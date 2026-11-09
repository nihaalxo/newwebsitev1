import type { Metadata } from 'next';
import About from '@/components/site/About';
import { absoluteUrl, OWNER_NAME, SITE_URL } from '@/components/site/config';
import Contact from '@/components/site/Contact';
import { getSettings, hasLair, listPublished, splitHighlights } from '@/components/site/data';
import Hero from '@/components/site/Hero';
import Lair from '@/components/site/Lair';
import MailPill from '@/components/site/MailPill';
import { still } from '@/components/site/media';
import Work from '@/components/site/Work';
import { toWorkItem } from '@/components/site/work-item';

export const revalidate = 300;

/** The case study that tells how the Lair was built, linked from the Lair band when it's published. Found by its id,
    which never changes, so renaming its web address in the editor keeps the link; the slug it was seeded with is the
    fallback for content seeded under another id. */
const LAIR_STORY_ID = 'b2f3f3cd-38ee-5821-8498-db1a3e9ce573';
const LAIR_STORY_SLUG = 'immersive-portfolio-website';

const FALLBACK_DESCRIPTION = 'Brand identities, app interfaces and spatial experiences, plus a 3D portfolio you can walk through.';

export async function generateMetadata(): Promise<Metadata> {
  const [projects, settings] = await Promise.all([listPublished(), getSettings()]);
  const description = settings.heroLead || FALLBACK_DESCRIPTION;
  const { highlights, rest } = splitHighlights(projects);
  const share = still([...highlights, ...rest].find((p) => p.cover)?.cover ?? null);
  const images = share
    ? [{ url: absoluteUrl(share.src), width: share.width, height: share.height, alt: share.alt }]
    : undefined;

  return {
    title: { absolute: OWNER_NAME },
    description,
    alternates: { canonical: '/' },
    openGraph: { type: 'website', url: SITE_URL, siteName: OWNER_NAME, title: OWNER_NAME, description, images },
    twitter: { card: 'summary_large_image', title: OWNER_NAME, description, images: images?.map((i) => i.url) },
  };
}

export default async function HomePage() {
  const [projects, settings] = await Promise.all([listPublished(), getSettings()]);
  const { highlights, rest } = splitHighlights(projects);
  const lairProject =
    projects.find((p) => p.id === LAIR_STORY_ID) ?? projects.find((p) => p.slug === LAIR_STORY_SLUG) ?? null;
  const lairStory = lairProject ? `/work/${lairProject.slug}` : null;

  return (
    <>
      <main id="main">
        <Hero settings={settings} showCue={projects.length > 0} />
        <Work highlights={highlights.map(toWorkItem)} rest={rest.map(toWorkItem)} />
        {hasLair(settings) && <Lair settings={settings} buildStoryHref={lairStory} />}
        <About settings={settings} />
        <Contact settings={settings} />
      </main>
      {settings.email && <MailPill email={settings.email} />}
    </>
  );
}
