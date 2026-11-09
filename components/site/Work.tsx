import type { CSSProperties } from 'react';
import type { Settings } from '@/lib/cms/types';
import { thumbnail } from './media';
import PlateCard from './PlateCard';
import type { WorkItem } from './work-item';

/** One screen on a desktop window: the heading, the highlights as plates, every other project once as a row. */
export default function Work({ settings, highlights, rest }: { settings: Settings; highlights: WorkItem[]; rest: WorkItem[] }) {
  return (
    <section className="work" id="work" aria-labelledby="work-title">
      <div className="wrap work-in">
        <h2 className="title-s" id="work-title">
          {settings.workTitle}
        </h2>
        {highlights.length > 0 && (
          <ul className="highs" id="highs">
            {highlights.map((item) => (
              <li key={item.id} className="card hi" style={{ '--span': 12 / highlights.length } as CSSProperties}>
                <PlateCard item={item} />
              </li>
            ))}
          </ul>
        )}
        {rest.length > 0 && (
          <ul className="rows" id="rows">
            {rest.map((item) => (
              <li key={item.id}>
                <a className="row" href={`/work/${item.slug}`} data-open={item.slug} data-peek={thumbnail(item.cover) ?? undefined}>
                  <span className="row-title">{item.title}</span>
                  <span className="row-year">{item.year}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="work-foot">
          <a className="btn btn-ghost" href="/work">
            {settings.labels.viewAll}
          </a>
        </p>
      </div>
    </section>
  );
}
