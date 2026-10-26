import '@/components/site/site.css';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { requireAdmin } from '@/components/admin/auth';
import { editPath, previewPath } from '@/components/admin/paths';
import CaseStudy from '@/components/site/CaseStudy';
import { nextProject } from '@/components/site/data';
import { cms } from '@/lib/cms';
import type { Block, Project } from '@/lib/cms/types';

// Outside the (protected) group on purpose: no admin chrome, so the case study looks exactly as it will on the site.

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
  const { store } = await requireAdmin(previewPath(id));
  const [project, all] = await Promise.all([loadProject(id), store.listAll()]);
  if (!project) notFound();

  // The footer's next project is the one that would follow on the site: the next published project in order.
  const sequence = [...all]
    .sort((a, b) => a.position - b.position)
    .filter((p) => p.status === 'published' || p.id === project.id);

  return (
    <>
      <div className="adm-preview-bar" role="region" aria-label="Preview">
        <p>
          Previewing <strong>{project.title || 'Untitled project'}</strong>
        </p>
        <a href={editPath(project.id)}>Back to the editor</a>
      </div>
      <main id="main" className="page">
        <CaseStudy project={previewable(project)} next={nextProject(sequence, project)} preview />
      </main>
    </>
  );
}
