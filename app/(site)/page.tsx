import type { Metadata } from 'next';
import About from '@/components/site/About';
import CaseDialog from '@/components/site/CaseDialog';
import { toCaseProject } from '@/components/site/case-project';
import { absoluteUrl, OWNER_NAME, SITE_URL } from '@/components/site/config';
import Contact from '@/components/site/Contact';
import Cv from '@/components/site/Cv';
import { getSettings, listPublished, splitHighlights } from '@/components/site/data';
import Hero from '@/components/site/Hero';
import Lair from '@/components/site/Lair';
import { still } from '@/components/site/media';
import Work from '@/components/site/Work';
import WorkPeek from '@/components/site/WorkPeek';
import { toWorkItem } from '@/components/site/work-item';

export const dynamic = 'force-dynamic';

/** The case file that tells how the Lair was built. Found by its id, which never changes, so renaming its web address
    in the editor keeps the link; the slug it was seeded with is the fallback for content seeded under another id. */
const LAIR_STORY_ID = 'b2f3f3cd-38ee-5821-8498-db1a3e9ce573';
const LAIR_STORY_SLUG = 'immersive-portfolio-website';

export async function generateMetadata(): Promise<Metadata> {
  const [projects, settings] = await Promise.all([listPublished(), getSettings()]);
  const description = settings.siteDescription.replace('{count}', String(projects.length));
  const { highlights, rest } = splitHighlights(projects);
  const share = still([...highlights, ...rest].find((p) => p.cover)?.cover ?? null);
  const images = share ? [{ url: absoluteUrl(share.src), width: share.width, height: share.height, alt: share.alt }] : undefined;
  const lead = settings.heroLead || description;

  return {
    title: { absolute: OWNER_NAME },
    description,
    alternates: { canonical: '/' },
    openGraph: { type: 'website', url: SITE_URL, siteName: OWNER_NAME, title: OWNER_NAME, description: lead, images },
    twitter: { card: 'summary_large_image', title: OWNER_NAME, description: lead, images: images?.map((i) => i.url) },
  };
}

export default async function HomePage() {
  const [projects, settings] = await Promise.all([listPublished(), getSettings()]);
  const { highlights, rest } = splitHighlights(projects);
  const lairStory = projects.find((p) => p.id === LAIR_STORY_ID) ?? projects.find((p) => p.slug === LAIR_STORY_SLUG) ?? null;

  return (
    <>
      <main id="top">
        <Hero settings={settings} />
        <Work settings={settings} highlights={highlights.map(toWorkItem)} rest={rest.map(toWorkItem)} />
        <Lair settings={settings} storySlug={lairStory?.slug ?? null} />
        <About settings={settings} />
        <Cv settings={settings} />
        <Contact settings={settings} />
      </main>
      <WorkPeek />
      <CaseDialog
        projects={projects.map(toCaseProject)}
        fiveLine={settings.fiveLine}
        labels={settings.labels}
        storyPrompts={settings.storyPrompts}
      />
    </>
  );
}
