import type { ReactNode } from 'react';
import { getSettings, hasLair } from '@/components/site/data';
import SiteFooter from '@/components/site/SiteFooter';
import SiteHeader from '@/components/site/SiteHeader';
import '@/components/site/site.css';

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  const showLair = hasLair(settings);

  return (
    <div className="site">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <SiteHeader showLair={showLair} />
      {children}
      <SiteFooter settings={settings} showLair={showLair} />
    </div>
  );
}
