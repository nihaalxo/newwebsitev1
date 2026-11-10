// What the admin API receives is untrusted: these functions coerce a payload into the content model, trimming and
// capping every string. Whether the result is acceptable (required fields, formats, how many blocks or images) is
// decided afterwards by components/admin/rules.ts. Lists are passed through whole, so one that is too long is refused
// there rather than cut short here; the 512 KB cap on a draft bounds them.
// No 'server-only' and no Next imports: the Worker bundles this.

import { SLUG_PATTERN, UPLOAD_EXTENSIONS, mimeOf } from '@/lib/cms/defaults';
import { CATEGORIES, PROJECT_TYPES, type Block, type Category, type Media, type ProjectInput, type ProjectType } from '@/lib/cms/types';
import { HEX_PATTERN, LIMITS, isHttpUrl, isSitePath, slugify, type FieldErrors } from '@/components/admin/rules';

type Data = Record<string, unknown>;

function isData(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One line of text: whitespace collapsed, trimmed, capped. */
function line(value: unknown, max: number = LIMITS.line): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Multi-line text: paragraphs kept, runs of blank lines reduced to one. */
function prose(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function oneOf<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Media sources come from uploads: a site path or an http(s) URL, never javascript: or data:. */
function mediaSource(value: unknown): string {
  const source = line(value, 1000);
  return isSitePath(source) || isHttpUrl(source) ? source : '';
}

function dimension(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 20000 ? n : undefined;
}

/** An ISO time such as "2026-11-09T21:10:43.416Z", or '' when it isn't one. */
function timestamp(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(value) ? value : '';
}

/** Returns media with an empty `src` when nothing usable was sent; callers decide whether that means "none". */
function media(value: unknown, kind: Media['kind']): Media {
  const data = isData(value) ? value : {};
  const result: Media = { kind, src: mediaSource(data.src), alt: line(data.alt, LIMITS.alt) };
  const small = mediaSource(data.srcSmall);
  const poster = mediaSource(data.poster);
  const tall = mediaSource(data.srcTall);
  const width = dimension(data.width);
  const height = dimension(data.height);
  if (kind === 'image' && small) result.srcSmall = small;
  if (kind === 'video' && poster) result.poster = poster;
  if (kind === 'video' && tall) result.srcTall = tall;
  if (width && height) {
    result.width = width;
    result.height = height;
  }
  return result;
}

function optionalMedia(value: unknown, kind: Media['kind']): Media | null {
  const result = media(value, kind);
  return result.src ? result : null;
}

const BLOCK_ID = /^[A-Za-z0-9_-]{1,64}$/;

function block(value: unknown, seenIds: Set<string>): Block | null {
  if (!isData(value)) return null;
  let id = typeof value.id === 'string' && BLOCK_ID.test(value.id) ? value.id : crypto.randomUUID();
  if (seenIds.has(id)) id = crypto.randomUUID();
  seenIds.add(id);

  const caption = line(value.caption, LIMITS.caption);
  switch (value.type) {
    case 'text': {
      const heading = line(value.heading, LIMITS.heading);
      return { id, type: 'text', ...(heading ? { heading } : {}), body: prose(value.body, LIMITS.body) };
    }
    case 'quote': {
      const cite = line(value.cite, LIMITS.cite);
      return { id, type: 'quote', text: prose(value.text, LIMITS.quote), ...(cite ? { cite } : {}) };
    }
    case 'image':
      return {
        id,
        type: 'image',
        media: media(value.media, 'image'),
        ...(caption ? { caption } : {}),
        size: oneOf(value.size, ['full', 'wide', 'inset'] as const, 'wide'),
      };
    case 'video':
      return { id, type: 'video', media: media(value.media, 'video'), ...(caption ? { caption } : {}), loop: value.loop !== false };
    case 'gallery': {
      const items = Array.isArray(value.items) ? value.items : [];
      return {
        id,
        type: 'gallery',
        items: items.map((item) => media(item, 'image')).filter((item) => item.src),
        columns: oneOf(value.columns, [2, 3] as const, 2),
        ...(caption ? { caption } : {}),
      };
    }
    default:
      return null;
  }
}

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
const PROJECT_TYPE_IDS: ProjectType[] = ['', ...PROJECT_TYPES.map((t) => t.id)];

/** A project id: a UUID, as the editor makes with crypto.randomUUID(). Upload keys are filed under it. */
export const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Coerces a project into the content model. `problems` holds values that could not be coerced at all (an unknown
 * category). Null when it isn't an object or has no valid id.
 */
export function sanitizeProject(value: unknown): { input: ProjectInput & { id: string }; problems: FieldErrors } | null {
  if (!isData(value) || typeof value.id !== 'string' || !PROJECT_ID.test(value.id)) return null;
  const problems: FieldErrors = {};

  const category = CATEGORY_IDS.includes(value.category as Category) ? (value.category as Category) : null;
  if (!category) problems.category = 'Choose a category.';

  const accent = line(value.accent, 7);
  const blocks = Array.isArray(value.blocks) ? value.blocks : [];
  const seenIds = new Set<string>();
  const year = Number(value.year);

  const input: ProjectInput & { id: string } = {
    id: value.id,
    slug: line(value.slug, LIMITS.slug).toLowerCase(),
    title: line(value.title, LIMITS.title),
    category: category ?? 'brand',
    discipline: line(value.discipline, LIMITS.discipline),
    year: Number.isInteger(year) ? year : Number.NaN,
    summary: line(value.summary, LIMITS.summary),
    accent: HEX_PATTERN.test(accent) ? accent.toUpperCase() : accent,
    cover: optionalMedia(value.cover, 'image'),
    shown: line(value.shown, LIMITS.summary),
    stillOnly: value.stillOnly === true,
    role: line(value.role, LIMITS.role),
    projectType: oneOf(value.projectType, PROJECT_TYPE_IDS, ''),
    tools: line(value.tools, LIMITS.tools),
    deliverables: line(value.deliverables, LIMITS.deliverables),
    link: line(value.link, LIMITS.url),
    blocks: blocks.map((b) => block(b, seenIds)).filter((b): b is Block => b !== null),
    createdAt: timestamp(value.createdAt),
    updatedAt: timestamp(value.updatedAt),
    publishedAt: timestamp(value.publishedAt) || null,
  };
  return { input, problems };
}

export function uploadExtension(contentType: unknown): string | null {
  if (typeof contentType !== 'string') return null;
  const mime = mimeOf(contentType);
  return Object.hasOwn(UPLOAD_EXTENSIONS, mime) ? UPLOAD_EXTENSIONS[mime] : null;
}

/** "20261109211043": the time in UTC, to the second. */
function stamp(now: Date): string {
  return now.toISOString().replace(/\D/g, '').slice(0, 14);
}

function randomBase36(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => (byte % 36).toString(36)).join('');
}

/**
 * The key an upload is stored under: p/<project id>/<field>-<YYYYMMDDHHmmss>-<6 base36>.<ext>. Only the shape of
 * the hint is used: the field is re-slugged, and the time, the random part and the extension are made here.
 */
export function buildUploadPath(hint: { project: unknown; field: unknown }, extension: string, now = new Date()): string | null {
  if (typeof hint.project !== 'string' || !PROJECT_ID.test(hint.project)) return null;
  const field = slugify(typeof hint.field === 'string' ? hint.field : '').slice(0, 40).replace(/-+$/, '') || 'file';
  if (!SLUG_PATTERN.test(field)) return null;
  return `p/${hint.project}/${field}-${stamp(now)}-${randomBase36(6)}.${extension}`;
}
