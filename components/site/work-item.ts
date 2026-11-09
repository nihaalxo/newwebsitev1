import type { Project } from '@/lib/cms/types';

/** What a plate or a list row draws of a project. */
export type WorkItem = Pick<
  Project,
  'id' | 'slug' | 'title' | 'category' | 'discipline' | 'year' | 'summary' | 'cover' | 'accent'
>;

/** Only what the plates and rows draw, so the client bundle doesn't carry every case study's blocks. */
export function toWorkItem({ id, slug, title, category, discipline, year, summary, cover, accent }: Project): WorkItem {
  return { id, slug, title, category, discipline, year, summary, cover, accent };
}
