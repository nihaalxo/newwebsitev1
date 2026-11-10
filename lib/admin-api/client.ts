'use client';

import type { Draft, Project, ProjectInput } from '@/lib/cms/types';
import type { Published } from '@/lib/content/assemble';
import type { FieldErrors } from '@/components/admin/rules';
import type { BuildState } from './publish';
import type { DraftSummary } from './store';

/*
 * The admin pages' side of the API (lib/admin-api/handler.ts). Every call resolves to { ok: true, ... } or
 * { ok: false, error }, never throws, so a form can't get stuck on "Saving…". A 401 means the session ended: the
 * browser goes to the sign-in page, which comes back here afterwards.
 */

const UNREACHABLE = "Couldn't reach the server. Check your connection, then try again.";

export type Failure = {
  ok: false;
  status: number;
  error: string;
  /** 422: field errors by project id. */
  errors?: Record<string, FieldErrors>;
  /** 409 from a publish. */
  conflicts?: { id: string; reason: string }[];
  retryAfter?: number;
};
export type Result<T> = ({ ok: true } & T) | Failure;

export interface AdminState {
  deployed: { commit: string; builtAt: string };
  drafts: (DraftSummary & { stale: boolean })[];
  homeDraft: { highlights: string[]; order: string[]; etag: string } | null;
  publish: {
    kind: 'publish' | 'undo';
    commit: string;
    at: string;
    liveAt: string | null;
    items: { id: string; title: string; action: Draft['action']; path: string | null }[];
  } | null;
  build: BuildState | null;
}

export function signInPath(): string {
  const here = `${window.location.pathname}${window.location.search}`;
  return `/admin/login?next=${encodeURIComponent(here)}`;
}

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: UNREACHABLE };
  }
  let data: Record<string, unknown> = {};
  if (response.status !== 204) {
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }
  if (response.ok) return { ok: true, ...(data as T) };
  if (response.status === 401 && path !== 'session') {
    window.location.assign(signInPath());
  }
  return {
    ok: false,
    status: response.status,
    error: typeof data.error === 'string' ? data.error : response.status === 401 ? 'Signed out.' : `Something went wrong (error ${response.status}). Try again.`,
    ...(data.errors ? { errors: data.errors as Record<string, FieldErrors> } : {}),
    ...(Array.isArray(data.conflicts) ? { conflicts: data.conflicts as Failure['conflicts'] } : {}),
    ...(typeof data.retryAfter === 'number' ? { retryAfter: data.retryAfter } : {}),
  };
}

const ifMatch = (etag: string | null): Record<string, string> => (etag ? { 'if-match': `"${etag}"` } : {});

export const api = {
  session: () => call<{ signedIn: boolean }>('GET', 'session'),
  signIn: (password: string) => call<object>('POST', 'session', { password }),
  signOut: (everywhere = false) => call<object>('DELETE', `session${everywhere ? '?everywhere=1' : ''}`),

  state: () => call<AdminState>('GET', 'state'),
  draft: (id: string) => call<{ draft: Draft; etag: string }>('GET', `drafts/${id}`),
  saveDraft: (id: string, project: ProjectInput & { id: string }, action: Draft['action'], etag: string | null) =>
    call<{ etag: string; savedAt: string }>('PUT', `drafts/${id}`, { project, action }, ifMatch(etag)),
  deleteDraft: (id: string) => call<object>('DELETE', `drafts/${id}`),
  saveHome: (highlights: string[], order: string[], etag: string | null) => call<{ etag: string }>('PUT', 'home', { highlights, order }, ifMatch(etag)),
  deleteHome: () => call<object>('DELETE', 'home'),

  publish: (items: { id: string; etag: string }[], home: string | null) => call<{ commit: string | null }>('POST', 'publish', { items, home }),
  resolve: (id: string) => call<{ etag: string; savedAt: string }>('POST', `resolve/${id}`, {}),
  rebuild: () => call<{ commit: string }>('POST', 'rebuild', {}),
  undo: () => call<{ commit: string }>('POST', 'undo', {}),

  storage: () => call<{ bytes: number; objects: number; truncated: boolean; media: { key: string; size: number; uploaded: string }[] }>('GET', 'storage'),
  tidy: (keys: string[]) => call<{ deleted: string[] }>('POST', 'tidy', { keys }),
};

/** The content of the build that is live: projects in site order, the home layout and the redirects. */
export async function loadPublished(): Promise<Result<{ published: Published }>> {
  try {
    const response = await fetch('/admin/data/published.json', { cache: 'no-store' });
    if (!response.ok) return { ok: false, status: response.status, error: `The site's content couldn't be loaded (error ${response.status}).` };
    return { ok: true, published: (await response.json()) as Published };
  } catch {
    return { ok: false, status: 0, error: UNREACHABLE };
  }
}

/** p/<id>/<file> from any address an upload is served at (the media domain live, /uploads/ under npm run dev). */
export function mediaKeyOf(url: string | undefined | null): string | null {
  const match = url?.match(/(?:^|\/)(p\/[0-9a-f-]{36}\/[a-z0-9-]+-\d{14}-[a-z0-9]{6}\.[a-z0-9]+)(?:[?#].*)?$/);
  return match ? match[1] : null;
}

/** An upload's address the admin can read pixels from: the same-origin copy for media-domain files. */
export function readableUrl(url: string): string {
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  const key = mediaKeyOf(url);
  return key ? `/api/admin/media/${key}` : url;
}

export type { Project };
