import type { ReactNode } from 'react';
import { LAIR_URL } from './config';
import { InlineText } from './RichText';

/**
 * A link to the Lair, which always opens in a new tab. On buttons the mockup's hidden note has no leading space. `data-lair` lets
 * LairBoarding answer a press at once, because the ship takes a few seconds to come up on a phone.
 */
export function LairLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <a className={className} href={LAIR_URL} target="_blank" rel="noopener" data-lair="">
      {children}
      <svg className="icon" aria-hidden="true">
        <use href="#ext" />
      </svg>
      <span className="vh">{className?.includes('btn') ? '(opens in a new tab)' : ' (opens in a new tab)'}</span>
    </a>
  );
}

/** The first [square-bracketed] words that aren't a [markdown](link). */
const LINK_WORDS = /\[([^\]\n]+)\](?!\()/;

/**
 * "If you have 5 minutes, [walk through my spaceship]. It will be worth it." The bracketed words link to the Lair;
 * **bold** works around them. Renders nothing for empty text.
 */
export default function FiveLine({ text, className = 'five' }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  const match = LINK_WORDS.exec(text);
  if (!match) {
    return (
      <p className={className || undefined}>
        <InlineText text={text.trim()} />
      </p>
    );
  }
  const start = match.index;
  return (
    <p className={className || undefined}>
      <InlineText text={text.slice(0, start).trimStart()} />
      <LairLink>{match[1]}</LairLink>
      <InlineText text={text.slice(start + match[0].length).trimEnd()} />
    </p>
  );
}
