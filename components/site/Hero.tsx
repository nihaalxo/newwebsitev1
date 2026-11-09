import type { Settings } from '@/lib/cms/types';
import { OWNER_NAME } from './config';
import FiveLine from './FiveLine';
import HeroFilm from './HeroFilm';
import { Inline } from './RichText';

/** Exactly one screen: the film full-bleed, the name set like a title card, and the way down. */
export default function Hero({ settings }: { settings: Settings }) {
  const { heroFilm, heroLead, fiveLine } = settings;
  const [first, ...rest] = OWNER_NAME.split(' ');
  return (
    <section className="hero" aria-labelledby="name">
      {heroFilm && (
        <HeroFilm
          src={heroFilm.src}
          poster={heroFilm.poster}
          loopStart={settings.heroFilmLoopStart}
          loopEnd={settings.heroFilmLoopEnd}
        />
      )}
      <div className="hero-shade" aria-hidden="true"></div>
      <div className="wrap hero-inner">
        <div className="hero-foot">
          <div>
            <h1 className="name" id="name">
              {first}
              <br />
              {rest.join(' ')}
            </h1>
            {heroLead && (
              <p className="lead">
                <Inline text={heroLead} />
              </p>
            )}
            <FiveLine text={fiveLine} />
          </div>
          <a className="scroll-cue" href="#work" aria-label="Scroll down to the work">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v17M5.5 13.5 12 20l6.5-6.5" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
