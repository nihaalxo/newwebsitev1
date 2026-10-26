'use client';

import { useEffect, useRef, useState } from 'react';

interface CopyButtonProps {
  text: string;
  label: string;
  className?: string;
  /** If the clipboard is unavailable, select this element's text so it can be copied by hand. */
  fallbackSelectId?: string;
}

/** Copies `text`, confirms on the button itself and announces the result to screen readers. */
export default function CopyButton({ text, label, className, fallbackSelectId }: CopyButtonProps) {
  const [message, setMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function show(next: string) {
    setMessage(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(''), 2400);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      show('Copied');
    } catch {
      const target = fallbackSelectId ? document.getElementById(fallbackSelectId) : null;
      const selection = window.getSelection();
      if (target && selection) {
        const range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);
        show('Selected, now copy it');
      } else {
        show(`Couldn't copy. It's ${text}`);
      }
    }
  }

  return (
    <>
      <button className={className} type="button" onClick={copy}>
        {message || label}
      </button>
      <span className="vh" role="status">
        {message}
      </span>
    </>
  );
}
