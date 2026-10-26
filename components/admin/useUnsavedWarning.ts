'use client';

import { useEffect } from 'react';

/**
 * Asks the browser to confirm before the tab closes or reloads while `active`.
 * Admin navigation uses plain links and Sign out is a native form post (full page loads both), so this also
 * covers moving between admin pages and signing out.
 */
export function useUnsavedWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers only show the prompt when returnValue is set.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}
