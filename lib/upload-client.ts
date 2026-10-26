// Browser-only upload helpers for the admin. Images are resized and re-encoded here, so the server and the
// public site only ever see web-ready files. Every upload asks the server for a ticket first (the server decides
// the storage path), then sends the bytes straight to local disk (development) or Supabase Storage (production).

import { createUploadTicket } from '@/app/admin/actions';
import { MAX_UPLOAD_BYTES } from '@/lib/cms/defaults';
import type { Media, UploadTicket } from '@/lib/cms/types';

/** Reports upload progress from 0 to 1, or null when the transport can't measure it. */
export type ProgressHandler = (fraction: number | null) => void;

/** The media store's own limit, so a video is refused here before a long upload fails there. */
export const MAX_VIDEO_BYTES = MAX_UPLOAD_BYTES;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_GIF_BYTES = 15 * 1024 * 1024;

const FULL_WIDTH = 2400;
const SMALL_WIDTH = 960;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.86;
/** Safari refuses canvases larger than about 16.7 million pixels. */
const MAX_CANVAS_PIXELS = 16_000_000;

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif';
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mov';
export const PDF_ACCEPT = 'application/pdf,.pdf';

/** An error whose message is written for the owner and can be shown as-is. */
export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof UploadError) return error.message;
  return 'The upload failed. Check your connection and try again.';
}

// ---------------------------------------------------------------- public API

/** Resizes to WebP at most 2400px wide (plus a 960px copy for cards) and uploads both. */
export async function uploadImage(file: File, folderHint: string, onProgress?: ProgressHandler): Promise<Media> {
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
    const srcSmall = small
      ? await uploadBlob(small.blob, `${folderHint}-sm`, small.blob.type, part(onProgress, 0.8, 1))
      : src;
    return { kind: 'image', src, srcSmall, alt: '', width: full.width, height: full.height };
  } finally {
    bitmap.close();
  }
}

/** Like uploadImage but a single file and no card-sized copy: for video posters. Resolves to its URL. */
export async function uploadStill(file: File, folderHint: string, onProgress?: ProgressHandler): Promise<string> {
  if (file.type && !file.type.startsWith('image/')) throw new UploadError("That file isn't an image. Use JPG, PNG or WebP.");
  const bitmap = await decodeImage(file);
  try {
    const still = await encodeImage(bitmap, bitmap.width, bitmap.height, FULL_WIDTH);
    return await uploadBlob(still.blob, folderHint, still.blob.type, onProgress);
  } finally {
    bitmap.close();
  }
}

/** Uploads a video as-is. Over 50 MB is refused before anything is sent. */
export async function uploadVideo(file: File, folderHint = 'site/video', onProgress?: ProgressHandler): Promise<Media> {
  const contentType = contentTypeOf(file);
  if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(contentType)) {
    throw new UploadError("That file isn't a video we can use. Use MP4 (H.264 plays everywhere), WebM or MOV.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new UploadError(
      `This video is ${megabytes(file.size)}; the limit is 50 MB. Export a smaller MP4 (H.264, 1080p) and try again.`,
    );
  }
  const size = await readVideoSize(file);
  const src = await uploadBlob(file, folderHint, contentType, onProgress);
  return { kind: 'video', src, alt: '', ...size };
}

/** Uploads a PDF and resolves to its public URL. */
export async function uploadFile(file: File, folderHint = 'site/cv', onProgress?: ProgressHandler): Promise<string> {
  if (contentTypeOf(file) !== 'application/pdf') throw new UploadError("That file isn't a PDF.");
  if (file.size > MAX_PDF_BYTES) throw new UploadError(`This PDF is ${megabytes(file.size)}; the limit is 20 MB.`);
  return uploadBlob(file, folderHint, 'application/pdf', onProgress);
}

/** Grabs the frame at `time` seconds from a video and uploads it as a poster still. Resolves to its URL. */
export async function uploadVideoFrame(
  videoSrc: string,
  time: number,
  folderHint: string,
  onProgress?: ProgressHandler,
): Promise<string> {
  const video = await loadVideoFrame(videoSrc, time);
  try {
    const frame = await encodeImage(video, video.videoWidth, video.videoHeight, FULL_WIDTH);
    return await uploadBlob(frame.blob, folderHint, frame.blob.type, onProgress);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      throw new UploadError("This video's server doesn't allow reading its frames. Upload a still image instead.");
    }
    throw error;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

// ---------------------------------------------------------------- transport

async function uploadBlob(blob: Blob, hint: string, contentType: string, onProgress?: ProgressHandler): Promise<string> {
  const result = await createUploadTicket(hint, contentType);
  if (!result.ok) throw new UploadError(result.error);
  await send(result.ticket, blob, contentType, onProgress);
  return result.ticket.publicUrl;
}

async function send(ticket: UploadTicket, blob: Blob, contentType: string, onProgress?: ProgressHandler) {
  if (ticket.mode === 'local') {
    await putWithProgress(ticket.url, blob, contentType, onProgress);
    return;
  }

  // Supabase's client can't report progress, so the field shows a busy state instead of a percentage.
  onProgress?.(null);
  const { createSupabaseBrowserClient } = await import('@/lib/supabase/browser');
  const { error } = await createSupabaseBrowserClient()
    .storage.from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, blob, { contentType });
  if (error) throw new UploadError(`Supabase refused the upload: ${error.message}`);
  onProgress?.(1);
}

function putWithProgress(url: string, body: Blob, contentType: string, onProgress?: ProgressHandler): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('content-type', contentType);
    request.upload.onprogress = (event) => onProgress?.(event.lengthComputable ? event.loaded / event.total : null);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new UploadError(serverMessage(request.responseText) ?? `The upload failed (error ${request.status}).`));
      }
    };
    request.onerror = () =>
      reject(new UploadError('The upload was interrupted. Check that the dev server is still running, then try again.'));
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
  pdf: 'application/pdf',
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

async function loadVideoFrame(src: string, time: number): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  // Needed to read pixels from Supabase-hosted films; harmless for same-origin files.
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = src;
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
