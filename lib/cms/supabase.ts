import 'server-only';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { createPublicClient, createSessionClient } from '@/lib/supabase/server';
import type { CmsAdapter } from './adapter';
import { isAllowedUploadPath, isAllowedUploadType, uploadPathMatchesType, withSettingsDefaults } from './defaults';
import { orphanedUrls, projectMediaUrls, settingsMediaUrls, uploadPathFromUrl } from './media-refs';
import { projectFields, projectFromRow, projectToRow, type ProjectRow, type SettingsRow } from './rows';
import { STALE_PROJECT_MESSAGE, type Block, type Media, type Settings } from './types';

/**
 * Supabase mode: Postgres for content, Storage for media, Auth for the admin.
 * Public reads go through an anonymous client; admin calls go through the visitor's own session, so Row Level
 * Security (supabase/migrations/0001_init.sql) enforces the same rules this file checks.
 */

const BUCKET = 'media';
const PROJECT_GONE_MESSAGE = 'This project no longer exists. It may have been deleted in another tab.';

/** Project ids are Postgres uuids. Anything else (a mistyped admin URL) matches no row, and Postgres would reject it. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Turns a database error into one the editor can act on. RLS refusals become the adapter's UNAUTHORIZED. */
function databaseError(action: string, error: PostgrestError, slug?: string): Error {
  if (error.code === '42501') return new Error('UNAUTHORIZED');
  if (error.code === '23505' && slug) return new Error(`The web address "${slug}" is already used by another project.`);
  return new Error(`${action}: ${error.message}`);
}

async function isAdmin(client: SupabaseClient, userId: string): Promise<boolean> {
  // RLS lets a user read only their own row in public.admins, so this finds a row exactly when they are an admin.
  const { data, error } = await client.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  return !error && data !== null;
}

/** The signed-in admin's client and email, or null for visitors and for users who aren't admins. */
async function adminSession(): Promise<{ client: SupabaseClient; email: string } | null> {
  const client = await createSessionClient();
  // getUser() checks the token with Supabase Auth instead of trusting the cookie.
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user || !(await isAdmin(client, user.id))) return null;
  return { client, email: user.email ?? '' };
}

async function requireAdmin(): Promise<SupabaseClient> {
  const session = await adminSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session.client;
}

function settingsFromRow(row: Pick<SettingsRow, 'data' | 'updated_at'> | null): Settings {
  if (!row) return withSettingsDefaults(null);
  return withSettingsDefaults({ ...(row.data as Partial<Settings>), updatedAt: row.updated_at });
}

const PUBLIC_PREFIX = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/`;

/** Every file URL still used by any project or by the site settings. */
async function referencedUrls(client: SupabaseClient): Promise<string[]> {
  const [projects, settings] = await Promise.all([
    client.from('projects').select('cover, blocks'),
    client.from('settings').select('data, updated_at').eq('id', 1).maybeSingle(),
  ]);
  if (projects.error) throw projects.error;
  if (settings.error) throw settings.error;
  const rows = (projects.data ?? []) as { cover: Media | null; blocks: Block[] | null }[];
  return [
    ...rows.flatMap((row) => projectMediaUrls({ cover: row.cover, blocks: row.blocks ?? [] })),
    ...settingsMediaUrls(settingsFromRow(settings.data as SettingsRow | null)),
  ];
}

/** Removes uploads that were in `before` and are no longer used anywhere. Best effort: a failure never blocks a save. */
async function removeOrphans(client: SupabaseClient, before: string[]): Promise<void> {
  try {
    const paths = orphanedUrls(before, await referencedUrls(client))
      .map((url) => uploadPathFromUrl(url, PUBLIC_PREFIX))
      .filter((p): p is string => p !== null);
    if (paths.length > 0) await client.storage.from(BUCKET).remove(paths);
  } catch (error) {
    console.warn('[cms] Could not tidy up unused uploads:', error);
  }
}

export function createSupabaseAdapter(): CmsAdapter {
  return {
    mode: 'supabase',

    async listPublished() {
      const { data, error } = await createPublicClient()
        .from('projects')
        .select('*')
        .eq('status', 'published')
        .order('position')
        .order('created_at');
      if (error) throw databaseError('Could not load projects', error);
      return (data as ProjectRow[]).map(projectFromRow);
    },

    async getPublishedBySlug(slug) {
      const { data, error } = await createPublicClient()
        .from('projects')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
      if (error) throw databaseError('Could not load the project', error);
      return data ? projectFromRow(data as ProjectRow) : null;
    },

    async getSettings() {
      const { data, error } = await createPublicClient().from('settings').select('data, updated_at').eq('id', 1).maybeSingle();
      if (error) throw databaseError('Could not load site settings', error);
      return settingsFromRow(data as SettingsRow | null);
    },

    async listAll() {
      const client = await requireAdmin();
      const { data, error } = await client.from('projects').select('*').order('position').order('created_at');
      if (error) throw databaseError('Could not load projects', error);
      return (data as ProjectRow[]).map(projectFromRow);
    },

    async getById(id) {
      const client = await requireAdmin();
      if (!UUID_PATTERN.test(id)) return null;
      const { data, error } = await client.from('projects').select('*').eq('id', id).maybeSingle();
      if (error) throw databaseError('Could not load the project', error);
      return data ? projectFromRow(data as ProjectRow) : null;
    },

    async saveProject(input) {
      const client = await requireAdmin();
      const fields = projectFields(input);
      const row = projectToRow(fields);
      // updated_at and the first published_at are set by the projects_before_write trigger.

      if (!input.id) {
        const { data, error } = await client.from('projects').insert(row).select('*').single();
        if (error) throw databaseError('Could not create the project', error, fields.slug);
        return projectFromRow(data as ProjectRow);
      }

      if (!UUID_PATTERN.test(input.id)) throw new Error(PROJECT_GONE_MESSAGE);
      const { data: previous } = await client.from('projects').select('cover, blocks').eq('id', input.id).maybeSingle();
      let update = client.from('projects').update(row).eq('id', input.id);
      // Only overwrite the version the editor loaded. The string goes to Postgres exactly as it came back from it:
      // timestamptz keeps microseconds, and a round trip through a JS Date would drop them so it never matched.
      if (input.expectedUpdatedAt) update = update.eq('updated_at', input.expectedUpdatedAt);
      const { data, error } = await update.select('*').maybeSingle();
      if (error) {
        // 22007 and 22008: expectedUpdatedAt isn't a timestamp at all, so it can't be the stored version.
        if (input.expectedUpdatedAt && (error.code === '22007' || error.code === '22008')) {
          throw new Error(STALE_PROJECT_MESSAGE);
        }
        throw databaseError('Could not save the project', error, fields.slug);
      }
      if (!data) {
        // No row matched: either the project is gone, or it changed after the editor loaded it.
        const { data: current } = await client.from('projects').select('id').eq('id', input.id).maybeSingle();
        throw new Error(current ? STALE_PROJECT_MESSAGE : PROJECT_GONE_MESSAGE);
      }
      if (previous) {
        const old = previous as { cover: Media | null; blocks: Block[] | null };
        await removeOrphans(client, projectMediaUrls({ cover: old.cover, blocks: old.blocks ?? [] }));
      }
      return projectFromRow(data as ProjectRow);
    },

    async deleteProject(id) {
      const client = await requireAdmin();
      // Not an id any project can have, so there is nothing to delete (like a missing id in local mode).
      if (!UUID_PATTERN.test(id)) return;
      const { data: previous } = await client.from('projects').select('cover, blocks').eq('id', id).maybeSingle();
      const { error } = await client.from('projects').delete().eq('id', id);
      if (error) throw databaseError('Could not delete the project', error);
      if (previous) {
        const old = previous as { cover: Media | null; blocks: Block[] | null };
        await removeOrphans(client, projectMediaUrls({ cover: old.cover, blocks: old.blocks ?? [] }));
      }
    },

    async reorder(ids) {
      const client = await requireAdmin();
      // One statement in the database, so a half-finished reorder can't leave two projects in the same place.
      const { error } = await client.rpc('reorder_projects', { ids });
      if (error) throw databaseError('Could not save the new order', error);
    },

    async saveSettings(settings) {
      const client = await requireAdmin();
      const { updatedAt: _ignored, ...data } = withSettingsDefaults(settings);
      const { data: previous } = await client.from('settings').select('data, updated_at').eq('id', 1).maybeSingle();
      const { data: row, error } = await client
        .from('settings')
        .upsert({ id: 1, data })
        .select('data, updated_at')
        .single();
      if (error) throw databaseError('Could not save site settings', error);
      if (previous) await removeOrphans(client, settingsMediaUrls(settingsFromRow(previous as SettingsRow)));
      return settingsFromRow(row as SettingsRow);
    },

    async createUpload(path, contentType) {
      const client = await requireAdmin();
      if (!isAllowedUploadPath(path)) throw new Error(`"${path}" is not a valid upload path.`);
      if (!isAllowedUploadType(contentType)) throw new Error(`Files of type "${contentType}" can't be uploaded.`);
      if (!uploadPathMatchesType(path, contentType)) throw new Error(`"${path}" doesn't match its type, ${contentType}.`);

      // Never overwrite: public files are cached by Supabase's CDN, so a replaced file would keep showing the old one.
      const bucket = client.storage.from(BUCKET);
      const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false });
      if (error) throw new Error(`Could not prepare the upload: ${error.message}`);
      return {
        mode: 'supabase',
        bucket: BUCKET,
        path: data.path,
        token: data.token,
        publicUrl: bucket.getPublicUrl(data.path).data.publicUrl,
      };
    },

    async signIn(email, password) {
      const client = await createSessionClient();
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) {
        const mismatch = !error || error.code === 'invalid_credentials';
        return { ok: false, error: mismatch ? "That email and password don't match." : error.message };
      }
      if (!(await isAdmin(client, data.user.id))) {
        await client.auth.signOut();
        return { ok: false, error: "This account isn't an admin for this site." };
      }
      return { ok: true };
    },

    async signOut() {
      const client = await createSessionClient();
      await client.auth.signOut();
    },

    async currentAdmin() {
      const session = await adminSession();
      return session ? { email: session.email } : null;
    },
  };
}
