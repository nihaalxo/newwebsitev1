import { preload } from 'react-dom';
import type { Settings } from '@/lib/cms/types';
import { OWNER_NAME } from './config';
import Film from './Film';
import { imageSources } from './media';
import NeonName from './NeonName';
import { Inline } from './RichText';

/** The opening shot: the hero film full bleed, the name set over it as a title card. */
export default function Hero({ settings }: { settings: Settings }) {
  const film = settings.heroFilm;
  const still = film?.kind === 'video' ? film.poster : film?.src;
  // The poster is the first thing anyone sees, so fetch it ahead of the stylesheet-discovered assets.
  if (still) preload(still, { as: 'image', fetchPriority: 'high' });

  return (
    <section className="hero" id="hero" aria-labelledby="hero-name">
      {film?.kind === 'video' && (
        <Film media={film} className="hero-film" ambient startAt={settings.heroFilmStart} decorative />
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
          {settings.heroCredit && (
            <p className="credit">
              <Inline text={settings.heroCredit} />
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
