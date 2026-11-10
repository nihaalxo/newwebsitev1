// Browser-only upload helpers for the admin. Images are resized and re-encoded here, so the server and the public
// site only ever see web-ready files. Files go to the admin's API (lib/admin-api/handler.ts), which decides each
// file's name: up to SINGLE_PUT_MAX in one request with progress, bigger films in 50 MiB parts, three at a time.
// Live, the files land in the media bucket; under `npm run dev`, in public/uploads/p/.

import { MAX_VIDEO_BYTES, SINGLE_PUT_MAX, VIDEO_WARN_BYTES } from '@/lib/cms/defaults';
import type { Media } from '@/lib/cms/types';
import { readableUrl, signInPath } from '@/lib/admin-api/client';

/** Reports upload progress from 0 to 1, or null when the transport can't measure it. */
export type ProgressHandler = (fraction: number | null) => void;

export { MAX_VIDEO_BYTES, VIDEO_WARN_BYTES };
const MAX_GIF_BYTES = 15 * 1024 * 1024;
const PART_TRIES = 3;
const PARALLEL_PARTS = 3;
const POSTER_AT = 1;

const FULL_WIDTH = 2400;
const SMALL_WIDTH = 960;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.86;
/** Safari refuses canvases larger than about 16.7 million pixels. */
const MAX_CANVAS_PIXELS = 16_000_000;

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif';
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mov';
export const VIDEO_ADVICE = 'Export H.264 1080p for smooth playback';

/** An error whose message is written for the owner and can be shown as-is. */
export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof UploadError) return error.message;
  if (error instanceof DOMException && error.name === 'AbortError') return 'Upload cancelled.';
  return 'The upload failed. Check your connection and try again.';
}

/**
 * Where a file is filed: "<project id>/<field>", e.g. "6f1c…/cover" or "6f1c…/gallery-poster". The server makes the
 * actual name, p/<project id>/<field>-<time>-<random>.<ext>, from { project, field }.
 */
export type UploadHint = string;

function hintOf(folderHint: UploadHint): { project: string; field: string } {
  const [project, ...rest] = folderHint.split('/');
  return { project, field: rest.join('-') || 'file' };
}

/** Local copies of uploaded images, by address, so the accent can be sampled without fetching the file again. */
const localCopies = new Map<string, string>();
export function localCopyOf(url: string): string | null {
  return localCopies.get(url) ?? null;
}

// ---------------------------------------------------------------- public API

/** Resizes to WebP at most 2400px wide (plus a 960px copy for cards) and uploads both. */
export async function uploadImage(file: File, folderHint: UploadHint, onProgress?: ProgressHandler): Promise<Media> {
  if (file.type === 'image/svg+xml') throw new UploadError("SVG files can't be used here. Export a PNG or WebP instead.");
  if (file.type && !file.type.startsWith('image/')) throw new UploadError("That file isn't an image. Use JPG, PNG, WebP or GIF.");

  const bitmap = await decodeImage(file);
  try {
    // Re-encoding a GIF would freeze it on its first frame, so animated GIFs go up untouched.
    if (file.type === 'image/gif') {
      if (file.size > MAX_GIF_BYTES) throw new UploadError(`This GIF is ${megabytes(file.size)}; the limit is 15 MB.`);
      const src = await uploadBlob(file, folderHint, 'image/gif', onProgress);
      return { kind: 'image', src, alt: '', width: bitmap.width, height: bitmap.height };
    }

    const full = await encodeImage(bitmap, bitmap.width, bitmap.height, FULL_WIDTH);
    const needsSmall = full.width > SMALL_WIDTH;
    const small = needsSmall ? await encodeImage(bitmap, bitmap.width, bitmap.height, SMALL_WIDTH) : null;

    const src = await uploadBlob(full.blob, folderHint, full.blob.type, part(onProgress, 0, needsSmall ? 0.8 : 1));
    const srcSmall = small ? await uploadBlob(small.blob, `${folderHint}-sm`, small.blob.type, part(onProgress, 0.8, 1)) : src;
    localCopies.set(srcSmall, URL.createObjectURL(small?.blob ?? full.blob));
    return { kind: 'image', src, srcSmall, alt: '', width: full.width, height: full.height };
  } finally {
    bitmap.close();
  }
}

/** Like uploadImage but a single file and no card-sized copy: for video posters. Resolves to its URL. */
export async function uploadStill(file: File, folderHint: UploadHint, onProgress?: ProgressHandler): Promise<string> {
  if (file.type && !file.type.startsWith('image/')) throw new UploadError("That file isn't an image. Use JPG, PNG or WebP.");
  const bitmap = await decodeImage(file);
  try {
    const still = await encodeImage(bitmap, bitmap.width, bitmap.height, FULL_WIDTH);
    return await uploadBlob(still.blob, folderHint, still.blob.type, onProgress);
  } finally {
    bitmap.close();
  }
}

/**
 * Uploads a film as it is, up to MAX_VIDEO_BYTES, then grabs its frame at 1 s from the file on this computer and
 * uploads it as the poster. A film too big for one request goes up in parts.
 */
export async function uploadVideo(
  file: File,
  folderHint: UploadHint,
  onProgress?: ProgressHandler,
  options: { signal?: AbortSignal; poster?: boolean } = {},
): Promise<Media> {
  const contentType = contentTypeOf(file);
  if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(contentType)) {
    throw new UploadError("That file isn't a video we can use. Use MP4 (H.264 plays everywhere), WebM or MOV.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new UploadError(`This film is ${megabytes(file.size)}; the most is ${megabytes(MAX_VIDEO_BYTES)}. ${VIDEO_ADVICE}.`);
  }
  const size = await readVideoSize(file);
  const withPoster = options.poster !== false;
  const src = await uploadBlob(file, folderHint, contentType, part(onProgress, 0, withPoster ? 0.97 : 1), options.signal);
  let poster: string | undefined;
  if (withPoster) {
    const url = URL.createObjectURL(file);
    try {
      poster = await uploadVideoFrame(url, POSTER_AT, `${folderHint}-poster`, part(onProgress, 0.97, 1));
    } catch {
      // A film the browser can't decode still uploads; a poster can be added by hand.
      poster = undefined;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return { kind: 'video', src, ...(poster ? { poster } : {}), alt: '', ...size };
}

/** Grabs the frame at `time` seconds from a video and uploads it as a poster still. Resolves to its URL. */
export async function uploadVideoFrame(videoSrc: string, time: number, folderHint: UploadHint, onProgress?: ProgressHandler): Promise<string> {
  const video = await loadVideoFrame(videoSrc, time);
  try {
    const frame = await encodeImage(video, video.videoWidth, video.videoHeight, FULL_WIDTH);
    return await uploadBlob(frame.blob, folderHint, frame.blob.type, onProgress);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      throw new UploadError("This video's frames can't be read here. Upload a still image instead.");
    }
    throw error;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

// ---------------------------------------------------------------- transport

async function uploadBlob(blob: Blob, folderHint: UploadHint, contentType: string, onProgress?: ProgressHandler, signal?: AbortSignal): Promise<string> {
  const hint = hintOf(folderHint);
  if (blob.size > SINGLE_PUT_MAX) return uploadInParts(blob, hint, contentType, onProgress, signal);
  const query = new URLSearchParams({ project: hint.project, field: hint.field, type: contentType });
  const body = await send('PUT', `/api/admin/upload?${query}`, blob, contentType, onProgress, signal);
  return urlFrom(body);
}

function urlFrom(body: unknown): string {
  if (body && typeof body === 'object' && 'url' in body && typeof body.url === 'string') return body.url;
  throw new UploadError('The upload finished without an address. Try again.');
}

async function postJson(path: string, payload: unknown, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new UploadError("Couldn't reach the server. Check your connection, then try again.");
  }
  const text = await response.text();
  if (response.status === 401) window.location.assign(signInPath());
  if (!response.ok) throw new UploadError(serverMessage(text) ?? `The upload failed (error ${response.status}).`);
  return JSON.parse(text || '{}');
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** A film too big for one request: start, then 50 MiB parts three at a time, each tried up to three times, then finish. */
async function uploadInParts(
  blob: Blob,
  hint: { project: string; field: string },
  contentType: string,
  onProgress?: ProgressHandler,
  signal?: AbortSignal,
): Promise<string> {
  const started = (await postJson('/api/admin/upload/start', { ...hint, type: contentType, size: blob.size }, signal)) as {
    key: string;
    uploadId: string;
    partSize: number;
  };
  const { key, uploadId, partSize } = started;
  const count = Math.ceil(blob.size / partSize);
  const loaded = new Array<number>(count).fill(0);
  const report = () => onProgress?.(loaded.reduce((sum, n) => sum + n, 0) / blob.size);
  const parts: { partNumber: number; etag: string }[] = [];
  let next = 0;

  async function sendPart(n: number): Promise<void> {
    const chunk = blob.slice((n - 1) * partSize, Math.min(blob.size, n * partSize));
    const query = new URLSearchParams({ key, uploadId, n: String(n) });
    for (let attempt = 1; ; attempt++) {
      try {
        const body = (await send('PUT', `/api/admin/upload/part?${query}`, chunk, contentType, (fraction) => {
          loaded[n - 1] = (fraction ?? 0) * chunk.size;
          report();
        }, signal)) as { partNumber: number; etag: string };
        parts.push({ partNumber: body.partNumber, etag: body.etag });
        loaded[n - 1] = chunk.size;
        report();
        return;
      } catch (error) {
        if (signal?.aborted || attempt >= PART_TRIES) throw error;
        loaded[n - 1] = 0;
        await wait(1000 * 2 ** (attempt - 1));
      }
    }
  }

  async function worker(): Promise<void> {
    while (next < count) {
      next += 1;
      await sendPart(next);
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, count) }, worker));
    const finished = await postJson('/api/admin/upload/finish', { key, uploadId, parts: parts.sort((a, b) => a.partNumber - b.partNumber) }, signal);
    return urlFrom(finished);
  } catch (error) {
    const query = new URLSearchParams({ key, uploadId });
    fetch(`/api/admin/upload?${query}`, { method: 'DELETE' }).catch(() => {});
    throw error;
  }
}

function send(method: string, url: string, body: Blob, contentType: string, onProgress?: ProgressHandler, signal?: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload cancelled.', 'AbortError'));
      return;
    }
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    signal?.addEventListener('abort', abort, { once: true });
    request.open(method, url);
    request.setRequestHeader('content-type', contentType);
    request.upload.onprogress = (event) => onProgress?.(event.lengthComputable ? event.loaded / event.total : null);
    request.onload = () => {
      signal?.removeEventListener('abort', abort);
      if (request.status === 401) window.location.assign(signInPath());
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(1);
        try {
          resolve(JSON.parse(request.responseText || '{}'));
        } catch {
          resolve({});
        }
      } else {
        reject(new UploadError(serverMessage(request.responseText) ?? `The upload failed (error ${request.status}).`));
      }
    };
    request.onabort = () => reject(new DOMException('Upload cancelled.', 'AbortError'));
    request.onerror = () => {
      signal?.removeEventListener('abort', abort);
      reject(new UploadError('The upload was interrupted. Check your connection, then try again.'));
    };
    request.send(body);
  });
}

function serverMessage(responseText: string): string | null {
  try {
    const body: unknown = JSON.parse(responseText);
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') return body.error;
  } catch {
    // Not JSON: fall back to the status code.
  }
  return null;
}

/** Maps a 0..1 progress callback onto a slice of a larger one, for multi-file uploads. */
function part(onProgress: ProgressHandler | undefined, from: number, to: number): ProgressHandler | undefined {
  if (!onProgress) return undefined;
  return (fraction) => onProgress(fraction === null ? null : from + fraction * (to - from));
}

// ---------------------------------------------------------------- image processing

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new UploadError("This image couldn't be opened in the browser. Save it as JPG, PNG or WebP and try again.");
  }
}

function fitWithin(width: number, height: number, maxWidth: number) {
  const scale = Math.min(1, maxWidth / width, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function encodeImage(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, maxWidth: number) {
  const { width, height } = fitWithin(sourceWidth, sourceHeight, maxWidth);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new UploadError("This browser couldn't process the image. Try the latest Chrome, Safari or Firefox.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);

  try {
    return { blob: await canvasToBlob(canvas), width, height };
  } finally {
    // Release the backing store straight away; Safari is slow to reclaim canvas memory.
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await toBlob(canvas, 'image/webp', WEBP_QUALITY);
  if (webp?.type === 'image/webp') return webp;
  // Browsers without a WebP encoder silently return PNG; JPEG keeps the file small instead.
  const jpeg = await toBlob(canvas, 'image/jpeg', JPEG_QUALITY);
  if (jpeg) return jpeg;
  throw new UploadError("This browser couldn't save the image. Try the latest Chrome, Safari or Firefox.");
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(resolve, type, quality);
    } catch (error) {
      reject(error);
    }
  });
}

// ---------------------------------------------------------------- video helpers

const EXTENSION_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

/** Some systems report an empty type for .mov files; fall back to the extension. */
function contentTypeOf(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[extension] ?? '';
}

function waitFor(target: HTMLMediaElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error('timeout')), timeoutMs);
    const onEvent = () => finish();
    const onError = () => finish(new Error('media error'));
    function finish(error?: Error) {
      window.clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener('error', onError);
      if (error) reject(error);
      else resolve();
    }
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

/** Width and height are optional in the model, so a file the browser can't read still uploads. */
async function readVideoSize(file: File): Promise<{ width?: number; height?: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.src = url;
  try {
    await waitFor(video, 'loadedmetadata', 8000);
    return video.videoWidth ? { width: video.videoWidth, height: video.videoHeight } : {};
  } catch {
    return {};
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** A film cued to `time`, ready to draw. Media-domain films are read through the admin's same-origin copy. */
export async function loadVideoFrame(src: string, time: number): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = src.startsWith('blob:') ? src : readableUrl(src);
  try {
    await waitFor(video, 'loadeddata', 20000);
    const target = Math.max(0, Math.min(time, (video.duration || time) - 0.05));
    if (Math.abs(video.currentTime - target) > 0.01) {
      video.currentTime = target;
      await waitFor(video, 'seeked', 20000);
    }
    return video;
  } catch {
    throw new UploadError("Couldn't read a frame from this video. Upload a still image instead.");
  }
}

function megabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}
