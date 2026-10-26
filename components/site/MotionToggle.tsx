'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { isMotionOn, motionOnOnServer, setMotionOn, subscribeToMotion } from './motion-pref';

/**
 * On unless the visitor asked their system for reduced motion. Off holds every looping film and stops the tape and
 * the other decorative animations; on lets them run again. The state is mirrored onto the site root as data-motion,
 * which is what site.css gates those animations on.
 */
export default function MotionToggle() {
  const on = useSyncExternalStore(subscribeToMotion, isMotionOn, motionOnOnServer);
  const ref = useRef<HTMLButtonElement>(null);

  // Reads the store rather than `on`: while hydrating, `on` is still the server's guess, and the root must never be
  // marked on for a visitor who asked for reduced motion, not even for a frame.
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>('.site');
    if (root) root.dataset.motion = isMotionOn() ? 'on' : 'off';
  }, [on]);

  return (
    <button ref={ref} className="bar-toggle motion" type="button" aria-pressed={on} onClick={() => setMotionOn(!on)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
        <circle cx="16.5" cy="12" r="4.5" fill="currentColor" stroke="none" />
        <path className="trail" d="M7.5 8.5h3M3 12h7.5M7.5 15.5h3" strokeLinecap="round" />
        <path className="hold" d="M5 8v8M9 8v8" />
      </svg>
      <span className="bar-toggle-label">Motion</span>
    </button>
  );
}
