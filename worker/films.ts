import { byteRange } from '../lib/http-range';
// Written by `npm run build` (scripts/postbuild.mjs).
import sizes from '../.build/film-sizes.json';

/*
 * The films in public/ (the hero, the Lair, About, Contact): Cloudflare serves them as static assets, and static
 * assets answer a Range request with the whole file and 200. Safari, and every browser on iPhone, only plays a film
 * whose server answers ranges with 206. So film requests come to the Worker first (run_worker_first) and are answered
 * here with the requested bytes. A static asset reaches the Worker without its size, so the build lists each film's
 * size. Ported from the redesign's cloudflare/worker.mjs, with the slices read in 1 MiB pieces (slice below).
 */

export const FILM = /\.(mp4|webm|mov|m4v)$/i;

/** How much one read takes from the asset: about 1 MiB. */
const PIECE = 1024 * 1024;

/**
 * The bytes from start to end (inclusive) of a stream, reading no further than end. It reads in pieces of 1 MiB with
 * a BYOB reader and readAtLeast: the default reader hands over the asset in chunks of a few KB, and passing each one
 * through JavaScript took 27 to 81 ms of CPU for a range deep into the hero film, far over the Free plan's 10 ms.
 * In 1 MiB pieces the same read is about 1 ms.
 */
function slice(body: ReadableStream<Uint8Array>, start: number, end: number): ReadableStream<Uint8Array> {
  const reader = body.getReader({ mode: 'byob' });
  let position = 0;
  const finish = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    controller.close();
    reader.cancel().catch(() => {});
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        // Up to the range's first byte (those bytes are dropped), then up to its last.
        const want = Math.min(PIECE, (position < start ? start : end + 1) - position);
        if (want <= 0) return finish(controller);
        const { done, value } = await reader.readAtLeast(want, new Uint8Array(want));
        if (done || !value || value.byteLength === 0) return finish(controller);
        const from = position;
        position += value.byteLength;
        if (position <= start) continue;
        controller.enqueue(value.subarray(Math.max(0, start - from), Math.min(value.byteLength, end + 1 - from)));
        if (position > end) finish(controller);
        return;
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

/** The size the build recorded for a film's address, or 0 when it isn't one of the site's films. */
export function filmSize(pathname: string): number {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // A malformed address is looked up as it is, and simply not found.
  }
  const size = (sizes as Record<string, number>)[path];
  return typeof size === 'number' && size > 0 ? size : 0;
}

/** A film from public/, with ranges answered; null when there is no such file, so the 404 page shows. */
export async function serveFilm(request: Request, env: { ASSETS: Fetcher }, size: number): Promise<Response | null> {
  const headers = new Headers(request.headers);
  const rangeHeader = headers.get('range');
  headers.delete('range');
  headers.delete('if-range');
  const asset = await env.ASSETS.fetch(new Request(request.url, { method: request.method, headers }));
  if (asset.status === 404) return null;

  const out = new Headers(asset.headers);
  out.set('accept-ranges', 'bytes');
  if (asset.status !== 200) return new Response(asset.body, { status: asset.status, headers: out });

  const range = byteRange(rangeHeader, size);
  if (range === null) {
    out.set('content-length', String(size));
    return new Response(asset.body, { status: 200, headers: out });
  }

  if (range === 'unsatisfiable') {
    await asset.body?.cancel();
    out.set('content-range', `bytes */${size}`);
    out.delete('content-length');
    return new Response(null, { status: 416, headers: out });
  }

  const length = range.end - range.start + 1;
  out.set('content-range', `bytes ${range.start}-${range.end}/${size}`);
  out.set('content-length', String(length));
  if (request.method === 'HEAD' || !asset.body) {
    await asset.body?.cancel();
    return new Response(null, { status: 206, headers: out });
  }
  // The whole file from the start ("bytes=0-", what a browser asks for first) passes straight through.
  if (range.start === 0 && range.end === size - 1) return new Response(asset.body, { status: 206, headers: out });

  const { readable, writable } = new FixedLengthStream(length);
  slice(asset.body, range.start, range.end).pipeTo(writable).catch(() => {});
  return new Response(readable, { status: 206, headers: out });
}
