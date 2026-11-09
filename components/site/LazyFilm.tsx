'use client';

import { useRef } from 'react';
import type { Media } from '@/lib/cms/types';
import { useLazyFilm } from './films';

interface LazyFilmProps {
  film: Media;
  className: string;
  /** Appended to the address, e.g. "#t=0.8" to start a little way in. */
  fragment?: string;
  /** Films that say something get a label; the rest are decoration and hidden from screen readers. */
  label?: string;
}

/** A muted, looping film that loads and plays only while it is on screen. */
export default function LazyFilm({ film, className, fragment = '', label }: LazyFilmProps) {
  const ref = useRef<HTMLVideoElement>(null);
  useLazyFilm(ref);
  return (
    <video
      ref={ref}
      className={className}
      data-src={film.src + fragment}
      data-src-tall={film.srcTall ? film.srcTall + fragment : undefined}
      poster={film.poster || undefined}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}
