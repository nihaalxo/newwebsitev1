import type { ReactNode } from 'react';
import { getSettings } from '@/components/site/data';
import MailPill from '@/components/site/MailPill';
import SeamLap from '@/components/site/SeamLap';
import SiteFooter from '@/components/site/SiteFooter';
import SiteHeader from '@/components/site/SiteHeader';
import '@/components/site/site.css';

// Every page reads the CMS on each request (D1 on Cloudflare), so an edit in the admin shows at once.
export const dynamic = 'force-dynamic';

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <symbol id="ext" viewBox="0 0 16 16">
          <path d="M6 3h7v7M13 3 4 12" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </symbol>
        <symbol id="dl" viewBox="0 0 16 16">
          <path d="M8 2v9M4 7.5 8 11.5l4-4M3 14h10" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </symbol>
        <symbol id="back" viewBox="0 0 16 16">
          <path d="M13 8H3M7 4 3 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </symbol>
      </svg>
      <SiteHeader labels={settings.labels} />
      {children}
      <SiteFooter settings={settings} />
      {settings.email && <MailPill email={settings.email} label={settings.labels.mailPill} />}
      <p className="vh" id="sr-status" role="status" aria-live="polite"></p>
      <SeamLap />
    </>
  );
}
