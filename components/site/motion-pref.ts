// One switch for everything that moves by itself: the looping films, the crawling tape, the hero film leaning back.
// It starts from the visitor's system setting (off when they asked for reduced motion) and follows that setting if it
// changes mid-visit. Otherwise the viewer's own choice holds across client-side navigation, because the header that
// owns the toggle lives in the shared layout.

import { prefersReducedMotion } from './motion';

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

/** Settled on the first read in the browser, so it starts from the system setting at that moment. */
let motionOn: boolean | null = null;
let followingSystem = false;
const listeners = new Set<() => void>();

export function isMotionOn(): boolean {
  if (motionOn === null) {
    if (typeof window === 'undefined') return true;
    motionOn = !prefersReducedMotion();
  }
  return motionOn;
}

export function setMotionOn(next: boolean): void {
  if (motionOn === next) return;
  motionOn = next;
  listeners.forEach((listener) => listener());
}

/** A change to the system setting wins over an earlier press of the toggle, the same way the first read does. */
function followSystem(): void {
  if (followingSystem || typeof window === 'undefined') return;
  followingSystem = true;
  window.matchMedia(REDUCE_QUERY).addEventListener('change', (event) => setMotionOn(!event.matches));
}

export function subscribeToMotion(listener: () => void): () => void {
  followSystem();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Server snapshot for useSyncExternalStore: on, until the browser can read the system setting. */
export function motionOnOnServer(): boolean {
  return true;
}
