import type { Metadata } from 'next';
import XMark from '@/components/site/XMark';

// Its own title, so the tab and screen readers say the page wasn't found before anyone reads the body.
export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main id="main" className="lost">
      <XMark className="lost-mark" />
      <div className="wrap">
        <h1 className="title-xl">Off the map</h1>
        <p className="lost-lead">
          This page isn&apos;t here. It may have moved when the site was rebuilt, or the link lost a letter on the way.
        </p>
        <div className="actions">
          <a className="btn btn-seam" href="/#work">
            See the work
          </a>
          <a className="btn btn-ghost" href="/">
            Back to the start
          </a>
        </div>
      </div>
    </main>
  );
}
