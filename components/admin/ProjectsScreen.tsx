'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, mediaKeyOf } from '@/lib/admin-api/client';
import { projectMediaUrls } from '@/lib/cms/media-refs';
import { STORAGE_WARN_BYTES, TIDY_BATCH } from '@/lib/cms/defaults';
import { MAX_HIGHLIGHTS, type Project } from '@/lib/cms/types';
import { useAdmin } from './AdminShell';
import { SwitchField } from './fields';
import { ChevronDown, ChevronUp } from './icons';
import { editPath, newProjectPath } from './paths';
import { highlightLimitProblem } from './rules';
import StatusBadge, { statusOf } from './StatusBadge';

/*
 * The project list: the order and highlights of the site, each project's state, the drafts not on the site, and the
 * storage used. Order and highlight changes are a draft of the home page (PUT /api/admin/home), published like any
 * other change. A project not on the site yet can be highlighted too: the highlight goes up when it is published.
 */

const GB = 1e9;
const TIDY_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Row {
  id: string;
  title: string;
  meta: string;
  thumb: string | null;
  status: ReturnType<typeof statusOf>;
}

const nameOf = (row: Row) => row.title.trim() || 'Untitled project';

function coverThumb(project: Project): string | null {
  const cover = project.cover;
  if (!cover) return null;
  return cover.kind === 'video' ? (cover.poster ?? null) : cover.srcSmall || cover.src;
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function size(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export default function ProjectsScreen() {
  const { state, published, refresh } = useAdmin();
  const live = useMemo(() => new Map(published.projects.map((p) => [p.id, p])), [published]);
  const drafts = useMemo(() => new Map(state.drafts.map((d) => [d.id, d])), [state]);
  const idOfSlug = useMemo(() => new Map(published.projects.map((p) => [p.slug, p.id])), [published]);

  // The layout as live, and as this page last saved it.
  const liveOrder = useMemo(() => published.projects.map((p) => p.id), [published]);
  const liveHighlights = useMemo(
    () => published.home.highlights.map((slug) => idOfSlug.get(slug)).filter((id): id is string => Boolean(id)),
    [published, idOfSlug],
  );
  const fromDraft = (ids: string[] | undefined, fallback: string[]) => {
    if (!ids) return fallback;
    const kept = ids.filter((id) => live.has(id));
    return [...kept, ...fallback.filter((id) => !kept.includes(id))];
  };
  // A highlight may wait for a project that isn't on the site yet.
  const highlightsFrom = () => (state.homeDraft ? state.homeDraft.highlights.filter((id) => live.has(id) || drafts.has(id)) : liveHighlights);
  const [order, setOrder] = useState(() => fromDraft(state.homeDraft?.order, liveOrder));
  const [highlights, setHighlights] = useState(highlightsFrom);
  const etag = useRef<string | null>(state.homeDraft?.etag ?? null);
  // Saves still on their way: the layout on screen is newer than the one the server has.
  const [saving, setSaving] = useState(0);
  // A new build went live while this page was open: start again from what it holds, once every save is in.
  const [shown, setShown] = useState(published);
  if (shown !== published && saving === 0) {
    setShown(published);
    setOrder(fromDraft(state.homeDraft?.order, liveOrder));
    setHighlights(highlightsFrom());
  }
  useEffect(() => {
    etag.current = state.homeDraft?.etag ?? null;
    // Only when the build changes: between builds this page keeps its own etag, which its saves move on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocus) return;
    document.getElementById(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, order, highlights]);

  const rowOf = (id: string): Row => {
    const project = live.get(id);
    const draft = drafts.get(id);
    return {
      id,
      title: draft?.title ?? project?.title ?? '',
      meta: draft?.meta ?? [project?.discipline, project?.year].filter(Boolean).join(' · '),
      thumb: draft?.thumb ?? (project ? coverThumb(project) : null),
      status: statusOf(Boolean(project), draft),
    };
  };

  /** Saves the layout as the home page's draft, or drops the draft once it matches the site again. */
  function saveLayout(nextOrder: string[], nextHighlights: string[]) {
    setOrder(nextOrder);
    setHighlights(nextHighlights);
    setProblem(null);
    setSaving((n) => n + 1);
    queue.current = queue.current.then(async () => {
      try {
        const matchesSite = sameList(nextOrder, liveOrder) && sameList(nextHighlights, liveHighlights);
        if (matchesSite) {
          const result = await api.deleteHome();
          if (result.ok) etag.current = null;
          else setProblem(`Couldn't save the new order. ${result.error}`);
        } else {
          // A highlighted project not on the site yet joins the end of the order, where publishing puts it.
          const waiting = nextHighlights.filter((id) => !nextOrder.includes(id));
          const result = await api.saveHome(nextHighlights, [...nextOrder, ...waiting], etag.current);
          if (result.ok) etag.current = result.etag;
          else setProblem(result.status === 409 ? 'The order was changed in another tab. Reload the list.' : `Couldn't save the new order. ${result.error}`);
        }
        await refresh();
      } finally {
        setSaving((n) => n - 1);
      }
    });
  }

  function move(list: 'order' | 'highlights', index: number, to: number) {
    const items = list === 'order' ? order : highlights;
    if (to < 0 || to >= items.length || to === index) return;
    const next = [...items];
    const [id] = next.splice(index, 1);
    next.splice(to, 0, id);
    const name = nameOf(rowOf(id));
    setAnnouncement(`${name} moved to position ${to + 1} of ${items.length}.`);
    const atEdge = to === 0 || to === items.length - 1;
    const pressed = to < index ? 'up' : 'down';
    const partner = to < index ? 'down' : 'up';
    setPendingFocus(`${list}-${id}-${to === 0 && to < index - 1 ? 'down' : atEdge ? partner : pressed}`);
    if (list === 'order') saveLayout(next, highlights);
    else saveLayout(order, next);
  }

  function toggleHighlight(id: string, on: boolean) {
    const name = nameOf(rowOf(id));
    if (on) {
      const refused = highlightLimitProblem(highlights.map((h) => nameOf(rowOf(h))));
      if (refused) {
        setProblem(refused);
        setAnnouncement(refused);
        return;
      }
      saveLayout(order, [...highlights, id]);
      setAnnouncement(`${name} is highlighted, at position ${highlights.length + 1}.`);
    } else {
      saveLayout(
        order,
        highlights.filter((h) => h !== id),
      );
      setAnnouncement(`${name} is no longer highlighted.`);
    }
  }

  const offSite = state.drafts.filter((d) => !live.has(d.id));
  const layoutChanged = Boolean(state.homeDraft);
  const highlightSwitch = (id: string, name: string) => (
    <div className="adm-row-feature">
      <SwitchField
        id={`featured-${id}`}
        label={
          <>
            Highlight<span className="adm-vh">: {name}</span>
          </>
        }
        checked={highlights.includes(id)}
        onChange={(on) => toggleHighlight(id, on)}
      />
    </div>
  );

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-h1">Projects</h1>
          <p className="adm-lede">
            {published.projects.length} on the site{offSite.length ? `, ${offSite.length} not on the site` : ''}.
          </p>
        </div>
        <a className="adm-btn adm-btn-primary" href={newProjectPath}>
          New project
        </a>
      </div>

      {problem && (
        <div className="adm-alert adm-list-alert" role="alert">
          <p>{problem}</p>
          <button type="button" className="adm-btn adm-btn-small" onClick={() => window.location.reload()}>
            Reload the list
          </button>
        </div>
      )}

      <section className="adm-section" aria-labelledby="home-panel-title">
        <h2 className="adm-h2" id="home-panel-title">
          Home page
        </h2>
        <p className="adm-section-intro">
          Up to {MAX_HIGHLIGHTS} projects appear large on the home page, in this order. Every other project is listed under
          them. {layoutChanged ? 'These changes go to the site when you publish.' : ''}
        </p>
        {highlights.length === 0 ? (
          <p className="adm-help">Nothing is highlighted. Turn on Highlight for a project below.</p>
        ) : (
          <ol className="adm-rows">
            {highlights.map((id, index) => {
              const row = rowOf(id);
              const name = nameOf(row);
              return (
                <li key={id} className="adm-row">
                  <div className="adm-thumb">{row.thumb ? <img src={row.thumb} alt="" loading="lazy" decoding="async" /> : <span>No cover</span>}</div>
                  <div className="adm-row-main">
                    <h3 className="adm-row-title">
                      {index + 1}. {name}
                    </h3>
                    <p className="adm-row-meta">
                      {!live.has(id) && <StatusBadge status={row.status} />}
                      <span>{live.has(id) ? row.meta : 'Highlighted once it is published'}</span>
                    </p>
                  </div>
                  <div className="adm-row-move" role="group" aria-label={`Highlight position of ${name}`}>
                    <button id={`highlights-${id}-up`} type="button" className="adm-icon-btn" onClick={() => move('highlights', index, index - 1)} disabled={index === 0}>
                      <ChevronUp />
                      <span className="adm-vh">Move {name} up</span>
                    </button>
                    <button
                      id={`highlights-${id}-down`}
                      type="button"
                      className="adm-icon-btn"
                      onClick={() => move('highlights', index, index + 1)}
                      disabled={index === highlights.length - 1}
                    >
                      <ChevronDown />
                      <span className="adm-vh">Move {name} down</span>
                    </button>
                  </div>
                  <button type="button" className="adm-btn adm-btn-small adm-btn-quiet" onClick={() => toggleHighlight(id, false)}>
                    Remove<span className="adm-vh"> {name} from the highlights</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="adm-section" aria-labelledby="site-list-title">
        <h2 className="adm-h2" id="site-list-title">
          On the site
        </h2>
        <p className="adm-list-help">The order here is the order on the site. Edits stay drafts until you publish them.</p>
        <p className="adm-list-count">
          {highlights.length} of {MAX_HIGHLIGHTS} highlighted
        </p>
        <ol className="adm-rows">
          {order.map((id, index) => {
            const row = rowOf(id);
            const name = nameOf(row);
            return (
              <li key={id} className="adm-row">
                <div className="adm-thumb">{row.thumb ? <img src={row.thumb} alt="" loading="lazy" decoding="async" /> : <span>No cover</span>}</div>
                <div className="adm-row-main">
                  <h3 className="adm-row-title">{name}</h3>
                  <p className="adm-row-meta">
                    <StatusBadge status={row.status} />
                    <span>{row.meta}</span>
                  </p>
                </div>
                {highlightSwitch(id, name)}
                <div className="adm-row-move" role="group" aria-label={`Position of ${name}`}>
                  <button id={`order-${id}-top`} type="button" className="adm-btn adm-btn-small adm-btn-quiet" onClick={() => move('order', index, 0)} disabled={index === 0}>
                    Move to top<span className="adm-vh">: {name}</span>
                  </button>
                  <button id={`order-${id}-up`} type="button" className="adm-icon-btn" onClick={() => move('order', index, index - 1)} disabled={index === 0}>
                    <ChevronUp />
                    <span className="adm-vh">Move {name} up</span>
                  </button>
                  <button id={`order-${id}-down`} type="button" className="adm-icon-btn" onClick={() => move('order', index, index + 1)} disabled={index === order.length - 1}>
                    <ChevronDown />
                    <span className="adm-vh">Move {name} down</span>
                  </button>
                </div>
                {/* A plain link: the editor loads as its own page, so Back can't drop unsaved edits unasked. */}
                <a className="adm-btn adm-btn-small adm-row-edit" href={editPath(id)}>
                  Edit<span className="adm-vh"> {name}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      {offSite.length > 0 && (
        <section className="adm-section" aria-labelledby="off-site-title">
          <h2 className="adm-h2" id="off-site-title">
            Not on the site
          </h2>
          <p className="adm-section-intro">
            New projects not published yet, and projects taken off the site. Only you can see them. Highlight one to put
            it on the home page when it is published.
          </p>
          <ol className="adm-rows">
            {offSite.map((draft) => {
              const row = rowOf(draft.id);
              const name = nameOf(row);
              return (
                <li key={draft.id} className="adm-row">
                  <div className="adm-thumb">{row.thumb ? <img src={row.thumb} alt="" loading="lazy" decoding="async" /> : <span>No cover</span>}</div>
                  <div className="adm-row-main">
                    <h3 className="adm-row-title">{name}</h3>
                    <p className="adm-row-meta">
                      <StatusBadge status={row.status} />
                      <span>{row.meta}</span>
                    </p>
                  </div>
                  {draft.action === 'publish' && highlightSwitch(draft.id, name)}
                  <a className="adm-btn adm-btn-small adm-row-edit" href={editPath(draft.id)}>
                    Edit<span className="adm-vh"> {name}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <Storage />

      <p className="adm-vh" role="status">
        {announcement}
      </p>
    </>
  );
}

type StorageInfo = { bytes: number; cap: number; truncated: boolean; media: { key: string; size: number; uploaded: string }[] };

/** The storage line, and tidying uploads nothing uses any more. */
function Storage() {
  const { state, published } = useAdmin();
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [unused, setUnused] = useState<StorageInfo['media'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    const result = await api.storage();
    if (result.ok) setInfo(result);
  }

  useEffect(() => {
    void load();
  }, []);

  /** Uploads no live project and no draft uses, uploaded over 7 days ago. */
  async function findUnused() {
    if (!info || busy) return;
    setBusy(true);
    setNote(null);
    const used = new Set<string>();
    const keep = (urls: string[]) => urls.forEach((url) => mediaKeyOf(url) && used.add(mediaKeyOf(url) as string));
    published.projects.forEach((p) => keep(projectMediaUrls(p)));
    for (const summary of state.drafts) {
      const result = await api.draft(summary.id);
      if (!result.ok) {
        setBusy(false);
        setNote(`Couldn't read every draft, so nothing was tidied. ${result.error}`);
        return;
      }
      keep(projectMediaUrls(result.draft.project));
    }
    const cutoff = Date.now() - TIDY_AGE_MS;
    setUnused(info.media.filter((m) => !used.has(m.key) && Date.parse(m.uploaded) < cutoff));
    setBusy(false);
  }

  async function tidy() {
    if (!unused?.length || busy) return;
    setBusy(true);
    // In batches, so each request stays small enough for the Free plan.
    let deleted = 0;
    let failed: string | null = null;
    for (let i = 0; i < unused.length && !failed; i += TIDY_BATCH) {
      const result = await api.tidy(unused.slice(i, i + TIDY_BATCH).map((m) => m.key));
      if (result.ok) deleted += result.deleted.length;
      else failed = result.error;
    }
    setBusy(false);
    setUnused(null);
    const done = `Deleted ${deleted} unused ${deleted === 1 ? 'file' : 'files'}.`;
    setNote(failed ? `${deleted ? `${done} ` : ''}${failed}` : done);
    await load();
  }

  if (!info) return null;
  return (
    <section className="adm-section adm-storage" aria-labelledby="storage-title">
      <h2 className="adm-h2" id="storage-title">
        Storage
      </h2>
      <p>
        Uploads use {size(info.bytes)} of the {size(info.cap)} the admin allows. Cloudflare&apos;s 10 GB of free storage is
        shared with the Lair&apos;s files, which are not counted here.
        {info.truncated ? ' (Counted from the first part of a long list.)' : ''}
      </p>
      {info.bytes > STORAGE_WARN_BYTES && (
        <p className="adm-alert">
          Nearly full: uploads stop at {size(info.cap)}, so the account stays inside the free storage. Tidy unused files, or
          replace big films with smaller exports.
        </p>
      )}
      {unused === null ? (
        <button type="button" className="adm-btn adm-btn-small" onClick={findUnused} aria-disabled={busy || undefined}>
          {busy ? 'Looking…' : 'Tidy unused files'}
        </button>
      ) : unused.length === 0 ? (
        <p className="adm-help">No unused files older than a week.</p>
      ) : (
        <div className="adm-confirm" role="group" aria-labelledby="tidy-question">
          <p id="tidy-question">
            {unused.length} {unused.length === 1 ? 'file' : 'files'} ({size(unused.reduce((s, m) => s + m.size, 0))}) used by no
            project and no draft, uploaded over a week ago. Delete them? This can&apos;t be undone.
          </p>
          <ul className="adm-tidy-list">
            {unused.map((m) => (
              <li key={m.key}>
                {m.key.split('/').pop()} · {size(m.size)}
              </li>
            ))}
          </ul>
          <button type="button" className="adm-btn adm-btn-danger" onClick={tidy} aria-disabled={busy || undefined}>
            {busy ? 'Deleting…' : `Delete ${unused.length} ${unused.length === 1 ? 'file' : 'files'}`}
          </button>
          <button type="button" className="adm-btn" onClick={() => setUnused(null)}>
            Keep them
          </button>
        </div>
      )}
      {note && (
        <p className="adm-help" role="status">
          {note}
        </p>
      )}
    </section>
  );
}
