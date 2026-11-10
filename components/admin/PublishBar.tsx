'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type AdminState, type Failure } from '@/lib/admin-api/client';
import type { Published } from '@/lib/content/assemble';
import { useAdmin } from './AdminShell';
import { caseStudyPath, editPath } from './paths';

/*
 * On every admin page: what is waiting to be published, and the publish on its way to the site. A publish is a
 * commit; Cloudflare then builds and deploys the site, usually in 2 to 4 minutes, and the bar follows it by asking
 * the server every 10 seconds.
 */

const POLL_MS = 10_000;
const LIVE_NOTICE_MS = 30 * 60 * 1000;

export interface Change {
  id: string;
  label: string;
  etag: string;
  /**
   * Live projects' changes are ticked to start with, and new projects highlighted on the home page; other new projects
   * are published from their editor or ticked here.
   */
  ticked: boolean;
  stale: boolean;
}

/** Everything that could go out with "Publish all changes". */
export function pendingChanges(state: AdminState, published: Published): Change[] {
  const live = new Map(published.projects.map((p) => [p.id, p]));
  const changes: Change[] = [];
  for (const draft of state.drafts) {
    if (draft.state === 'publishing' || draft.state === 'hidden') continue;
    const onSite = live.has(draft.id);
    const title = draft.title.trim() || 'Untitled project';
    const label = !onSite
      ? `${title} (new)`
      : draft.action === 'delete'
        ? `${title} (deleted)`
        : draft.action === 'unpublish'
          ? `${title} (taken off the site)`
          : live.get(draft.id)?.slug !== draft.slug && draft.slug
            ? `${title} (edited, new web address)`
            : `${title} (edited)`;
    // A new project highlighted on the home page goes up with it unless unticked.
    const highlighted = !onSite && draft.action === 'publish' && Boolean(state.homeDraft?.highlights.includes(draft.id));
    changes.push({ id: draft.id, label, etag: draft.etag, ticked: (onSite || highlighted) && !draft.stale, stale: draft.stale });
  }
  return changes;
}

function elapsed(since: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(since)) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}

/** Where to look once a publish is live. */
function liveHref(publish: NonNullable<AdminState['publish']>): string {
  const item = publish.items.find((i) => i.action === 'publish' && i.path);
  if (item?.path) return caseStudyPath(item.path.replace(/^content\/projects\/|\.json$/g, ''));
  return publish.items.length ? '/work' : '/';
}

export default function PublishBar() {
  const { state, published, refresh } = useAdmin();
  const changes = useMemo(() => pendingChanges(state, published), [state, published]);
  const home = state.homeDraft;
  const count = changes.filter((c) => c.ticked).length + (home ? 1 : 0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const publish = state.publish;
  const build = state.build;
  const following = publish && build && (build.state === 'building' || build.state === 'late');

  // Follow a build: ask again every 10 s, and tick the clock every second.
  useEffect(() => {
    if (!following) return;
    const poll = window.setInterval(() => void refresh(), POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [following, refresh]);

  async function act(label: string, work: () => Promise<{ ok: true } | Failure>) {
    if (busy) return;
    setBusy(label);
    setProblem(null);
    const result = await work();
    setBusy(null);
    if (!result.ok) setProblem(result.error);
    await refresh();
  }

  const showLive = publish && build?.state === 'live' && dismissed !== publish.commit && publish.liveAt && now - Date.parse(publish.liveAt) < LIVE_NOTICE_MS;
  if (count === 0 && changes.length === 0 && !home && !following && build?.state !== 'failed' && !showLive && !problem) return null;

  return (
    <section className="adm-publish" aria-label="Publishing">
      <div className="adm-publish-in">
        {publish && build?.state === 'building' && (
          <p className="adm-publish-status" role="status" data-tone="busy">
            Building the site ({elapsed(publish.at, now)}). Usually 2 to 4 minutes.
          </p>
        )}
        {publish && build?.state === 'late' && (
          <div className="adm-publish-status" role="status" data-tone="error">
            <p>Not live after 15 minutes. The site still shows the previous version.</p>
            <BuildActions busy={busy} act={act} />
          </div>
        )}
        {publish && build?.state === 'failed' && (
          <div className="adm-publish-status" role="alert" data-tone="error">
            <p>
              The build failed{build.step ? ` at ${build.step}` : ''}. The site still shows the previous version.
            </p>
            {build.tail && <pre className="adm-publish-log">{build.tail}</pre>}
            <BuildActions busy={busy} act={act} />
          </div>
        )}
        {showLive && publish && (
          <p className="adm-publish-status" role="status" data-tone="saved">
            {publish.kind === 'undo' ? 'Undone. The site is back to how it was. ' : 'Live. '}
            <a href={liveHref(publish)} target="_blank" rel="noopener">
              View it<span className="adm-vh"> (opens in a new tab)</span>
            </a>
            <button type="button" className="adm-btn adm-btn-small adm-btn-quiet" onClick={() => setDismissed(publish.commit)}>
              Dismiss
            </button>
          </p>
        )}
        {problem && (
          <p className="adm-alert" role="alert">
            {problem}
          </p>
        )}
        {(changes.length > 0 || home) && !following && (
          <button type="button" className="adm-btn adm-btn-primary adm-btn-small" onClick={() => dialog.current?.showModal()}>
            Publish all changes ({count})
          </button>
        )}
      </div>
      <PublishDialog dialogRef={dialog} changes={changes} home={home} onDone={refresh} />
    </section>
  );
}

function BuildActions({ busy, act }: { busy: string | null; act: (label: string, work: () => Promise<{ ok: true } | Failure>) => Promise<void> }) {
  return (
    <>
      <div className="adm-publish-actions">
        <button type="button" className="adm-btn adm-btn-small" aria-disabled={busy ? true : undefined} onClick={() => act('rebuild', api.rebuild)}>
          {busy === 'rebuild' ? 'Starting the build…' : 'Try again'}
        </button>
        <button type="button" className="adm-btn adm-btn-small" aria-disabled={busy ? true : undefined} onClick={() => act('undo', api.undo)}>
          {busy === 'undo' ? 'Undoing…' : 'Undo this publish'}
        </button>
      </div>
      <p className="adm-help">Open the build log: Cloudflare &gt; Workers &amp; Pages &gt; nihaalnazeer &gt; Deployments.</p>
    </>
  );
}

function PublishDialog({
  dialogRef,
  changes,
  home,
  onDone,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  changes: Change[];
  home: AdminState['homeDraft'];
  onDone: () => Promise<void>;
}) {
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [withHome, setWithHome] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const isTicked = (change: Change) => ticked[change.id] ?? change.ticked;
  const chosen = changes.filter(isTicked);
  const total = chosen.length + (home && withHome ? 1 : 0);
  const titles = new Map(changes.map((c) => [c.id, c.label]));

  async function publishNow() {
    if (busy || total === 0) return;
    setBusy(true);
    setFailure(null);
    const result = await api.publish(
      chosen.map(({ id, etag }) => ({ id, etag })),
      home && withHome ? home.etag : null,
    );
    setBusy(false);
    if (!result.ok) {
      setFailure(result);
      await onDone();
      return;
    }
    setTicked({});
    dialogRef.current?.close();
    await onDone();
  }

  return (
    <dialog ref={dialogRef} className="adm-dialog" aria-labelledby="adm-publish-title" onClose={() => setFailure(null)}>
      <h2 className="adm-h2" id="adm-publish-title">
        Publish changes
      </h2>
      <p className="adm-help">Exactly these go to the site. It rebuilds in 2 to 4 minutes; you can keep working meanwhile.</p>
      <ul className="adm-publish-list">
        {changes.map((change) => (
          <li key={change.id}>
            <label className="adm-check">
              <input type="checkbox" checked={isTicked(change)} onChange={(e) => setTicked((t) => ({ ...t, [change.id]: e.target.checked }))} />
              <span>{change.label}</span>
            </label>
            {change.stale && <span className="adm-help"> Changed on the site since this draft began: open it to choose.</span>}
            <a className="adm-btn adm-btn-small adm-btn-quiet" href={editPath(change.id)}>
              Open<span className="adm-vh"> {change.label}</span>
            </a>
          </li>
        ))}
        {home && (
          <li>
            <label className="adm-check">
              <input type="checkbox" checked={withHome} onChange={(e) => setWithHome(e.target.checked)} />
              <span>Home page (order and highlights)</span>
            </label>
          </li>
        )}
      </ul>
      {failure && (
        <div className="adm-alert" role="alert">
          {failure.conflicts?.length ? (
            <ul>
              {failure.conflicts.map((c) => (
                <li key={c.id}>
                  {c.id === 'site' ? '' : `${c.id === 'home' ? 'Home page' : (titles.get(c.id) ?? 'A project')}: `}
                  {c.reason}
                </li>
              ))}
            </ul>
          ) : failure.errors ? (
            <ul>
              {Object.entries(failure.errors).map(([id, fields]) => (
                <li key={id}>
                  <a href={editPath(id)}>{titles.get(id) ?? 'A project'}</a>: {Object.values(fields)[0]}
                </li>
              ))}
            </ul>
          ) : (
            <p>{failure.error}</p>
          )}
        </div>
      )}
      <div className="adm-dialog-buttons">
        <button type="button" className="adm-btn" onClick={() => dialogRef.current?.close()}>
          Cancel
        </button>
        <button type="button" className="adm-btn adm-btn-primary" onClick={publishNow} aria-disabled={busy || total === 0 || undefined}>
          {busy ? 'Publishing…' : `Publish ${total} ${total === 1 ? 'change' : 'changes'}`}
        </button>
      </div>
    </dialog>
  );
}
