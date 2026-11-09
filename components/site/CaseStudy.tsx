import Link from 'next/link';
import type { CSSProperties } from 'react';
import { PROJECT_TYPES, type Media, type Project } from '@/lib/cms/types';
import CaseBlock from './CaseBlocks';
import Film from './Film';
import Picture from './Picture';

const DEFAULT_ACCENT = '#6FF3FF';

/** Only a hex colour may light the page; anything else falls back to the suit's cyan. */
function accentOf(project: Project): string {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(project.accent) ? project.accent : DEFAULT_ACCENT;
}

/** Names the destination honestly: the platform for films, otherwise the site's own address. */
function externalLabel(href: string): string {
  try {
    const host = new URL(href).hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'youtu.be') return 'Watch on YouTube';
    if (host === 'vimeo.com') return 'Watch on Vimeo';
    if (host === 'behance.net') return 'See it on Behance';
    return `Visit ${host}`;
  } catch {
    return 'Visit the project';
  }
}

function specRows(project: Project): [string, string][] {
  const rows: [string, string][] = [
    ['Year', project.year ? String(project.year) : ''],
    ['Discipline', project.discipline],
    ['Role', project.role],
    ['Type', PROJECT_TYPES.find((t) => t.id === project.projectType)?.label ?? ''],
    ['Tools', project.tools],
    ['Deliverables', project.deliverables],
  ];
  return rows.filter(([, value]) => value.trim() !== '');
}

function Cover({ media }: { media: Media }) {
  return (
    <div className="cs-cover">
      <div className="cs-cover-clip">
        {media.kind === 'video' ? (
          <Film media={media} ambient controls />
        ) : (
          <Picture media={media} sizes="(max-width: 1360px) 92vw, 1248px" priority />
        )}
      </div>
    </div>
  );
}

function PreviewBar({ project }: { project: Project }) {
  return (
    <p className="cs-preview">
      <strong>Draft preview</strong>
      <span>
        {project.status === 'published'
          ? 'This project is published, so this is what visitors see.'
          : 'Not published yet, so only you can see this.'}
      </span>
    </p>
  );
}

function NextProject({ next }: { next: Project }) {
  return (
    <Link className="cs-next" href={`/work/${next.slug}`} style={{ '--accent': accentOf(next) } as CSSProperties}>
      <span className="cs-next-text">
        <span className="cs-next-label">Next project</span>
        <span className="cs-next-title">{next.title}</span>
        {next.discipline && <span className="cs-next-meta">{next.discipline}</span>}
      </span>
      {next.cover && (
        <span className="halo">
          <span className="plate">
            <Picture media={next.cover} sizes="(max-width: 719px) 92vw, 40vw" alt="" />
          </span>
        </span>
      )}
    </Link>
  );
}

/**
 * A full case study, without the site header or footer. Renders on the public /work/[slug] page and, with
 * `preview`, in the admin so drafts can be checked before publishing.
 */
export default function CaseStudy({ project, next, preview = false }: { project: Project; next: Project | null; preview?: boolean }) {
  const specs = specRows(project);

  return (
    <article className="cs" aria-labelledby="cs-title" style={{ '--accent': accentOf(project) } as CSSProperties}>
      {preview && <PreviewBar project={project} />}
      <div className="cs-grid">
        <header className="cs-head">
          {project.cover && <Cover media={project.cover} />}
          <div className="cs-intro">
            <h1 className="cs-title" id="cs-title">
              {project.title}
            </h1>
            {project.summary && <p className="cs-summary">{project.summary}</p>}
            {project.link && (
              <a className="btn btn-ghost cs-link" href={project.link} target="_blank" rel="noopener">
                {externalLabel(project.link)}
                <span className="vh"> (opens in a new tab)</span>
              </a>
            )}
          </div>
          {specs.length > 0 && (
            <dl className="spec">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </header>

        {project.blocks.length > 0 && (
          <div className="cs-body">
            {project.blocks.map((block) => (
              <CaseBlock key={block.id} block={block} />
            ))}
          </div>
        )}

        <footer className="cs-foot">
          {next && <NextProject next={next} />}
          <Link className="btn btn-ghost" href="/work">
            Back to all work
          </Link>
        </footer>
      </div>
    </article>
  );
}
