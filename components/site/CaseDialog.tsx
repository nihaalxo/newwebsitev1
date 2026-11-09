'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { CaseProject } from './case-project';
import CaseView from './CaseView';
import { getActiveFilter } from './filter-store';
import { reducedMotion } from './films';
import { isSoundOn } from './sound';

const CASE_HASH = /^#case-([\w-]+)$/;

interface CaseDialogProps {
  /** Every published project, in order: the case file steps through them (or the filtered ones) with Previous and Next. */
  projects: CaseProject[];
  fiveLine: string;
  /** Open on this project from the start: the page at /work/<slug>. */
  initialSlug?: string;
  /** Over All projects, Back to all work just closes the case file. */
  overAllWork?: boolean;
}

type View = { seq: string[]; idx: number; announce: boolean };

/**
 * The case file: one dialog per page. Any element with data-open="<slug>" opens it on that project (plain clicks
 * only, so a link opened in a new tab still goes to /work/<slug>). Its address is #case-<slug>, so Back closes it and
 * a link with that hash opens it.
 */
export default function CaseDialog({ projects, fiveLine, initialSlug, overAllWork = false }: CaseDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  // Set when a project opens: the Close button is focused once it has rendered.
  const focusClose = useRef(false);
  const bySlug = useMemo(() => new Map(projects.map((p) => [p.slug, p])), [projects]);
  const all = useMemo(() => projects.map((p) => p.slug), [projects]);
  const [view, setView] = useState<View | null>(() =>
    initialSlug && bySlug.has(initialSlug) ? { seq: all, idx: all.indexOf(initialSlug), announce: false } : null,
  );

  // The handlers below are registered once; they reach the latest state through this ref.
  const live = useRef({ all, bySlug, view });
  live.current = { all, bySlug, view };

  const api = useMemo(() => {
    function render(i: number, announce: boolean) {
      const current = live.current.view;
      if (!current) return;
      const n = current.seq.length;
      setView({ ...current, idx: (i + n) % n, announce });
    }

    function openCase(slug: string, opener?: HTMLElement | null) {
      const { all: every, bySlug: lookup } = live.current;
      const filter = getActiveFilter();
      const pool = filter === 'all' ? every : every.filter((s) => lookup.get(s)?.category === filter);
      const seq = pool.includes(slug) ? pool : every.includes(slug) ? every : [slug];
      returnTo.current = opener ?? null;
      document.getElementById('peek')?.classList.remove('on');
      const d = dialog.current;
      if (d && !d.open) {
        history.pushState({ case: slug }, '', `#case-${slug}`);
        d.showModal();
      }
      focusClose.current = true;
      setView({ seq, idx: seq.indexOf(slug), announce: false });
    }

    function closeCase() {
      if (dialog.current?.open) dialog.current.close();
    }

    return { render, openCase, closeCase };
  }, []);

  // After each render of a project: back to the top, the address names it, its film follows the sound switch.
  useEffect(() => {
    const d = dialog.current;
    if (!d || !view) return;
    const slug = view.seq[view.idx];
    d.scrollTop = 0;
    if (focusClose.current) {
      focusClose.current = false;
      document.getElementById('case-close')?.focus();
    }
    if (d.open && location.hash !== `#case-${slug}`) history.replaceState(null, '', `#case-${slug}`);
    d.querySelectorAll('video').forEach((video) => {
      video.muted = !isSoundOn();
      if (d.open && !reducedMotion() && video.closest('.case-media')) video.play().catch(() => undefined);
    });
  }, [view]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;

    // Opened by the server (the page at /work/<slug>): reopen as a modal, and give it the address it has when opened
    // from All projects, so closing it leaves All projects behind.
    if (d.open && !d.matches(':modal')) {
      d.close();
      d.showModal();
      const slug = initialSlug ?? '';
      history.replaceState(null, '', `/work#case-${slug}`);
      document.getElementById('case-close')?.focus();
    }

    const onClose = () => {
      // The reopen above fires a close event after the dialog is already open again; that one isn't a real close.
      if (d.open) return;
      d.querySelectorAll('video').forEach((video) => video.pause());
      if (location.hash.startsWith('#case-')) history.replaceState(null, '', location.pathname + location.search);
      if (returnTo.current && document.contains(returnTo.current)) returnTo.current.focus();
    };
    const onBackdrop = (event: globalThis.MouseEvent) => {
      if (event.target === d) api.closeCase();
    };
    const onKey = (event: KeyboardEvent) => {
      const current = live.current.view;
      if (!current || current.seq.length < 2) return;
      if (event.target instanceof Element && event.target.closest('video')) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        api.render(current.idx - 1, true);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        api.render(current.idx + 1, true);
      }
    };
    const onOpenClick = (event: globalThis.MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const opener = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-open]') : null;
      const slug = opener?.dataset.open;
      if (!opener || !slug || !live.current.bySlug.has(slug)) return;
      event.preventDefault();
      api.openCase(slug, opener);
    };
    const onPopState = () => {
      const match = CASE_HASH.exec(location.hash);
      if (match && live.current.bySlug.has(match[1])) api.openCase(match[1]);
      else api.closeCase();
    };

    d.addEventListener('close', onClose);
    d.addEventListener('click', onBackdrop);
    d.addEventListener('keydown', onKey);
    document.addEventListener('click', onOpenClick);
    window.addEventListener('popstate', onPopState);

    // Arriving with #case-<slug> in the address opens that project.
    const start = CASE_HASH.exec(location.hash);
    if (!d.open && start && live.current.bySlug.has(start[1])) api.openCase(start[1]);

    return () => {
      d.removeEventListener('close', onClose);
      d.removeEventListener('click', onBackdrop);
      d.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onOpenClick);
      window.removeEventListener('popstate', onPopState);
    };
  }, [api, initialSlug]);

  const project = view ? bySlug.get(view.seq[view.idx]) : undefined;
  const n = view?.seq.length ?? 0;
  const neighbour = (offset: number) => (view && n > 1 ? (bySlug.get(view.seq[(view.idx + offset + n) % n])?.title ?? '') : null);

  return (
    <dialog
      className="case"
      id="case"
      aria-labelledby="case-title"
      ref={dialog}
      open={initialSlug ? true : undefined}
      style={project ? ({ '--amb': project.accent || '#6FF3FF' } as CSSProperties) : undefined}
    >
      {project ? (
        <CaseView
          project={project}
          fiveLine={fiveLine}
          prevTitle={neighbour(-1)}
          nextTitle={neighbour(1)}
          announcement={view?.announce ? `${project.title}, ${view.idx + 1} of ${n}` : ''}
          onClose={api.closeCase}
          onPrev={() => view && api.render(view.idx - 1, true)}
          onNext={() => view && api.render(view.idx + 1, true)}
          onAllWork={
            overAllWork
              ? (event: MouseEvent<HTMLAnchorElement>) => {
                  event.preventDefault();
                  api.closeCase();
                }
              : undefined
          }
        />
      ) : (
        <div className="case-bar">
          <span id="case-kicker">Case file</span>
          <button className="x-btn" type="button" id="case-close" onClick={api.closeCase}>
            Close
          </button>
        </div>
      )}
    </dialog>
  );
}
