import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { PROJECT_TYPES, type Block, type Labels, type Media, type StoryPrompts } from '@/lib/cms/types';
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
  labels: Labels;
  storyPrompts: StoryPrompts;
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

/** "example.com" from "https://www.example.com/x". A draft's link may not be an address yet (the admin's preview). */
function linkHost(link: string): string {
  try {
    return new URL(link).host.replace(/^www\./, '');
  } catch {
    return link;
  }
}

export default function CaseView({
  project: p,
  fiveLine,
  labels,
  storyPrompts,
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
    [labels.specYear, p.year],
    [labels.specDiscipline, p.discipline || <Fill>{labels.fillDiscipline}</Fill>],
    ...(p.shown ? ([[labels.specShown, p.shown]] as [string, ReactNode][]) : []),
    [labels.specRole, p.role || <Fill>{labels.fillRole}</Fill>],
    [labels.specType, type || <Fill>{labels.fillType}</Fill>],
    [p.category === 'spatial' ? labels.specBuiltWith : labels.specTools, p.tools || <Fill>{labels.fillTools}</Fill>],
    ...(p.deliverables ? ([[labels.specDeliverables, p.deliverables]] as [string, ReactNode][]) : []),
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
            {labels.caseClose}
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
              <img src={cover.src} alt={cover.alt} />
            ) : null}
          </div>
          {capture && (
            <div className="capture" style={{ marginTop: 16 }}>
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 13l12 7-12 7z" fill="currentColor" />
              </svg>
              <span className="fill">{labels.fillCapture}</span>
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
          {spec.map(([term, value], i) => (
            <div key={i}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          {p.link && (
            <div>
              <dt>{labels.specLink}</dt>
              <dd>
                <a className="ext" href={p.link} target="_blank" rel="noopener">
                  {linkHost(p.link)}
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
            storyPrompts[p.category].map(({ heading, hint }, i) => (
              <section key={i}>
                <h3>{heading}</h3>
                {hint && <p className="fill">{hint}</p>}
              </section>
            ))}
          {story.map((block) => (
            <StoryBlock key={block.id} block={block} />
          ))}
        </div>
        <FiveLine text={fiveLine} />
        <p>
          <a className="ext" id="case-all" href="/work" onClick={onAllWork}>
            {labels.caseAllWork}
          </a>
        </p>
        <div className="case-foot">
          <button type="button" id="case-prev" hidden={!multi} onClick={onPrev}>
            <small>{labels.casePrev}</small>
            <strong id="case-prev-t">{prevTitle}</strong>
          </button>
          <button type="button" id="case-next" hidden={!multi} onClick={onNext}>
            <small>{labels.caseNext}</small>
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
