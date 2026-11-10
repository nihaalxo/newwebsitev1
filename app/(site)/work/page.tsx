import type { Metadata } from 'next';
import AllProjectsView from '@/components/site/AllProjectsView';
import { absoluteUrl, OWNER_NAME } from '@/components/site/config';
import { SITE } from '@/components/site/copy';
import { loadContent } from '@/lib/content/load';

const DESCRIPTION = `Every project by ${OWNER_NAME}: brand identities, spatial experiences, app interfaces, print and motion.`;

export function generateMetadata(): Metadata {
  const title = SITE.allProjectsTitle || 'All projects';
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: '/work' },
    openGraph: {
      type: 'website',
      url: absoluteUrl('/work'),
      siteName: OWNER_NAME,
      title: `${title} | ${OWNER_NAME}`,
      description: SITE.heroLead || DESCRIPTION,
    },
  };
}

export default function AllProjectsPage() {
  return <AllProjectsView settings={SITE} projects={loadContent().projects} />;
}
