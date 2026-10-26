import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CaseStudy from '@/components/site/CaseStudy';
import { absoluteUrl, OWNER_NAME } from '@/components/site/config';
import { getPublishedProject, listPublished, nextProject } from '@/components/site/data';
import { still } from '@/components/site/media';

export const revalidate = 300;
// Projects published after the last build render on first request, then join the cache.
export const dynamicParams = true;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const projects = await listPublished();
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project) return { title: 'Page not found' };

  const path = `/work/${project.slug}`;
  const description = project.summary || [project.discipline, project.year].filter(Boolean).join(', ') || undefined;
  const cover = still(project.cover);
  const images = cover
    ? [{ url: absoluteUrl(cover.src), width: cover.width, height: cover.height, alt: cover.alt }]
    : undefined;

  return {
    title: project.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      url: absoluteUrl(path),
      siteName: OWNER_NAME,
      title: project.title,
      description,
      images,
      publishedTime: project.publishedAt ?? undefined,
      modifiedTime: project.updatedAt,
    },
    twitter: { card: 'summary_large_image', title: project.title, description, images: images?.map((i) => i.url) },
  };
}

export default async function WorkPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [project, all] = await Promise.all([getPublishedProject(slug), listPublished()]);
  if (!project) notFound();

  return (
    <main id="main" className="page">
      <CaseStudy project={project} next={nextProject(all, project)} />
    </main>
  );
}
