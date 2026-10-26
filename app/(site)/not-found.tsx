import type { Metadata } from 'next';
import Link from 'next/link';
import XMark from '@/components/site/XMark';

// Its own title, so the tab and screen readers say the page wasn't found before anyone reads the body.
export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main id="main" className="page lost">
      <XMark className="lost-mark" />
      <div className="wrap lost-in">
        <h1 className="title-l">Off the map</h1>
        <p className="lost-lead">
          This page isn&apos;t here. It may have moved when the site was rebuilt, or the link lost a letter on the way.
        </p>
        <div className="actions">
          <span className="lit">
            <Link className="btn btn-seam" href="/#work">
              See the work
            </Link>
          </span>
          <Link className="btn btn-ghost" href="/">
            Back to the start
          </Link>
        </div>
      </div>
    </main>
  );
}
