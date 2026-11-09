import type { Metadata } from 'next';
import { getSettings } from '@/components/site/data';
import XMark from '@/components/site/XMark';

// Its own title, so the tab and screen readers say the page wasn't found before anyone reads the body.
export const metadata: Metadata = { title: 'Page not found' };

export default async function NotFound() {
  const { labels } = await getSettings();
  return (
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
  );
}
