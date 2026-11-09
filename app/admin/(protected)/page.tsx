import type { Metadata } from 'next';
import { requireAdmin } from '@/components/admin/auth';
import ProjectList, { type ProjectRow } from '@/components/admin/ProjectList';
import { MAX_HIGHLIGHTS, type Project } from '@/lib/cms/types';

export const metadata: Metadata = { title: 'Projects' };

function toRow(project: Project): ProjectRow {
  const cover = project.cover?.kind === 'image' ? project.cover : null;
  return {
    id: project.id,
    title: project.title,
    discipline: project.discipline,
    year: project.year,
    status: project.status,
    featured: project.featured,
    thumb: cover ? cover.srcSmall || cover.src : null,
  };
}

function countLine(projects: Project[]): string {
  const published = projects.filter((p) => p.status === 'published').length;
  const drafts = projects.length - published;
  const total = `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`;
  return `${total}: ${published} published, ${drafts} ${drafts === 1 ? 'draft' : 'drafts'}.`;
}

export default async function ProjectsPage() {
  const { store } = await requireAdmin('/admin');
  const projects = [...(await store.listAll())].sort((a, b) => a.position - b.position);

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-h1">Projects</h1>
          {projects.length > 0 && <p className="adm-lede">{countLine(projects)}</p>}
        </div>
        <a className="adm-btn adm-btn-primary" href="/admin/projects/new">
          New project
        </a>
      </div>

      {projects.length === 0 ? (
        <EmptyState local={store.mode === 'local'} />
      ) : (
        <>
          <p className="adm-list-help">
            Highlighted projects appear large on the home page, up to {MAX_HIGHLIGHTS} at a time. Every other published
            project is listed under them, and all of them appear on the All projects page. The order here is the order on
            the site. Drafts stay hidden until you publish them.
          </p>
          <ProjectList initialRows={projects.map(toRow)} />
        </>
      )}
    </>
  );
}

function EmptyState({ local }: { local: boolean }) {
  return (
    <div className="adm-empty">
      <h2 className="adm-h2">No projects yet</h2>
      <p>To add your first one:</p>
      <ol>
        <li>Choose New project.</li>
        <li>Give it a title, a year and a one-sentence summary, and add a cover image.</li>
        <li>Tell the story with text, images, galleries, videos and quotes.</li>
        <li>Save it as a draft while you work, preview it, and publish when it&apos;s ready.</li>
      </ol>
      {local && (
        <p className="adm-help">
          Running locally and expected to see the existing projects? Run npm run cms:seed in the project folder, then reload.
        </p>
      )}
      <a className="adm-btn adm-btn-primary" href="/admin/projects/new">
        New project
      </a>
    </div>
  );
}
