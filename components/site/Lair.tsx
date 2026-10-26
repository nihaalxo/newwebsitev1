import Link from 'next/link';
import type { Media, Settings } from '@/lib/cms/types';
import CopyButton from './CopyButton';
import Film from './Film';
import LairKeys from './LairKeys';
import Picture from './Picture';
import { Prose } from './RichText';

const TAPE_TEXT = 'Keyboard and mouse required';

/** What is known for sure: the owner's own line if there is one, otherwise where the world runs. */
function specLine(settings: Settings): string {
  if (settings.lairBuiltWith) return settings.lairBuiltWith;
  try {
    return `Runs in the browser at ${new URL(settings.lairUrl).host}.`;
  } catch {
    return '';
  }
}

/** Caution tape that crawls along its own length; two identical halves make the loop seamless. */
function HazardTape() {
  return (
    <div className="tape" aria-hidden="true">
      <span className="tape-run">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i}>
            {TAPE_TEXT}
            <b />
          </span>
        ))}
      </span>
    </div>
  );
}

function LairFilm({ media }: { media: Media }) {
  if (media.kind === 'image') {
    return <Picture media={media} sizes="(max-width: 959px) 100vw, 58vw" />;
  }
  // The poster sits underneath and the film dissolves in over it once its first frame is ready.
  return (
    <>
      {media.poster && <img src={media.poster} alt="" width={media.width} height={media.height} loading="lazy" decoding="async" />}
      <Film media={media} ambient lazy dissolve showPoster={false} />
    </>
  );
}

export default function Lair({ settings, buildStoryHref }: { settings: Settings; buildStoryHref: string | null }) {
  const spec = specLine(settings);
  const film = settings.lairFilm;

  return (
    <section className="lair" id="lair" aria-labelledby="lair-title">
      <div className="wrap lair-grid">
        <div className="lair-copy">
          <h2 className="title-l" id="lair-title">
            The Lair
          </h2>
          <Prose text={settings.lairBlurb} />
          <LairKeys />
          {spec && <p className="lair-spec">{spec}</p>}
          {(settings.lairUrl || buildStoryHref) && (
            <div className="actions">
              {settings.lairUrl && (
                <span className="lit">
                  <a className="btn btn-seam" href={settings.lairUrl} target="_blank" rel="noopener">
                    Enter the Lair<span className="vh"> (opens in a new tab)</span>
                  </a>
                </span>
              )}
              {buildStoryHref && (
                <Link className="btn btn-ghost" href={buildStoryHref}>
                  Read how I built it
                </Link>
              )}
            </div>
          )}
          {settings.lairUrl && (
            <p className="on-touch">
              On a phone? <CopyButton className="linkish" text={settings.lairUrl} label="Copy the link" /> and open it on a
              laptop later.
            </p>
          )}
        </div>
        {film && (
          <div className="lair-frame">
            <HazardTape />
            <div className="frame-halo">
              <div className="frame-clip">
                <LairFilm media={film} />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
