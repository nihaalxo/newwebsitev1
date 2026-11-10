'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/admin-api/client';
import { PROJECT_ID } from '@/lib/admin-api/sanitize';
import { SITE_URL } from '@/components/site/config';
import { emptyProject } from '@/lib/cms/defaults';
import { useAdmin } from './AdminShell';
import ProjectEditor, { type EditableProject, type StoredDraft } from './ProjectEditor';

/** /admin/edit?id=<project id>, or ?new for a new project. */
export default function EditScreen() {
  const params = useSearchParams();
  const { state, published } = useAdmin();
  const requested = params.get('id');
  const isNew = params.has('new') && !requested;
  const [id] = useState(() => (isNew ? crypto.randomUUID() : (requested ?? '')));
  const [loaded, setLoaded] = useState<{ initial: EditableProject; stored: StoredDraft | null } | 'missing' | string | null>(null);

  const live = useMemo(() => published.projects.find((p) => p.id === id) ?? null, [published, id]);
  const summary = state.drafts.find((d) => d.id === id);

  useEffect(() => {
    if (loaded) return;
    if (isNew) {
      setLoaded({ initial: { ...emptyProject(), id }, stored: null });
      return;
    }
    if (!PROJECT_ID.test(id)) {
      setLoaded('missing');
      return;
    }
    void api.draft(id).then((result) => {
      if (result.ok) {
        const { project, savedAt, state: draftState, action } = result.draft;
        setLoaded({ initial: project, stored: { etag: result.etag, savedAt, state: draftState, action } });
      } else if (result.status === 404) {
        setLoaded(live ? { initial: { ...live }, stored: null } : 'missing');
      } else {
        setLoaded(result.error);
      }
    });
  }, [id, isNew, live, loaded]);

  useEffect(() => {
    const title = loaded && typeof loaded === 'object' ? loaded.initial.title : '';
    document.title = `${isNew ? 'New project' : title ? `Edit ${title}` : 'Edit project'} | Site admin`;
  }, [loaded, isNew]);

  if (!loaded) return <p className="adm-lede" role="status">Loading…</p>;
  if (loaded === 'missing') {
    return (
      <div className="adm-empty">
        <h1 className="adm-h1">No such project</h1>
        <p>It may have been deleted. <a href="/admin">Back to the projects</a>.</p>
      </div>
    );
  }
  if (typeof loaded === 'string') {
    return (
      <div className="adm-alert adm-list-alert" role="alert">
        <p>{loaded}</p>
        <button type="button" className="adm-btn adm-btn-small" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  const takenSlugs = [
    ...published.projects.filter((p) => p.id !== id).map((p) => p.slug),
    ...state.drafts.filter((d) => d.id !== id && d.slug).map((d) => d.slug),
  ];
  return (
    <ProjectEditor
      key={id}
      initial={loaded.initial}
      stored={loaded.stored}
      live={live}
      stale={Boolean(summary?.stale)}
      takenSlugs={takenSlugs}
      siteHost={new URL(SITE_URL).host}
    />
  );
}
