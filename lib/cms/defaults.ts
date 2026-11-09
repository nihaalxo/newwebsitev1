import defaultSettings from './default-settings.json';
import type { ProjectInput, Settings } from './types';

// Safe to import from client components: no server-only code lives here.

/**
 * What the site shows before anything has been saved in Site settings. The values live in default-settings.json so
 * scripts/seed-local.mjs and scripts/push-to-cloudflare.mjs seed exactly the same words.
 */
export const DEFAULT_SETTINGS: Settings = {
  ...(defaultSettings as unknown as Omit<Settings, 'updatedAt'>),
  updatedAt: '',
};

/** The starting point for "New project" in the admin. */
export function emptyProject(): ProjectInput {
  return {
    slug: '',
    title: '',
    category: 'brand',
    year: new Date().getFullYear(),
    discipline: '',
    summary: '',
    shown: '',
    stillOnly: false,
    cover: null,
    accent: '#6FF3FF',
    role: '',
    projectType: '',
    tools: '',
    deliverables: '',
    link: '',
    featured: false,
    position: 0,
    status: 'draft',
    blocks: [],
  };
}

/**
 * Fills in any setting a stored record lacks (for example one added after it was saved) and drops unknown keys.
 * A key that is present wins even when it is null, so clearing the portrait does not bring the default back.
 */
export function withSettingsDefaults(stored: Partial<Settings> | null | undefined): Settings {
  const source: Partial<Settings> = stored ?? {};
  const merged = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (source[key] !== undefined) (merged as Record<keyof Settings, unknown>)[key] = source[key];
  }
  return merged;
}

// ---- Rules shared by both storage modes and supabase/migrations/0001_init.sql. Keep the three in step.

/** Lowercase words joined by single hyphens, e.g. "my-chaii-london". Mirrors the projects_slug_format check. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Mirrors the 'media' bucket's file size limit. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** A CV is a few pages of text; anything bigger is almost certainly the wrong file. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Mirrors the 'media' bucket's allowed MIME types. SVG is left out on purpose: it can carry script. */
export const ALLOWED_UPLOAD_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
];

/**
 * The extension each allowed type is stored under (components/admin/sanitize.ts names uploads the same way).
 * Local mode serves public/uploads by extension, so a file must never get one its checked type doesn't have:
 * an ".html" or ".svg" file would run script on the site's own origin.
 */
const UPLOAD_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};

/**
 * Where uploads may go inside the media store: "projects/<slug-or-id>/<file>", "site/<group>/<file>" or
 * "site/<file>" (the admin names site files "site/<field>-<timestamp>-<random>.<ext>"). The extension is captured
 * so it can be checked against UPLOAD_EXTENSIONS.
 */
const UPLOAD_PATH_PATTERN = /^(?:projects\/[a-z0-9-]+|site(?:\/[a-z0-9-]+)?)\/[a-z0-9._-]+\.([a-z0-9]+)$/;

export function isAllowedUploadPath(path: string): boolean {
  const match = UPLOAD_PATH_PATTERN.exec(path);
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  return (
    match !== null &&
    Object.values(UPLOAD_EXTENSIONS).includes(match[1]) &&
    !path.includes('..') &&
    !fileName.startsWith('.')
  );
}

/** "image/webp; charset=binary" -> "image/webp". */
function mimeOf(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

/** Accepts a bare MIME type or a Content-Type header value such as "image/webp; charset=binary". */
export function isAllowedUploadType(contentType: string): boolean {
  return ALLOWED_UPLOAD_TYPES.includes(mimeOf(contentType));
}

/** True when `path` ends in the extension stored for `contentType`, so the file is served as the type that was checked. */
export function uploadPathMatchesType(path: string, contentType: string): boolean {
  const mime = mimeOf(contentType);
  return Object.hasOwn(UPLOAD_EXTENSIONS, mime) && path.endsWith(`.${UPLOAD_EXTENSIONS[mime]}`);
}
