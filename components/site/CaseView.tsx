import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { STORY_PROMPTS } from '@/lib/cms/story-prompts';
import { PROJECT_TYPES, type Block, type Media } from '@/lib/cms/types';
import type { CaseProject } from './case-project';
import FiveLine from './FiveLine';
import { imageSources } from './media';
import { Prose } from './RichText';

/*
 * The inside of a case file: what the mockup's dialog shows, filled from the CMS. Used by the case dialog on the
 * public pages and, open in the page, by the admin's draft preview. No state of its own: the dialog drives it.
 */

function Fill({ children }: { children: ReactNode }) {
  return <span className="fill">{children}</span>;
}

/** The first video in the story leads the case file in place of the cover. */
function leadFilm(project: CaseProject): Extract<Block, { type: 'video' }> | null {
  return project.blocks.find((b): b is Extract<Block, { type: 'video' }> => b.type === 'video' && Boolean(b.media.src)) ?? null;
}

function Still({ media, sizes }: { media: Media; sizes?: string }) {
  const { src, srcSet } = imageSources(media);
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      width={media.width}
      height={media.height}
      alt={media.alt}
      loading="lazy"
    />
  );
}

function StoryBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'text':
      return (
        <section>
          {block.heading && <h3>{block.heading}</h3>}
          <Prose text={block.body} />
        </section>
      );
    case 'image':
      return (
        <figure className={block.size === 'inset' ? 'inset' : undefined}>
          <div className="sec-frame">
            <Still media={block.media} sizes="(min-width: 1080px) 1020px, 100vw" />
          </div>
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    case 'gallery':
      return (
        <figure className="sec-gallery" style={{ '--cols': block.columns } as CSSProperties}>
          <ul>
            {block.items.map((item, i) => (
              <li key={`${item.src}-${i}`}>
                <div className="sec-frame">
                  <Still media={item} sizes="(min-width: 720px) 50vw, 100vw" />
                </div>
              </li>
            ))}
          </ul>
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    case 'video':
      return (
        <figure>
          <div className="sec-frame">
            <video
              src={block.media.src}
              poster={block.media.poster || undefined}
              controls
              muted
              playsInline
              loop={block.loop}
              preload="metadata"
              aria-label={block.media.alt || undefined}
            />
          </div>
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    case 'quote':
      return (
        <figure className="sec-quote">
          <blockquote>
            <Prose text={block.text} />
          </blockquote>
          {block.cite && <figcaption>{block.cite}</figcaption>}
        </figure>
      );
  }
}

export interface CaseViewProps {
  project: CaseProject;
  fiveLine: string;
  /** Titles of the neighbours; both null hides Previous and Next. */
  prevTitle: string | null;
  nextTitle: string | null;
  announcement?: string;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** Back to all work: closes the case file instead when it is already open over All projects. */
  onAllWork?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** The admin preview has no dialog to close: its button is a link back to the editor instead. */
  closeHref?: string;
}

export default function CaseView({
  project: p,
  fiveLine,
  prevTitle,
  nextTitle,
  announcement = '',
  onClose,
  onPrev,
  onNext,
  onAllWork,
  closeHref,
}: CaseViewProps) {
  const film = leadFilm(p);
  const cover = p.cover;
  const capture = p.category === 'spatial' && !film && !p.stillOnly;
  const type = PROJECT_TYPES.find((t) => t.id === p.projectType)?.label;
  const spec: [string, ReactNode][] = [
    ['Year', p.year],
    ['Discipline', p.discipline || <Fill>What kind of work it is</Fill>],
    ...(p.shown ? ([['In the images', p.shown]] as [string, ReactNode][]) : []),
    ['Role', p.role || <Fill>Solo, or your part in a team</Fill>],
    ['Type', type || <Fill>Client, UAL brief or self-initiated</Fill>],
    [p.category === 'spatial' ? 'Built with' : 'Tools', p.tools || <Fill>What it was made with</Fill>],
    ...(p.deliverables ? ([['Deliverables', p.deliverables]] as [string, ReactNode][]) : []),
  ];
  // The cover already leads the case file, so an image block of the same file isn't shown twice.
  const story = p.blocks.filter(
    (b) => b !== film && !(b.type === 'image' && (!b.media.src || b.media.src === cover?.src)),
  );
  const hasText = story.some((b) => b.type === 'text');
  const multi = prevTitle !== null && nextTitle !== null;

  return (
    <>
      <div className="case-bar">
        <span id="case-kicker">{[p.discipline, p.year].filter(Boolean).join(', ')}</span>
        {closeHref ? (
          <a className="x-btn" id="case-close" href={closeHref}>
            Back to the editor
          </a>
        ) : (
          <button className="x-btn" type="button" id="case-close" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      <div className="case-in">
        <div id="case-media">
          <div className="case-media">
            {film ? (
              <video
                src={film.media.src}
                poster={film.media.poster || cover?.src}
                muted
                loop
                playsInline
                controls
                aria-label={film.media.alt || cover?.alt || p.title}
              />
            ) : cover ? (
              <img src={cover.src} width={cover.width} height={cover.height} alt={cover.alt} />
            ) : null}
          </div>
          {capture && (
            <div className="capture" style={{ marginTop: 16 }}>
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 13l12 7-12 7z" fill="currentColor" />
              </svg>
              <span className="fill">A 10-second capture from the headset or the visionOS simulator</span>
            </div>
          )}
        </div>
        <div>
          <h2 className="case-title" id="case-title">
            {p.title}
          </h2>
          <p className="case-line" id="case-line">
            {p.summary}
          </p>
        </div>
        <dl className="spec" id="case-spec">
          {spec.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          {p.link && (
            <div>
              <dt>Link</dt>
              <dd>
                <a className="ext" href={p.link} target="_blank" rel="noopener">
                  {new URL(p.link).host.replace(/^www\./, '')}
                  <svg className="icon" aria-hidden="true">
                    <use href="#ext" />
                  </svg>
                  <span className="vh"> (opens in a new tab)</span>
                </a>
              </dd>
            </div>
          )}
        </dl>
        <div className="secs" id="case-secs">
          {!hasText &&
            STORY_PROMPTS[p.category].map(({ heading, hint }) => (
              <section key={heading}>
                <h3>{heading}</h3>
                <p className="fill">{hint}</p>
              </section>
            ))}
          {story.map((block) => (
            <StoryBlock key={block.id} block={block} />
          ))}
        </div>
        <FiveLine text={fiveLine} />
        <p>
          <a className="ext" id="case-all" href="/work" onClick={onAllWork}>
            Back to all work
          </a>
        </p>
        <div className="case-foot">
          <button type="button" id="case-prev" hidden={!multi} onClick={onPrev}>
            <small>Previous project</small>
            <strong id="case-prev-t">{prevTitle}</strong>
          </button>
          <button type="button" id="case-next" hidden={!multi} onClick={onNext}>
            <small>Next project</small>
            <strong id="case-next-t">{nextTitle}</strong>
          </button>
        </div>
        <p className="vh" id="case-live" aria-live="polite">
          {announcement}
        </p>
      </div>
    </>
  );
}
