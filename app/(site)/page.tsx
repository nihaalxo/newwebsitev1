import type { Metadata } from 'next';
import { absoluteUrl, OWNER_NAME, SITE_URL } from '@/components/site/config';
import { SITE } from '@/components/site/copy';
import HomeView from '@/components/site/HomeView';
import { still } from '@/components/site/media';
import { findLairStory, splitHighlights } from '@/lib/content/assemble';
import { loadContent } from '@/lib/content/load';

export function generateMetadata(): Metadata {
  const { projects, home } = loadContent();
  const description = SITE.siteDescription.replace('{count}', String(projects.length));
  const { highlights, rest } = splitHighlights(projects, home.highlights);
  const share = still([...highlights, ...rest].find((p) => p.cover)?.cover ?? null);
  const images = share ? [{ url: absoluteUrl(share.src), width: share.width, height: share.height, alt: share.alt }] : undefined;
  const lead = SITE.heroLead || description;

  return {
    title: { absolute: OWNER_NAME },
    description,
    alternates: { canonical: '/' },
    openGraph: { type: 'website', url: SITE_URL, siteName: OWNER_NAME, title: OWNER_NAME, description: lead, images },
    twitter: { card: 'summary_large_image', title: OWNER_NAME, description: lead, images: images?.map((i) => i.url) },
  };
}

export default function HomePage() {
  const { projects, home } = loadContent();
  const { highlights, rest } = splitHighlights(projects, home.highlights);
  return (
    <HomeView
      settings={SITE}
      projects={projects}
      highlights={highlights}
      rest={rest}
      lairStorySlug={findLairStory(projects)?.slug ?? null}
    />
  );
}
