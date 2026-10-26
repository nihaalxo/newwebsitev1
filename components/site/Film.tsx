'use client';

import { useEffect, useRef } from 'react';
import type { Media } from '@/lib/cms/types';
import { isMotionOn, subscribeToMotion } from './motion-pref';
import { isSoundOn } from './sound';

interface FilmProps {
  media: Media;
  className?: string;
  /** Loops by itself while on screen, muted unless Sound is on. Otherwise the viewer starts it with the controls. */
  ambient?: boolean;
  /** Fetch nothing until the film is about to scroll into view. */
  lazy?: boolean;
  /** Seconds into the file to start from. */
  startAt?: number;
  controls?: boolean;
  /** Hide from assistive tech when the film only sets a mood and the words around it carry the meaning. */
  decorative?: boolean;
  /** Show media.poster as the video's own poster. Turn off when a still is layered underneath instead. */
  showPoster?: boolean;
  /** Fade in over whatever sits beneath once the first frame is ready, instead of cutting to it. */
  dissolve?: boolean;
}

/** Starts at this much visibility; pauses only once fully off screen, so a film never freezes in plain view. */
const PLAY_AT = 0.3;

/** Films the fallback below muted on its own. Only those are put back in step with Sound on the next start, so a
    mute or unmute the viewer chose with a film's own controls survives scrolling it away and back. */
const forcedMute = new WeakSet<HTMLVideoElement>();

function play(video: HTMLVideoElement) {
  if (forcedMute.delete(video)) video.muted = !isSoundOn();
  video.play().catch((error: unknown) => {
    // Autoplay with sound can be refused; fall back to a silent start rather than a frozen frame. Any other refusal,
    // such as a pause landing before the start, is left alone so the film stays paused.
    if (video.muted || !(error instanceof DOMException) || error.name !== 'NotAllowedError') return;
    video.muted = true;
    forcedMute.add(video);
    video.play().catch(() => {});
  });
}

export default function Film({
  media,
  className,
  ambient = false,
  lazy = false,
  startAt = 0,
  controls = false,
  decorative = false,
  showPoster = true,
  dissolve = false,
}: FilmProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const src = startAt > 0 ? `${media.src}#t=${startAt}` : media.src;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = !isSoundOn();

    const reveal = () => video.setAttribute('data-live', '');
    video.addEventListener('loadeddata', reveal);
    video.addEventListener('playing', reveal);
    if (video.readyState >= 2) reveal();

    const load = () => {
      if (video.getAttribute('src') === src) return;
      video.preload = ambient ? 'auto' : 'metadata';
      video.src = src;
    };

    // Pauses this component makes itself are flagged just before they happen, so a 'pause' without the flag is the
    // viewer's own, made with the controls. Such a film stays paused until the viewer plays it again.
    let pausingItself = false;
    let heldByViewer = false;
    const onPause = () => {
      heldByViewer = !pausingItself;
      pausingItself = false;
    };
    const onPlay = () => {
      heldByViewer = false;
    };
    video.addEventListener('pause', onPause);
    video.addEventListener('play', onPlay);

    const hold = () => {
      if (video.paused) return;
      pausingItself = true;
      video.pause();
    };

    /** Share of the film on screen, as of the latest observation. */
    let visible = 0;
    const resume = () => {
      if (!ambient || visible < PLAY_AT || !video.paused || heldByViewer || !isMotionOn()) return;
      load();
      play(video);
    };

    // The Motion switch in the bar holds every ambient film where it is and lets the visible ones run again.
    const stopFollowingMotion = subscribeToMotion(() => {
      if (!ambient) return;
      if (isMotionOn()) resume();
      else hold();
    });

    const cleanUpListeners = () => {
      video.removeEventListener('loadeddata', reveal);
      video.removeEventListener('playing', reveal);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('play', onPlay);
      stopFollowingMotion();
    };

    if (!('IntersectionObserver' in window)) {
      load();
      return cleanUpListeners;
    }

    const approach = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        load();
        approach.disconnect();
      },
      { rootMargin: '600px 0px' },
    );
    if (lazy) approach.observe(video);

    const screen = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        visible = entry.isIntersecting ? entry.intersectionRatio : 0;
        if (!entry.isIntersecting) hold();
        else resume();
      },
      { threshold: [0, PLAY_AT] },
    );
    screen.observe(video);

    return () => {
      approach.disconnect();
      screen.disconnect();
      cleanUpListeners();
    };
  }, [src, lazy, ambient]);

  const classes = [className, dissolve ? 'film-dissolve' : null].filter(Boolean).join(' ') || undefined;

  return (
    <video
      ref={ref}
      className={classes}
      src={lazy ? undefined : src}
      poster={showPoster ? media.poster || undefined : undefined}
      width={media.width}
      height={media.height}
      preload={lazy ? 'none' : ambient ? 'auto' : 'metadata'}
      muted
      loop={ambient}
      playsInline
      controls={controls}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : media.alt || undefined}
    />
  );
}
