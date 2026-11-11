'use client';

import { useEffect, type RefObject } from 'react';
import { isSoundOn } from './sound';

/*
 * Films play only while on screen and pause off it. A lazy film has no src until it first scrolls into view: it waits
 * under its poster, then loads data-src (or data-src-tall on screens taller than they are wide). A film with a tall
 * cut changes cut when the screen turns, at the same moment of the film: the two cuts are the same length.
 */

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const TALL_SCREEN = '(max-aspect-ratio: 1/1)';

/** Plays with sound when it's on; if the browser refuses, plays muted instead. */
export function playFilm(video: HTMLVideoElement): void {
  video.muted = !isSoundOn();
  video.play().catch((error: unknown) => {
    // Muting cures only a refusal to play with sound. A pause or a new src (AbortError) or a file that won't load
    // (NotSupportedError) is no refusal: playing again would undo the pause, or fail again and leave the film muted.
    if ((error as { name?: string } | null)?.name !== 'NotAllowedError') return;
    video.muted = true;
    video.play().catch(() => undefined);
  });
}

function filmSrc(video: HTMLVideoElement): string | undefined {
  const { src, srcTall } = video.dataset;
  return srcTall && matchMedia(TALL_SCREEN).matches ? srcTall : src;
}

/**
 * Follows the screen turning, for a film with a tall cut: once loaded, it swaps to the other cut and carries on from
 * the same moment, playing if it was and is still on screen. Before its first sight there is nothing to swap; that
 * sight picks the cut. A turn can also move the film off screen: whichever of the turn and the screen check comes
 * first, the film ends up paused there. If the other cut won't load, the film goes back to the one that did.
 */
function followTurns(video: HTMLVideoElement, onScreen: () => boolean): () => void {
  if (!video.dataset.srcTall) return () => undefined;
  const shape = matchMedia(TALL_SCREEN);
  // The swap still loading, if any: the moment it carries on from, and how to stop listening to it.
  let pending: { at: number; done: () => void } | null = null;

  const swap = (src: string, at: number, play: boolean, back: string | null) => {
    pending?.done();
    video.src = src;
    const loaded = () => {
      pending?.done();
      if (at > 0 && at < video.duration) video.currentTime = at;
    };
    const failed = () => {
      pending?.done();
      if (back) swap(back, at, play, null);
    };
    video.addEventListener('loadedmetadata', loaded);
    video.addEventListener('error', failed);
    pending = {
      at,
      done: () => {
        video.removeEventListener('loadedmetadata', loaded);
        video.removeEventListener('error', failed);
        pending = null;
      },
    };
    if (play && onScreen()) playFilm(video);
  };

  const onTurn = () => {
    const now = video.getAttribute('src');
    const wanted = filmSrc(video);
    if (!now || !wanted || now === wanted) return;
    // Turned again before the last swap loaded: that swap's moment still holds, as the new load is still at 0.
    swap(wanted, pending ? pending.at : video.currentTime, !video.paused, now);
  };
  // Safari before 14 has only the old listener methods.
  if (shape.addEventListener) shape.addEventListener('change', onTurn);
  else shape.addListener(onTurn);
  return () => {
    pending?.done();
    if (shape.removeEventListener) shape.removeEventListener('change', onTurn);
    else shape.removeListener(onTurn);
  };
}

/** Wires one film to the screen: load on first sight, play while 30% or more of it shows, pause when it leaves. */
export function useLazyFilm(ref: RefObject<HTMLVideoElement | null>): void {
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!('IntersectionObserver' in window)) {
      const src = filmSrc(video);
      if (src) video.src = src;
      return followTurns(video, () => true);
    }
    let onScreen = false;
    const stopFollowing = followTurns(video, () => onScreen);
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          onScreen = entry.isIntersecting;
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
    return () => {
      observer.disconnect();
      stopFollowing();
    };
  }, [ref]);
}
