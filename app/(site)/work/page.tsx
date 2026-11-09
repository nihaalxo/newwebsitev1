import type { Metadata } from 'next';
import AllWork from '@/components/site/AllWork';
import { absoluteUrl, OWNER_NAME } from '@/components/site/config';
import { listPublished } from '@/components/site/data';
import { toWorkItem } from '@/components/site/work-item';

export const revalidate = 300;

const TITLE = 'All projects';
const DESCRIPTION = 'Every project: brand identities, spatial experiences, interfaces, print and motion.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/work' },
  openGraph: { type: 'website', url: absoluteUrl('/work'), siteName: OWNER_NAME, title: TITLE, description: DESCRIPTION },
};

export default async function AllProjectsPage() {
  const projects = await listPublished();

  return (
    <main id="main" className="page">
      <div className="wrap all-head">
        <h1 className="title-l" id="all-title">
          {TITLE}
        </h1>
      </div>
      <AllWork items={projects.map(toWorkItem)} labelledBy="all-title" />
    </main>
  );
}
