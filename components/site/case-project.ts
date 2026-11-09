import type { Project } from '@/lib/cms/types';

/** What a case file shows of a project. */
export type CaseProject = Pick<
  Project,
  | 'id'
  | 'slug'
  | 'title'
  | 'category'
  | 'year'
  | 'discipline'
  | 'summary'
  | 'shown'
  | 'stillOnly'
  | 'cover'
  | 'accent'
  | 'role'
  | 'projectType'
  | 'tools'
  | 'deliverables'
  | 'link'
  | 'blocks'
>;

export function toCaseProject(p: Project): CaseProject {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    category: p.category,
    year: p.year,
    discipline: p.discipline,
    summary: p.summary,
    shown: p.shown,
    stillOnly: p.stillOnly,
    cover: p.cover,
    accent: p.accent,
    role: p.role,
    projectType: p.projectType,
    tools: p.tools,
    deliverables: p.deliverables,
    link: p.link,
    blocks: p.blocks,
  };
}
