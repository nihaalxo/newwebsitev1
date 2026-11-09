'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import Picture from './Picture';
import type { WorkItem } from './work-item';

/** Light the seam around a plate. The class stays until the run finishes, so a brushing pointer never cuts it short. */
function lightSeam(link: HTMLElement) {
  link.querySelector('.plate')?.classList.add('lit');
}

/** A project as a large plate with its caption, on the home page's highlights and on All projects. */
export default function PlateCard({ item, sizes, priority = false }: { item: WorkItem; sizes: string; priority?: boolean }) {
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
