'use client';

import { useEffect } from 'react';

/**
 * The glimmer on plates and the About photo: a lap of light around the whole outline. A lap always finishes once
 * started: leaving early doesn't cut it short, and coming back doesn't restart it.
 */
export default function SeamLap() {
  useEffect(() => {
    const startLap = (link: Element) => link.querySelector('.seam-run')?.classList.add('lit');
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
      const link = event.target.closest('.card-link, .identity');
      if (link && !(event.relatedTarget instanceof Node && link.contains(event.relatedTarget))) startLap(link);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.matches('.card-link:focus-visible')) startLap(event.target);
    };
    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.animationName === 'seam-lap' && event.target instanceof Element) event.target.classList.remove('lit');
    };
    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('animationend', onAnimationEnd);
    return () => {
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('animationend', onAnimationEnd);
    };
  }, []);
  return null;
}
