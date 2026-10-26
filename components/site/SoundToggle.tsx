'use client';

import { useSyncExternalStore } from 'react';
import { isSoundOn, setSoundOn, soundOffOnServer, subscribeToSound } from './sound';

/** Off on every visit. One press lets every film play its own soundtrack; films pause when they leave the screen. */
export default function SoundToggle() {
  const on = useSyncExternalStore(subscribeToSound, isSoundOn, soundOffOnServer);

  return (
    <button className="bar-toggle sound" type="button" aria-pressed={on} onClick={() => setSoundOn(!on)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
        <path className="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
        <path className="mute" d="M16 9.5l5 5M21 9.5l-5 5" />
      </svg>
      <span className="bar-toggle-label">Sound</span>
    </button>
  );
}
