import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AllProjects from '@/components/site/AllProjects';
import { absoluteUrl, OWNER_NAME } from '@/components/site/config';
import { getPublishedProject } from '@/components/site/data';
import { still } from '@/components/site/media';

// A project's own address: All projects, with that project's case file open over it.
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

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
  const project = await getPublishedProject(slug);
  if (!project) notFound();

  return <AllProjects openSlug={project.slug} />;
}
