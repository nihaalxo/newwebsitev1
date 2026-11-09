import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { requireAdmin } from '@/components/admin/auth';
import { editPath } from '@/components/admin/paths';
import ProjectEditor from '@/components/admin/ProjectEditor';
import { toInput } from '@/components/admin/rules';
import { SITE_URL } from '@/components/site/config';
import { cms } from '@/lib/cms';

type Params = Promise<{ id: string }>;

/** Shared by the page and its metadata within one request. Null when signed out or the project is gone. */
const loadProject = cache(async (id: string) => {
  const store = await cms();
  return (await store.currentAdmin()) ? store.getById(id) : null;
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const project = await loadProject((await params).id);
  return { title: project?.title ? `Edit ${project.title}` : 'Edit project' };
}

export default async function EditProjectPage({ params }: { params: Params }) {
  const { id } = await params;
  const { store } = await requireAdmin(editPath(id));
  const [project, all, settings] = await Promise.all([loadProject(id), store.listAll(), store.getSettings()]);
  if (!project) notFound();

  return (
    <ProjectEditor
      key={project.id}
      initial={toInput(project)}
      saved={{ status: project.status, slug: project.slug, publishedAt: project.publishedAt, updatedAt: project.updatedAt }}
      takenSlugs={all.filter((p) => p.id !== project.id).map((p) => p.slug)}
      siteHost={new URL(SITE_URL).host}
      storyPrompts={settings.storyPrompts}
    />
  );
}
