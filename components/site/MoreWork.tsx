'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { thumbnail } from './media';
import { isMotionOn } from './motion-pref';
import type { WorkItem } from './Work';

const PEEK_WIDTH = 260;
const PEEK_HEIGHT = 195;
const PEEK_CLIP = 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)';
const PEEK_CLOSED = 'polygon(0 0, 0 0, 0 0, 0 100%, 0 100%)';

/** The published projects that aren't featured, as a list. On fine pointers the cover trails the cursor. */
export default function MoreWork({ items }: { items: WorkItem[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const peekRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const peek = peekRef.current;
    if (!list || !peek || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    let currentRow: Element | null = null;

    const tick = () => {
      // Read as it moves rather than once, so a press of the Motion switch in the bar applies straight away.
      const reduce = !isMotionOn();
      // Share of the remaining distance covered each frame: the peek has weight and leans into the motion.
      const follow = reduce ? 1 : 0.18;
      x += (targetX - x) * follow;
      y += (targetY - y) * follow;
      peek.style.translate = `${x}px ${y}px`;
      peek.style.rotate = reduce ? '0deg' : `${Math.max(-5, Math.min(5, (targetX - x) * 0.05))}deg`;
      frame = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.5 ? requestAnimationFrame(tick) : 0;
    };

    const hide = () => {
      peek.classList.remove('on');
      currentRow = null;
    };

    const warm = () => {
      list.querySelectorAll<HTMLElement>('[data-peek]').forEach((row) => {
        if (row.dataset.peek) new Image().src = row.dataset.peek;
      });
    };

    const move = (event: PointerEvent) => {
      const row = (event.target as Element).closest<HTMLElement>('[data-peek]');
      if (!row?.dataset.peek) return hide();

      const shown = peek.classList.contains('on');
      targetX = Math.min(event.clientX + 28, window.innerWidth - PEEK_WIDTH - 20);
      targetY = Math.max(16, Math.min(event.clientY - 98, window.innerHeight - PEEK_HEIGHT - 21));
      // While hidden it jumps to the cursor, so it never flies in from where it was last seen.
      if (!shown) {
        x = targetX;
        y = targetY;
      }

      if (row !== currentRow) {
        currentRow = row;
        if (peek.getAttribute('src') !== row.dataset.peek) {
          peek.src = row.dataset.peek;
          if (shown && isMotionOn()) {
            peek.animate([{ clipPath: PEEK_CLOSED }, { clipPath: PEEK_CLIP }], {
              duration: 260,
              easing: 'cubic-bezier(.2, .7, .2, 1)',
            });
          }
        }
      }

      peek.classList.add('on');
      if (!frame) frame = requestAnimationFrame(tick);
    };

    list.addEventListener('pointerenter', warm, { once: true });
    list.addEventListener('pointermove', move);
    list.addEventListener('pointerleave', hide);
    // Wheel scrolling slides a different row under a still cursor, so the peek would show the wrong project.
    window.addEventListener('scroll', hide, { passive: true });

    return () => {
      list.removeEventListener('pointerenter', warm);
      list.removeEventListener('pointermove', move);
      list.removeEventListener('pointerleave', hide);
      window.removeEventListener('scroll', hide);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="more">
      <h2 className="title-s">More work</h2>
      <ul className="rows" ref={listRef}>
        {items.map((p) => (
          <li key={p.id}>
            <Link className="row" href={`/work/${p.slug}`} data-peek={thumbnail(p.cover) ?? undefined}>
              <span className="row-title">{p.title}</span>
              {p.discipline && <span className="row-kind">{p.discipline}</span>}
              {p.year > 0 && <span className="row-year">{p.year}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <img className="peek" ref={peekRef} alt="" aria-hidden="true" />
    </div>
  );
}
