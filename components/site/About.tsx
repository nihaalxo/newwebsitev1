import { Fragment, type ReactNode } from 'react';
import type { Labels, Settings } from '@/lib/cms/types';
import LazyFilm from './LazyFilm';
import { Prose } from './RichText';

/** The "classified" doors over the photo, opened by hovering or focusing it. Pure decoration. */
function Dossier({ labels }: { labels: Labels }) {
  const face = (
    <span className="face">
      <span className="file-no">{labels.dossierFile}</span>
      <span className="stamp">{labels.dossierStamp}</span>
      <span className="hint">{labels.dossierHint}</span>
    </span>
  );
  return (
    <span className="dossier" aria-hidden="true">
      <span className="door door-l">{face}</span>
      <span className="door door-r">{face}</span>
      <span className="strap strap-a"></span>
      <span className="strap strap-b"></span>
      <span className="seal"></span>
    </span>
  );
}

export default function About({ settings }: { settings: Settings }) {
  const { portrait, education, tools, basedIn, availability, labels } = settings;
  const facts: [string, ReactNode][] = [];
  if (education.length > 0) {
    facts.push([
      labels.factStudied,
      education.map((entry, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {entry}
        </Fragment>
      )),
    ]);
  }
  if (tools) facts.push([labels.factTools, tools]);
  if (basedIn) facts.push([labels.factBasedIn, basedIn]);
  if (availability) facts.push([labels.factAvailable, availability]);

  return (
    <section className="about" id="about" aria-labelledby="about-title">
      <div className="wrap about-grid">
        <h2 className="title-s" id="about-title">
          {settings.aboutTitle}
        </h2>
        <div className="about-main">
          <Prose text={settings.aboutStatement} className="statement" />
          {facts.length > 0 && (
            <dl className="facts">
              {facts.map(([term, value], i) => (
                <div key={i}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {portrait && (
          <figure className="identity">
            <span className="halo">
              <span className="plate identity-frame" tabIndex={0}>
                <img src={portrait.src} width={portrait.width} height={portrait.height} loading="lazy" alt={portrait.alt} />
                <Dossier labels={labels} />
                <span className="seam-run" aria-hidden="true"></span>
              </span>
            </span>
            {settings.aboutPhotoCaption && <figcaption>{settings.aboutPhotoCaption}</figcaption>}
          </figure>
        )}
      </div>
      {settings.aboutFilm && <LazyFilm film={settings.aboutFilm} className="about-film lazy-film" />}
    </section>
  );
}
