import type { Draft, HomeDraft } from '@/lib/cms/types';
import { projectMediaUrls } from '@/lib/cms/media-refs';
import { gitBlobSha } from '@/lib/content/blob-sha';
import { HOME_PATH, serializeProject } from '@/lib/content/serialize';
import { mediaList } from '@/lib/content/validate';
import { planPublish, publishedProject, type PlanChange, type PlanItem } from './plan';
import { RepoMoved, type DeployedIndex, type DraftSummary, type RepoHead, type Store } from './store';

/*
 * Publishing, and following a publish until it is live. A publish is one commit; Workers Builds builds and deploys
 * it; the build that goes live carries admin/data/index.json, and a publish is live once that index holds every
 * file the publish wrote (and none it deleted). Nothing here waits: GET /state looks again each time it is asked.
 */

export const LATEST_KEY = 'publish/latest.json';
export const BUILD_TIMEOUT_MS = 15 * 60 * 1000;

export interface LatestPublish {
  kind: 'publish' | 'undo';
  commit: string;
  at: string;
  /** Each project published, with its draft's etag right after it was marked publishing (null: saved since). */
  items: (PlanItem & { etag: string | null })[];
  changes: PlanChange[];
  /** The home draft's etag, when it was part of this publish. */
  home: { etag: string } | null;
  /** When the build holding it was first seen live. */
  liveAt?: string;
}

/** What the continuous-deploy script reports in the admin bucket (scripts/ci.mjs): builds/<commit>.json. */
export interface BuildReport {
  state: 'building' | 'deployed' | 'failed';
  at: string;
  step?: string;
  tail?: string;
  buildUuid?: string;
}

export type BuildState = { state: 'building' | 'live' | 'failed' | 'late'; step?: string; tail?: string; at: string };

export function isLive(latest: Pick<LatestPublish, 'changes'>, index: DeployedIndex): boolean {
  return latest.changes.every((change) =>
    change.after === null ? index.files[change.path] === undefined : index.files[change.path]?.blobSha === change.after,
  );
}

/** path -> id for files an earlier publish wrote that the live build may not hold yet. */
export function knownIds(latest: LatestPublish | null): Record<string, string> {
  const ids: Record<string, string> = {};
  for (const item of latest?.items ?? []) if (item.path) ids[item.path] = item.id;
  return ids;
}

/** Where a project's file is on the live site, or in the publish on its way there. */
export function baseFor(id: string, index: DeployedIndex, latest: LatestPublish | null): Draft['base'] {
  if (latest && !latest.liveAt) {
    const item = latest.items.find((i) => i.id === id);
    if (item) return item.path && item.blobSha ? { path: item.path, blobSha: item.blobSha } : null;
  }
  for (const [path, file] of Object.entries(index.files)) if (file.id === id) return { path, blobSha: file.blobSha };
  return null;
}

/** A draft whose starting point is no longer on the site (and isn't on its way there). */
export function isStale(summary: Pick<DraftSummary, 'base' | 'state'>, index: DeployedIndex, latest: LatestPublish | null): boolean {
  if (!summary.base || summary.state === 'publishing' || summary.state === 'failed') return false;
  if (index.files[summary.base.path]?.blobSha === summary.base.blobSha) return false;
  const inFlight = latest && !latest.liveAt && latest.changes.some((c) => c.path === summary.base?.path && c.after === summary.base?.blobSha);
  return !inFlight;
}

/** Updates a stored draft with `change`, keeping whatever content it has now. Gives up quietly after a few tries. */
async function updateDraft(store: Store, id: string, change: (draft: Draft) => Draft | null): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const stored = await store.drafts.get(id);
    if (!stored) return null;
    const next = change(stored.value);
    if (!next) {
      await store.drafts.delete(id);
      return null;
    }
    const etag = await store.drafts.put(id, next, stored.etag);
    if (etag) return etag;
  }
  return null;
}

// ---------------------------------------------------------------- publish

export type PublishOutcome =
  | { status: 200; body: { commit: string | null } }
  | { status: 409; body: { conflicts: { id: string; reason: string }[] } }
  | { status: 422; body: { errors: Record<string, Record<string, string>> } };

export async function publish(store: Store, request: { items: { id: string; etag: string }[]; home: string | null }, now: Date): Promise<PublishOutcome> {
  // ---- the drafts must be exactly the ones the admin saw when Publish was chosen
  const conflicts: { id: string; reason: string }[] = [];
  const drafts: { draft: Draft; etag: string }[] = [];
  for (const { id, etag } of request.items) {
    const stored = await store.drafts.get(id);
    if (!stored || stored.etag !== etag) conflicts.push({ id, reason: 'Changed since you clicked Publish' });
    else drafts.push({ draft: stored.value, etag });
  }
  const homeStored = request.home ? await store.homeDraft.get() : null;
  if (request.home && homeStored?.etag !== request.home) conflicts.push({ id: 'home', reason: 'Changed since you clicked Publish' });
  if (conflicts.length) return { status: 409, body: { conflicts } };

  // ---- every upload a published project points at must be in the bucket (one listing per project folder)
  const errors: Record<string, Record<string, string>> = {};
  const uses: { id: string; field: string; mediaKey: string }[] = [];
  for (const { draft } of drafts) {
    if (draft.action !== 'publish') continue;
    for (const { key, media } of mediaList(draft.project)) {
      for (const url of [media.src, media.srcSmall, media.poster, media.srcTall]) {
        const mediaKey = url ? store.media.keyOf(url) : null;
        if (mediaKey) uses.push({ id: draft.project.id, field: key.replace(/\.items\.\d+$/, '.items'), mediaKey });
      }
    }
  }
  const stored = uses.length ? await store.media.find(uses.map((u) => u.mediaKey)) : new Map();
  for (const { id, field, mediaKey } of uses) {
    if (!stored.has(mediaKey)) errors[id] = { ...errors[id], [field]: "This file didn't finish uploading: upload it again" };
  }
  if (Object.keys(errors).length) return { status: 422, body: { errors } };

  // ---- plan and commit, once more from the start if the branch moved in between
  const [index, latest] = await Promise.all([store.deployed.index(), store.meta.get<LatestPublish>(LATEST_KEY)]);
  for (let attempt = 0; ; attempt++) {
    const head: RepoHead = await store.repo.readHead();
    const plan = await planPublish({
      index,
      head,
      drafts: drafts.map((d) => d.draft),
      homeDraft: homeStored?.value ?? null,
      knownIds: knownIds(latest),
      mediaOrigin: store.config.mediaOrigin || undefined,
    });
    if (plan.conflicts.length) return { status: 409, body: { conflicts: plan.conflicts } };
    if (Object.keys(plan.errors).length) return { status: 422, body: { errors: plan.errors } };

    if (plan.writes.length === 0 && plan.deletes.length === 0) {
      // Nothing differs from the site: the drafts are done with. A home draft still holding a highlight for a project
      // that isn't on the site yet stays, so the highlight waits for that project as it does after a build.
      for (const { draft } of drafts) await store.drafts.delete(draft.project.id);
      if (homeStored && !(await holdsWaitingHighlight(store, index, homeStored.value))) await store.homeDraft.delete();
      return { status: 200, body: { commit: null } };
    }

    let commit: string;
    try {
      commit = await store.repo.commit(head, { writes: plan.writes, deletes: plan.deletes, message: plan.message });
    } catch (error) {
      if (error instanceof RepoMoved && attempt === 0) continue;
      if (error instanceof RepoMoved) {
        return { status: 409, body: { conflicts: [{ id: 'site', reason: 'The site changed while publishing. Try again.' }] } };
      }
      throw error;
    }

    // ---- record it, and mark each draft as publishing from its new file
    const items: LatestPublish['items'] = [];
    for (const item of plan.items) {
      const published = drafts.find((d) => d.draft.project.id === item.id);
      const mark = (draft: Draft): Draft => ({
        ...draft,
        state: 'publishing',
        commit,
        base: item.path && item.blobSha ? { path: item.path, blobSha: item.blobSha } : null,
      });
      // Usually the draft is still exactly what was published: one conditional write, no read.
      let etag = published ? await store.drafts.put(item.id, mark(published.draft), published.etag) : null;
      let unchangedSince = etag !== null;
      if (etag === null) {
        unchangedSince = true;
        etag = await updateDraft(store, item.id, (draft) => {
          unchangedSince = JSON.stringify(draft.project) === JSON.stringify(published?.draft.project) && draft.action === published?.draft.action;
          return mark(draft);
        });
      }
      items.push({ ...item, etag: unchangedSince ? etag : null });
    }
    const record: LatestPublish = { kind: 'publish', commit, at: now.toISOString(), items, changes: plan.changes, home: homeStored ? { etag: homeStored.etag } : null };
    // A publish made while the one before is still building goes live with it (its commit holds both): follow both.
    const building = latest && latest.kind === 'publish' && !latest.liveAt ? latest : null;
    await store.meta.put(LATEST_KEY, building ? mergePublishes(building, record) : record);
    return { status: 200, body: { commit } };
  }
}

/**
 * One record for a publish and the one still building before it: every project of both (the newer item wins, keeping
 * where the project was before either), each path from its state before the first to its state after the second,
 * and the newer commit, whose build holds both.
 */
export function mergePublishes(earlier: LatestPublish, later: LatestPublish): LatestPublish {
  const items = [
    ...earlier.items.filter((e) => !later.items.some((l) => l.id === e.id)),
    ...later.items.map((l) => {
      const e = earlier.items.find((i) => i.id === l.id);
      return e ? { ...l, prevPath: e.prevPath, prevBlobSha: e.prevBlobSha } : l;
    }),
  ];
  const changes = new Map(earlier.changes.map((c) => [c.path, { ...c }]));
  for (const c of later.changes) {
    const e = changes.get(c.path);
    changes.set(c.path, e ? { path: c.path, before: e.before, after: c.after } : { ...c });
  }
  return { ...later, items, changes: [...changes.values()], home: later.home ?? earlier.home };
}

/** Whether the home draft highlights a project that isn't on the site but has a draft: that highlight waits for it. */
async function holdsWaitingHighlight(store: Store, index: DeployedIndex, home: HomeDraft): Promise<boolean> {
  const liveIds = new Set(Object.values(index.files).map((file) => file.id));
  for (const id of home.highlights) if (!liveIds.has(id) && (await store.drafts.get(id))) return true;
  return false;
}

// ---------------------------------------------------------------- following a publish

/** Whether a draft still holds exactly what `item` published: its etag is the one recorded, or its file would be. */
async function publishedAsIs(store: Store, item: LatestPublish['items'][number], summary: DraftSummary): Promise<boolean> {
  if (item.etag !== null && summary.etag === item.etag) return true;
  const stored = await store.drafts.get(item.id);
  if (!stored || stored.value.action !== 'publish' || !item.blobSha) return false;
  return (await gitBlobSha(serializeProject(publishedProject(stored.value)))) === item.blobSha;
}

/**
 * Looks at the latest publish against the live build: once it is live, its drafts are done with (or go back to
 * editing if they were changed since); while it isn't, the build's own report says how it is going.
 */
export async function settle(store: Store, index: DeployedIndex, latest: LatestPublish | null, summaries: DraftSummary[], now: Date): Promise<{ latest: LatestPublish | null; build: BuildState | null; changed: boolean }> {
  if (!latest) return { latest, build: null, changed: false };
  if (latest.liveAt) return { latest, build: { state: 'live', at: latest.liveAt }, changed: false };

  if (isLive(latest, index)) {
    for (const item of latest.items) {
      const summary = summaries.find((s) => s.id === item.id);
      if (!summary) continue;
      if (item.action === 'delete' || (item.action === 'publish' && (await publishedAsIs(store, item, summary)))) {
        await store.drafts.delete(item.id);
      } else if (item.action === 'unpublish') {
        await updateDraft(store, item.id, (draft) => ({ ...draft, state: 'hidden', action: 'publish', base: null, commit: undefined }));
      } else {
        await updateDraft(store, item.id, (draft) => ({
          ...draft,
          state: draft.state === 'hidden' ? 'hidden' : 'editing',
          base: item.path && item.blobSha ? { path: item.path, blobSha: item.blobSha } : draft.base,
          commit: undefined,
        }));
      }
    }
    if (latest.home) {
      const home = await store.homeDraft.get();
      // A highlight for a project that isn't on the site yet waits in the home draft until that project is published.
      const liveIds = new Set(Object.values(index.files).map((file) => file.id));
      const waiting = home?.value.highlights.some((id) => !liveIds.has(id) && summaries.some((s) => s.id === id));
      if (home?.etag === latest.home.etag && !waiting) await store.homeDraft.delete();
      else if (home) {
        const blobSha = index.files[HOME_PATH]?.blobSha;
        if (blobSha) await store.homeDraft.put({ ...home.value, base: { blobSha } }, home.etag);
      }
    }
    const settled: LatestPublish = { ...latest, liveAt: now.toISOString() };
    await store.meta.put(LATEST_KEY, settled);
    return { latest: settled, build: { state: 'live', at: settled.liveAt as string }, changed: true };
  }

  const report = await store.meta.get<BuildReport>(`builds/${latest.commit}.json`);
  if (report?.state === 'failed') {
    let changed = false;
    for (const item of latest.items) {
      const summary = summaries.find((s) => s.id === item.id);
      // Every project in the record goes up with this build, including those of a publish it took over.
      if (summary?.state === 'publishing') {
        await updateDraft(store, item.id, (draft) => ({ ...draft, state: 'failed' }));
        changed = true;
      }
    }
    return { latest, build: { state: 'failed', step: report.step, tail: report.tail, at: report.at }, changed };
  }
  if (!report && now.getTime() - Date.parse(latest.at) > BUILD_TIMEOUT_MS) return { latest, build: { state: 'late', at: latest.at }, changed: false };
  return { latest, build: { state: 'building', at: report?.at ?? latest.at }, changed: false };
}

// ---------------------------------------------------------------- after a failed build

/** Builds the same content again: an empty commit on top of the branch. */
export async function rebuild(store: Store, now: Date): Promise<{ commit: string }> {
  const commit = await store.repo.emptyCommit('Rebuild');
  const latest = await store.meta.get<LatestPublish>(LATEST_KEY);
  if (latest && !latest.liveAt) {
    await store.meta.put(LATEST_KEY, { ...latest, commit, at: now.toISOString() });
    for (const item of latest.items) {
      await updateDraft(store, item.id, (draft) => (draft.state === 'publishing' || draft.state === 'failed' ? { ...draft, state: 'publishing', commit } : draft));
    }
  }
  return { commit };
}

export type UndoOutcome = { status: 200; body: { commit: string } } | { status: 409; body: { error: string } };

/** Puts back every file the latest publish changed, as long as nobody has changed them since. */
export async function undo(store: Store, now: Date): Promise<UndoOutcome> {
  const latest = await store.meta.get<LatestPublish>(LATEST_KEY);
  if (!latest || latest.kind !== 'publish') return { status: 409, body: { error: 'There is no publish to undo.' } };
  const head = await store.repo.readHead();
  const moved = latest.changes.some((c) => (head.files[c.path] ?? null) !== c.after);
  if (moved) return { status: 409, body: { error: 'The site has changed since that publish, so it can no longer be undone here.' } };
  let commit: string;
  try {
    commit = await store.repo.restore(head, latest.changes.map((c) => ({ path: c.path, blobSha: c.before })), `Undo: ${latest.items.map((i) => i.title).join(', ') || 'home page'}`);
  } catch (error) {
    if (error instanceof RepoMoved) return { status: 409, body: { error: 'The site changed at the same moment. Try again.' } };
    throw error;
  }
  for (const item of latest.items) {
    await updateDraft(store, item.id, (draft) => ({
      ...draft,
      state: item.action === 'publish' || draft.state !== 'hidden' ? 'editing' : draft.state,
      action: item.action,
      base: item.prevPath && item.prevBlobSha ? { path: item.prevPath, blobSha: item.prevBlobSha } : null,
      commit: undefined,
    }));
  }
  const record: LatestPublish = {
    kind: 'undo',
    commit,
    at: now.toISOString(),
    items: [],
    changes: latest.changes.map((c) => ({ path: c.path, before: c.after, after: c.before })),
    home: null,
  };
  await store.meta.put(LATEST_KEY, record);
  return { status: 200, body: { commit } };
}

/** Every upload key a project uses, for tidying. */
export function uploadKeys(store: Store, projects: { cover: Draft['project']['cover']; blocks: Draft['project']['blocks'] }[]): Set<string> {
  const keys = new Set<string>();
  for (const project of projects) for (const url of projectMediaUrls(project)) {
    const key = store.media.keyOf(url);
    if (key) keys.add(key);
  }
  return keys;
}
