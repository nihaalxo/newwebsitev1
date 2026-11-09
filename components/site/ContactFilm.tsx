'use client';

import { useEffect, useRef } from 'react';
import type { Media } from '@/lib/cms/types';
import { reducedMotion, useLazyFilm } from './films';

/**
 * The contact film. On a desktop, someone who watches the whole film without touching anything is carried down to
 * the form when it ends: only once, never with reduced motion, and never if they have scrolled on, paused it or left.
 */
export default function ContactFilm({ film, start }: { film: Media; start: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useLazyFilm(ref);

  useEffect(() => {
    const video = ref.current;
    const form = document.querySelector('#contact .contact-grid');
    if (!video || !form) return;
    const desktop = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 960px)');
    let from: number | null = null;
    let last = 0;
    let done = false;

    const onPlaying = () => {
      if (from === null) from = video.currentTime;
    };
    // Paused part-way (scrolled away): no longer a full watch.
    const onPause = () => {
      if (!done) from = -1;
    };
    const filmInView = () => {
      const r = video.getBoundingClientRect();
      return (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height >= 0.6;
    };
    const finish = () => {
      done = true;
      const formShowing = form.getBoundingClientRect().bottom <= innerHeight;
      if (desktop.matches && !reducedMotion() && from !== null && from >= 0 && from < 1.5 && filmInView() && !formShowing) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    // The film loops, so its end shows up either as the last moments or as the jump back to the start.
    const onTime = () => {
      const t = video.currentTime;
      if (!done && from !== null && (t >= video.duration - 0.3 || t < last - 1)) finish();
      last = t;
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
    };
  }, []);

  return (
    <video
      ref={ref}
      className="lazy-film"
      data-src={start > 0 ? `${film.src}#t=${start}` : film.src}
      poster={film.poster || undefined}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
    />
  );
}
