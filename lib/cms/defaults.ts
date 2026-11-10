import type { ProjectInput } from './types';

// Safe to import from client components, the Worker and build scripts: no server-only code lives here.

/** The starting point for "New project" in the admin. The timestamps are set when it is first published. */
export function emptyProject(): ProjectInput {
  return {
    slug: '',
    title: '',
    category: 'brand',
    discipline: '',
    year: new Date().getFullYear(),
    summary: '',
    accent: '#6FF3FF',
    cover: null,
    shown: '',
    stillOnly: false,
    role: '',
    projectType: '',
    tools: '',
    deliverables: '',
    link: '',
    blocks: [],
    createdAt: '',
    updatedAt: '',
    publishedAt: null,
  };
}

/** Lowercase words joined by single hyphens, e.g. "my-chaii-london". */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The upload types the admin accepts. SVG and HTML are left out on purpose: they can carry script. */
export const ALLOWED_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const ALLOWED_VIDEO_TYPES: readonly string[] = ['video/mp4', 'video/webm', 'video/quicktime'];
export const ALLOWED_UPLOAD_TYPES: readonly string[] = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

/** The extension each allowed type is stored under. The extension always comes from here, never from the browser. */
export const UPLOAD_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/** "image/webp; charset=binary" -> "image/webp". */
export function mimeOf(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

/** Accepts a bare MIME type or a Content-Type header value such as "image/webp; charset=binary". */
export function isAllowedUploadType(contentType: string): boolean {
  return ALLOWED_UPLOAD_TYPES.includes(mimeOf(contentType));
}

const MiB = 1024 * 1024;

/** The largest film the admin takes. */
export const MAX_VIDEO_BYTES = 1024 * MiB;
/** Above this the admin suggests exporting a lighter film. */
export const VIDEO_WARN_BYTES = 200 * 1000 * 1000;
/** Files up to this size go up in one request; the Worker takes request bodies up to 100 MB on the Free plan. */
export const SINGLE_PUT_MAX = 95 * 1000 * 1000;
/** Bigger files go up in parts of this size (R2 takes parts of 5 MiB to 5 GiB). */
export const PART_SIZE = 50 * MiB;

/**
 * An upload's key in the media bucket: p/<project id>/<field>-<YYYYMMDDHHmmss>-<6 base36>.<ext>. Keys are only ever
 * made by the server (lib/admin-api/handler.ts), and nothing outside this pattern is read, served or deleted.
 */
export const MEDIA_KEY = /^p\/[0-9a-f-]{36}\/[a-z0-9-]{1,40}-\d{14}-[a-z0-9]{6}\.(webp|jpg|png|gif|avif|mp4|webm|mov)$/;

/**
 * Where the admin's uploads are served from: the media bucket's custom domain. Next fixes NEXT_PUBLIC_MEDIA_ORIGIN
 * into the pages at build time; the Worker has no `process` and reads its MEDIA_ORIGIN var instead (wrangler.jsonc).
 */
export const MEDIA_ORIGIN = (
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_MEDIA_ORIGIN : undefined) || 'https://media.nihaalnazeer.com'
).replace(/\/+$/, '');
