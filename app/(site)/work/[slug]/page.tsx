import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AllProjectsView from '@/components/site/AllProjectsView';
import { absoluteUrl, OWNER_NAME } from '@/components/site/config';
import { SITE } from '@/components/site/copy';
import { still } from '@/components/site/media';
import { loadContent } from '@/lib/content/load';

// A project's own address: All projects, with that project's case file open over it. One page is built per project;
// any other /work/<slug> is the 404 page.

type Params = Promise<{ slug: string }>;

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return loadContent().projects.map((p) => ({ slug: p.slug }));
}

function findProject(slug: string) {
  return loadContent().projects.find((p) => p.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const project = findProject((await params).slug);
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
  const project = findProject((await params).slug);
  if (!project) notFound();
  return <AllProjectsView settings={SITE} projects={loadContent().projects} openSlug={project.slug} />;
}
