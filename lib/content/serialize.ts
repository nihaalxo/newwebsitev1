import type { Block, HomeLayout, Media, Project, ProjectInput, Redirects } from '@/lib/cms/types';

/*
 * The one way content files are written: by the admin's publish (lib/admin-api/plan.ts), by
 * `npm run content:format`, and checked by `npm run check`. Keys always come in the same order and the output is
 * JSON.stringify(…, null, 2) plus a final newline, so the same content always has the same bytes and the same git
 * blob, and a diff shows only what changed. Pure: runs in Node, the browser and the Worker.
 */

type Json = Record<string, unknown>;

/** Copies `keys` from `source` in that order, leaving out undefined ones (and any key not listed). */
function pick(source: Json, keys: readonly string[]): Json {
  const out: Json = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

const PROJECT_KEYS = [
  'id',
  'slug',
  'title',
  'category',
  'discipline',
  'year',
  'summary',
  'accent',
  'cover',
  'shown',
  'stillOnly',
  'role',
  'projectType',
  'tools',
  'deliverables',
  'link',
  'blocks',
  'createdAt',
  'updatedAt',
  'publishedAt',
] as const;

const MEDIA_KEYS = ['kind', 'src', 'srcSmall', 'poster', 'srcTall', 'alt', 'width', 'height'] as const;

/** Each block's fields after id and type, in the order lib/cms/types.ts declares them. */
const BLOCK_KEYS: Record<Block['type'], readonly string[]> = {
  text: ['heading', 'body'],
  image: ['media', 'caption', 'size'],
  gallery: ['items', 'columns', 'caption'],
  video: ['media', 'caption', 'loop'],
  quote: ['text', 'cite'],
};

function canonicalMedia(media: Media | null | undefined): Json | null {
  if (!media) return null;
  return pick(media as unknown as Json, MEDIA_KEYS);
}

function canonicalBlock(block: Block): Json {
  const ordered = pick(block as unknown as Json, ['id', 'type', ...BLOCK_KEYS[block.type]]);
  if ('media' in ordered) ordered.media = canonicalMedia(ordered.media as Media);
  if (Array.isArray(ordered.items)) ordered.items = (ordered.items as Media[]).map(canonicalMedia);
  return ordered;
}

/** A project in canonical key order: what content/projects/<slug>.json holds. */
export function canonicalProject(project: Project | (ProjectInput & { id: string })): Json {
  const ordered = pick(project as unknown as Json, PROJECT_KEYS);
  ordered.cover = canonicalMedia(project.cover);
  ordered.blocks = project.blocks.map(canonicalBlock);
  if (ordered.publishedAt === undefined) ordered.publishedAt = null;
  return ordered;
}

function text(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function serializeProject(project: Project | (ProjectInput & { id: string })): string {
  return text(canonicalProject(project));
}

export function serializeHome(home: HomeLayout): string {
  return text({ highlights: [...home.highlights], order: [...home.order] });
}

export function serializeRedirects(redirects: Redirects): string {
  const sorted: Json = {};
  for (const from of Object.keys(redirects).sort()) {
    const { to, status, id } = redirects[from];
    sorted[from] = id ? { to, status, id } : { to, status };
  }
  return text(sorted);
}

/** content/projects/<slug>.json */
export function projectPath(slug: string): string {
  return `content/projects/${slug}.json`;
}

export const HOME_PATH = 'content/home.json';
export const REDIRECTS_PATH = 'content/redirects.json';

/** "content/projects/my-chaii-london.json" -> "my-chaii-london"; null for any other path. */
export function slugOfPath(path: string): string | null {
  const match = /^content\/projects\/([a-z0-9-]+)\.json$/.exec(path);
  return match ? match[1] : null;
}
