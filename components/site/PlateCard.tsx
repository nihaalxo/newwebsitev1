import { thumbnail } from './media';
import type { WorkItem } from './work-item';

/**
 * Every plate's image is laid out by the plate itself (object-fit: cover), so the attributes are the plate's display
 * size, as in the mockup, not the file's.
 */
const PLATE_WIDTH = 679;
const PLATE_HEIGHT = 504;

/**
 * A project as a plate with the full glimmer hover: a halo, a lap of light around the whole outline (SeamLap) and a
 * slow zoom. A real link to the project's page, which the case file intercepts to open in place (CaseDialog).
 * The spaces between the parts are the mockup's, so the link reads "title meta summary", not one run-on word.
 * `priority` is for the first plates on All projects: fetched first, never lazily. On the home page the plates load
 * normally, as in the mockup.
 */
export default function PlateCard({ item, priority }: { item: WorkItem; priority?: boolean }) {
  const src = thumbnail(item.cover);
  const loading = priority === undefined ? undefined : priority ? undefined : 'lazy';
  return (
    <a className="card-link" href={`/work/${item.slug}`} data-open={item.slug}>
      {' '}
      <span className="halo">
        <span className="plate">
          {src && (
            <img
              src={src}
              width={PLATE_WIDTH}
              height={PLATE_HEIGHT}
              alt={item.cover?.alt ?? ''}
              loading={loading}
              fetchPriority={priority ? 'high' : undefined}
            />
          )}
          <span className="seam-run" aria-hidden="true"></span>
        </span>
      </span>{' '}
      <span className="cap">
        {' '}
        <span className="card-title">{item.title}</span>{' '}
        <span className="card-meta">{item.discipline ? `${item.discipline}, ${item.year}` : String(item.year)}</span>{' '}
        {item.summary && <span className="card-line">{item.summary}</span>}{' '}
      </span>{' '}
    </a>
  );
}
