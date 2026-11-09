import type { Metadata } from 'next';
import { requireAdmin } from '@/components/admin/auth';
import ProjectEditor from '@/components/admin/ProjectEditor';
import { SITE_URL } from '@/components/site/config';
import { emptyProject } from '@/lib/cms/defaults';

export const metadata: Metadata = { title: 'New project' };

export default async function NewProjectPage() {
  const { store } = await requireAdmin('/admin/projects/new');
  const [projects, settings] = await Promise.all([store.listAll(), store.getSettings()]);

  return (
    <ProjectEditor
      initial={emptyProject()}
      saved={null}
      takenSlugs={projects.map((p) => p.slug)}
      siteHost={new URL(SITE_URL).host}
      storyPrompts={settings.storyPrompts}
    />
  );
}
