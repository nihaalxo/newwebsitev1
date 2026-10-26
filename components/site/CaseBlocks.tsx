import type { CSSProperties } from 'react';
import type { Block, Media } from '@/lib/cms/types';
import Film from './Film';
import Picture from './Picture';
import { Prose, splitParagraphs } from './RichText';

type BlockOf<T extends Block['type']> = Extract<Block, { type: T }>;

const WIDE_SIZES = '(max-width: 1360px) 92vw, 1248px';
const TEXT_SIZES = '(max-width: 800px) 92vw, 720px';

function Caption({ text }: { text?: string }) {
  return text ? <figcaption>{text}</figcaption> : null;
}

/** One piece of media inside a block: a still, or a film the viewer controls (looping ones start on their own). */
function BlockMedia({ media, sizes, loop }: { media: Media; sizes: string; loop: boolean }) {
  if (media.kind === 'image') return <Picture media={media} sizes={sizes} />;
  return <Film media={media} lazy ambient={loop} controls />;
}

function TextBlock({ block }: { block: BlockOf<'text'> }) {
  const heading = block.heading?.trim();
  if (!heading && splitParagraphs(block.body).length === 0) return null;
  return (
    <section className="cs-text">
      {heading && <h2>{heading}</h2>}
      <Prose text={block.body} />
    </section>
  );
}

function ImageBlock({ block }: { block: BlockOf<'image'> }) {
  const sizes = block.size === 'full' ? '100vw' : block.size === 'wide' ? WIDE_SIZES : TEXT_SIZES;
  return (
    <figure className={`cs-figure size-${block.size}`}>
      <div className="cs-frame">
        <BlockMedia media={block.media} sizes={sizes} loop />
      </div>
      <Caption text={block.caption} />
    </figure>
  );
}

function GalleryBlock({ block }: { block: BlockOf<'gallery'> }) {
  if (block.items.length === 0) return null;
  const sizes = `(max-width: 719px) 92vw, ${Math.round(92 / block.columns)}vw`;
  return (
    <figure className="cs-gallery" style={{ '--cols': block.columns } as CSSProperties}>
      <ul>
        {block.items.map((media, i) => (
          <li key={`${media.src}-${i}`} className="cs-frame">
            <BlockMedia media={media} sizes={sizes} loop />
          </li>
        ))}
      </ul>
      <Caption text={block.caption} />
    </figure>
  );
}

function VideoBlock({ block }: { block: BlockOf<'video'> }) {
  return (
    <figure className="cs-figure size-wide">
      <div className="cs-frame">
        <BlockMedia media={block.media} sizes={WIDE_SIZES} loop={block.loop} />
      </div>
      <Caption text={block.caption} />
    </figure>
  );
}

function QuoteBlock({ block }: { block: BlockOf<'quote'> }) {
  if (!block.text.trim()) return null;
  return (
    <figure className="cs-quote">
      <blockquote>
        <Prose text={block.text} />
      </blockquote>
      {block.cite && <figcaption>{block.cite}</figcaption>}
    </figure>
  );
}

export default function CaseBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'text':
      return <TextBlock block={block} />;
    case 'image':
      return <ImageBlock block={block} />;
    case 'gallery':
      return <GalleryBlock block={block} />;
    case 'video':
      return <VideoBlock block={block} />;
    case 'quote':
      return <QuoteBlock block={block} />;
  }
}
