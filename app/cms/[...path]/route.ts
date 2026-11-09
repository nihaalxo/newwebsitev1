import type { NextRequest } from 'next/server';
import { R2_PREFIX, cloudflareEnv, type CmsR2Range } from '@/lib/cms/cloudflare-env';
import { isAllowedUploadPath } from '@/lib/cms/defaults';

// Serves the admin's uploads from R2 at /cms/<path>. Files never change once written (the admin always uploads under
// a new name), so they are cached for a year. Range requests are answered with 206, so films seek and stream.

export const dynamic = 'force-dynamic';

const notFound = () => new Response('Not found.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/** Parses a single "bytes=a-b", "bytes=a-" or "bytes=-n" range. Anything else is ignored (the whole file is sent). */
function parseRange(header: string | null): CmsR2Range | null {
  const match = header?.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, start, end] = match;
  if (start === '' && end === '') return null;
  if (start === '') return { suffix: Number(end) };
  if (end === '') return { offset: Number(start) };
  if (Number(end) < Number(start)) return null;
  return { offset: Number(start), length: Number(end) - Number(start) + 1 };
}

async function serve(request: NextRequest, params: Promise<{ path: string[] }>, withBody: boolean) {
  const env = cloudflareEnv();
  if (!env) return notFound();
  const path = (await params).path.map((part) => decodeURIComponent(part)).join('/');
  if (!isAllowedUploadPath(path)) return notFound();
  const key = `${R2_PREFIX}${path}`;

  const head = await env.CMS_UPLOADS.head(key);
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

  let range = parseRange(request.headers.get('range'));
  if (range) {
    const size = head.size;
    const start = 'suffix' in range ? Math.max(0, size - range.suffix) : range.offset;
    const end = 'suffix' in range ? size - 1 : Math.min(size - 1, range.length ? range.offset + range.length - 1 : size - 1);
    if (start >= size || end < start) {
      headers.set('content-range', `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    range = { offset: start, length: end - start + 1 };
    headers.set('content-range', `bytes ${start}-${end}/${size}`);
    headers.set('content-length', String(end - start + 1));
    if (!withBody) return new Response(null, { status: 206, headers });
    const object = await env.CMS_UPLOADS.get(key, { range });
    if (!object) return notFound();
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('content-length', String(head.size));
  if (!withBody) return new Response(null, { status: 200, headers });
  const object = await env.CMS_UPLOADS.get(key);
  if (!object) return notFound();
  return new Response(object.body, { status: 200, headers });
}

export function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return serve(request, params, true);
}

export function HEAD(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return serve(request, params, false);
}
