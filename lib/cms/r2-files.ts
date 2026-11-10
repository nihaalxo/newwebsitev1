import { byteRange } from '../http-range';
import { MEDIA_KEY } from './defaults';

/*
 * Serving an upload from the R2 media bucket, for the admin's same-origin reads (GET /api/admin/media/<key>: poster
 * grabs and accent sampling read pixels, which needs the same origin). Visitors get uploads straight from the
 * bucket's custom domain, without the Worker. One R2 read per request: the range and the If-None-Match go with the
 * get. Ranges are answered with 206, so films seek and Safari plays them. No Next or Node imports: the Worker bundles
 * this.
 */

/** The part of R2's object the Worker uses. */
export interface R2ObjectLike {
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string };
  range?: { offset?: number; length?: number; suffix?: number };
  body?: ReadableStream;
}

/** The part of an R2 bucket binding serveUpload uses. */
export interface R2Readable {
  get(
    key: string,
    options?: { range?: { offset: number; length?: number } | { suffix: number }; onlyIf?: { etagDoesNotMatch: string } },
  ): Promise<R2ObjectLike | null>;
  head(key: string): Promise<R2ObjectLike | null>;
}

const notFound = () =>
  new Response('Not found.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' } });

type Wanted = { offset: number; length?: number } | { suffix: number } | 'unsatisfiable' | null;

/** The Range header as R2 takes it, before the file's size is known. */
function wantedRange(header: string | null): Wanted {
  const match = header?.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, first, last] = match;
  if (first === '' && last === '') return null;
  if (first === '') return Number(last) === 0 ? 'unsatisfiable' : { suffix: Number(last) };
  const offset = Number(first);
  if (last === '') return { offset };
  if (Number(last) < offset) return null;
  return { offset, length: Number(last) - offset + 1 };
}

function headersFor(object: R2ObjectLike): Headers {
  return new Headers({
    'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    'accept-ranges': 'bytes',
    etag: object.httpEtag,
    'last-modified': object.uploaded.toUTCString(),
    'x-content-type-options': 'nosniff',
  });
}

function unsatisfiable(object: R2ObjectLike): Response {
  const headers = headersFor(object);
  headers.set('content-range', `bytes */${object.size}`);
  return new Response(null, { status: 416, headers });
}

/** One upload by its key (p/<id>/<file>), for GET and HEAD, with 206, 416 and 304. */
export async function serveUpload(bucket: R2Readable, key: string, request: Request): Promise<Response> {
  if (!MEDIA_KEY.test(key)) return notFound();
  const ifNoneMatch = request.headers.get('if-none-match')?.replace(/^W\//, '').replace(/"/g, '');
  const rangeHeader = request.headers.get('range');

  if (request.method === 'HEAD') {
    const object = await bucket.head(key);
    if (!object) return notFound();
    const headers = headersFor(object);
    if (ifNoneMatch === object.etag) return new Response(null, { status: 304, headers });
    const range = byteRange(rangeHeader, object.size);
    if (range === 'unsatisfiable') return unsatisfiable(object);
    if (!range) {
      headers.set('content-length', String(object.size));
      return new Response(null, { status: 200, headers });
    }
    headers.set('content-range', `bytes ${range.start}-${range.end}/${object.size}`);
    headers.set('content-length', String(range.end - range.start + 1));
    return new Response(null, { status: 206, headers });
  }

  const wanted = wantedRange(rangeHeader);
  if (wanted === 'unsatisfiable') {
    const object = await bucket.head(key);
    return object ? unsatisfiable(object) : notFound();
  }

  let object: R2ObjectLike | null;
  try {
    object = await bucket.get(key, { ...(wanted ? { range: wanted } : {}), ...(ifNoneMatch ? { onlyIf: { etagDoesNotMatch: ifNoneMatch } } : {}) });
  } catch (error) {
    // R2 refuses a range that starts past the end of the file.
    const head = wanted ? await bucket.head(key) : null;
    if (head && 'offset' in (wanted as object) && (wanted as { offset: number }).offset >= head.size) return unsatisfiable(head);
    throw error;
  }
  if (!object) return notFound();
  const headers = headersFor(object);
  // The condition failed: the browser already has this version.
  if (!('body' in object) || !object.body) return new Response(null, { status: 304, headers });

  if (!wanted) {
    headers.set('content-length', String(object.size));
    return new Response(object.body, { status: 200, headers });
  }
  const size = object.size;
  let start: number;
  let length: number;
  if ('suffix' in wanted) {
    length = Math.min(wanted.suffix, size);
    start = size - length;
  } else {
    if (wanted.offset >= size) {
      await object.body.cancel();
      return unsatisfiable(object);
    }
    start = wanted.offset;
    length = Math.min(wanted.length ?? size - start, size - start);
  }
  headers.set('content-range', `bytes ${start}-${start + length - 1}/${size}`);
  headers.set('content-length', String(length));
  return new Response(object.body, { status: 206, headers });
}
