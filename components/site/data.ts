import 'server-only';
import { cache } from 'react';
import { cms, type Project, type Settings } from '@/lib/cms';

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

/** The project after `current` in the published order, wrapping to the first; null when there is no other. */
export function nextProject(all: Project[], current: Project): Project | null {
  const others = all.filter((p) => p.id !== current.id);
  if (others.length === 0) return null;
  const index = all.findIndex((p) => p.id === current.id);
  return index === -1 ? others[0] : all[(index + 1) % all.length];
}

/** The Lair band renders only when there is something to show in it. */
export function hasLair(settings: Settings): boolean {
  return Boolean(settings.lairUrl || settings.lairFilm || settings.lairBlurb);
}
