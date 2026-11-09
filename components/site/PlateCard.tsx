import { thumbnail } from './media';
import type { WorkItem } from './work-item';

/**
 * A project as a plate with the full glimmer hover: a halo, a lap of light around the whole outline (SeamLap) and a
 * slow zoom. A real link to the project's page, which the case file intercepts to open in place (CaseDialog).
 */
export default function PlateCard({ item, priority = false }: { item: WorkItem; priority?: boolean }) {
  const src = thumbnail(item.cover);
  return (
    <a className="card-link" href={`/work/${item.slug}`} data-open={item.slug}>
      <span className="halo">
        <span className="plate">
          {src && (
            <img
              src={src}
              width={item.cover?.width}
              height={item.cover?.height}
              alt={item.cover?.alt ?? ''}
              loading={priority ? undefined : 'lazy'}
              fetchPriority={priority ? 'high' : undefined}
            />
          )}
          <span className="seam-run" aria-hidden="true"></span>
        </span>
      </span>
      <span className="cap">
        <span className="card-title">{item.title}</span>
        <span className="card-meta">
          {item.discipline ? `${item.discipline}, ` : ''}
          {item.year}
        </span>
        {item.summary && <span className="card-line">{item.summary}</span>}
      </span>
    </a>
  );
}
