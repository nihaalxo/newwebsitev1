import type { Draft, HomeDraft, Project } from '@/lib/cms/types';

/*
 * Where the admin API keeps things. Two implementations share one handler (lib/admin-api/handler.ts):
 * - worker/cloudflare-store.ts, live: drafts in the R2 bucket ADMIN, uploads in the R2 bucket MEDIA, the deployed
 *   content from the Worker's own static assets, and publishing as a commit through GitHub's API;
 * - lib/admin-api/file-store.ts, under `npm run dev`: drafts in .drafts/, uploads in public/uploads/p/, and
 *   publishing straight into content/.
 */

/** What the build that is live holds: out/admin/data/index.json, written by scripts/postbuild.mjs. */
export interface DeployedIndex {
  commit: string;
  builtAt: string;
  /** content/projects/<slug>.json -> its project id and git blob; content/home.json and content/redirects.json -> blob. */
  files: Record<string, { id?: string; blobSha: string }>;
}

/** The few fields the project list needs, kept as the draft object's metadata so one list call draws the list. */
export interface DraftSummary {
  id: string;
  etag: string;
  title: string;
  slug: string;
  state: Draft['state'];
  action: Draft['action'];
  savedAt: string;
  base: Draft['base'];
  commit?: string;
  /** The cover's small image, for the list. */
  thumb?: string;
  /** "Brand identity · 2024" */
  meta?: string;
}

export interface Stored<T> {
  value: T;
  etag: string;
}

/** A file in the media bucket. */
export interface MediaObject {
  key: string;
  size: number;
  uploaded: Date;
}

/** HEAD of the branch the site builds from, as far as publishing needs it. */
export interface RepoHead {
  commit: string;
  tree: string;
  /** Every file under content/: path -> git blob sha. */
  files: Record<string, string>;
  homeJson: string;
  redirectsJson: string;
}

export interface RepoChange {
  writes: { path: string; content: string }[];
  deletes: string[];
  message: string;
}

/** Thrown when the branch moved between reading HEAD and updating it, so the caller can start again. */
export class RepoMoved extends Error {
  constructor() {
    super('The branch moved while publishing.');
    this.name = 'RepoMoved';
  }
}

/** A failure talking to the repository, with a message written for the admin. */
export class RepoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RepoError';
  }
}

export interface Repo {
  readHead(): Promise<RepoHead>;
  /** Commits the change on top of `head` and moves the branch to it. Throws RepoMoved if the branch moved. */
  commit(head: RepoHead, change: RepoChange): Promise<string>;
  /** A commit with HEAD's own tree, to build the same content again. */
  emptyCommit(message: string): Promise<string>;
  /** Sets each path to a blob it held before (null deletes it), on top of `head`. */
  restore(head: RepoHead, entries: { path: string; blobSha: string | null }[], message: string): Promise<string>;
}

export interface StoreConfig {
  /** The session cookie: __Host-nn_admin live (Secure), nn_admin_dev under `npm run dev`. */
  cookieName: string;
  secureCookie: boolean;
  /** Undefined when the secret isn't set: then nobody can sign in. */
  adminPassword: string | undefined;
  /** Where uploads are served from, e.g. https://media.nihaalnazeer.com; '' when they are served by the site itself. */
  mediaOrigin: string;
  /** The largest single upload request. */
  maxUploadBytes: number;
  /** Shown when a file is too big for this store, e.g. under `npm run dev`. */
  tooBigMessage?: string;
  /** Whether big files can go up in parts. */
  multipart: boolean;
}

export interface Store {
  config: StoreConfig;
  drafts: {
    get(id: string): Promise<Stored<Draft> | null>;
    /** `ifMatch` null: only if there is none yet. Resolves to the new etag, or null when the condition failed. */
    put(id: string, draft: Draft, ifMatch: string | null): Promise<string | null>;
    delete(id: string): Promise<void>;
    list(): Promise<DraftSummary[]>;
  };
  homeDraft: {
    get(): Promise<Stored<HomeDraft> | null>;
    put(draft: HomeDraft, ifMatch: string | null): Promise<string | null>;
    delete(): Promise<void>;
  };
  /** Small JSON records: publish/latest.json, auth/session-key, auth/failures.json, builds/<sha>.json. */
  meta: {
    get<T>(key: string): Promise<T | null>;
    put(key: string, value: unknown): Promise<void>;
  };
  media: {
    /** Stores a file of `length` bytes from a stream. */
    put(key: string, body: ReadableStream<Uint8Array>, length: number, contentType: string): Promise<void>;
    startMultipart(key: string, contentType: string): Promise<string>;
    uploadPart(key: string, uploadId: string, partNumber: number, body: ReadableStream<Uint8Array>, length: number): Promise<{ partNumber: number; etag: string }>;
    finishMultipart(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void>;
    abortMultipart(key: string, uploadId: string): Promise<void>;
    head(key: string): Promise<MediaObject | null>;
    /** Answers a GET or HEAD for the file, with ranges (206, 416) and 304. */
    serve(key: string, request: Request): Promise<Response>;
    /** Every file under p/, at most `maxPages` list calls. */
    list(maxPages: number): Promise<{ objects: MediaObject[]; truncated: boolean }>;
    delete(keys: string[]): Promise<void>;
    /** The address a file is published under. */
    url(key: string): string;
    /** The key behind an address `url` made, or null for any other address. */
    keyOf(url: string): string | null;
  };
  /** Bytes and files in the admin's own bucket, for the storage line. */
  adminUsage(maxPages: number): Promise<{ bytes: number; objects: number }>;
  deployed: {
    index(): Promise<DeployedIndex>;
    /** out/admin/data/published.json of the live build. */
    published(): Promise<{ projects: Project[] }>;
  };
  repo: Repo;
}
