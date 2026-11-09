'use client';

import { useLayoutEffect, useRef } from 'react';
import { playFilm, reducedMotion } from './films';
import { isSoundOn } from './sound';

const SEEN_KEY = 'nn-intro-seen';

/**
 * Whether to skip the intro: the first load of a visit plays the whole film (black, the figure appears, the flash)
 * and runs straight into the rain; after that, including a reload or coming back from All projects, only the rain
 * and lightning repeat. Coming back from the Lair (?from=lair) counts as having seen it: the exit film has just
 * played. ?intro in the address forces the intro, for reviewing it.
 */
function introAlreadySeen(): boolean {
  let seen = false;
  try {
    seen =
      (sessionStorage.getItem(SEEN_KEY) === '1' || location.search.includes('from=lair')) &&
      !location.search.includes('intro');
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // No storage: the intro simply plays.
  }
  return seen;
}

/** Takes ?from=lair out of the address once it has been read, so a reload or a shared link doesn't carry it. */
function forgetLairReturn(): void {
  const url = new URL(location.href);
  if (url.searchParams.get('from') !== 'lair') return;
  url.searchParams.delete('from');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

interface HeroFilmProps {
  src: string;
  poster?: string;
  /** After the intro the film loops between these times; loopEnd 0 loops the whole film. */
  loopStart: number;
  loopEnd: number;
}

export default function HeroFilm({ src, poster, loopStart, loopEnd }: HeroFilmProps) {
  const ref = useRef<HTMLVideoElement>(null);
  // Decided once per page view. React's development Strict Mode runs effects twice, and the second run would
  // otherwise find the flag the first one just set and skip an intro nobody has seen.
  const skipIntro = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    const hero = ref.current;
    if (!hero) return;
    const reduce = reducedMotion();
    if (skipIntro.current === null) {
      skipIntro.current = introAlreadySeen() || reduce;
      forgetLairReturn();
    }
    const skip = skipIntro.current;

    if (skip && poster) hero.poster = poster;
    const wanted = src + (skip && loopStart > 0 ? `#t=${loopStart}` : '');
    if (hero.getAttribute('src') !== wanted) hero.src = wanted;
    hero.muted = !isSoundOn();

    // Both loop points are calm frames on a locked camera, so the jump reads as a cut to the next lightning strike.
    const loopBack = () => {
      if (loopEnd > 0 && hero.currentTime >= loopEnd) hero.currentTime = loopStart;
    };
    hero.addEventListener('timeupdate', loopBack);
    let frame = 0;
    let live = true;
    if ('requestVideoFrameCallback' in hero) {
      const onFrame = () => {
        if (!live) return;
        loopBack();
        frame = hero.requestVideoFrameCallback(onFrame);
      };
      frame = hero.requestVideoFrameCallback(onFrame);
    }

    if (reduce) {
      hero.removeAttribute('autoplay');
      hero.autoplay = false;
      hero.pause();
    } else {
      hero.play().catch(() => {
        if (poster) hero.poster = poster;
      });
    }

    // Like every film, it pauses off screen and carries on when it comes back.
    let observer: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (!reducedMotion()) playFilm(hero);
          } else if (!hero.paused) hero.pause();
        },
        { threshold: 0.3 },
      );
      observer.observe(hero);
    }

    return () => {
      live = false;
      hero.removeEventListener('timeupdate', loopBack);
      if (frame && 'cancelVideoFrameCallback' in hero) hero.cancelVideoFrameCallback(frame);
      observer?.disconnect();
    };
  }, [src, poster, loopStart, loopEnd]);

  return (
    <video
      ref={ref}
      className="hero-film"
      id="hero-film"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    />
  );
}
