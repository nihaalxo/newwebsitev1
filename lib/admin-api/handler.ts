import { MAX_HIGHLIGHTS, type Draft, type HomeDraft } from '@/lib/cms/types';
import { MAX_VIDEO_BYTES, MEDIA_KEY, PART_SIZE, isAllowedUploadType, mimeOf } from '@/lib/cms/defaults';
import { HOME_PATH } from '@/lib/content/serialize';
import { endSessionCookie, isSignedIn, rotateSessionKey, signIn } from './auth';
import { LATEST_KEY, baseFor, isStale, publish, rebuild, settle, undo, uploadKeys, type LatestPublish } from './publish';
import { PROJECT_ID, buildUploadPath, sanitizeProject, uploadExtension } from './sanitize';
import { RepoError, type Store } from './store';

/*
 * The admin's API at /api/admin/*, fetch-style: the Worker (worker/index.ts) and `npm run dev`
 * (app/api/admin/[...path]/route.dev.ts) both hand requests here, each with its own store.
 * Every answer is JSON and never cached. Every write must come from the admin's own pages (same Origin) and, apart
 * from signing in, from a signed-in session. Each request does a few small reads and writes, so it stays far inside
 * the Free plan's 10 ms of CPU; uploads stream through without being read.
 */

const DRAFT_MAX_BYTES = 512 * 1024;
const JSON_MAX_BYTES = 64 * 1024;
const TIDY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LIST_PAGES = 20;
const SIGNED_OUT = 'You have been signed out. Sign in again, then try again.';

const BASE_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, 'content-type': 'application/json; charset=utf-8', ...headers } });
}

function empty(status = 204, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { ...BASE_HEADERS, ...headers } });
}

const problem = (status: number, error: string) => json(status, { error });

class BadRequest extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** An etag as sent in If-Match: quotes and a weak marker removed. */
function etagOf(value: string | null): string | null {
  if (!value) return null;
  return value.trim().replace(/^W\//, '').replace(/^"|"$/g, '') || null;
}

async function readJson<T>(request: Request, limit = JSON_MAX_BYTES): Promise<T> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > limit) throw new BadRequest(413, 'That is too much to save at once.');
  const text = await request.text();
  if (text.length > limit) throw new BadRequest(413, 'That is too much to save at once.');
  try {
    return JSON.parse(text || '{}') as T;
  } catch {
    throw new BadRequest(400, 'That request could not be read. Reload the page and try again.');
  }
}

function isUploadRoute(method: string, route: string): boolean {
  return method === 'PUT' && (route === 'upload' || route === 'upload/part');
}

/** The checks every request passes before its route runs: Origin and Content-Type for writes. */
function refused(request: Request, route: string): Response | null {
  const method = request.method;
  if (method === 'GET' || method === 'HEAD') return null;
  if (request.headers.get('origin') !== new URL(request.url).origin) return problem(403, 'Write from the admin itself.');
  if (method === 'POST' || method === 'PUT') {
    const type = mimeOf(request.headers.get('content-type') ?? '');
    const ok = isUploadRoute(method, route) ? isAllowedUploadType(type) : type === 'application/json';
    if (!ok) return problem(403, 'Write from the admin itself.');
  }
  return null;
}

export interface HandlerOptions {
  now?: () => Date;
}

export async function handleAdminApi(request: Request, store: Store, options: HandlerOptions = {}): Promise<Response> {
  const now = options.now?.() ?? new Date();
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/admin\/?/, '').replace(/\/+$/, '');
  const method = request.method.toUpperCase();

  const refusal = refused(request, route);
  if (refusal) return refusal;

  try {
    if (route === 'session') return await sessionRoute(request, store, method, url, now);
    if (!(await isSignedIn(store, request, now.getTime()))) return problem(401, SIGNED_OUT);
    return await routes(request, store, method, route, url, now);
  } catch (error) {
    if (error instanceof BadRequest) return problem(error.status, error.message);
    if (error instanceof RepoError) return problem(502, error.message);
    console.error('admin api', route, error instanceof Error ? error.message : 'error');
    return problem(500, 'Something went wrong on the server. Try again in a moment.');
  }
}

async function sessionRoute(request: Request, store: Store, method: string, url: URL, now: Date): Promise<Response> {
  if (method === 'GET') return json(200, { signedIn: await isSignedIn(store, request, now.getTime()) });
  if (method === 'POST') {
    const body = await readJson<{ password?: unknown }>(request, 4096);
    const password = typeof body.password === 'string' ? body.password.slice(0, 500) : '';
    const ip = request.headers.get('cf-connecting-ip') ?? 'local';
    const result = await signIn(store, password, ip, now.getTime());
    if (result.ok) return empty(204, { 'set-cookie': result.cookie });
    if (result.retryAfter > 0) return json(429, { retryAfter: result.retryAfter }, { 'retry-after': String(result.retryAfter) });
    return problem(401, "That password isn't right.");
  }
  if (method === 'DELETE') {
    if (url.searchParams.get('everywhere') === '1' && (await isSignedIn(store, request, now.getTime()))) await rotateSessionKey(store);
    return empty(204, { 'set-cookie': endSessionCookie(store) });
  }
  return problem(405, 'Not allowed.');
}

async function routes(request: Request, store: Store, method: string, route: string, url: URL, now: Date): Promise<Response> {
  const [head, ...rest] = route.split('/');
  const id = rest.join('/');

  switch (`${method} ${head}`) {
    case 'GET state':
      return json(200, await state(store, now));

    case 'GET drafts': {
      if (!PROJECT_ID.test(id)) return problem(404, 'No such draft.');
      const stored = await store.drafts.get(id);
      return stored ? json(200, { draft: stored.value, etag: stored.etag }) : problem(404, 'No such draft.');
    }
    case 'PUT drafts':
      return saveDraft(request, store, id, now);
    case 'DELETE drafts':
      if (!PROJECT_ID.test(id)) return problem(404, 'No such draft.');
      await store.drafts.delete(id);
      return empty();

    case 'PUT home':
      return saveHome(request, store, now);
    case 'DELETE home':
      await store.homeDraft.delete();
      return empty();

    case 'POST publish': {
      const body = await readJson<{ items?: unknown; home?: unknown }>(request);
      const items = Array.isArray(body.items) ? body.items : [];
      const valid = items.every((item) => typeof item?.id === 'string' && PROJECT_ID.test(item.id) && typeof item.etag === 'string');
      const home = typeof body.home === 'string' ? body.home : null;
      if (!valid || items.length > 20 || (items.length === 0 && !home)) return problem(400, 'Choose between 1 and 20 projects to publish.');
      const outcome = await publish(store, { items: items as { id: string; etag: string }[], home }, now);
      return json(outcome.status, outcome.body);
    }
    case 'POST resolve':
      return resolve(store, id, now);
    case 'POST rebuild':
      return json(200, await rebuild(store, now));
    case 'POST undo': {
      const outcome = await undo(store, now);
      return json(outcome.status, outcome.body);
    }

    case 'PUT upload':
      return route === 'upload/part' ? uploadPart(request, store, url) : upload(request, store, url, now);
    case 'POST upload':
      if (route === 'upload/start') return uploadStart(request, store, now);
      if (route === 'upload/finish') return uploadFinish(request, store);
      return problem(404, 'Not found.');
    case 'DELETE upload': {
      const key = url.searchParams.get('key') ?? '';
      const uploadId = url.searchParams.get('uploadId') ?? '';
      if (!MEDIA_KEY.test(key) || !uploadId) return problem(400, 'Nothing to cancel.');
      await store.media.abortMultipart(key, uploadId);
      return empty();
    }

    case 'GET media':
    case 'HEAD media': {
      let key = '';
      try {
        key = decodeURIComponent(id);
      } catch {
        return problem(404, 'Not found.');
      }
      if (!MEDIA_KEY.test(key)) return problem(404, 'Not found.');
      const response = await store.media.serve(key, request);
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'private, max-age=3600');
      return new Response(response.body, { status: response.status, headers });
    }

    case 'GET storage':
      return json(200, await storage(store));
    case 'POST tidy':
      return tidy(request, store, now);
  }
  return problem(404, 'Not found.');
}

// ---------------------------------------------------------------- state

async function state(store: Store, now: Date) {
  const [index, latestBefore, summaries, homeDraft] = await Promise.all([
    store.deployed.index(),
    store.meta.get<LatestPublish>(LATEST_KEY),
    store.drafts.list(),
    store.homeDraft.get(),
  ]);
  const settled = await settle(store, index, latestBefore, summaries, now);
  const drafts = settled.changed ? await store.drafts.list() : summaries;
  const home = settled.changed ? await store.homeDraft.get() : homeDraft;
  const latest = settled.latest;
  return {
    deployed: { commit: index.commit, builtAt: index.builtAt },
    drafts: drafts.map((d) => ({ ...d, stale: isStale(d, index, latest) })),
    homeDraft: home ? { highlights: home.value.highlights, order: home.value.order, etag: home.etag } : null,
    publish: latest
      ? { kind: latest.kind, commit: latest.commit, at: latest.at, liveAt: latest.liveAt ?? null, items: latest.items.map(({ id, title, action, path }) => ({ id, title, action, path })) }
      : null,
    build: settled.build,
  };
}

// ---------------------------------------------------------------- drafts

async function saveDraft(request: Request, store: Store, id: string, now: Date): Promise<Response> {
  if (!PROJECT_ID.test(id)) return problem(404, 'No such project.');
  const body = await readJson<{ project?: unknown; action?: unknown }>(request, DRAFT_MAX_BYTES);
  const sanitized = sanitizeProject(body.project);
  if (!sanitized || sanitized.input.id !== id) return problem(400, 'That save arrived empty. Reload the page and try again.');
  if (Object.keys(sanitized.problems).length) return json(422, { errors: { [id]: sanitized.problems } });
  const action: Draft['action'] = body.action === 'unpublish' || body.action === 'delete' ? body.action : 'publish';

  const ifMatch = etagOf(request.headers.get('if-match'));
  const stored = await store.drafts.get(id);
  if (Boolean(stored) !== Boolean(ifMatch) || (stored && stored.etag !== ifMatch)) return problem(409, 'Changed in another tab: reload');

  let base = stored?.value.base ?? null;
  if (!stored) {
    const [index, latest] = await Promise.all([store.deployed.index(), store.meta.get<LatestPublish>(LATEST_KEY)]);
    base = baseFor(id, index, latest);
  }
  const draft: Draft = {
    project: sanitized.input,
    action,
    state: stored?.value.state === 'hidden' ? 'hidden' : 'editing',
    base,
    savedAt: now.toISOString(),
  };
  const etag = await store.drafts.put(id, draft, ifMatch);
  if (!etag) return problem(409, 'Changed in another tab: reload');
  return json(200, { etag, savedAt: draft.savedAt });
}

/** "Keep my draft": the draft now starts from the project as it is on the site. */
async function resolve(store: Store, id: string, now: Date): Promise<Response> {
  if (!PROJECT_ID.test(id)) return problem(404, 'No such draft.');
  const stored = await store.drafts.get(id);
  if (!stored) return problem(404, 'No such draft.');
  const [index, latest] = await Promise.all([store.deployed.index(), store.meta.get<LatestPublish>(LATEST_KEY)]);
  const base = baseFor(id, index, latest);
  const savedAt = now.toISOString();
  const etag = await store.drafts.put(id, { ...stored.value, base, state: base || stored.value.state !== 'hidden' ? 'editing' : 'hidden', savedAt }, stored.etag);
  if (!etag) return problem(409, 'Changed in another tab: reload');
  return json(200, { etag, savedAt });
}

async function saveHome(request: Request, store: Store, now: Date): Promise<Response> {
  const body = await readJson<{ highlights?: unknown; order?: unknown }>(request);
  const ids = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && PROJECT_ID.test(v)) : null);
  const highlights = ids(body.highlights);
  const order = ids(body.order);
  if (!highlights || !order || new Set(order).size !== order.length) return problem(400, 'That order could not be read. Reload the page.');
  if (highlights.length > MAX_HIGHLIGHTS) return problem(422, `At most ${MAX_HIGHLIGHTS} projects can be highlighted.`);
  if (highlights.some((h) => !order.includes(h))) return problem(422, 'A highlighted project must be on the site.');

  const ifMatch = etagOf(request.headers.get('if-match'));
  const stored = await store.homeDraft.get();
  if (Boolean(stored) !== Boolean(ifMatch) || (stored && stored.etag !== ifMatch)) return problem(409, 'Changed in another tab: reload');
  const blobSha = stored?.value.base.blobSha ?? (await store.deployed.index()).files[HOME_PATH]?.blobSha ?? '';
  const draft: HomeDraft = { highlights, order, base: { blobSha }, savedAt: now.toISOString() };
  const etag = await store.homeDraft.put(draft, ifMatch);
  if (!etag) return problem(409, 'Changed in another tab: reload');
  return json(200, { etag });
}

// ---------------------------------------------------------------- uploads

function contentLength(request: Request): number {
  const value = request.headers.get('content-length');
  return value && /^\d+$/.test(value) ? Number(value) : -1;
}

const TOO_BIG = (store: Store, limit: number) =>
  store.config.tooBigMessage ?? `That file is bigger than ${Math.round(limit / 1e6)} MB, the most one upload can be.`;

async function upload(request: Request, store: Store, url: URL, now: Date): Promise<Response> {
  const type = mimeOf(url.searchParams.get('type') ?? '');
  const extension = uploadExtension(type);
  if (!extension || mimeOf(request.headers.get('content-type') ?? '') !== type) {
    return problem(415, "That file type isn't supported. Use JPG, PNG, WebP, AVIF or GIF images, or MP4, WebM or MOV films.");
  }
  const length = contentLength(request);
  if (length < 0) return problem(411, 'The upload needs its length. Try again.');
  if (length > store.config.maxUploadBytes) return problem(413, TOO_BIG(store, store.config.maxUploadBytes));
  const key = buildUploadPath({ project: url.searchParams.get('project'), field: url.searchParams.get('field') }, extension, now);
  if (!key || !request.body) return problem(400, "Couldn't work out where to store that file. Reload the page and try again.");
  await store.media.put(key, request.body, length, type);
  return json(200, { url: store.media.url(key), key });
}

async function uploadStart(request: Request, store: Store, now: Date): Promise<Response> {
  const body = await readJson<{ project?: unknown; field?: unknown; type?: unknown; size?: unknown }>(request);
  const type = typeof body.type === 'string' ? mimeOf(body.type) : '';
  const extension = uploadExtension(type);
  const size = Number(body.size);
  if (!extension) return problem(415, "That file type isn't supported.");
  if (!Number.isFinite(size) || size <= 0) return problem(400, 'The upload needs its size.');
  if (size > MAX_VIDEO_BYTES) return problem(413, `That film is ${Math.round(size / 1e6)} MB; the most is ${Math.round(MAX_VIDEO_BYTES / 1e6)} MB.`);
  if (!store.config.multipart) return problem(413, TOO_BIG(store, store.config.maxUploadBytes));
  const key = buildUploadPath({ project: body.project, field: body.field }, extension, now);
  if (!key) return problem(400, "Couldn't work out where to store that file. Reload the page and try again.");
  const uploadId = await store.media.startMultipart(key, type);
  return json(200, { key, uploadId, partSize: PART_SIZE });
}

async function uploadPart(request: Request, store: Store, url: URL): Promise<Response> {
  const key = url.searchParams.get('key') ?? '';
  const uploadId = url.searchParams.get('uploadId') ?? '';
  const n = Number(url.searchParams.get('n'));
  if (!MEDIA_KEY.test(key) || !uploadId || !Number.isInteger(n) || n < 1 || n > 10000) return problem(400, 'That part could not be placed.');
  const length = contentLength(request);
  if (length < 0) return problem(411, 'The part needs its length.');
  if (length > PART_SIZE) return problem(413, 'That part is too big.');
  if (!request.body) return problem(400, 'The part was empty.');
  return json(200, await store.media.uploadPart(key, uploadId, n, request.body, length));
}

async function uploadFinish(request: Request, store: Store): Promise<Response> {
  const body = await readJson<{ key?: unknown; uploadId?: unknown; parts?: unknown }>(request, 1024 * 1024);
  const key = typeof body.key === 'string' ? body.key : '';
  const uploadId = typeof body.uploadId === 'string' ? body.uploadId : '';
  const parts = Array.isArray(body.parts)
    ? body.parts.filter((p): p is { partNumber: number; etag: string } => Number.isInteger(p?.partNumber) && typeof p?.etag === 'string')
    : [];
  if (!MEDIA_KEY.test(key) || !uploadId || parts.length === 0) return problem(400, 'The upload could not be finished. Try again.');
  await store.media.finishMultipart(key, uploadId, parts.sort((a, b) => a.partNumber - b.partNumber));
  return json(200, { url: store.media.url(key), key });
}

async function storage(store: Store) {
  const [media, admin] = await Promise.all([store.media.list(LIST_PAGES), store.adminUsage(LIST_PAGES)]);
  const mediaBytes = media.objects.reduce((sum, o) => sum + o.size, 0);
  return {
    bytes: mediaBytes + admin.bytes,
    objects: media.objects.length + admin.objects,
    truncated: media.truncated,
    media: media.objects.map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded.toISOString() })),
  };
}

/** Deletes uploads nothing uses: not on the site, not in a draft, and at least 7 days old. */
async function tidy(request: Request, store: Store, now: Date): Promise<Response> {
  const body = await readJson<{ keys?: unknown }>(request, 256 * 1024);
  const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === 'string' && MEDIA_KEY.test(k)) : [];
  if (keys.length === 0) return json(200, { deleted: [] });
  const [published, summaries] = await Promise.all([store.deployed.published(), store.drafts.list()]);
  const drafts = (await Promise.all(summaries.map((s) => store.drafts.get(s.id)))).filter(Boolean).map((d) => (d as { value: Draft }).value.project);
  const used = uploadKeys(store, [...published.projects, ...drafts]);
  const deleted: string[] = [];
  for (const key of keys.slice(0, 1000)) {
    if (used.has(key)) continue;
    const object = await store.media.head(key);
    if (object && now.getTime() - object.uploaded.getTime() > TIDY_AGE_MS) deleted.push(key);
  }
  if (deleted.length) await store.media.delete(deleted);
  return json(200, { deleted });
}
