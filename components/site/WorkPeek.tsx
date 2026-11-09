'use client';

import { useEffect, useRef } from 'react';

/** The list's hover preview: a still of the project under the pointer follows it. Fine pointers only. */
export default function WorkPeek() {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const peek = ref.current;
    const rows = document.getElementById('rows');
    if (!peek || !rows || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const preload = () => {
      rows.querySelectorAll<HTMLElement>('[data-peek]').forEach((row) => {
        new Image().src = row.dataset.peek ?? '';
      });
    };
    const move = (event: PointerEvent) => {
      const row = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-peek]') : null;
      if (!row?.dataset.peek) {
        peek.classList.remove('on');
        return;
      }
      if (peek.getAttribute('src') !== row.dataset.peek) peek.src = row.dataset.peek;
      const x = Math.min(event.clientX + 28, innerWidth - 280);
      const y = Math.max(16, Math.min(event.clientY - 98, innerHeight - 216));
      peek.style.left = `${x}px`;
      peek.style.top = `${y}px`;
      peek.classList.add('on');
    };
    const hide = () => peek.classList.remove('on');

    rows.addEventListener('pointerenter', preload, { once: true });
    rows.addEventListener('pointermove', move);
    rows.addEventListener('pointerleave', hide);
    addEventListener('scroll', hide, { passive: true });
    return () => {
      rows.removeEventListener('pointerenter', preload);
      rows.removeEventListener('pointermove', move);
      rows.removeEventListener('pointerleave', hide);
      removeEventListener('scroll', hide);
    };
  }, []);

  return <img className="peek" id="peek" ref={ref} alt="" aria-hidden="true" />;
}
