import { isSitePath, validateProject, type FieldErrors } from '@/components/admin/rules';
import { MAX_HIGHLIGHTS, type HomeLayout, type Media, type Project, type ProjectInput, type Redirects } from '@/lib/cms/types';
import { MEDIA_ORIGIN, SLUG_PATTERN } from '@/lib/cms/defaults';
import { HOME_PATH, REDIRECTS_PATH, projectPath } from './serialize';

/*
 * The checks every content file must pass: at build time (lib/content/load.ts), in `npm run check`, and in the
 * admin's publish (lib/admin-api/plan.ts). Pure: no file system, so the Worker runs it too.
 */

export interface ContentSet {
  projects: Project[];
  home: HomeLayout;
  redirects: Redirects;
}

/** Media sources a published project may use: a file on this site, or an upload on the media domain. */
export function mediaSourceProblem(src: string, mediaOrigin: string = MEDIA_ORIGIN): string | null {
  if (isSitePath(src)) return null;
  if (src.startsWith(`${mediaOrigin}/p/`)) return null;
  return `"${src}" is neither a path on this site nor an upload on ${mediaOrigin}`;
}

/** Each image or film in a project, with the key the editor marks its errors under. */
export function mediaList(project: Pick<Project, 'cover' | 'blocks'>): { key: string; media: Media }[] {
  const list: { key: string; media: Media }[] = [];
  if (project.cover) list.push({ key: 'cover', media: project.cover });
  for (const block of project.blocks ?? []) {
    if (block.type === 'image' || block.type === 'video') list.push({ key: `blocks.${block.id}.media`, media: block.media });
    if (block.type === 'gallery') block.items.forEach((item, i) => list.push({ key: `blocks.${block.id}.items.${i}`, media: item }));
  }
  return list;
}

const STRING_FIELDS = ['id', 'slug', 'title', 'category', 'discipline', 'summary', 'accent', 'shown', 'role', 'projectType', 'tools', 'deliverables', 'link', 'createdAt', 'updatedAt'] as const;

/** Wrong types, so a hand-edited file fails with a message instead of breaking the build somewhere else. */
function shapeErrors(project: Project): Record<string, string> {
  const errors: Record<string, string> = {};
  if (typeof project !== 'object' || project === null) return { file: 'is not a JSON object' };
  for (const key of STRING_FIELDS) if (typeof project[key] !== 'string') errors[key] = 'must be a string';
  if (typeof project.year !== 'number') errors.year = 'must be a number';
  if (typeof project.stillOnly !== 'boolean') errors.stillOnly = 'must be true or false';
  if (project.publishedAt !== null && typeof project.publishedAt !== 'string') errors.publishedAt = 'must be a time or null';
  if (project.cover !== null && typeof project.cover !== 'object') errors.cover = 'must be an image or null';
  if (!Array.isArray(project.blocks)) errors.blocks = 'must be a list';
  else {
    project.blocks.forEach((block, i) => {
      if (typeof block !== 'object' || block === null || typeof block.id !== 'string') errors[`blocks.${i}`] = 'needs an id';
      else if (!['text', 'image', 'gallery', 'video', 'quote'].includes(block.type)) errors[`blocks.${block.id}.type`] = `unknown block type "${String(block.type)}"`;
      else if ((block.type === 'image' || block.type === 'video') && (typeof block.media !== 'object' || block.media === null)) errors[`blocks.${block.id}.media`] = 'is missing';
      else if (block.type === 'gallery' && !Array.isArray(block.items)) errors[`blocks.${block.id}.items`] = 'must be a list';
    });
  }
  return errors;
}

/**
 * What stops a project from being published, keyed by field as the editor marks them: the editor's own rules for
 * publishing (components/admin/rules.ts) and where its files may live.
 */
export function projectFieldErrors(project: Project | (ProjectInput & { id: string }), mediaOrigin: string = MEDIA_ORIGIN): FieldErrors {
  const errors = validateProject(project, true);
  for (const { key, media } of mediaList(project)) {
    for (const field of ['src', 'srcSmall', 'poster', 'srcTall'] as const) {
      const src = media[field];
      if (src === undefined) continue;
      const problem = typeof src === 'string' ? mediaSourceProblem(src, mediaOrigin) : 'must be a string';
      if (problem) errors[`${key}.${field}`] = problem;
    }
  }
  return errors;
}

/** Every problem with one project file, as "field: message". */
export function projectProblems(project: Project, mediaOrigin: string = MEDIA_ORIGIN): string[] {
  const shape = shapeErrors(project);
  const errors = Object.keys(shape).length > 0 ? shape : projectFieldErrors(project, mediaOrigin);
  return Object.entries(errors).map(([field, message]) => `${field}: ${message}`);
}

/** Problems with the home page's layout, given the slugs that have a file. */
export function homeProblems(home: HomeLayout, slugs: Set<string>): string[] {
  const problems: string[] = [];
  if (!home || !Array.isArray(home.order) || !Array.isArray(home.highlights)) return ['must hold "highlights" and "order" lists'];
  const seen = new Set<string>();
  for (const slug of home.order) {
    if (seen.has(slug)) problems.push(`order: "${slug}" is listed twice`);
    seen.add(slug);
    if (!slugs.has(slug)) problems.push(`order: "${slug}" has no file in content/projects/`);
  }
  if (home.highlights.length > MAX_HIGHLIGHTS) problems.push(`highlights: at most ${MAX_HIGHLIGHTS}, not ${home.highlights.length}`);
  if (new Set(home.highlights).size !== home.highlights.length) problems.push('highlights: a project is listed twice');
  for (const slug of home.highlights) if (!seen.has(slug)) problems.push(`highlights: "${slug}" is not in order`);
  return problems;
}

/** Problems with the redirects, given the slugs that have a file. */
export function redirectProblems(redirects: Redirects, slugs: Set<string>): string[] {
  const problems: string[] = [];
  if (typeof redirects !== 'object' || redirects === null || Array.isArray(redirects)) return ['must be an object'];
  for (const [from, rule] of Object.entries(redirects)) {
    const match = /^\/work\/([a-z0-9-]+)$/.exec(from);
    if (!match) problems.push(`${from}: only /work/<slug> addresses can be redirected`);
    else if (slugs.has(match[1])) problems.push(`${from}: is a live project, so it can't also redirect`);
    if (typeof rule?.to !== 'string' || !rule.to.startsWith('/') || rule.to.startsWith('//')) problems.push(`${from}: "to" must be a path on this site`);
    if (rule?.status !== 301 && rule?.status !== 302) problems.push(`${from}: status must be 301 or 302`);
  }
  return problems;
}

/**
 * Every problem in a set of content, as "content/projects/x.json: field: message". `files` holds the file each
 * project came from, in the same order as `projects`.
 */
export function validateContent(content: ContentSet, files: string[], mediaOrigin: string = MEDIA_ORIGIN): string[] {
  const errors: string[] = [];
  const ids = new Map<string, string>();
  const slugs = new Set<string>();
  content.projects.forEach((project, i) => {
    const file = files[i] ?? '(unknown file)';
    for (const problem of projectProblems(project, mediaOrigin)) errors.push(`${file}: ${problem}`);
    const slug = typeof project?.slug === 'string' ? project.slug : '';
    if (SLUG_PATTERN.test(slug) && file !== projectPath(slug)) errors.push(`${file}: slug: "${slug}" must match the file name`);
    if (typeof project?.id === 'string') {
      if (ids.has(project.id)) errors.push(`${file}: id: also used by ${ids.get(project.id)}`);
      ids.set(project.id, file);
    }
    slugs.add(slug);
  });
  for (const problem of homeProblems(content.home, slugs)) errors.push(`${HOME_PATH}: ${problem}`);
  for (const problem of redirectProblems(content.redirects, slugs)) errors.push(`${REDIRECTS_PATH}: ${problem}`);
  return errors;
}
