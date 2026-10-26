'use client';

import { useEffect, useRef } from 'react';
import { isMotionOn } from './motion-pref';

const CONTROLS = [
  { keys: ['W', 'A', 'S', 'D'], action: 'Move' },
  { keys: ['F'], action: 'Interact' },
  { keys: ['Space'], action: 'Jump' },
  { keys: ['Mouse'], action: 'Look and shoot' },
];

/** Played once, the first time the whole row is in view: the same keys the desk film lights up. */
const DEMO = ['w', 'a', 's', 'd', 'f', 'space', 'mouse'];
const DEMO_STEP_MS = 140;
const TAP_MS = 150;

function capName(event: KeyboardEvent): string {
  return event.key === ' ' ? 'space' : event.key.toLowerCase();
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

/** The Lair's controls as keycaps that press down when the visitor presses the real key (or clicks) nearby. */
export default function LairKeys() {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const caps = new Map<string, HTMLElement>();
    list.querySelectorAll<HTMLElement>('kbd[data-key]').forEach((cap) => caps.set(cap.dataset.key ?? '', cap));
    const timers: number[] = [];
    const tap = (name: string) => {
      const cap = caps.get(name);
      if (!cap) return;
      cap.classList.add('down');
      timers.push(window.setTimeout(() => cap.classList.remove('down'), TAP_MS));
    };
    const releaseAll = () => caps.forEach((cap) => cap.classList.remove('down'));

    let onScreen = false;
    let demoed = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (entry.intersectionRatio < 0.99 || demoed || !isMotionOn()) return;
        demoed = true;
        DEMO.forEach((name, i) => timers.push(window.setTimeout(() => tap(name), 300 + i * DEMO_STEP_MS)));
      },
      { threshold: [0, 1] },
    );
    observer.observe(list);

    // Nothing is prevented: Space still scrolls the page.
    const keyDown = (event: KeyboardEvent) => {
      if (!onScreen || event.repeat || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      caps.get(capName(event))?.classList.add('down');
    };
    const keyUp = (event: KeyboardEvent) => caps.get(capName(event))?.classList.remove('down');
    const pointerDown = (event: PointerEvent) => {
      if (onScreen && event.pointerType === 'mouse') tap('mouse');
    };

    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('pointerdown', pointerDown);
    window.addEventListener('blur', releaseAll);
    return () => {
      observer.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('blur', releaseAll);
    };
  }, []);

  return (
    <ul className="keys" ref={listRef} aria-label="Controls">
      {CONTROLS.map(({ keys, action }) => (
        <li key={action}>
          {keys.map((key) => (
            <kbd key={key} data-key={key.toLowerCase()}>
              {key}
            </kbd>
          ))}
          <span>{action}</span>
        </li>
      ))}
    </ul>
  );
}
