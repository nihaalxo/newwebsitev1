'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { CATEGORIES } from '@/lib/cms/types';
import { setActiveFilter, type Filter } from './filter-store';
import PlateCard from './PlateCard';
import { say } from './say';
import type { WorkItem } from './work-item';

/*
 * Every project once, as a plate on an uneven 12-column grid: rows of 7|5, 5|7, then 4|4|4, and again. Plates in a row
 * share a height (ROW_H, in twelfths of the grid's width). A last row with fewer plates than its pattern spreads them
 * across the full width.
 */
const PATTERN = [[7, 5], [5, 7], [4, 4, 4]];
const ROW_H: Record<number, number> = { 12: 5.2, 7: 4.6, 6: 4.6, 5: 4.6, 4: 3.25 };

function spans(count: number): number[] {
  const out: number[] = [];
  for (let row = 0; out.length < count; row++) {
    const pattern = PATTERN[row % PATTERN.length];
    const left = count - out.length;
    if (left >= pattern.length) out.push(...pattern);
    else out.push(...Array<number>(left).fill(12 / left));
  }
  return out;
}

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function AllWork({ items }: { items: WorkItem[] }) {
  const [active, setActive] = useState<Filter>('all');
  const bar = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const layout = spans(items.length);
  const counts = new Map(CATEGORIES.map((c) => [c.id, items.filter((i) => i.category === c.id).length]));
  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: items.length },
    ...CATEGORIES.filter((c) => (counts.get(c.id) ?? 0) > 0).map((c) => ({ id: c.id, label: c.label, count: counts.get(c.id) ?? 0 })),
  ];
  const showing = active === 'all' ? items.length : (counts.get(active) ?? 0);

  function choose(filter: Filter) {
    setActive(filter);
    setActiveFilter(filter);
    const count = filter === 'all' ? items.length : (counts.get(filter) ?? 0);
    const label = CATEGORIES.find((c) => c.id === filter)?.label.toLowerCase();
    say(filter === 'all' ? `Showing all ${count} projects` : `Showing ${count} ${label} projects`);
    // Keep the top of the grid just under the sticky filters, so the change is visible.
    if (bar.current && grid.current) {
      const want = bar.current.getBoundingClientRect().bottom + 16;
      const top = grid.current.getBoundingClientRect().top;
      if (top < want - 1) window.scrollBy({ top: top - want, behavior: reduce() ? 'auto' : 'smooth' });
    }
  }

  return (
    <>
      <div className="filters" role="group" aria-label="Show projects by discipline" ref={bar}>
        {tabs.map((tab) => (
          <button key={tab.id} className="tab" type="button" data-f={tab.id} aria-pressed={active === tab.id} onClick={() => choose(tab.id)}>
            {tab.label}
            <sup>{tab.count}</sup>
          </button>
        ))}
      </div>
      <ul
        className={active === 'all' ? 'grid' : 'grid is-filtered'}
        id="grid"
        ref={grid}
        style={{ '--n': Math.min(showing, 3) } as CSSProperties}
      >
        {items.map((item, i) => (
          <li
            key={item.id}
            className="card"
            data-cat={item.category}
            hidden={active !== 'all' && item.category !== active}
            style={{ '--span': layout[i], '--rh': ROW_H[layout[i]] ?? 4.6 } as CSSProperties}
          >
            <PlateCard item={item} priority={i < 2} />
          </li>
        ))}
      </ul>
    </>
  );
}
