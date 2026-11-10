import type { ReactNode } from 'react';
import { SITE } from '@/components/site/copy';
import SiteChrome from '@/components/site/SiteChrome';
import '@/components/site/site.css';

// Every public page is built ahead into plain HTML (`npm run build`): the words from components/site/copy.ts, the
// projects from content/.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteChrome settings={SITE}>{children}</SiteChrome>;
}
