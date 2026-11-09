'use client';

import { useEffect, type RefObject } from 'react';
import { isSoundOn } from './sound';

/*
 * Films play only while on screen and pause off it. A lazy film has no src until it first scrolls into view: it waits
 * under its poster, then loads data-src (or data-src-tall on screens taller than they are wide).
 */

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Plays with sound when it's on; if the browser refuses, plays muted instead. */
export function playFilm(video: HTMLVideoElement): void {
  video.muted = !isSoundOn();
  video.play().catch(() => {
    video.muted = true;
    video.play().catch(() => undefined);
  });
}

function filmSrc(video: HTMLVideoElement): string | undefined {
  const { src, srcTall } = video.dataset;
  return srcTall && matchMedia('(max-aspect-ratio: 1/1)').matches ? srcTall : src;
}

/** Wires one film to the screen: load on first sight, play while 30% or more of it shows, pause when it leaves. */
export function useLazyFilm(ref: RefObject<HTMLVideoElement | null>): void {
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!('IntersectionObserver' in window)) {
      const src = filmSrc(video);
      if (src) video.src = src;
      return;
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const src = filmSrc(video);
            if (src && !video.getAttribute('src')) {
              video.src = src;
              video.preload = 'auto';
            }
            if (!reducedMotion()) playFilm(video);
          } else if (!video.paused) video.pause();
        }),
      { threshold: 0.3 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [ref]);
}
