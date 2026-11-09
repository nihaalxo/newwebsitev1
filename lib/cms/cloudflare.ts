import 'server-only';
import type { CmsAdapter } from './adapter';
import { R2_PREFIX, R2_PUBLIC_PREFIX, type CmsCloudflareEnv, type CmsD1Database, type CmsR2Bucket } from './cloudflare-env';
import { isAllowedUploadPath, isAllowedUploadType, uploadPathMatchesType, withSettingsDefaults } from './defaults';
import { orphanedUrls, projectMediaUrls, settingsMediaUrls, uploadPathFromUrl } from './media-refs';
import { passwordAuth } from './password-auth';
import { projectFields, projectFromRow, projectToRow, type ProjectRow } from './rows';
import { STALE_PROJECT_MESSAGE, type Block, type Media, type Project, type Settings } from './types';

/*
 * Cloudflare mode: projects and settings in D1 (binding CMS_DB, schema in d1/migrations), uploads in R2 (binding
 * CMS_UPLOADS, under "cms/", served by app/cms/[...path]/route.ts at /cms/...), and one admin whose email, password
 * and session secret are Worker secrets. Created per request, because the bindings belong to the request.
 */

const PROJECT_GONE_MESSAGE = 'This project no longer exists. It may have been deleted in another tab.';

/** A projects row as D1 returns it: JSON as text, booleans as 0/1. */
interface D1ProjectRow extends Omit<ProjectRow, 'cover' | 'blocks' | 'featured' | 'still_only'> {
  cover: string | null;
  blocks: string;
  featured: number;
  still_only: number;
}

interface D1SettingsRow {
  data: string;
  updated_at: string;
}

function parseJson<T>(text: string | null, fallback: T): T {
  if (text === null) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function fromD1(row: D1ProjectRow): Project {
  return projectFromRow({
    ...row,
    cover: parseJson<Media | null>(row.cover, null),
    blocks: parseJson<Block[]>(row.blocks, []),
    featured: row.featured === 1,
    still_only: row.still_only === 1,
  });
}

function settingsFromD1(row: D1SettingsRow | null): Settings {
  if (!row) return withSettingsDefaults(null);
  return withSettingsDefaults({ ...parseJson<Partial<Settings>>(row.data, {}), updatedAt: row.updated_at });
}

/** The columns a save writes, in the order WRITE_COLUMNS lists them. */
const WRITE_COLUMNS = [
  'slug',
  'title',
  'category',
  'year',
  'discipline',
  'summary',
  'shown',
  'still_only',
  'cover',
  'accent',
  'role',
  'project_type',
  'tools',
  'deliverables',
  'link',
  'featured',
  'position',
  'status',
  'blocks',
] as const;

function writeValues(project: ReturnType<typeof projectToRow>): unknown[] {
  const row: Record<(typeof WRITE_COLUMNS)[number], unknown> = {
    ...project,
    shown: project.shown ?? '',
    still_only: project.still_only ? 1 : 0,
    featured: project.featured ? 1 : 0,
    cover: project.cover ? JSON.stringify(project.cover) : null,
    blocks: JSON.stringify(project.blocks),
  };
  return WRITE_COLUMNS.map((column) => row[column]);
}

function byPosition(a: Project, b: Project): number {
  return a.position - b.position || a.createdAt.localeCompare(b.createdAt);
}

async function allReferencedUrls(db: CmsD1Database): Promise<string[]> {
  const [{ results }, settings] = await Promise.all([
    db.prepare('SELECT cover, blocks FROM projects').all<{ cover: string | null; blocks: string }>(),
    db.prepare('SELECT data, updated_at FROM settings WHERE id = 1').first<D1SettingsRow>(),
  ]);
  const projectUrls = results.flatMap((row) =>
    projectMediaUrls({ cover: parseJson<Media | null>(row.cover, null), blocks: parseJson<Block[]>(row.blocks, []) }),
  );
  return [...projectUrls, ...settingsMediaUrls(settingsFromD1(settings))];
}

/** Deletes uploads from R2 that nothing references any more. Tidying never fails a save. */
async function removeOrphans(db: CmsD1Database, bucket: CmsR2Bucket, before: string[]): Promise<void> {
  try {
    const candidates = before.filter((url) => uploadPathFromUrl(url, R2_PUBLIC_PREFIX));
    if (candidates.length === 0) return;
    const keys = orphanedUrls(candidates, await allReferencedUrls(db))
      .map((url) => uploadPathFromUrl(url, R2_PUBLIC_PREFIX))
      .filter((path): path is string => Boolean(path))
      .map((path) => `${R2_PREFIX}${path}`);
    if (keys.length > 0) await bucket.delete(keys);
  } catch (error) {
    console.warn('[cms] Could not tidy up unused uploads:', error);
  }
}

export function createCloudflareAdapter(env: CmsCloudflareEnv): CmsAdapter {
  const db = env.CMS_DB;
  const bucket = env.CMS_UPLOADS;
  const auth = passwordAuth({
    // OpenNext also copies Worker secrets into process.env; the bindings object is the source of truth.
    env: () => ({
      ADMIN_EMAIL: env.ADMIN_EMAIL ?? process.env.ADMIN_EMAIL,
      ADMIN_PASSWORD: env.ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD,
      LOCAL_SESSION_SECRET: env.LOCAL_SESSION_SECRET ?? process.env.LOCAL_SESSION_SECRET,
    }),
    secure: true,
    setupHint: "the Worker's secrets (npx wrangler secret put NAME), or to .dev.vars for the local preview",
  });

  async function projectById(id: string): Promise<Project | null> {
    const row = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<D1ProjectRow>();
    return row ? fromD1(row) : null;
  }

  return {
    mode: 'cloudflare',

    async listPublished() {
      const { results } = await db
        .prepare("SELECT * FROM projects WHERE status = 'published' ORDER BY position, created_at")
        .all<D1ProjectRow>();
      return results.map(fromD1);
    },

    async getPublishedBySlug(slug) {
      const row = await db
        .prepare("SELECT * FROM projects WHERE slug = ? AND status = 'published'")
        .bind(slug)
        .first<D1ProjectRow>();
      return row ? fromD1(row) : null;
    },

    async getSettings() {
      return settingsFromD1(await db.prepare('SELECT data, updated_at FROM settings WHERE id = 1').first<D1SettingsRow>());
    },

    async listAll() {
      await auth.requireAdmin();
      const { results } = await db.prepare('SELECT * FROM projects ORDER BY position, created_at').all<D1ProjectRow>();
      return results.map(fromD1).sort(byPosition);
    },

    async getById(id) {
      await auth.requireAdmin();
      return projectById(id);
    },

    async saveProject(input) {
      await auth.requireAdmin();
      const fields = projectFields(input);
      const values = writeValues(projectToRow(fields));
      const now = new Date().toISOString();
      const firstPublish = fields.status === 'published' ? now : null;

      const clash = await db
        .prepare('SELECT title FROM projects WHERE slug = ? AND id <> ?')
        .bind(fields.slug, input.id ?? '')
        .first<{ title: string }>();
      if (clash) throw new Error(`The web address "${fields.slug}" is already used by "${clash.title}".`);

      if (!input.id) {
        const id = crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO projects (id, ${WRITE_COLUMNS.join(', ')}, created_at, updated_at, published_at)
             VALUES (?, ${WRITE_COLUMNS.map(() => '?').join(', ')}, ?, ?, ?)`,
          )
          .bind(id, ...values, now, now, firstPublish)
          .run();
        const created = await projectById(id);
        if (!created) throw new Error('The project was saved but could not be read back. Reload the page.');
        return created;
      }

      const previous = await projectById(input.id);
      if (!previous) throw new Error(PROJECT_GONE_MESSAGE);
      // Only overwrite the version the editor loaded: the row must still carry the updated_at it was read with.
      const guard = input.expectedUpdatedAt ? ' AND updated_at = ?' : '';
      const result = await db
        .prepare(
          `UPDATE projects SET ${WRITE_COLUMNS.map((c) => `${c} = ?`).join(', ')},
             updated_at = ?, published_at = COALESCE(published_at, ?)
           WHERE id = ?${guard}`,
        )
        .bind(...values, now, firstPublish, input.id, ...(input.expectedUpdatedAt ? [input.expectedUpdatedAt] : []))
        .run();
      if (!result.meta.changes) {
        throw new Error((await projectById(input.id)) ? STALE_PROJECT_MESSAGE : PROJECT_GONE_MESSAGE);
      }
      await removeOrphans(db, bucket, projectMediaUrls(previous));
      const saved = await projectById(input.id);
      if (!saved) throw new Error(PROJECT_GONE_MESSAGE);
      return saved;
    },

    async deleteProject(id) {
      await auth.requireAdmin();
      const previous = await projectById(id);
      if (!previous) return;
      await db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
      await removeOrphans(db, bucket, projectMediaUrls(previous));
    },

    async reorder(ids) {
      await auth.requireAdmin();
      if (ids.length === 0) return;
      const now = new Date().toISOString();
      // One batch is one transaction, so a half-finished reorder can't leave two projects in the same place.
      await db.batch(
        ids.map((id, position) =>
          db
            .prepare('UPDATE projects SET position = ?, updated_at = ? WHERE id = ? AND position <> ?')
            .bind(position, now, id, position),
        ),
      );
    },

    async saveSettings(settings) {
      await auth.requireAdmin();
      const { updatedAt: _ignored, ...data } = withSettingsDefaults(settings);
      const previous = await db.prepare('SELECT data, updated_at FROM settings WHERE id = 1').first<D1SettingsRow>();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO settings (id, data, updated_at) VALUES (1, ?, ?)
           ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        )
        .bind(JSON.stringify(data), now)
        .run();
      if (previous) await removeOrphans(db, bucket, settingsMediaUrls(settingsFromD1(previous)));
      return withSettingsDefaults({ ...data, updatedAt: now });
    },

    async createUpload(path, contentType) {
      await auth.requireAdmin();
      if (!isAllowedUploadPath(path)) throw new Error(`"${path}" is not a valid upload path.`);
      if (!isAllowedUploadType(contentType)) throw new Error(`Files of type "${contentType}" can't be uploaded.`);
      if (!uploadPathMatchesType(path, contentType)) throw new Error(`"${path}" doesn't match its type, ${contentType}.`);
      return {
        mode: 'cloudflare',
        url: `/api/cms/upload?path=${encodeURIComponent(path)}`,
        publicUrl: `${R2_PUBLIC_PREFIX}${path}`,
      };
    },

    signIn: auth.signIn,
    signOut: auth.signOut,
    currentAdmin: auth.currentAdmin,
  };
}
