import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Draft, HomeDraft, Project } from '@/lib/cms/types';
import { MEDIA_KEY } from '@/lib/cms/defaults';
import { readContent } from '@/lib/content/read';
import type { DeployedIndex, DraftSummary, MediaObject, Repo, RepoHead, Store } from '@/lib/admin-api/store';

// An in-memory Store (lib/admin-api/store.ts) for the tests, seeded from this checkout's content/.

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MEDIA_ORIGIN = 'https://media.nihaalnazeer.com';

const blobSha = (text: string) => {
  const bytes = Buffer.from(text, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

/** The content files as the live build would index them, and as HEAD holds them. */
export function contentFixture() {
  const content = readContent(ROOT);
  const files: Record<string, string> = {};
  for (const file of content.files) files[file.path] = file.text;
  const index: DeployedIndex = { commit: 'c0', builtAt: '2026-11-01T00:00:00.000Z', files: {} };
  const shas: Record<string, string> = {};
  for (const [file, text] of Object.entries(files)) {
    shas[file] = blobSha(text);
    const project = content.projects.find((p) => `content/projects/${p.slug}.json` === file);
    index.files[file] = project ? { id: project.id, blobSha: shas[file] } : { blobSha: shas[file] };
  }
  const head: RepoHead = {
    commit: 'c0',
    tree: 't0',
    files: shas,
    homeJson: files['content/home.json'],
    redirectsJson: files['content/redirects.json'],
  };
  return { content, files, index, head, blobSha };
}

/** A Store in memory; `repo` defaults to one that refuses everything. */
export function memoryStore(options: { repo?: Repo; index?: DeployedIndex; projects?: Project[]; password?: string } = {}) {
  const fixture = contentFixture();
  const drafts = new Map<string, { value: Draft; etag: string }>();
  let home: { value: HomeDraft; etag: string } | null = null;
  const meta = new Map<string, unknown>();
  const metaEtags = new Map<string, string>();
  const media = new Map<string, MediaObject>();
  let counter = 0;
  const etag = () => `e${++counter}`;
  const deployed = { index: options.index ?? fixture.index, projects: options.projects ?? fixture.content.projects };

  const store: Store & { deployedState: typeof deployed; mediaObjects: typeof media } = {
    config: {
      cookieName: '__Host-nn_admin',
      secureCookie: true,
      adminPassword: options.password ?? 'correct horse',
      mediaOrigin: MEDIA_ORIGIN,
      maxUploadBytes: 95e6,
      multipart: true,
    },
    drafts: {
      async get(id) {
        const d = drafts.get(id);
        return d ? { value: structuredClone(d.value), etag: d.etag } : null;
      },
      async put(id, draft, ifMatch) {
        const current = drafts.get(id);
        if (ifMatch === null ? current : current?.etag !== ifMatch) return null;
        const next = { value: structuredClone(draft), etag: etag() };
        drafts.set(id, next);
        return next.etag;
      },
      async delete(id) {
        drafts.delete(id);
      },
      async list() {
        return [...drafts.entries()].map(
          ([id, { value, etag: e }]): DraftSummary => ({
            id,
            etag: e,
            title: value.project.title,
            slug: value.project.slug,
            state: value.state,
            action: value.action,
            savedAt: value.savedAt,
            base: value.base,
            ...(value.commit ? { commit: value.commit } : {}),
          }),
        );
      },
    },
    homeDraft: {
      async get() {
        return home ? { value: structuredClone(home.value), etag: home.etag } : null;
      },
      async put(draft, ifMatch) {
        if (ifMatch === null ? home : home?.etag !== ifMatch) return null;
        home = { value: structuredClone(draft), etag: etag() };
        return home.etag;
      },
      async delete() {
        home = null;
      },
    },
    meta: {
      async get<T>(key: string) {
        return meta.has(key) ? (structuredClone(meta.get(key)) as T) : null;
      },
      async put(key, value) {
        meta.set(key, structuredClone(value));
        metaEtags.set(key, etag());
      },
      async getStored<T>(key: string) {
        return meta.has(key) ? { value: structuredClone(meta.get(key)) as T, etag: metaEtags.get(key) as string } : null;
      },
      async putIf(key, value, ifMatch) {
        if (ifMatch === null ? meta.has(key) : metaEtags.get(key) !== ifMatch) return false;
        meta.set(key, structuredClone(value));
        metaEtags.set(key, etag());
        return true;
      },
    },
    media: {
      async put(key, body, length) {
        await new Response(body).arrayBuffer();
        media.set(key, { key, size: length, uploaded: new Date() });
      },
      async startMultipart() {
        return 'upload-1';
      },
      async uploadPart(_key, _id, partNumber) {
        return { partNumber, etag: `p${partNumber}` };
      },
      async finishMultipart() {
        return { size: 0, declaredSize: null };
      },
      async abortMultipart() {},
      async head(key) {
        return media.get(key) ?? null;
      },
      async find(keys) {
        return new Map(keys.filter((key) => media.has(key)).map((key) => [key, media.get(key) as MediaObject]));
      },
      async serve() {
        return new Response(null, { status: 404 });
      },
      async list() {
        return { objects: [...media.values()], truncated: false };
      },
      async delete(keys) {
        for (const key of keys) media.delete(key);
      },
      url: (key) => `${MEDIA_ORIGIN}/${key}`,
      keyOf(url) {
        if (!url.startsWith(`${MEDIA_ORIGIN}/`)) return null;
        const key = url.slice(MEDIA_ORIGIN.length + 1);
        return MEDIA_KEY.test(key) ? key : null;
      },
    },
    async adminUsage() {
      return { bytes: 0, objects: drafts.size };
    },
    deployed: {
      index: async () => deployed.index,
      published: async () => ({ projects: deployed.projects }),
    },
    repo: options.repo ?? {
      readHead: async () => fixture.head,
      commit: async () => {
        throw new Error('no repo');
      },
      emptyCommit: async () => {
        throw new Error('no repo');
      },
      restore: async () => {
        throw new Error('no repo');
      },
    },
    deployedState: deployed,
    mediaObjects: media,
  };
  return store;
}

/** A draft of `project` as the admin would save it. */
export function draftOf(project: Draft['project'], base: Draft['base'], action: Draft['action'] = 'publish', savedAt = '2026-11-09T12:00:00.000Z'): Draft {
  return { project: structuredClone(project), action, state: 'editing', base, savedAt };
}
