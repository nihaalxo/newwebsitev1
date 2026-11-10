import type { Metadata } from 'next';
import { SITE } from '@/components/site/copy';
import SiteChrome from '@/components/site/SiteChrome';
import XMark from '@/components/site/XMark';
import '@/components/site/site.css';

// The 404 page (out/404.html), for any address the site doesn't have. Its own title, so the tab and screen readers
// say the page wasn't found before anyone reads the body.
export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  const { labels } = SITE;
  return (
    <SiteChrome settings={SITE}>
      <main id="main" className="lost">
        <XMark className="lost-mark" />
        <div className="wrap">
          <h1 className="title-xl">{labels.lostTitle}</h1>
          <p className="lost-lead">{labels.lostLead}</p>
          <div className="actions">
            <a className="btn btn-seam" href="/#work">
              {labels.lostWork}
            </a>
            <a className="btn btn-ghost" href="/">
              {labels.lostHome}
            </a>
          </div>
        </div>
      </main>
    </SiteChrome>
  );
}
