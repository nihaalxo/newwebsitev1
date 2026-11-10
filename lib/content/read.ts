import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { HomeLayout, Project, Redirects } from '@/lib/cms/types';
import { projectMediaUrls } from '@/lib/cms/media-refs';
import { isSitePath } from '@/components/admin/rules';
import { orderProjects } from './assemble';
import { HOME_PATH, REDIRECTS_PATH, projectPath } from './serialize';
import { validateContent } from './validate';

/*
 * Reads content/ from disk. Used by the pages at build time and under `npm run dev` (lib/content/load.ts), and by
 * the scripts (postbuild, check-content, content-format). Node only.
 */

export interface ContentOnDisk {
  /** In site order. */
  projects: Project[];
  /** As used: slugs without a file dropped, files missing from the order appended. */
  home: HomeLayout;
  redirects: Redirects;
  /** Each file's path and exact text, for the canonical-form check and the build's index. */
  files: { path: string; text: string }[];
  warnings: string[];
  errors: string[];
}

function readJson(root: string, file: string, errors: string[]): unknown {
  try {
    return JSON.parse(readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    errors.push(`${file}: ${error instanceof Error ? error.message : 'could not be read'}`);
    return null;
  }
}

export function readContent(root = process.cwd()): ContentOnDisk {
  const errors: string[] = [];
  const warnings: string[] = [];
  const files: { path: string; text: string }[] = [];
  const read = (file: string) => {
    const full = path.join(root, file);
    if (!existsSync(full)) return null;
    files.push({ path: file, text: readFileSync(full, 'utf8') });
    return readJson(root, file, errors);
  };

  const names = readdirSync(path.join(root, 'content/projects'))
    .filter((name) => name.endsWith('.json'))
    .sort();
  const projects: Project[] = [];
  const projectFiles: string[] = [];
  for (const name of names) {
    const file = `content/projects/${name}`;
    const project = read(file) as Project | null;
    if (project) {
      projects.push(project);
      projectFiles.push(file);
    }
  }

  const rawHome = (read(HOME_PATH) as HomeLayout | null) ?? { highlights: [], order: [] };
  const redirects = (read(REDIRECTS_PATH) as Redirects | null) ?? {};
  if (!files.some((f) => f.path === HOME_PATH)) errors.push(`${HOME_PATH}: missing`);
  if (!files.some((f) => f.path === REDIRECTS_PATH)) errors.push(`${REDIRECTS_PATH}: missing`);

  // The order as used: a slug without a file is dropped, a file missing from the order is appended.
  const slugs = new Set(projects.map((p) => p.slug));
  const order = Array.isArray(rawHome.order) ? rawHome.order : [];
  for (const slug of order) if (!slugs.has(slug)) warnings.push(`${HOME_PATH}: "${slug}" has no file in content/projects/, so it is left out`);
  const kept = [...new Set(order.filter((slug) => slugs.has(slug)))];
  const ordered = orderProjects(projects, { highlights: [], order: kept });
  for (const p of ordered.slice(kept.length)) warnings.push(`${HOME_PATH}: ${projectPath(p.slug)} is not in the order, so it goes last`);
  const home: HomeLayout = {
    highlights: (Array.isArray(rawHome.highlights) ? rawHome.highlights : []).filter((slug) => slugs.has(slug)),
    order: ordered.map((p) => p.slug),
  };

  errors.push(...validateContent({ projects, home, redirects }, projectFiles));

  // A file on this site must exist in public/, or the page would show a broken image.
  projects.forEach((project, i) => {
    if (!Array.isArray(project?.blocks)) return;
    for (const src of new Set(projectMediaUrls(project))) {
      if (!isSitePath(src)) continue;
      const local = path.join(root, 'public', decodeURIComponent(src.split(/[?#]/)[0]));
      if (!existsSync(local)) errors.push(`${projectFiles[i]}: ${src} is not in public/`);
    }
  });

  return { projects: ordered, home, redirects, files, warnings, errors };
}
