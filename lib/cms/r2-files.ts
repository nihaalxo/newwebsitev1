import { byteRange } from '../http-range';
import type { CmsR2Bucket } from './cloudflare-env';
import { isAllowedUploadPath } from './defaults';

/*
 * Serving the admin's uploads from R2 at /cms/<path>. cloudflare/worker.mjs answers /cms/ requests with this before
 * the site runs (cheaper, and the length of each answer is kept); app/cms/[...path]/route.ts does the same inside the
 * site, for a build without that entry point. No 'server-only' and no Next imports, so the Worker can bundle it.
 */

/** Uploads live in R2 under this prefix and are served at /cms/<path>. */
export const R2_PREFIX = 'cms/';
export const R2_PUBLIC_PREFIX = '/cms/';

const notFound = () => new Response('Not found.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/**
 * One upload, by its address after /cms/ (still URL-encoded). Files never change once written (the admin always
 * uploads under a new name), so they are cached for a year. Range requests are answered with 206, so films seek
 * and stream, and Safari plays them.
 */
export async function serveUpload(bucket: CmsR2Bucket, encodedPath: string, request: Request): Promise<Response> {
  let path: string;
  try {
    path = encodedPath.split('/').map(decodeURIComponent).join('/');
  } catch {
    return notFound();
  }
  if (!isAllowedUploadPath(path)) return notFound();
  const key = `${R2_PREFIX}${path}`;

  const head = await bucket.head(key);
  if (!head) return notFound();

  const headers = new Headers({
    'content-type': head.httpMetadata?.contentType ?? 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    'accept-ranges': 'bytes',
    etag: head.httpEtag,
    'last-modified': head.uploaded.toUTCString(),
    'x-content-type-options': 'nosniff',
  });

  if (request.headers.get('if-none-match') === head.httpEtag) return new Response(null, { status: 304, headers });
  const withBody = request.method !== 'HEAD';

  const range = byteRange(request.headers.get('range'), head.size);
  if (range === 'unsatisfiable') {
    headers.set('content-range', `bytes */${head.size}`);
    return new Response(null, { status: 416, headers });
  }
  if (range) {
    const length = range.end - range.start + 1;
    headers.set('content-range', `bytes ${range.start}-${range.end}/${head.size}`);
    headers.set('content-length', String(length));
    if (!withBody) return new Response(null, { status: 206, headers });
    const object = await bucket.get(key, { range: { offset: range.start, length } });
    if (!object) return notFound();
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('content-length', String(head.size));
  if (!withBody) return new Response(null, { status: 200, headers });
  const object = await bucket.get(key);
  if (!object) return notFound();
  return new Response(object.body, { status: 200, headers });
}
