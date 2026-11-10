import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Draft, HomeDraft, Project } from '@/lib/cms/types';
import { MEDIA_KEY } from '@/lib/cms/defaults';
import { byteRange } from '@/lib/http-range';
import { readContent } from '@/lib/content/read';
import { HOME_PATH, REDIRECTS_PATH } from '@/lib/content/serialize';
import { RepoError, RepoMoved, type DeployedIndex, type DraftSummary, type MediaObject, type RepoHead, type Store } from './store';

/*
 * The admin's store under `npm run dev` (app/api/admin/[...path]/route.dev.ts): everything on this computer, no git
 * and no network.
 * - Drafts, the publish record and the session key in .drafts/ (gitignored).
 * - Uploads in public/uploads/p/<id>/, served by the site itself at /uploads/p/...; commit them with the content.
 * - "Deployed" is content/ as it is on disk, read again on every call.
 * - Publishing writes content/ straight away, so a publish is live at once. Each version of a file it replaces is
 *   kept in .drafts/blobs/, so Undo can put it back.
 * Films over 25 MiB go through the live admin, which uploads them in parts to R2.
 */

const MiB = 1024 * 1024;
const DEV_UPLOAD_MAX = 25 * MiB;

const blobSha = (bytes: Buffer | string) => {
  const buffer = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes;
  return createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
};
const etagOf = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 20);

/** ADMIN_PASSWORD from the environment, or from .dev.vars, which `npm run preview` reads too. */
function devPassword(root: string): string | undefined {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const file = path.join(root, '.dev.vars');
  if (!existsSync(file)) return undefined;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*ADMIN_PASSWORD\s*=\s*(.*)\s*$/);
    if (match) return match[1].replace(/^(["'])(.*)\1$/, '$2') || undefined;
  }
  return undefined;
}

async function readText(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

/** Writes through a temporary file, so a reader never sees half a file. */
async function writeAtomic(file: string, text: string | Buffer): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, text);
  await rename(temp, file);
}

async function walk(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (!entry.name.endsWith('.tmp')) files.push(full);
  }
  return files;
}

const META_KEY = /^(publish\/latest|auth\/session-key|auth\/failures|builds\/[0-9a-f]{7,40})(\.json)?$/;

export function fileStore(root = process.cwd()): Store {
  const DRAFTS = path.join(root, '.drafts');
  const draftFile = (id: string) => path.join(DRAFTS, 'drafts', `${id}.json`);
  const HOME_DRAFT = path.join(DRAFTS, 'drafts', '_home.json');
  const UPLOADS = path.join(root, 'public', 'uploads');
  const mediaFile = (key: string) => path.join(UPLOADS, ...key.split('/'));

  async function getStored<T>(file: string): Promise<{ value: T; etag: string } | null> {
    const text = await readText(file);
    if (text === null) return null;
    return { value: JSON.parse(text) as T, etag: etagOf(text) };
  }

  async function putStored(file: string, value: unknown, ifMatch: string | null): Promise<string | null> {
    const current = await readText(file);
    if (ifMatch === null ? current !== null : current === null || etagOf(current) !== ifMatch) return null;
    const text = `${JSON.stringify(value, null, 2)}\n`;
    await writeAtomic(file, text);
    return etagOf(text);
  }

  // ---------------------------------------------------------------- content/ as the "repository"
  async function contentFiles(): Promise<Record<string, Buffer>> {
    const files: Record<string, Buffer> = {};
    for (const full of await walk(path.join(root, 'content'))) {
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (rel.endsWith('.json')) files[rel] = await readFile(full);
    }
    return files;
  }

  const commitOf = (shas: Record<string, string>) =>
    createHash('sha1')
      .update(Object.keys(shas).sort().map((p) => `${p} ${shas[p]}`).join('\n'))
      .digest('hex');

  async function keepBlob(bytes: Buffer | string): Promise<string> {
    const sha = blobSha(bytes);
    const file = path.join(DRAFTS, 'blobs', sha);
    if (!existsSync(file)) await writeAtomic(file, bytes);
    return sha;
  }

  async function readHead(): Promise<RepoHead> {
    const files = await contentFiles();
    const shas: Record<string, string> = {};
    for (const [file, bytes] of Object.entries(files)) shas[file] = blobSha(bytes);
    const commit = commitOf(shas);
    return {
      commit,
      tree: commit,
      files: shas,
      homeJson: files[HOME_PATH]?.toString('utf8') ?? '{"highlights":[],"order":[]}\n',
      redirectsJson: files[REDIRECTS_PATH]?.toString('utf8') ?? '{}\n',
    };
  }

  async function writeContent(head: RepoHead, entries: { path: string; content: string | Buffer | null }[]): Promise<string> {
    const now = await readHead();
    if (now.commit !== head.commit) throw new RepoMoved();
    for (const entry of entries) {
      const full = path.join(root, ...entry.path.split('/'));
      const before = await readFile(full).catch(() => null);
      if (before) await keepBlob(before);
      if (entry.content === null) await unlink(full).catch(() => {});
      else {
        await keepBlob(entry.content);
        await writeAtomic(full, entry.content);
      }
    }
    return (await readHead()).commit;
  }

  async function summaryOf(id: string): Promise<DraftSummary | null> {
    const stored = await getStored<Draft>(draftFile(id));
    if (!stored) return null;
    const { project, state, action, savedAt, base, commit } = stored.value;
    const cover = project.cover;
    return {
      id,
      etag: stored.etag,
      title: project.title,
      slug: project.slug,
      state,
      action,
      savedAt,
      base,
      ...(commit ? { commit } : {}),
      ...(cover?.srcSmall || cover?.poster || cover?.src ? { thumb: cover.kind === 'video' ? cover.poster || '' : cover.srcSmall || cover.src } : {}),
      meta: [project.discipline, project.year].filter(Boolean).join(' · '),
    };
  }

  const store: Store = {
    config: {
      cookieName: 'nn_admin_dev',
      secureCookie: false,
      adminPassword: devPassword(root),
      mediaOrigin: '',
      maxUploadBytes: DEV_UPLOAD_MAX,
      tooBigMessage: 'Big films go through the live admin.',
      multipart: false,
      devServer: true,
    },

    drafts: {
      get: (id) => getStored<Draft>(draftFile(id)),
      put: (id, draft, ifMatch) => putStored(draftFile(id), draft, ifMatch),
      delete: async (id) => {
        await unlink(draftFile(id)).catch(() => {});
      },
      async list() {
        let names: string[] = [];
        try {
          names = await readdir(path.join(DRAFTS, 'drafts'));
        } catch {
          return [];
        }
        const ids = names.filter((n) => n.endsWith('.json') && !n.startsWith('_')).map((n) => n.slice(0, -5));
        const summaries = await Promise.all(ids.map(summaryOf));
        return summaries.filter((s): s is DraftSummary => s !== null);
      },
    },

    homeDraft: {
      get: () => getStored<HomeDraft>(HOME_DRAFT),
      put: (draft, ifMatch) => putStored(HOME_DRAFT, draft, ifMatch),
      delete: async () => {
        await unlink(HOME_DRAFT).catch(() => {});
      },
    },

    meta: {
      async get<T>(key: string) {
        if (!META_KEY.test(key)) return null;
        const text = await readText(path.join(DRAFTS, 'meta', ...key.split('/')));
        return text === null ? null : (JSON.parse(text) as T);
      },
      async put(key, value) {
        if (!META_KEY.test(key)) throw new Error('Not a meta key.');
        await writeAtomic(path.join(DRAFTS, 'meta', ...key.split('/')), JSON.stringify(value));
      },
      async getStored<T>(key: string) {
        if (!META_KEY.test(key)) return null;
        return getStored<T>(path.join(DRAFTS, 'meta', ...key.split('/')));
      },
      async putIf(key, value, ifMatch) {
        if (!META_KEY.test(key)) throw new Error('Not a meta key.');
        return (await putStored(path.join(DRAFTS, 'meta', ...key.split('/')), value, ifMatch)) !== null;
      },
    },

    media: {
      async put(key, body, length, contentType) {
        void contentType;
        if (!MEDIA_KEY.test(key)) throw new Error('Not an upload key.');
        if (length > DEV_UPLOAD_MAX) throw new RepoError('Big films go through the live admin.', 413);
        const bytes = Buffer.from(await new Response(body).arrayBuffer());
        if (bytes.length !== length) throw new RepoError('The upload arrived incomplete. Try again.', 400);
        await writeAtomic(mediaFile(key), bytes);
      },
      async startMultipart() {
        throw new RepoError('Big films go through the live admin.', 413);
      },
      async uploadPart() {
        throw new RepoError('Big films go through the live admin.', 413);
      },
      async finishMultipart() {
        throw new RepoError('Big films go through the live admin.', 413);
      },
      async abortMultipart() {},
      async head(key) {
        if (!MEDIA_KEY.test(key)) return null;
        try {
          const info = await stat(mediaFile(key));
          return { key, size: info.size, uploaded: info.mtime };
        } catch {
          return null;
        }
      },
      async find(keys) {
        const found = new Map<string, MediaObject>();
        for (const key of new Set(keys)) {
          const object = await store.media.head(key);
          if (object) found.set(key, object);
        }
        return found;
      },
      async serve(key, request) {
        const object = MEDIA_KEY.test(key) ? await store.media.head(key) : null;
        if (!object) return new Response('Not found.', { status: 404 });
        const extension = key.slice(key.lastIndexOf('.') + 1);
        const type =
          { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', avif: 'image/avif', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }[extension] ??
          'application/octet-stream';
        const etag = `"${object.size}-${object.uploaded.getTime()}"`;
        const headers = new Headers({ 'content-type': type, 'accept-ranges': 'bytes', etag, 'x-content-type-options': 'nosniff' });
        if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
        const range = byteRange(request.headers.get('range'), object.size);
        if (range === 'unsatisfiable') {
          headers.set('content-range', `bytes */${object.size}`);
          return new Response(null, { status: 416, headers });
        }
        const start = range?.start ?? 0;
        const end = range?.end ?? object.size - 1;
        headers.set('content-length', String(end - start + 1));
        if (range) headers.set('content-range', `bytes ${start}-${end}/${object.size}`);
        const body = request.method === 'HEAD' ? null : (await readFile(mediaFile(key))).subarray(start, end + 1);
        return new Response(body, { status: range ? 206 : 200, headers });
      },
      async list() {
        const objects: MediaObject[] = [];
        for (const full of await walk(path.join(UPLOADS, 'p'))) {
          const key = path.relative(UPLOADS, full).split(path.sep).join('/');
          if (!MEDIA_KEY.test(key)) continue;
          const info = await stat(full);
          objects.push({ key, size: info.size, uploaded: info.mtime });
        }
        return { objects, truncated: false };
      },
      async delete(keys) {
        for (const key of keys) if (MEDIA_KEY.test(key)) await rm(mediaFile(key), { force: true });
      },
      url: (key) => `/uploads/${key}`,
      keyOf(url) {
        if (!url.startsWith('/uploads/')) return null;
        const key = url.slice('/uploads/'.length).split(/[?#]/)[0];
        return MEDIA_KEY.test(key) ? key : null;
      },
    },

    async adminUsage() {
      let bytes = 0;
      const files = await walk(DRAFTS);
      for (const file of files) bytes += (await stat(file)).size;
      return { bytes, objects: files.length };
    },

    deployed: {
      async index(): Promise<DeployedIndex> {
        const files = await contentFiles();
        const out: DeployedIndex['files'] = {};
        const shas: Record<string, string> = {};
        for (const file of Object.keys(files).sort()) {
          shas[file] = blobSha(files[file]);
          let id: string | undefined;
          if (file.startsWith('content/projects/')) {
            try {
              id = (JSON.parse(files[file].toString('utf8')) as Project).id;
            } catch {
              id = undefined;
            }
          }
          out[file] = id ? { id, blobSha: shas[file] } : { blobSha: shas[file] };
        }
        return { commit: commitOf(shas), builtAt: new Date().toISOString(), files: out };
      },
      async published() {
        return { projects: readContent(root).projects };
      },
    },

    repo: {
      readHead,
      commit: (head, change) =>
        writeContent(head, [...change.writes.map((w) => ({ path: w.path, content: w.content })), ...change.deletes.map((d) => ({ path: d, content: null }))]),
      emptyCommit: async () => (await readHead()).commit,
      async restore(head, entries) {
        const resolved: { path: string; content: Buffer | null }[] = [];
        for (const entry of entries) {
          if (entry.blobSha === null) resolved.push({ path: entry.path, content: null });
          else {
            const bytes = await readFile(path.join(DRAFTS, 'blobs', entry.blobSha)).catch(() => null);
            if (!bytes) throw new RepoError("The earlier version of that file isn't kept on this computer.", 409);
            resolved.push({ path: entry.path, content: bytes });
          }
        }
        return writeContent(head, resolved);
      },
    },
  };
  return store;
}
