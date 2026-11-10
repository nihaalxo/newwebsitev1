'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { api, loadPublished } from '@/lib/admin-api/client';
import { mergeForPreview, findLairStory, splitHighlights, type Published } from '@/lib/content/assemble';
import type { Draft, HomeDraft } from '@/lib/cms/types';
import AllProjectsView from '@/components/site/AllProjectsView';
import { toCaseProject } from '@/components/site/case-project';
import CaseView from '@/components/site/CaseView';
import { SITE } from '@/components/site/copy';
import HomeView from '@/components/site/HomeView';
import SiteChrome from '@/components/site/SiteChrome';
import { editPath, previewPath, type PreviewView } from './paths';

/*
 * /admin/preview?id=<project id>&view=case|home|work: the site as it will be once this draft (and the home page's
 * draft) are published, drawn by the site's own views. Links to the home page and All projects switch the view here
 * instead of leaving. Phone view frames the same page at 390 px.
 */

const VIEWS: { id: PreviewView; label: string }[] = [
  { id: 'case', label: 'Case file' },
  { id: 'home', label: 'Home' },
  { id: 'work', label: 'All projects' },
];

type Loaded = { site: Published; draft: Draft | null } | { error: string };

export default function PreviewScreen() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const view = (VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'case') as PreviewView;
  const framed = params.get('frame') === '1';
  const [phone, setPhone] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let gone = false;
    void (async () => {
      const [content, draft, state] = await Promise.all([loadPublished(), api.draft(id), api.state()]);
      if (gone) return;
      if (!content.ok) return setLoaded({ error: content.error });
      if (!state.ok) return setLoaded({ error: state.error });
      const home: HomeDraft | null = state.homeDraft
        ? { highlights: state.homeDraft.highlights, order: state.homeDraft.order, base: { blobSha: '' }, savedAt: '' }
        : null;
      const own = draft.ok ? draft.draft : null;
      setLoaded({ site: mergeForPreview(content.published, own, home), draft: own });
    })();
    return () => {
      gone = true;
    };
  }, [id]);

  // Links to the home page and All projects switch the view instead of leaving the preview.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a');
      if (!link || link.target === '_blank') return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const to: PreviewView | null = url.pathname === '/work' ? 'work' : url.pathname === '/' ? 'home' : null;
      if (!to) return;
      event.preventDefault();
      const next = `${previewPath(id, to)}${framed ? '&frame=1' : ''}${url.hash}`;
      window.location.assign(next);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [id, framed]);

  const project = useMemo(() => (loaded && 'site' in loaded ? (loaded.site.projects.find((p) => p.id === id) ?? null) : null), [loaded, id]);

  useEffect(() => {
    if (project) document.title = `Preview: ${project.title || 'Untitled project'} | Site admin`;
  }, [project]);

  if (!loaded) return <p style={{ padding: 24 }}>Loading the preview…</p>;
  if ('error' in loaded) return <p style={{ padding: 24 }}>{loaded.error}</p>;
  if (!project) {
    return (
      <p style={{ padding: 24 }}>
        Nothing to preview yet: save the project first. <a href="/admin">Back to the projects</a>
      </p>
    );
  }

  const bar = framed ? null : (
    <div className={`adm-preview-bar${view === 'case' ? '' : ' adm-preview-bar-low'}`} role="region" aria-label="Preview">
      <p>
        Previewing <strong>{project.title || 'Untitled project'}</strong> · <a href={editPath(id)}>Back to the editor</a>
      </p>
      <p className="adm-preview-views">
        {VIEWS.map((v) =>
          v.id === view ? (
            <strong key={v.id} aria-current="page">
              {v.label}
            </strong>
          ) : (
            <a key={v.id} href={previewPath(id, v.id)}>
              {v.label}
            </a>
          ),
        )}
        <button type="button" className="adm-preview-phone" aria-pressed={phone} onClick={() => setPhone((p) => !p)}>
          Phone view
        </button>
      </p>
    </div>
  );

  if (phone && !framed) {
    return (
      <>
        {bar}
        <div className="adm-phone-frame">
          <iframe title="The preview at phone width" src={`${previewPath(id, view)}&frame=1`} width={390} height={844} />
        </div>
      </>
    );
  }

  const { site } = loaded;
  if (view === 'home') {
    const { highlights, rest } = splitHighlights(site.projects, site.home.highlights);
    return (
      <>
        {bar}
        <SiteChrome settings={SITE}>
          <HomeView settings={SITE} projects={site.projects} highlights={highlights} rest={rest} lairStorySlug={findLairStory(site.projects)?.slug ?? null} />
        </SiteChrome>
      </>
    );
  }
  if (view === 'work') {
    return (
      <>
        {bar}
        <SiteChrome settings={SITE}>
          <AllProjectsView settings={SITE} projects={site.projects} />
        </SiteChrome>
      </>
    );
  }

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <symbol id="ext" viewBox="0 0 16 16">
          <path d="M6 3h7v7M13 3 4 12" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </symbol>
      </svg>
      {bar}
      <main id="main">
        <dialog className="case is-preview" open aria-labelledby="case-title" style={{ '--amb': project.accent || '#6FF3FF' } as CSSProperties}>
          <CaseView
            project={toCaseProject(project)}
            fiveLine={SITE.fiveLine}
            labels={SITE.labels}
            storyPrompts={SITE.storyPrompts}
            prevTitle={null}
            nextTitle={null}
            closeHref={editPath(id)}
          />
        </dialog>
      </main>
    </>
  );
}
