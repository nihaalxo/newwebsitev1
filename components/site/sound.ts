// One switch for every film's soundtrack. Sound starts off on each visit and survives client-side navigation,
// because the header that owns the toggle lives in the shared layout.

let soundOn = false;
const listeners = new Set<() => void>();

export function isSoundOn(): boolean {
  return soundOn;
}

export function setSoundOn(next: boolean): void {
  soundOn = next;
  document.querySelectorAll('video').forEach((video) => {
    video.muted = !next;
    // A film that is playing carries on with its soundtrack (the browser allows it: this runs from a click).
    if (next && !video.paused) video.play().catch(() => undefined);
  });
  listeners.forEach((listener) => listener());
}

export function subscribeToSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Server snapshot for useSyncExternalStore: always off. */
export function soundOffOnServer(): boolean {
  return false;
}
