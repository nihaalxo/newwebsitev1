/**
 * One byte range from a Range header ("bytes=a-b", "bytes=a-" or "bytes=-n"), resolved against the file's size.
 *
 * - `null`: no usable range (no header, several ranges, or another unit). Send the whole file with 200.
 * - `'unsatisfiable'`: the range starts past the end. Answer 416 with `content-range: bytes *\/size`.
 * - `{ start, end }`: inclusive byte offsets. Answer 206 with `content-range: bytes start-end/size`.
 *
 * Safari only plays a film whose server answers ranges with 206, so every film the site serves goes through this:
 * uploads in R2 (app/cms/[...path]/route.ts) and the films in public/ (cloudflare/worker.mjs).
 */
export type ByteRange = { start: number; end: number };

export function byteRange(header: string | null | undefined, size: number): ByteRange | 'unsatisfiable' | null {
  const match = header?.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, first, last] = match;
  if (first === '' && last === '') return null;
  if (first === '') {
    // The last n bytes.
    const suffix = Number(last);
    if (suffix === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(first);
  const end = last === '' ? size - 1 : Math.min(size - 1, Number(last));
  if (last !== '' && Number(last) < start) return null;
  if (start >= size) return 'unsatisfiable';
  return { start, end };
}
