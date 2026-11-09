import 'server-only';
import { cache } from 'react';
import { cms, type Project, type Settings } from '@/lib/cms';
import { MAX_HIGHLIGHTS } from '@/lib/cms/types';

// Request-scoped memoisation, so a page and its generateMetadata share one read.

export const getSettings = cache(async (): Promise<Settings> => (await cms()).getSettings());

/** Published projects in the owner's order (lower position first). */
export const listPublished = cache(async (): Promise<Project[]> => {
  const projects = await (await cms()).listPublished();
  return [...projects].sort((a, b) => a.position - b.position);
});

export const getPublishedProject = cache(async (slug: string): Promise<Project | null> =>
  (await cms()).getPublishedBySlug(slug),
);

/** Splits published projects for the home page: the highlights, at most MAX_HIGHLIGHTS, and everything else, in order. */
export function splitHighlights(projects: Project[]): { highlights: Project[]; rest: Project[] } {
  const highlights = projects.filter((p) => p.featured).slice(0, MAX_HIGHLIGHTS);
  return { highlights, rest: projects.filter((p) => !highlights.includes(p)) };
}
