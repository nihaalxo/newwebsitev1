import { Fragment } from 'react';
import type { Settings } from '@/lib/cms/types';
import { LairLink } from './FiveLine';
import LazyFilm from './LazyFilm';
import { Prose } from './RichText';

/** "W A S D: Move" -> keys ["W", "A", "S", "D"], action "Move". */
function parseControls(text: string): { keys: string[]; action: string }[] {
  return text
    .split('\n')
    .map((line) => {
      const colon = line.indexOf(':');
      if (colon === -1) return null;
      const keys = line.slice(0, colon).trim().split(/\s+/).filter(Boolean);
      const action = line.slice(colon + 1).trim();
      return keys.length > 0 && action ? { keys, action } : null;
    })
    .filter((control): control is { keys: string[]; action: string } => control !== null);
}

/**
 * The band for the walk-through 3D portfolio. `storySlug` is the published case file that tells how it was built;
 * without one, How I built it is left out.
 */
export default function Lair({ settings, storySlug }: { settings: Settings; storySlug: string | null }) {
  const controls = parseControls(settings.lairControls);
  return (
    <section className="lair" id="lair" aria-labelledby="lair-title">
      <div className="wrap lair-in">
        <div className="lair-copy">
          <h2 className="title-l" id="lair-title">
            {settings.lairTitle}
          </h2>
          <Prose text={settings.lairBlurb} />
          {controls.length > 0 && (
            <ul className="keys" aria-label="Controls">
              {controls.map(({ keys, action }) => (
                <li key={`${keys.join('-')}-${action}`}>
                  {keys.map((key, i) => (
                    <Fragment key={i}>
                      <kbd>{key}</kbd>
                    </Fragment>
                  ))}
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          )}
          <Prose text={settings.lairNudge} />
          <div className="actions">
            <LairLink className="btn btn-seam">{settings.labels.enterLair}</LairLink>
            {storySlug && (
              <button className="btn btn-ghost" type="button" data-open={storySlug}>
                {settings.labels.howBuilt}
              </button>
            )}
          </div>
          {settings.lairTouch && <p className="on-touch">{settings.lairTouch}</p>}
        </div>
      </div>
      {settings.lairFilm && <LazyFilm film={settings.lairFilm} className="lair-film lazy-film" label={settings.lairFilm.alt} />}
    </section>
  );
}
