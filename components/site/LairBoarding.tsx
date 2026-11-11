'use client';

import { useEffect, useRef } from 'react';

/** How long a press stays answered when the visitor never leaves this tab, as when the ship opened behind it. */
const NOTE_MS = 5000;
/** A link this close to the bottom of the screen has the note at the top instead, so that the note never covers it. */
const LOW_PX = 160;

/**
 * Every Lair link opens the ship in a new tab, and on a phone the ship takes a few seconds to come up. So a press is answered at
 * once, before anything else has happened: the link lights (`.boarding`) and a note says where the ship went. Both clear when the
 * visitor comes back to this tab, or after a few seconds. The note is a popover, so it shows over an open case file too. Screen
 * readers hear it through the page's status line, but only while this tab is still the one in front: the link itself already says
 * it opens in a new tab, and a visitor who comes back should not hear about a tab that is already open.
 */
export default function LairBoarding({ label }: { label: string }) {
  const note = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let lit: Element | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const el = note.current;
    const status = document.getElementById('sr-status');
    const show = (on: boolean) => {
      if (!el) return;
      el.classList.toggle('on', on);
      try {
        if (typeof el.showPopover === 'function') {
          if (on && !el.matches(':popover-open')) el.showPopover();
          if (!on && el.matches(':popover-open')) el.hidePopover();
        }
      } catch {
        // A browser without popovers keeps the note fixed over the page, which is all it needs.
      }
    };
    const clear = () => {
      clearTimeout(timer);
      lit?.classList.remove('boarding');
      lit = null;
      show(false);
      if (status?.textContent === label) status.textContent = '';
    };
    const press = (event: MouseEvent) => {
      if (event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return;
      const link = event.target instanceof Element ? event.target.closest('a[data-lair]') : null;
      if (!link) return;
      clear();
      lit = link;
      link.classList.add('boarding');
      el?.classList.toggle('up', link.getBoundingClientRect().bottom > window.innerHeight - LOW_PX);
      show(true);
      // As say() does, a frame later so that it is heard. A tab left behind runs no frames until it is back in front, and by then
      // the press has been cleared.
      if (status) {
        status.textContent = '';
        requestAnimationFrame(() => {
          if (lit === link) status.textContent = label;
        });
      }
      timer = setTimeout(clear, NOTE_MS);
    };
    const back = () => {
      if (document.visibilityState === 'visible') clear();
    };
    // Safari on a phone shows :active, the press itself, only on a page that listens for touches.
    const touch = () => undefined;
    document.addEventListener('click', press);
    document.addEventListener('auxclick', press);
    document.addEventListener('visibilitychange', back);
    document.addEventListener('touchstart', touch, { passive: true });
    window.addEventListener('pageshow', clear);
    return () => {
      clear();
      document.removeEventListener('click', press);
      document.removeEventListener('auxclick', press);
      document.removeEventListener('visibilitychange', back);
      document.removeEventListener('touchstart', touch);
      window.removeEventListener('pageshow', clear);
    };
  }, [label]);

  return (
    <p className="boarding-note" ref={note} popover="manual" aria-hidden="true">
      <span className="boarding-orbit" />
      {label}
    </p>
  );
}
