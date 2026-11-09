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
  type CvSection,
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

/** A time in a film, to the tenth of a second. NaN when it isn't a number, which rules.ts refuses. */
function seconds(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : Number.NaN;
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
  const tall = mediaSource(data.srcTall);
  if (kind === 'video' && tall) result.srcTall = tall;
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
    shown: line(value.shown, LIMITS.summary),
    stillOnly: value.stillOnly === true,
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

/** Lowercase words joined by hyphens, for a CV section's anchor. */
function sectionId(value: unknown, title: string, taken: Set<string>): string {
  const base = slugify(line(value, 40)) || slugify(title) || 'section';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

function cvSections(value: unknown): CvSection[] {
  const taken = new Set<string>();
  return (Array.isArray(value) ? value : []).filter(isData).map((section) => {
    const title = line(section.title);
    const entries = Array.isArray(section.entries) ? section.entries : [];
    return {
      id: sectionId(section.id, title, taken),
      title,
      column: section.column === 2 ? 2 : 1,
      entries: entries.filter(isData).map((entry) => ({
        role: line(entry.role),
        when: line(entry.when, 80),
        at: line(entry.at),
      })),
    };
  });
}

/** One control per line, "keys: what they do", with the spacing around the colon tidied. */
function controls(value: unknown): string {
  return prose(value, LIMITS.paragraph)
    .split('\n')
    .map((entry) => entry.replace(/\s+/g, ' ').trim().replace(/\s*:\s*/, ': '))
    .filter(Boolean)
    .join('\n');
}

export function sanitizeSettings(value: unknown): SettingsInput | null {
  if (!isData(value)) return null;
  const education = Array.isArray(value.education) ? value.education : [];

  return {
    siteDescription: line(value.siteDescription, LIMITS.description),
    heroLead: line(value.heroLead, LIMITS.line),
    heroFilm: optionalMedia(value.heroFilm, 'video'),
    heroFilmLoopStart: seconds(value.heroFilmLoopStart),
    heroFilmLoopEnd: seconds(value.heroFilmLoopEnd),
    fiveLine: line(value.fiveLine),
    fiveFooter: line(value.fiveFooter),
    workTitle: line(value.workTitle, 60),
    allProjectsTitle: line(value.allProjectsTitle, 60),
    lairTitle: line(value.lairTitle, 60),
    lairBlurb: prose(value.lairBlurb, LIMITS.paragraph),
    lairControls: controls(value.lairControls),
    lairNudge: prose(value.lairNudge, LIMITS.paragraph),
    lairTouch: line(value.lairTouch, LIMITS.paragraph),
    lairFilm: optionalMedia(value.lairFilm, 'video'),
    aboutTitle: line(value.aboutTitle, 60),
    aboutStatement: prose(value.aboutStatement, LIMITS.paragraph),
    education: education.map((entry) => line(entry)).filter(Boolean),
    tools: line(value.tools, LIMITS.tools),
    basedIn: line(value.basedIn),
    availability: line(value.availability),
    portrait: optionalMedia(value.portrait, 'image'),
    aboutPhotoCaption: line(value.aboutPhotoCaption, 80),
    aboutFilm: optionalMedia(value.aboutFilm, 'video'),
    cvTitle: line(value.cvTitle, 60),
    cvHeadline: line(value.cvHeadline),
    cvPlace: line(value.cvPlace, 80),
    cvUrl: line(value.cvUrl, LIMITS.url),
    cvSections: cvSections(value.cvSections),
    contactTitle: line(value.contactTitle),
    contactFallback: line(value.contactFallback),
    contactLead: line(value.contactLead, LIMITS.paragraph),
    email: line(value.email).replace(/^mailto:/i, ''),
    linkedin: line(value.linkedin, LIMITS.url),
    instagram: instagramUrl(line(value.instagram, LIMITS.url)),
    contactFilm: optionalMedia(value.contactFilm, 'video'),
    contactFilmStart: seconds(value.contactFilmStart),
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
