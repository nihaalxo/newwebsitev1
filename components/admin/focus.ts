'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';

const INVALID_CONTROL = ['input', 'textarea', 'select', 'button'].map((tag) => `${tag}[data-invalid="true"]`).join(', ');

/** Focuses the first control marked invalid, scrolled to mid-screen so the sticky bars don't cover it. */
export function focusFirstInvalid(root: ParentNode = document) {
  const target = root.querySelector<HTMLElement>(INVALID_CONTROL);
  if (!target) return;
  target.focus({ preventScroll: true });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
}

/** Returns a function that focuses the first invalid control once the errors it just set have rendered. */
export function useFocusFirstInvalid(): () => void {
  const [requests, setRequests] = useState(0);
  useEffect(() => {
    if (requests > 0) focusFirstInvalid();
  }, [requests]);
  return useCallback(() => setRequests((n) => n + 1), []);
}

/**
 * Keeps a field that gets keyboard focus out from under the sticky save bar (WCAG 2.4.11). Publishes the bar's
 * height as --adm-bar-h, which admin.css reserves as scroll-padding-bottom. Measured, because the bar wraps and
 * grows on narrow screens and while the delete question shows.
 */
export function useStickyBarHeight(bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = bar.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty('--adm-bar-h', `${element.offsetHeight}px`));
    observer.observe(element, { box: 'border-box' });
    return () => {
      observer.disconnect();
      root.style.removeProperty('--adm-bar-h');
    };
  }, [bar]);
}
