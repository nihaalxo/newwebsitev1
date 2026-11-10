import { SLUG_TAKEN_MESSAGE, type FieldErrors } from '@/components/admin/rules';
import { SLUG_PATTERN } from '@/lib/cms/defaults';
import type { Draft, HomeDraft, HomeLayout, Project, Redirects } from '@/lib/cms/types';
import { mergeHome } from '@/lib/content/assemble';
import { gitBlobSha } from '@/lib/content/blob-sha';
import { HOME_PATH, REDIRECTS_PATH, projectPath, serializeHome, serializeProject, serializeRedirects, slugOfPath } from '@/lib/content/serialize';
import { projectFieldErrors } from '@/lib/content/validate';
import type { DeployedIndex, RepoHead } from './store';

/*
 * What one publish changes in the repository: which content files to write and delete, the redirects for renamed
 * and removed projects, and the home page's order and highlights. Pure (apart from hashing), so it is unit-tested
 * (tests/plan.test.ts) and the dev store uses exactly the same rules as the live one.
 */

export interface PlanInput {
  /** What the live build holds (for project ids). */
  index: DeployedIndex;
  /** The branch as it is now. */
  head: Pick<RepoHead, 'files' | 'homeJson' | 'redirectsJson'>;
  drafts: Draft[];
  homeDraft: Pick<HomeDraft, 'highlights' | 'order'> | null;
  /** path -> project id for files HEAD has but the live build doesn't yet (an earlier publish still building). */
  knownIds?: Record<string, string>;
  mediaOrigin?: string;
}

export interface PlanItem {
  id: string;
  title: string;
  action: Draft['action'];
  /** Where the project's file is after this publish (null once it is taken off), and its git blob. */
  path: string | null;
  blobSha: string | null;
  /** Where it was before, and its blob then. */
  prevPath: string | null;
  prevBlobSha: string | null;
}

/** One path this publish touches: its blob before and after (null: absent). Undo puts `before` back. */
export interface PlanChange {
  path: string;
  before: string | null;
  after: string | null;
}

export interface Plan {
  writes: { path: string; content: string }[];
  deletes: string[];
  message: string;
  items: PlanItem[];
  changes: PlanChange[];
  home: HomeLayout;
  conflicts: { id: string; reason: string }[];
  errors: Record<string, FieldErrors>;
}

export const CHANGED_ELSEWHERE = 'Changed on the site since this draft began';

/** The only files a publish may write or delete. */
export const ALLOWED_PATH = /^(content\/projects\/[a-z0-9-]+\.json|content\/home\.json|content\/redirects\.json)$/;

const COUNT = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function parse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** The project as its file will hold it. The times come from the draft, so a retried publish writes the same bytes. */
export function publishedProject(draft: Draft): Project {
  const p = draft.project;
  return {
    ...p,
    createdAt: p.createdAt || draft.savedAt,
    updatedAt: draft.savedAt,
    publishedAt: p.publishedAt || draft.savedAt,
  };
}

export async function planPublish({ index, head, drafts, homeDraft, knownIds = {}, mediaOrigin }: PlanInput): Promise<Plan> {
  const conflicts: Plan['conflicts'] = [];
  const errors: Plan['errors'] = {};
  const items: PlanItem[] = [];
  const writes = new Map<string, { content: string; blob: string; id: string }>();
  const deletes = new Set<string>();
  const renames: { from: string; to: string }[] = [];
  const removed: string[] = [];
  const added: string[] = [];
  const labels: string[] = [];

  const idAt = (path: string): string | undefined =>
    index.files[path]?.id ?? knownIds[path] ?? drafts.find((d) => d.base?.path === path)?.project.id;

  // ---- each project: where it goes, whether the branch still holds what the draft started from, and its checks
  const prepared = await Promise.all(
    drafts.map(async (draft) => {
      if (draft.action !== 'publish') return { draft, content: null, blob: null, target: null };
      const content = serializeProject(publishedProject(draft));
      return { draft, content, blob: await gitBlobSha(content), target: SLUG_PATTERN.test(draft.project.slug) ? projectPath(draft.project.slug) : null };
    }),
  );

  for (const { draft, blob, target } of prepared) {
    const { id } = draft.project;
    const basePath = draft.base?.path ?? null;
    if (basePath) {
      const now = head.files[basePath];
      const unchanged = now === draft.base?.blobSha;
      // A publish that went through but wasn't recorded, tried again: the branch already holds this draft's result.
      const retried =
        draft.action === 'publish'
          ? (now === blob && basePath === target) || (now === undefined && target !== null && head.files[target] === blob)
          : now === undefined;
      if (!unchanged && !retried) conflicts.push({ id, reason: CHANGED_ELSEWHERE });
    } else if (draft.action !== 'publish') {
      conflicts.push({ id, reason: 'This project is not on the site.' });
    }
    if (draft.action === 'publish') {
      const fieldErrors = projectFieldErrors(draft.project, mediaOrigin);
      if (Object.keys(fieldErrors).length) errors[id] = fieldErrors;
    }
  }

  // ---- deletes first, so a project can take the address another one leaves in the same publish
  for (const { draft, target } of prepared) {
    const basePath = draft.base?.path ?? null;
    if (!basePath) continue;
    if (draft.action !== 'publish') {
      if (head.files[basePath] !== undefined) deletes.add(basePath);
      removed.push(slugOfPath(basePath) as string);
    } else if (target && target !== basePath) {
      if (head.files[basePath] !== undefined) deletes.add(basePath);
      renames.push({ from: slugOfPath(basePath) as string, to: draft.project.slug });
    }
  }

  const live = new Map<string, string>(Object.entries(head.files).filter(([path]) => !deletes.has(path)));
  for (const { draft, content, blob, target } of prepared) {
    const { id, title } = draft.project;
    const basePath = draft.base?.path ?? null;
    const item: PlanItem = { id, title, action: draft.action, path: null, blobSha: null, prevPath: basePath, prevBlobSha: draft.base?.blobSha ?? null };
    items.push(item);
    if (draft.action !== 'publish') {
      labels.push(`${title} (${draft.action === 'delete' ? 'deleted' : 'taken off the site'})`);
      continue;
    }
    // An invalid web address: projectFieldErrors has already said so.
    if (!content || !blob || !target) continue;
    const occupant = live.get(target);
    const takenByOther =
      writes.has(target) || (occupant !== undefined && occupant !== blob && target !== basePath && idAt(target) !== id);
    if (takenByOther) {
      errors[id] = { ...errors[id], slug: SLUG_TAKEN_MESSAGE };
      continue;
    }
    writes.set(target, { content, blob, id });
    live.set(target, blob);
    item.path = target;
    item.blobSha = blob;
    if (!basePath) added.push(id);
    labels.push(
      `${title} (${!basePath ? (draft.state === 'hidden' ? 'back on the site' : 'new') : target !== basePath ? 'renamed' : 'edited'})`,
    );
  }

  // ---- redirects: renamed projects keep their old address, removed ones go to All projects
  const redirects: Redirects = { ...parse<Redirects>(head.redirectsJson, {}) };
  for (const { from, to } of renames) {
    for (const rule of Object.values(redirects)) if (rule.to === `/work/${from}`) rule.to = `/work/${to}`;
    redirects[`/work/${from}`] = { to: `/work/${to}`, status: 301 };
  }
  for (const slug of removed) {
    for (const rule of Object.values(redirects)) if (rule.to === `/work/${slug}`) rule.to = '/work';
    redirects[`/work/${slug}`] = { to: '/work', status: 302 };
  }
  for (const from of Object.keys(redirects)) {
    const slug = /^\/work\/([a-z0-9-]+)$/.exec(from)?.[1];
    if ((slug && live.has(projectPath(slug))) || redirects[from].to === from) delete redirects[from];
  }

  // ---- the home page: the admin's order and highlights if sent, new projects at the end, removed ones out
  const writtenId = new Map([...writes].map(([path, w]) => [path, w.id]));
  const idOfPath = (path: string) => writtenId.get(path) ?? idAt(path) ?? `slug:${slugOfPath(path)}`;
  const current = parse<HomeLayout>(head.homeJson, { highlights: [], order: [] });
  const home = mergeHome({
    current: { highlights: current.highlights ?? [], order: current.order ?? [] },
    idOfSlug: (slug) => idAt(projectPath(slug)) ?? `slug:${slug}`,
    homeDraft,
    live: [...live.keys()].filter((path) => slugOfPath(path)).map((path) => ({ id: idOfPath(path), slug: slugOfPath(path) as string })),
    added,
  });

  const fileWrites: Plan['writes'] = [...writes].map(([path, { content }]) => ({ path, content }));
  const homeText = serializeHome(home);
  if (homeText !== head.homeJson) fileWrites.push({ path: HOME_PATH, content: homeText });
  const redirectsText = serializeRedirects(redirects);
  if (redirectsText !== head.redirectsJson) fileWrites.push({ path: REDIRECTS_PATH, content: redirectsText });

  if (homeDraft) {
    const orderChanged = JSON.stringify(current.order) !== JSON.stringify(home.order);
    const highlightsChanged = JSON.stringify(current.highlights) !== JSON.stringify(home.highlights);
    const what = [orderChanged && 'order', highlightsChanged && 'highlights'].filter(Boolean).join(' and ');
    if (what && homeText !== head.homeJson) labels.push(`Home page (${what})`);
  }

  const paths = [...fileWrites.map((w) => w.path), ...deletes];
  const outside = paths.filter((path) => !ALLOWED_PATH.test(path));
  if (outside.length) throw new Error(`A publish may only change content files, not ${outside.join(', ')}`);

  const changes: PlanChange[] = [];
  for (const write of fileWrites) {
    const blob = writes.get(write.path)?.blob ?? (await gitBlobSha(write.content));
    changes.push({ path: write.path, before: head.files[write.path] ?? null, after: blob });
  }
  for (const path of deletes) changes.push({ path, before: head.files[path] ?? null, after: null });

  return {
    writes: fileWrites,
    deletes: [...deletes],
    message: labels.length ? `Publish: ${labels.join(', ')}` : `Publish: ${COUNT(items.length, 'project')}`,
    items,
    changes,
    home,
    conflicts,
    errors,
  };
}
