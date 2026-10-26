import type { CSSProperties } from 'react';

/** Strike delays in seconds, a fixed scramble so the tubes catch out of order rather than left to right. */
const STRIKE_DELAYS = [0.1, 0.32, 0.04, 0.44, 0.18, 0.26, 0.38, 0.08, 0.5, 0.22, 0.14, 0.3];

/**
 * A name lit letter by letter like neon tubes catching. Screen readers get the plain name once; each word stays
 * whole so phones break between words, never inside one.
 */
export default function NeonName({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  const firstLetterOf = words.map((_, w) => words.slice(0, w).reduce((sum, word) => sum + word.length, 0));

  return (
    <>
      <span className="vh">{text}</span>
      <span aria-hidden="true">
        {words.map((word, w) => (
          <span key={w}>
            {w > 0 && ' '}
            <span className="w">
              {Array.from(word).map((letter, i) => (
                <span
                  key={i}
                  className="l"
                  style={{ '--d': `${STRIKE_DELAYS[(firstLetterOf[w] + i) % STRIKE_DELAYS.length]}s` } as CSSProperties}
                >
                  {letter}
                </span>
              ))}
            </span>
          </span>
        ))}
      </span>
    </>
  );
}
