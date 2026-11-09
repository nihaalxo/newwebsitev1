'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CATEGORIES, type Category } from '@/lib/cms/types';
import { layoutPlates, plateSizes } from '@/lib/layout';
import PlateCard from './PlateCard';
import { scrollBehavior } from './motion';
import type { WorkItem } from './work-item';

type Filter = Category | 'all';

const FILTER_PARAM = 'filter';

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Every published project as a plate in uneven rows, under the discipline tabs. Named by the page's title. */
export default function AllWork({ items, labelledBy }: { items: WorkItem[]; labelledBy: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [announcement, setAnnouncement] = useState('');
  const [stuck, setStuck] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);

  const tabs = useMemo(() => {
    const counted = CATEGORIES.map((c) => ({ ...c, count: items.filter((p) => p.category === c.id).length }));
    return [
      { id: 'all' as Filter, label: 'All', count: items.length },
      ...counted.filter((c) => c.count > 0).map((c) => ({ id: c.id as Filter, label: c.label, count: c.count })),
    ];
  }, [items]);

  const shown = useMemo(() => (filter === 'all' ? items : items.filter((p) => p.category === filter)), [items, filter]);
  const plates = useMemo(() => layoutPlates(shown), [shown]);

  // A filter chosen earlier survives the trip to a case study and back.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get(FILTER_PARAM);
    if (wanted && wanted !== 'all' && tabs.some((t) => t.id === wanted)) setFilter(wanted as Filter);
  }, [tabs]);

  // The tabs frost only once they pin under the header.
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
    const n = next === 'all' ? items.length : (label?.count ?? 0);
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
      const grid = gridRef.current;
      if (!bar || !grid) return;
      const want = bar.getBoundingClientRect().bottom + 16;
      const top = grid.getBoundingClientRect().top;
      if (top < want - 1) window.scrollBy({ top: top - want, behavior: scrollBehavior() });
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="all-work" aria-labelledby={labelledBy}>
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
          </div>
        </div>
      </div>

      <div className="wrap">
        <ul ref={gridRef} className="grid">
          {plates.map(({ item, span, ratio, row }) => (
            <li key={item.id} className="card" style={{ '--span': span, '--ar': ratio } as CSSProperties}>
              <PlateCard item={item} sizes={plateSizes(span)} priority={filter === 'all' && row === 0} />
            </li>
          ))}
        </ul>
      </div>
      <p className="vh" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
