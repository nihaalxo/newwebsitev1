import Link from 'next/link';
import type { CSSProperties } from 'react';
import { highlightSpan, plateSizes } from '@/lib/layout';
import MoreWork from './MoreWork';
import PlateCard from './PlateCard';
import type { WorkItem } from './work-item';

/** The home page's second screen: the highlighted projects as plates, every other project as a compact list. */
export default function Work({ highlights, rest }: { highlights: WorkItem[]; rest: WorkItem[] }) {
  if (highlights.length === 0 && rest.length === 0) return null;
  const span = highlightSpan(highlights.length);

  return (
    <section className="work" id="work" aria-labelledby="work-title">
      <div className="wrap work-in">
        <h2 className="title-s" id="work-title">
          Work
        </h2>
        {highlights.length > 0 && (
          <ul className="grid highlights">
            {highlights.map((item) => (
              <li key={item.id} className="card" style={{ '--span': span } as CSSProperties}>
                <PlateCard item={item} sizes={plateSizes(span)} />
              </li>
            ))}
          </ul>
        )}
        {rest.length > 0 && <MoreWork items={rest} />}
        <Link className="btn btn-ghost work-all" href="/work">
          View all projects
        </Link>
      </div>
    </section>
  );
}
