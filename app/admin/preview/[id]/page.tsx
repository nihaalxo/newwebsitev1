import '@/components/site/site.css';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { requireAdmin } from '@/components/admin/auth';
import { editPath, previewPath } from '@/components/admin/paths';
import type { CSSProperties } from 'react';
import { toCaseProject } from '@/components/site/case-project';
import CaseView from '@/components/site/CaseView';
import { getSettings } from '@/components/site/data';
import { cms } from '@/lib/cms';
import type { Block, Project } from '@/lib/cms/types';

// Outside the (protected) group on purpose: no admin chrome, so the case file looks exactly as it will on the site,
// shown open in the page rather than as a dialog over it.

type Params = Promise<{ id: string }>;

export const dynamic = 'force-dynamic';

const loadProject = cache(async (id: string) => {
  const store = await cms();
  return (await store.currentAdmin()) ? store.getById(id) : null;
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const project = await loadProject((await params).id);
  return { title: project?.title ? `Preview: ${project.title}` : 'Preview' };
}

/** Drafts may hold blocks still waiting for their file; leave those out rather than render empty frames. */
function isReady(block: Block): boolean {
  switch (block.type) {
    case 'image':
    case 'video':
      return Boolean(block.media.src);
    case 'gallery':
      return block.items.length > 0;
    default:
      return true;
  }
}

function previewable(project: Project): Project {
  return {
    ...project,
    cover: project.cover?.src ? project.cover : null,
    blocks: project.blocks.filter(isReady),
  };
}

export default async function PreviewPage({ params }: { params: Params }) {
  const { id } = await params;
  await requireAdmin(previewPath(id));
  const [project, settings] = await Promise.all([loadProject(id), getSettings()]);
  if (!project) notFound();

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <symbol id="ext" viewBox="0 0 16 16">
          <path d="M6 3h7v7M13 3 4 12" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </symbol>
      </svg>
      <div className="adm-preview-bar" role="region" aria-label="Preview">
        <p>
          Previewing <strong>{project.title || 'Untitled project'}</strong>
        </p>
        <a href={editPath(project.id)}>Back to the editor</a>
      </div>
      <main id="main">
        <dialog
          className="case is-preview"
          open
          aria-labelledby="case-title"
          style={{ '--amb': project.accent || '#6FF3FF' } as CSSProperties}
        >
          <CaseView
            project={toCaseProject(previewable(project))}
            fiveLine={settings.fiveLine}
            labels={settings.labels}
            storyPrompts={settings.storyPrompts}
            prevTitle={null}
            nextTitle={null}
            closeHref={editPath(project.id)}
          />
        </dialog>
      </main>
    </>
  );
}
