import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { isExternal } from './config';

// The CMS stores prose as plain text. Blank lines split paragraphs, a single line break stays a line break,
// and two inline marks are understood: **bold** and [label](https://url). Everything renders as React elements.

const INLINE_MARK = /\*\*(.+?)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/** Only web, mail and on-site links survive; anything else (javascript:, data:) renders as plain text. */
function safeHref(raw: string): string | null {
  if (isExternal(raw) || /^mailto:/i.test(raw)) return raw;
  if ((raw.startsWith('/') && !raw.startsWith('//')) || raw.startsWith('#')) return raw;
  return null;
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  if (isExternal(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <span className="vh"> (opens in a new tab)</span>
      </a>
    );
  }
  if (href.startsWith('/')) return <Link href={href}>{children}</Link>;
  return <a href={href}>{children}</a>;
}

function withLineBreaks(text: string, key: string): ReactNode[] {
  return text.split('\n').map((line, i) => (
    <Fragment key={`${key}-${i}`}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}

function renderInline(text: string, key = 'r'): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let n = 0;

  for (const match of text.matchAll(INLINE_MARK)) {
    const [whole, bold, label, href] = match;
    const start = match.index ?? 0;
    const k = `${key}-${n++}`;
    if (start > cursor) nodes.push(...withLineBreaks(text.slice(cursor, start), `${k}t`));

    if (bold !== undefined) {
      nodes.push(<strong key={k}>{renderInline(bold, k)}</strong>);
    } else {
      const safe = safeHref(href);
      nodes.push(safe ? <TextLink key={k} href={safe}>{label}</TextLink> : <Fragment key={k}>{label}</Fragment>);
    }
    cursor = start + whole.length;
  }

  if (cursor < text.length) nodes.push(...withLineBreaks(text.slice(cursor), `${key}-end`));
  return nodes;
}

export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** One run of text with inline marks, for a heading-sized line such as the hero lead. */
export function Inline({ text }: { text: string }) {
  return <>{renderInline(text.trim())}</>;
}

/** Like Inline, but keeps the spaces at either end, for a run that sits next to other inline content. */
export function InlineText({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}

/** Paragraphs of prose. Renders nothing for empty text. */
export function Prose({ text, className }: { text: string; className?: string }) {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return null;
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className={className}>
          {renderInline(p, `p${i}`)}
        </p>
      ))}
    </>
  );
}
