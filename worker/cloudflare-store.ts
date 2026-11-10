import { MEDIA_KEY, SINGLE_PUT_MAX } from '../lib/cms/defaults';
import { serveUpload, type R2Readable } from '../lib/cms/r2-files';
import { githubRepo } from '../lib/admin-api/github';
import { RepoError, type DeployedIndex, type DraftSummary, type MediaObject, type Store } from '../lib/admin-api/store';
import type { Draft, HomeDraft, Project } from '../lib/cms/types';

/*
 * The admin's store on Cloudflare (lib/admin-api/store.ts):
 * - ADMIN (R2 bucket nihaalnazeer-admin, private): drafts/<id>.json, each with the few fields the project list needs
 *   as custom metadata so one list call draws it; drafts/_home.json; publish/latest.json; auth/session-key;
 *   auth/failures.json; builds/<commit>.json, written by scripts/ci.mjs.
 * - MEDIA (R2 bucket nihaalnazeer-media): the uploads, served to visitors at MEDIA_ORIGIN (the bucket's custom domain).
 * - The deployed content: admin/data/index.json and published.json from this Worker's own static assets.
 * - Publishing: lib/admin-api/github.ts, with the GITHUB_TOKEN secret.
 */

type WorkerEnv = Env & { ADMIN_PASSWORD?: string; GITHUB_TOKEN?: string; GITHUB_API?: string };

const HOME_KEY = 'drafts/_home.json';
const draftKey = (id: string) => `drafts/${id}.json`;
const LIST_LIMIT = 1000;
const NO_TOKEN = 'Publishing is not set up yet: the GITHUB_TOKEN secret is missing (GO-LIVE.md)';

/** A stream of exactly `length` bytes, which R2 needs to store a stream. */
function fixedLength(body: ReadableStream<Uint8Array>, length: number): ReadableStream<Uint8Array> {
  const { readable, writable } = new FixedLengthStream(length);
  body.pipeTo(writable).catch(() => {});
  return readable;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The list fields, kept within R2's 2 KB of custom metadata. */
function metadataOf(draft: Draft): Record<string, string> {
  const { project, state, action, savedAt, base, commit } = draft;
  const cover = project.cover;
  const thumb = cover ? (cover.kind === 'video' ? cover.poster ?? '' : cover.srcSmall || cover.src) : '';
  return {
    title: clip(project.title, 200),
    slug: project.slug,
    state,
    action,
    savedAt,
    base: base ? `${base.path}@${base.blobSha}` : '',
    commit: commit ?? '',
    thumb: thumb.length <= 600 ? thumb : '',
    meta: clip([project.discipline, project.year].filter(Boolean).join(' · '), 200),
  };
}

function summaryOf(object: R2Object): DraftSummary | null {
  const id = object.key.slice('drafts/'.length, -'.json'.length);
  const m = object.customMetadata ?? {};
  if (!m.state || !m.action) return null;
  const at = m.base ? m.base.lastIndexOf('@') : -1;
  return {
    id,
    etag: object.etag,
    title: m.title ?? '',
    slug: m.slug ?? '',
    state: m.state as Draft['state'],
    action: m.action as Draft['action'],
    savedAt: m.savedAt ?? object.uploaded.toISOString(),
    base: at > 0 ? { path: m.base.slice(0, at), blobSha: m.base.slice(at + 1) } : null,
    ...(m.commit ? { commit: m.commit } : {}),
    ...(m.thumb ? { thumb: m.thumb } : {}),
    ...(m.meta ? { meta: m.meta } : {}),
  };
}

async function listAll(bucket: R2Bucket, prefix: string, maxPages: number, include: ('customMetadata' | 'httpMetadata')[] = []) {
  const objects: R2Object[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const result = await bucket.list({ prefix, cursor, limit: LIST_LIMIT, include });
    objects.push(...result.objects);
    if (!result.truncated) return { objects, truncated: false };
    cursor = result.cursor;
  }
  return { objects, truncated: true };
}

/** Puts JSON under `key`: `ifMatch` null only if there is nothing there yet. Resolves to the new etag, or null. */
async function putJson(bucket: R2Bucket, key: string, value: unknown, ifMatch: string | null, customMetadata?: Record<string, string>): Promise<string | null> {
  if (ifMatch === null && (await bucket.head(key))) return null;
  const object = await bucket.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: 'application/json' },
    ...(customMetadata ? { customMetadata } : {}),
    ...(ifMatch ? { onlyIf: { etagMatches: ifMatch } } : {}),
  });
  return object ? object.etag : null;
}

async function getJson<T>(bucket: R2Bucket, key: string): Promise<{ value: T; etag: string } | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  return { value: (await object.json()) as T, etag: object.etag };
}

async function asset<T>(env: WorkerEnv, path: string): Promise<T> {
  const response = await env.ASSETS.fetch(new Request(`https://assets.local${path}`));
  if (!response.ok) throw new Error(`${path} is missing from the build (${response.status})`);
  return (await response.json()) as T;
}

export function cloudflareStore(env: WorkerEnv): Store {
  const mediaOrigin = (env.MEDIA_ORIGIN || 'https://media.nihaalnazeer.com').replace(/\/+$/, '');
  const repo = env.GITHUB_TOKEN
    ? githubRepo({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || 'main', api: env.GITHUB_API || undefined })
    : null;
  const noRepo = (): never => {
    throw new RepoError(NO_TOKEN, 503);
  };

  const store: Store = {
    config: {
      cookieName: '__Host-nn_admin',
      secureCookie: true,
      adminPassword: env.ADMIN_PASSWORD || undefined,
      mediaOrigin,
      maxUploadBytes: SINGLE_PUT_MAX,
      multipart: true,
    },

    drafts: {
      get: (id) => getJson<Draft>(env.ADMIN, draftKey(id)),
      put: (id, draft, ifMatch) => putJson(env.ADMIN, draftKey(id), draft, ifMatch, metadataOf(draft)),
      delete: (id) => env.ADMIN.delete(draftKey(id)),
      async list() {
        const { objects } = await listAll(env.ADMIN, 'drafts/', 5, ['customMetadata']);
        return objects
          .filter((o) => o.key !== HOME_KEY && o.key.endsWith('.json'))
          .map(summaryOf)
          .filter((s): s is DraftSummary => s !== null);
      },
    },

    homeDraft: {
      get: () => getJson<HomeDraft>(env.ADMIN, HOME_KEY),
      put: (draft, ifMatch) => putJson(env.ADMIN, HOME_KEY, draft, ifMatch),
      delete: () => env.ADMIN.delete(HOME_KEY),
    },

    meta: {
      async get<T>(key: string) {
        const object = await env.ADMIN.get(key);
        return object ? ((await object.json()) as T) : null;
      },
      async put(key, value) {
        await env.ADMIN.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json' } });
      },
    },

    media: {
      async put(key, body, length, contentType) {
        await env.MEDIA.put(key, fixedLength(body, length), {
          httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
        });
      },
      async startMultipart(key, contentType) {
        const upload = await env.MEDIA.createMultipartUpload(key, {
          httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
        });
        return upload.uploadId;
      },
      async uploadPart(key, uploadId, partNumber, body, length) {
        const part = await env.MEDIA.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, fixedLength(body, length));
        return { partNumber: part.partNumber, etag: part.etag };
      },
      async finishMultipart(key, uploadId, parts) {
        await env.MEDIA.resumeMultipartUpload(key, uploadId).complete(parts);
      },
      async abortMultipart(key, uploadId) {
        await env.MEDIA.resumeMultipartUpload(key, uploadId).abort().catch(() => {});
      },
      async head(key) {
        const object = await env.MEDIA.head(key);
        return object ? { key, size: object.size, uploaded: object.uploaded } : null;
      },
      serve: (key, request) => serveUpload(env.MEDIA as unknown as R2Readable, key, request),
      async list(maxPages) {
        const { objects, truncated } = await listAll(env.MEDIA, 'p/', maxPages);
        return { objects: objects.map((o): MediaObject => ({ key: o.key, size: o.size, uploaded: o.uploaded })), truncated };
      },
      async delete(keys) {
        for (let i = 0; i < keys.length; i += 1000) await env.MEDIA.delete(keys.slice(i, i + 1000));
      },
      url: (key) => `${mediaOrigin}/${key}`,
      keyOf(url) {
        if (!url.startsWith(`${mediaOrigin}/`)) return null;
        const key = url.slice(mediaOrigin.length + 1).split(/[?#]/)[0];
        return MEDIA_KEY.test(key) ? key : null;
      },
    },

    async adminUsage(maxPages) {
      const { objects } = await listAll(env.ADMIN, '', maxPages);
      return { bytes: objects.reduce((sum, o) => sum + o.size, 0), objects: objects.length };
    },

    deployed: {
      index: () => asset<DeployedIndex>(env, '/admin/data/index.json'),
      published: () => asset<{ projects: Project[] }>(env, '/admin/data/published.json'),
    },

    repo: repo ?? {
      readHead: async () => noRepo(),
      commit: async () => noRepo(),
      emptyCommit: async () => noRepo(),
      restore: async () => noRepo(),
    },
  };
  return store;
}
