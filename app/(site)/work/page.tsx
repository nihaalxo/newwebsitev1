import type { Metadata } from 'next';
import AllProjects from '@/components/site/AllProjects';
import { absoluteUrl, OWNER_NAME } from '@/components/site/config';
import { getSettings } from '@/components/site/data';

export const dynamic = 'force-dynamic';

const DESCRIPTION = `Every project by ${OWNER_NAME}: brand identities, spatial experiences, app interfaces, print and motion.`;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = settings.allProjectsTitle || 'All projects';
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: '/work' },
    openGraph: {
      type: 'website',
      url: absoluteUrl('/work'),
      siteName: OWNER_NAME,
      title: `${title} | ${OWNER_NAME}`,
      description: settings.heroLead || DESCRIPTION,
    },
  };
}

export default function AllProjectsPage() {
  return <AllProjects />;
}
