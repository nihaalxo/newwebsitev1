import { preload } from 'react-dom';
import type { Settings } from '@/lib/cms/types';
import { OWNER_NAME } from './config';
import Film from './Film';
import { imageSources } from './media';
import NeonName from './NeonName';
import { Inline } from './RichText';

/** The opening shot: the hero film full bleed, the name set over it as a title card, the arrow pointing to the work. */
export default function Hero({ settings, showCue }: { settings: Settings; showCue: boolean }) {
  const film = settings.heroFilm;
  const still = film?.kind === 'video' ? film.poster : film?.src;
  // The poster is the first thing anyone sees, so fetch it ahead of the stylesheet-discovered assets.
  if (still) preload(still, { as: 'image', fetchPriority: 'high' });

  return (
    <section className="hero" id="hero" aria-labelledby="hero-name">
      {film?.kind === 'video' && (
        <Film
          media={film}
          className="hero-film"
          ambient
          startAt={settings.heroFilmStart}
          loopStart={settings.heroFilmLoopStart}
          loopEnd={settings.heroFilmLoopEnd}
          decorative
        />
      )}
      {film?.kind === 'image' && (
        <img className="hero-film" {...imageSources(film)} sizes="100vw" alt="" fetchPriority="high" decoding="async" />
      )}
      <div className="hero-shade" aria-hidden="true" />
      <div className="wrap hero-inner">
        <div className="hero-foot">
          <h1 className="name" id="hero-name">
            <NeonName text={OWNER_NAME} />
          </h1>
          {settings.heroLead && (
            <p className="lead">
              <Inline text={settings.heroLead} />
            </p>
          )}
          {showCue && (
            <a className="scroll-cue" href="#work" aria-label="Scroll down to the work">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 3v17M5.5 13.5 12 20l6.5-6.5" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
