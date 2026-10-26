import 'server-only';

// Server actions are public HTTP endpoints, so everything they receive is treated as untrusted:
// these functions coerce a payload into the content model, trimming and capping every string.
// Whether the result is acceptable (required fields, formats, how many blocks or images) is decided afterwards by
// rules.ts. Lists are passed through whole, so one that's too long is refused there rather than cut short here;
// the server action body limit (1 MB) bounds them.

import {
  CATEGORIES,
  PROJECT_TYPES,
  type Block,
  type Category,
  type Media,
  type ProjectInput,
  type ProjectType,
} from '@/lib/cms/types';
import {
  LIMITS,
  HEX_PATTERN,
  instagramUrl,
  isHttpUrl,
  isSitePath,
  slugify,
  type FieldErrors,
  type SettingsInput,
} from './rules';

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

/** Media sources come from our own uploads: a site path or an http(s) URL, never javascript: or data:. */
function mediaSource(value: unknown): string {
  const source = line(value, 1000);
  return isSitePath(source) || isHttpUrl(source) ? source : '';
}

function dimension(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 20000 ? n : undefined;
}

/** Returns media with an empty `src` when nothing usable was sent; callers decide whether that means "none". */
function media(value: unknown, kind: Media['kind']): Media {
  const data = isData(value) ? value : {};
  const result: Media = { kind, src: mediaSource(data.src), alt: line(data.alt, LIMITS.alt) };
  const small = mediaSource(data.srcSmall);
  const poster = mediaSource(data.poster);
  const width = dimension(data.width);
  const height = dimension(data.height);
  if (kind === 'image' && small) result.srcSmall = small;
  if (kind === 'video' && poster) result.poster = poster;
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

  switch (value.type) {
    case 'text':
      return { id, type: 'text', heading: line(value.heading, LIMITS.heading), body: prose(value.body, LIMITS.body) };
    case 'quote':
      return { id, type: 'quote', text: prose(value.text, LIMITS.quote), cite: line(value.cite, LIMITS.cite) };
    case 'image':
      return {
        id,
        type: 'image',
        media: media(value.media, 'image'),
        caption: line(value.caption, LIMITS.caption),
        size: oneOf(value.size, ['full', 'wide', 'inset'] as const, 'wide'),
      };
    case 'video':
      return {
        id,
        type: 'video',
        media: media(value.media, 'video'),
        caption: line(value.caption, LIMITS.caption),
        loop: value.loop !== false,
      };
    case 'gallery': {
      const items = Array.isArray(value.items) ? value.items : [];
      return {
        id,
        type: 'gallery',
        items: items.map((item) => media(item, 'image')).filter((item) => item.src),
        columns: oneOf(value.columns, [2, 3] as const, 2),
        caption: line(value.caption, LIMITS.caption),
      };
    }
    default:
      return null;
  }
}

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
const PROJECT_TYPE_IDS: ProjectType[] = ['', ...PROJECT_TYPES.map((t) => t.id)];

/** `problems` holds values that could not be coerced into the model at all (an unknown category). */
export function sanitizeProject(value: unknown): { input: ProjectInput; problems: FieldErrors } | null {
  if (!isData(value)) return null;
  const problems: FieldErrors = {};

  const category = CATEGORY_IDS.includes(value.category as Category) ? (value.category as Category) : null;
  if (!category) problems.category = 'Choose a category.';

  const accent = line(value.accent, 7);
  const position = Number(value.position);
  const blocks = Array.isArray(value.blocks) ? value.blocks : [];
  const seenIds = new Set<string>();

  const input: ProjectInput = {
    slug: line(value.slug, LIMITS.slug).toLowerCase(),
    title: line(value.title, LIMITS.title),
    category: category ?? 'brand',
    year: Number.isInteger(Number(value.year)) ? Number(value.year) : Number.NaN,
    discipline: line(value.discipline, LIMITS.discipline),
    summary: line(value.summary, LIMITS.summary),
    cover: optionalMedia(value.cover, 'image'),
    accent: HEX_PATTERN.test(accent) ? accent.toUpperCase() : accent,
    role: line(value.role, LIMITS.role),
    projectType: oneOf(value.projectType, PROJECT_TYPE_IDS, ''),
    tools: line(value.tools, LIMITS.tools),
    deliverables: line(value.deliverables, LIMITS.deliverables),
    link: line(value.link, LIMITS.url),
    featured: value.featured === true,
    position: Number.isInteger(position) && position >= 0 ? position : 0,
    status: value.status === 'published' ? 'published' : 'draft',
    blocks: blocks.map((b) => block(b, seenIds)).filter((b): b is Block => b !== null),
  };
  if (typeof value.id === 'string' && value.id) input.id = value.id.slice(0, 100);
  // The version the editor loaded; the store compares it with the stored one and refuses a stale save.
  if (input.id && typeof value.expectedUpdatedAt === 'string' && value.expectedUpdatedAt) {
    input.expectedUpdatedAt = value.expectedUpdatedAt.slice(0, 64);
  }

  return { input, problems };
}

export function sanitizeSettings(value: unknown): SettingsInput | null {
  if (!isData(value)) return null;
  const education = Array.isArray(value.education) ? value.education : [];
  const start = Number(value.heroFilmStart);

  return {
    heroLead: line(value.heroLead, LIMITS.line),
    heroCredit: line(value.heroCredit, LIMITS.line),
    aboutStatement: prose(value.aboutStatement, LIMITS.paragraph),
    basedIn: line(value.basedIn),
    availability: line(value.availability),
    cvUrl: line(value.cvUrl, LIMITS.url),
    avatar: optionalMedia(value.avatar, 'image'),
    portrait: optionalMedia(value.portrait, 'image'),
    email: line(value.email).replace(/^mailto:/i, ''),
    linkedin: line(value.linkedin, LIMITS.url),
    instagram: instagramUrl(line(value.instagram, LIMITS.url)),
    tools: line(value.tools, LIMITS.tools),
    education: education.map((entry) => line(entry)).filter(Boolean),
    lairUrl: line(value.lairUrl, LIMITS.url),
    lairBlurb: prose(value.lairBlurb, LIMITS.paragraph),
    lairBuiltWith: line(value.lairBuiltWith),
    heroFilm: optionalMedia(value.heroFilm, 'video'),
    heroFilmStart: Number.isFinite(start) ? Math.round(start * 10) / 10 : Number.NaN,
    lairFilm: optionalMedia(value.lairFilm, 'video'),
    contactFilm: optionalMedia(value.contactFilm, 'video'),
  };
}

/** File types the media store accepts, keyed by MIME type. The extension always comes from here, never the client. */
const UPLOAD_EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};

export function uploadExtension(contentType: unknown): string | null {
  return typeof contentType === 'string' && Object.hasOwn(UPLOAD_EXTENSIONS, contentType)
    ? UPLOAD_EXTENSIONS[contentType]
    : null;
}

/**
 * Builds a storage path from the client's hint ("projects/my-chaii/cover" or "site/avatar").
 * Only the shape of the hint is used; every segment is re-slugged and the file name is generated here:
 * projects/<slug-or-id>/<kind>-<timestamp>-<random>.<ext> or site/<field>-<timestamp>-<random>.<ext>.
 */
export function buildUploadPath(hint: unknown, extension: string): string | null {
  if (typeof hint !== 'string') return null;
  const [scope, ...rest] = hint
    .split('/')
    .map((part) => slugify(part).slice(0, 48))
    .filter(Boolean);
  const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  if (scope === 'projects') {
    const owner = rest[0] ?? 'unsorted';
    const kind = rest[1] ?? 'media';
    return `projects/${owner}/${kind}-${unique}.${extension}`;
  }
  if (scope === 'site') {
    const field = rest[0] ?? 'file';
    return `site/${field}-${unique}.${extension}`;
  }
  return null;
}
