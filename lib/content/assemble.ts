import { MAX_HIGHLIGHTS, type Block, type Draft, type HomeDraft, type HomeLayout, type Project, type Redirects } from '@/lib/cms/types';

/*
 * Putting the published content together for a page: the order, the highlights, the Lair's own case file. Pure, so
 * the build (app/(site)) and the admin's preview (app/admin/preview) put it together the same way.
 */

export interface Published {
  /** In site order. */
  projects: Project[];
  home: HomeLayout;
  redirects: Redirects;
}

/** Projects in the order content/home.json gives; any it leaves out follow, oldest published first. */
export function orderProjects(projects: Project[], home: HomeLayout): Project[] {
  const bySlug = new Map(projects.map((p) => [p.slug, p]));
  const ordered = home.order.map((slug) => bySlug.get(slug)).filter((p): p is Project => Boolean(p));
  const listed = new Set(ordered);
  const rest = projects.filter((p) => !listed.has(p)).sort(byPublished);
  return [...ordered, ...rest];
}

function byPublished(a: Project, b: Project): number {
  return (a.publishedAt ?? a.createdAt).localeCompare(b.publishedAt ?? b.createdAt) || a.slug.localeCompare(b.slug);
}

/** The home page's split: the highlights (at most MAX_HIGHLIGHTS, in their own order), then everything else in order. */
export function splitHighlights(ordered: Project[], highlights: string[]): { highlights: Project[]; rest: Project[] } {
  const bySlug = new Map(ordered.map((p) => [p.slug, p]));
  const chosen = highlights
    .map((slug) => bySlug.get(slug))
    .filter((p): p is Project => Boolean(p))
    .slice(0, MAX_HIGHLIGHTS);
  return { highlights: chosen, rest: ordered.filter((p) => !chosen.includes(p)) };
}

/**
 * The case file that tells how the Lair was built. Found by its id, which never changes, so renaming its web address
 * keeps the link; the slug it was first published under is the fallback.
 */
export const LAIR_STORY_ID = 'b2f3f3cd-38ee-5821-8498-db1a3e9ce573';
const LAIR_STORY_SLUG = 'immersive-portfolio-website';

export function findLairStory(projects: Project[]): Project | null {
  return projects.find((p) => p.id === LAIR_STORY_ID) ?? projects.find((p) => p.slug === LAIR_STORY_SLUG) ?? null;
}

// ---------------------------------------------------------------- home layout, shared with publishing

export interface HomeMergeInput {
  /** The current content/home.json, by slug. */
  current: HomeLayout;
  /** The id behind each slug of `current`. */
  idOfSlug: (slug: string) => string | undefined;
  /** The admin's changes to the order and highlights, by id, if they are part of this publish. */
  homeDraft: Pick<HomeDraft, 'highlights' | 'order'> | null;
  /** Every project on the site once this publish is live, by id, in no particular order. */
  live: { id: string; slug: string }[];
  /** Ids put on the site by this publish that weren't there before: they go to the end of the order. */
  added: string[];
}

/**
 * The home page's layout after a publish: the admin's order and highlights if they were sent, otherwise the current
 * ones; projects that are no longer on the site drop out (a home draft keeps them), new ones join at the end, and at
 * most MAX_HIGHLIGHTS highlights, each also in the order. Used by publishing and by the preview, so the preview shows
 * exactly what Publish will make.
 */
export function mergeHome({ current, idOfSlug, homeDraft, live, added }: HomeMergeInput): HomeLayout {
  const slugOf = new Map(live.map((p) => [p.id, p.slug]));
  const fromCurrent = (slugs: string[]) => slugs.map(idOfSlug).filter((id): id is string => Boolean(id));
  let order = fromCurrent(current.order);
  let highlights = fromCurrent(current.highlights);
  if (homeDraft) {
    order = [...homeDraft.order, ...order.filter((id) => !homeDraft.order.includes(id))];
    highlights = [...homeDraft.highlights];
  }
  order = [...new Set(order)].filter((id) => slugOf.has(id));
  for (const id of [...added, ...live.map((p) => p.id)]) if (slugOf.has(id) && !order.includes(id)) order.push(id);
  highlights = [...new Set(highlights)].filter((id) => order.includes(id)).slice(0, MAX_HIGHLIGHTS);
  return { highlights: highlights.map((id) => slugOf.get(id) as string), order: order.map((id) => slugOf.get(id) as string) };
}

// ---------------------------------------------------------------- preview

/** Drafts may hold blocks still waiting for their file; leave those out rather than render empty frames. */
export function isReady(block: Block): boolean {
  switch (block.type) {
    case 'image':
    case 'video':
      return Boolean(block.media.src);
    case 'gallery':
      return block.items.length > 0;
    default:
      return true;
  }
}

export function previewable(project: Project): Project {
  return { ...project, cover: project.cover?.src ? project.cover : null, blocks: project.blocks.filter(isReady) };
}

/** A draft's project with the timestamps a publish would give it, so it renders like a published one. */
function asPublished(draft: Draft, before: Project | undefined, now: string): Project {
  const p = draft.project;
  return {
    ...p,
    createdAt: before?.createdAt || p.createdAt || now,
    updatedAt: now,
    publishedAt: before?.publishedAt || p.publishedAt || now,
  };
}

/**
 * The site as it will be once `draft` (and the home draft) are published, for the admin's preview. A draft that
 * takes the project off the site is shown as it would be if published, so it can still be previewed.
 */
export function mergeForPreview(published: Published, draft: Draft | null, homeDraft: HomeDraft | null, now = new Date().toISOString()): Published {
  let projects = published.projects;
  const added: string[] = [];
  if (draft) {
    const before = projects.find((p) => p.id === draft.project.id);
    const project = previewable(asPublished(draft, before, now));
    if (before) projects = projects.map((p) => (p.id === project.id ? project : p));
    else {
      projects = [...projects, project];
      added.push(project.id);
    }
  }
  const idBySlug = new Map(published.projects.map((p) => [p.slug, p.id]));
  const home = mergeHome({
    current: published.home,
    idOfSlug: (slug) => idBySlug.get(slug),
    homeDraft,
    live: projects.map((p) => ({ id: p.id, slug: p.slug })),
    added,
  });
  return { projects: orderProjects(projects, home), home, redirects: published.redirects };
}
