'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CATEGORIES, type Category, type Project } from '@/lib/cms/types';
import { layoutPlates } from '@/lib/layout';
import MoreWork from './MoreWork';
import Picture from './Picture';
import { scrollBehavior } from './motion';

export type WorkItem = Pick<
  Project,
  'id' | 'slug' | 'title' | 'category' | 'discipline' | 'year' | 'summary' | 'cover' | 'accent'
>;

type Filter = Category | 'all';

const FILTER_PARAM = 'filter';

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function summarise(items: WorkItem[]): string {
  const years = items.map((p) => p.year).filter(Boolean);
  if (years.length === 0) return plural(items.length, 'project');
  const first = Math.min(...years);
  const last = Math.max(...years);
  return `${plural(items.length, 'project')}, ${first === last ? `from ${first}` : `${first} to ${last}`}`;
}

/** How wide a plate spanning `span` of 12 columns renders, for the image's `sizes`. */
function plateSizes(span: number) {
  return `(max-width: 719px) 100vw, (max-width: 1360px) ${Math.round((span / 12) * 92)}vw, ${Math.round((span / 12) * 1248)}px`;
}

/** Light the seam around a plate. The class stays until the run finishes, so a brushing pointer never cuts it short. */
function lightSeam(link: HTMLElement) {
  link.querySelector('.plate')?.classList.add('lit');
}

export default function Work({ featured, more }: { featured: WorkItem[]; more: WorkItem[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [announcement, setAnnouncement] = useState('');
  const [stuck, setStuck] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const everything = useMemo(() => [...featured, ...more], [featured, more]);
  const tabs = useMemo(() => {
    const counted = CATEGORIES.map((c) => ({ ...c, count: everything.filter((p) => p.category === c.id).length }));
    return [
      { id: 'all' as Filter, label: 'All', count: everything.length },
      ...counted.filter((c) => c.count > 0).map((c) => ({ id: c.id as Filter, label: c.label, count: c.count })),
    ];
  }, [everything]);

  const shownFeatured = useMemo(
    () => (filter === 'all' ? featured : featured.filter((p) => p.category === filter)),
    [featured, filter],
  );
  const shownMore = useMemo(() => (filter === 'all' ? more : more.filter((p) => p.category === filter)), [more, filter]);
  const plates = useMemo(() => layoutPlates(shownFeatured), [shownFeatured]);
  const shownCount = shownFeatured.length + shownMore.length;

  // A filter chosen earlier survives the trip to a case study and back.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get(FILTER_PARAM);
    if (wanted && wanted !== 'all' && tabs.some((t) => t.id === wanted)) setFilter(wanted as Filter);
  }, [tabs]);

  // The bar is clear over the hero film and frosts only once it pins under the header.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || !('IntersectionObserver' in window)) return;
    const pin = parseFloat(getComputedStyle(bar).top) || 64;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(entry.intersectionRatio < 1 && entry.boundingClientRect.top <= pin + 1),
      { rootMargin: `-${Math.ceil(pin) + 1}px 0px 0px 0px`, threshold: [0, 1] },
    );
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  function choose(next: Filter, tab: HTMLButtonElement) {
    if (next === filter) return;
    setFilter(next);

    const url = new URL(window.location.href);
    if (next === 'all') url.searchParams.delete(FILTER_PARAM);
    else url.searchParams.set(FILTER_PARAM, next);
    window.history.replaceState(null, '', url);

    const label = tabs.find((t) => t.id === next);
    const n = next === 'all' ? everything.length : (label?.count ?? 0);
    setAnnouncement(
      next === 'all' ? `Showing all ${plural(n, 'project')}` : `Showing ${n} ${label?.label.toLowerCase()} ${n === 1 ? 'project' : 'projects'}`,
    );

    // Bring a tab the phone's edge fade was hiding into view, and keep the results starting under the bar.
    const row = tabsRef.current;
    if (row) {
      row.scrollTo({ left: Math.max(0, tab.offsetLeft + tab.offsetWidth / 2 - row.clientWidth / 2), behavior: scrollBehavior() });
    }
    requestAnimationFrame(() => {
      const bar = barRef.current;
      const results = resultsRef.current;
      if (!bar || !results) return;
      const want = bar.getBoundingClientRect().bottom + 16;
      const top = results.getBoundingClientRect().top;
      if (top < want - 1) window.scrollBy({ top: top - want, behavior: scrollBehavior() });
    });
  }

  if (everything.length === 0) return null;

  return (
    <section className="work" id="work" aria-labelledby="work-title">
      <h2 className="vh" id="work-title">
        Work
      </h2>
      {/* Full-bleed so the frost reaches the edges once it pins; the tabs themselves keep to the grid. */}
      <div ref={barRef} className={stuck ? 'filters stuck' : 'filters'}>
        <div className="wrap">
          <div ref={tabsRef} className="tabs" role="group" aria-label="Show projects by discipline">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className="tab"
                type="button"
                aria-pressed={filter === tab.id}
                onClick={(event) => choose(tab.id, event.currentTarget)}
              >
                {tab.label}
                <sup>{tab.count}</sup>
                <span className="vh"> projects</span>
              </button>
            ))}
            <p className="count">
              {filter === 'all' ? summarise(everything) : `${shownCount} of ${plural(everything.length, 'project')}`}
            </p>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div ref={resultsRef} className="results">
          {plates.length > 0 && (
            <ul className="grid">
              {plates.map(({ item, span, ratio, row }) => (
                <li key={item.id} className="card" style={{ '--span': span, '--ar': ratio } as CSSProperties}>
                  <PlateCard item={item} sizes={plateSizes(span)} priority={filter === 'all' && row === 0} />
                </li>
              ))}
            </ul>
          )}
          {shownMore.length > 0 && <MoreWork items={shownMore} />}
        </div>
      </div>
      <p className="vh" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

function PlateCard({ item, sizes, priority }: { item: WorkItem; sizes: string; priority: boolean }) {
  const meta = [item.discipline, item.year].filter(Boolean).join(', ');
  return (
    <Link
      className="card-link"
      href={`/work/${item.slug}`}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') lightSeam(event.currentTarget);
      }}
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible')) lightSeam(event.currentTarget);
      }}
    >
      <span className="halo">
        <span
          className="plate"
          style={{ '--accent': item.accent } as CSSProperties}
          onAnimationEnd={(event) => {
            if (event.pseudoElement === '::before') event.currentTarget.classList.remove('lit');
          }}
        >
          {item.cover && <Picture media={item.cover} sizes={sizes} priority={priority} />}
        </span>
      </span>
      <span className="cap">
        <span className="card-title">{item.title}</span>
        {meta && <span className="card-meta">{meta}</span>}
        {item.summary && <span className="card-line">{item.summary}</span>}
      </span>
    </Link>
  );
}
