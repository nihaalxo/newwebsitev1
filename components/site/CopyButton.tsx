'use client';

import { useEffect, useRef, useState } from 'react';
import { say } from './say';

interface CopyButtonProps {
  text: string;
  label: string;
  /** Shown once copied. */
  copied: string;
  /** Shown when the clipboard is refused and the element with id `selectId` has been selected instead. */
  selected: string;
  selectId?: string;
  className?: string;
}

/**
 * Copies `text`. If the clipboard is refused, selects the element with id `selectId` so it can be copied by hand,
 * or says what to copy. The label changes for two seconds to say what happened.
 */
export default function CopyButton({ text, label, copied, selected, selectId, className }: CopyButtonProps) {
  const [shown, setShown] = useState(label);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function show(message: string) {
    setShown(message);
    say(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(label), 2000);
  }

  function fallback() {
    const target = selectId ? document.getElementById(selectId) : null;
    if (target) {
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      show(selected);
    } else show(`Couldn't copy: ${text}`);
  }

  function copy() {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => show(copied), fallback);
    else fallback();
  }

  return (
    <button className={className} type="button" data-copy={text} data-select={selectId} onClick={copy}>
      {shown}
    </button>
  );
}
