import type { ReactNode } from 'react';
import type { Settings } from '@/lib/cms/types';
import MailPill from './MailPill';
import SeamLap from './SeamLap';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

/**
 * Everything around a page's content: the shared icons, the bar, the footer, the phone email pill, the status line
 * for screen readers and the plates' glimmer. Used by every public page, the 404 page and the admin's preview.
 */
export default function SiteChrome({ settings, children }: { settings: Settings; children: ReactNode }) {
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
