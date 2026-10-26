import 'server-only';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import type { CmsAdapter } from './adapter';
import { isAllowedUploadPath, isAllowedUploadType, uploadPathMatchesType, withSettingsDefaults } from './defaults';
import { orphanedUrls, projectMediaUrls, settingsMediaUrls, uploadPathFromUrl } from './media-refs';
import { projectFields } from './rows';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, safeEqual, signSession, verifySession } from './session';
import { STALE_PROJECT_MESSAGE, type Project, type Settings } from './types';

/**
 * Local mode: content lives in .cms/content.json and uploads in public/uploads, both committed to git.
 * Reads work everywhere, so a deployment without Supabase still shows the seeded site; writes only work under
 * `npm run dev`, because a deployed filesystem is read-only and would forget every change anyway.
 */

interface Store {
  projects: Project[];
  settings: Settings;
}

const CONTENT_FILE = path.join(process.cwd(), '.cms', 'content.json');
const READ_ONLY_MESSAGE = 'Local mode is read-only in production. Connect Supabase to edit.';
const isProduction = process.env.NODE_ENV === 'production';

// ---- Reading and writing the file

async function readStoreFromDisk(): Promise<Store> {
  let raw: string;
  try {
    raw = await fs.readFile(CONTENT_FILE, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    // Expected before the first save in development; in production it means the file wasn't deployed.
    if (isProduction) console.warn(`[cms] ${CONTENT_FILE} not found, so the site has no projects. Run npm run cms:seed and commit .cms/.`);
    return { projects: [], settings: withSettingsDefaults(null) };
  }
  const parsed = JSON.parse(raw) as Partial<Store>;
  return {
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    settings: withSettingsDefaults(parsed.settings),
  };
}

// In production the file cannot change, so it is read once per server instance.
let productionStore: Promise<Store> | null = null;

function readStore(): Promise<Store> {
  if (!isProduction) return readStoreFromDisk();
  productionStore ??= readStoreFromDisk();
  return productionStore;
}

/** Writes to a temporary file and renames it over the old one, so a crash never leaves half a file behind. */
async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(path.dirname(CONTENT_FILE), { recursive: true });
  const temp = `${CONTENT_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  await fs.rename(temp, CONTENT_FILE);
}

/*
 * Writes run one at a time: each reads the latest file, changes it and writes it back before the next starts.
 * The queue lives on globalThis because the dev server can load this module more than once.
 */
const queueHolder = globalThis as typeof globalThis & { __nnCmsWriteQueue?: Promise<unknown> };

function mutate<T>(change: (store: Store) => T): Promise<T> {
  const run = (queueHolder.__nnCmsWriteQueue ?? Promise.resolve()).then(async () => {
    const store = await readStoreFromDisk();
    const result = change(store);
    await writeStore(store);
    return result;
  });
  queueHolder.__nnCmsWriteQueue = run.catch(() => undefined);
  return run;
}

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads');

function referencedUrls(store: Store): string[] {
  return [...store.projects.flatMap(projectMediaUrls), ...settingsMediaUrls(store.settings)];
}

/** Deletes admin uploads that nothing references any more. A file that's already gone is fine. */
async function removeUploads(urls: string[]): Promise<void> {
  for (const url of urls) {
    const relative = uploadPathFromUrl(url, '/uploads/');
    if (!relative) continue;
    const file = path.join(UPLOADS_ROOT, relative);
    if (!file.startsWith(UPLOADS_ROOT + path.sep)) continue;
    await fs.unlink(file).catch(() => undefined);
    // Drop the project's folder once it's empty; rmdir refuses non-empty folders, so nothing else can go.
    await fs.rmdir(path.dirname(file)).catch(() => undefined);
  }
}

function assertWritable(): void {
  if (isProduction) throw new Error(READ_ONLY_MESSAGE);
}

function byPosition(a: Project, b: Project): number {
  return a.position - b.position || a.createdAt.localeCompare(b.createdAt);
}

// ---- Auth

interface LocalCredentials {
  email: string;
  password: string;
  secret: string;
}

/** The three variables local sign-in needs, or the names of the ones that are missing. */
function readCredentials(): { ok: true; value: LocalCredentials } | { ok: false; missing: string[] } {
  const env = {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL?.trim() ?? '',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? '',
    LOCAL_SESSION_SECRET: process.env.LOCAL_SESSION_SECRET ?? '',
  };
  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    value: { email: env.ADMIN_EMAIL.toLowerCase(), password: env.ADMIN_PASSWORD, secret: env.LOCAL_SESSION_SECRET },
  };
}

async function sessionEmail(): Promise<string | null> {
  const credentials = readCredentials();
  if (!credentials.ok) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = verifySession(token, credentials.value.secret);
  // A session only counts for the admin email currently configured, so changing ADMIN_EMAIL signs everyone out.
  if (!session || !safeEqual(session.email, credentials.value.email)) return null;
  return session.email;
}

async function requireAdmin(): Promise<void> {
  if (!(await sessionEmail())) throw new Error('UNAUTHORIZED');
}

// ---- The adapter

export function createLocalAdapter(): CmsAdapter {
  return {
    mode: 'local',

    async listPublished() {
      const { projects } = await readStore();
      return projects.filter((p) => p.status === 'published').sort(byPosition);
    },

    async getPublishedBySlug(slug) {
      const { projects } = await readStore();
      return projects.find((p) => p.slug === slug && p.status === 'published') ?? null;
    },

    async getSettings() {
      return (await readStore()).settings;
    },

    async listAll() {
      await requireAdmin();
      const { projects } = await readStore();
      return [...projects].sort(byPosition);
    },

    async getById(id) {
      await requireAdmin();
      const { projects } = await readStore();
      return projects.find((p) => p.id === id) ?? null;
    },

    async saveProject(input) {
      await requireAdmin();
      assertWritable();
      const fields = projectFields(input);

      const { project, orphans } = await mutate((store) => {
        const clash = store.projects.find((p) => p.slug === fields.slug && p.id !== input.id);
        if (clash) throw new Error(`The web address "${fields.slug}" is already used by "${clash.title}".`);

        const now = new Date().toISOString();
        const firstPublish = fields.status === 'published' ? now : null;

        if (!input.id) {
          const created: Project = { ...fields, id: randomUUID(), createdAt: now, updatedAt: now, publishedAt: firstPublish };
          store.projects.push(created);
          return { project: created, orphans: [] as string[] };
        }

        const index = store.projects.findIndex((p) => p.id === input.id);
        if (index === -1) throw new Error('This project no longer exists. It may have been deleted in another tab.');
        const existing = store.projects[index];
        // Checked inside the write queue, so nothing can change the project between this check and the write.
        if (input.expectedUpdatedAt && existing.updatedAt !== input.expectedUpdatedAt) {
          throw new Error(STALE_PROJECT_MESSAGE);
        }
        const updated: Project = {
          ...fields,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: now,
          publishedAt: existing.publishedAt ?? firstPublish,
        };
        store.projects[index] = updated;
        return { project: updated, orphans: orphanedUrls(projectMediaUrls(existing), referencedUrls(store)) };
      });
      await removeUploads(orphans);
      return project;
    },

    async deleteProject(id) {
      await requireAdmin();
      assertWritable();
      const orphans = await mutate((store) => {
        const removed = store.projects.find((p) => p.id === id);
        store.projects = store.projects.filter((p) => p.id !== id);
        return removed ? orphanedUrls(projectMediaUrls(removed), referencedUrls(store)) : [];
      });
      await removeUploads(orphans);
    },

    async reorder(ids) {
      await requireAdmin();
      assertWritable();
      await mutate((store) => {
        const now = new Date().toISOString();
        ids.forEach((id, position) => {
          const project = store.projects.find((p) => p.id === id);
          if (project && project.position !== position) {
            project.position = position;
            project.updatedAt = now;
          }
        });
      });
    },

    async saveSettings(settings) {
      await requireAdmin();
      assertWritable();
      const { saved, orphans } = await mutate((store) => {
        const before = settingsMediaUrls(store.settings);
        store.settings = withSettingsDefaults({ ...settings, updatedAt: new Date().toISOString() });
        return { saved: store.settings, orphans: orphanedUrls(before, referencedUrls(store)) };
      });
      await removeUploads(orphans);
      return saved;
    },

    async createUpload(uploadPath, contentType) {
      await requireAdmin();
      assertWritable();
      if (!isAllowedUploadPath(uploadPath)) throw new Error(`"${uploadPath}" is not a valid upload path.`);
      if (!isAllowedUploadType(contentType)) throw new Error(`Files of type "${contentType}" can't be uploaded.`);
      if (!uploadPathMatchesType(uploadPath, contentType)) throw new Error(`"${uploadPath}" doesn't match its type, ${contentType}.`);
      return {
        mode: 'local',
        url: `/api/cms/local-upload?path=${encodeURIComponent(uploadPath)}`,
        publicUrl: `/uploads/${uploadPath}`,
      };
    },

    async signIn(email, password) {
      const credentials = readCredentials();
      if (!credentials.ok) {
        return {
          ok: false,
          error: `Local sign-in isn't set up: add ${credentials.missing.join(', ')} to .env.local and restart the dev server.`,
        };
      }
      // Both comparisons always run, so the response time doesn't reveal which one failed.
      const emailMatches = safeEqual(email.trim().toLowerCase(), credentials.value.email);
      const passwordMatches = safeEqual(password, credentials.value.password);
      if (!(emailMatches && passwordMatches)) return { ok: false, error: "That email and password don't match." };

      (await cookies()).set(SESSION_COOKIE, signSession(credentials.value.email, credentials.value.secret), {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
      });
      return { ok: true };
    },

    async signOut() {
      (await cookies()).delete(SESSION_COOKIE);
    },

    async currentAdmin() {
      const email = await sessionEmail();
      return email ? { email } : null;
    },
  };
}
