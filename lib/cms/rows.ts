import { SLUG_PATTERN } from './defaults';
import { CATEGORIES, PROJECT_TYPES } from './types';
import type { Block, Category, Media, Project, ProjectInput, ProjectType } from './types';

// Shared by both adapters: input validation, and the mapping between the camelCase types and Postgres rows.

/** The editable part of a project: everything except the id and the timestamps the store sets itself. */
export type ProjectFields = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'>;

/**
 * Copies only the known fields, so stray keys from a form never reach storage, and checks the values the
 * database constrains. Throws an Error whose message can be shown to the editor as-is.
 * `expectedUpdatedAt` is left out on purpose: it only guards the write (see each adapter's saveProject).
 */
export function projectFields(input: ProjectInput): ProjectFields {
  const fields: ProjectFields = {
    slug: input.slug.trim(),
    title: input.title.trim(),
    category: input.category,
    year: input.year,
    discipline: input.discipline,
    summary: input.summary,
    cover: input.cover,
    accent: input.accent,
    role: input.role,
    projectType: input.projectType,
    tools: input.tools,
    deliverables: input.deliverables,
    link: input.link,
    featured: input.featured,
    position: input.position,
    status: input.status,
    blocks: input.blocks,
  };

  if (!fields.title) throw new Error('Give the project a title.');
  if (!SLUG_PATTERN.test(fields.slug)) {
    throw new Error('The web address can only use lowercase letters, numbers and single hyphens, like "my-chaii-london".');
  }
  if (!CATEGORIES.some((c) => c.id === fields.category)) throw new Error(`"${fields.category}" is not a category.`);
  if (fields.projectType !== '' && !PROJECT_TYPES.some((t) => t.id === fields.projectType)) {
    throw new Error(`"${fields.projectType}" is not a project type.`);
  }
  if (!Number.isInteger(fields.year)) throw new Error('The year must be a whole number.');
  if (!Number.isInteger(fields.position)) throw new Error('The position must be a whole number.');
  if (fields.status !== 'draft' && fields.status !== 'published') throw new Error('Status must be draft or published.');
  if (!Array.isArray(fields.blocks)) throw new Error('The project body is not a list of blocks.');

  return fields;
}

// ---- Postgres rows (see supabase/migrations/0001_init.sql)

export interface ProjectRow {
  id: string;
  slug: string;
  title: string;
  category: Category;
  year: number;
  discipline: string;
  summary: string;
  cover: Media | null;
  accent: string;
  role: string;
  project_type: ProjectType;
  tools: string;
  deliverables: string;
  link: string;
  featured: boolean;
  position: number;
  status: 'draft' | 'published';
  blocks: Block[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

/** What the adapter writes. Timestamps are left to the database: see the projects_before_write trigger. */
export type ProjectRowWrite = Omit<ProjectRow, 'id' | 'created_at' | 'updated_at' | 'published_at'>;

export function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    year: row.year,
    discipline: row.discipline,
    summary: row.summary,
    cover: row.cover,
    accent: row.accent,
    role: row.role,
    projectType: row.project_type,
    tools: row.tools,
    deliverables: row.deliverables,
    link: row.link,
    featured: row.featured,
    position: row.position,
    status: row.status,
    blocks: row.blocks ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export function projectToRow(fields: ProjectFields): ProjectRowWrite {
  return {
    slug: fields.slug,
    title: fields.title,
    category: fields.category,
    year: fields.year,
    discipline: fields.discipline,
    summary: fields.summary,
    cover: fields.cover,
    accent: fields.accent,
    role: fields.role,
    project_type: fields.projectType,
    tools: fields.tools,
    deliverables: fields.deliverables,
    link: fields.link,
    featured: fields.featured,
    position: fields.position,
    status: fields.status,
    blocks: fields.blocks,
  };
}

export interface SettingsRow {
  id: 1;
  /** Settings without updatedAt; may lack keys added to Settings after it was saved. */
  data: Record<string, unknown>;
  updated_at: string;
}
