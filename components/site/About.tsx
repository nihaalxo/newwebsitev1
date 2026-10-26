import type { ReactNode } from 'react';
import type { Media, Settings } from '@/lib/cms/types';
import Picture from './Picture';
import { Prose } from './RichText';

function Portrait({ media, caption }: { media: Media; caption: string }) {
  return (
    <figure className="pf">
      <div className="pf-frame">
        <Picture media={media} sizes="(max-width: 959px) 46vw, 210px" />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function About({ settings }: { settings: Settings }) {
  const { avatar, portrait } = settings;
  const education = settings.education.map((line) => line.trim()).filter(Boolean);
  const hasFacts = education.length > 0 || settings.tools || settings.basedIn || settings.availability || settings.cvUrl;

  return (
    <section className="about" id="about" aria-labelledby="about-title">
      <div className="wrap about-grid">
        <h2 className="title-l" id="about-title">
          About
        </h2>
        <div className="statement">
          <Prose text={settings.aboutStatement} />
        </div>
        <div className="about-side">
          {(avatar || portrait) && (
            <div className={portrait && avatar ? 'portraits' : 'portraits solo'}>
              {avatar && (
                <Portrait
                  media={avatar}
                  caption={portrait ? 'Me, rebuilt in 3D for my portfolio world' : "That's me, rebuilt in 3D for my portfolio world."}
                />
              )}
              {portrait && <Portrait media={portrait} caption="Me, in person" />}
            </div>
          )}
          {hasFacts && (
            <dl className="facts">
              {education.length > 0 && (
                <Fact label="Studied">
                  {education.map((line, i) => (
                    <span key={i} className="fact-line">
                      {line}
                    </span>
                  ))}
                </Fact>
              )}
              {settings.tools && <Fact label="Tools">{settings.tools}</Fact>}
              {settings.basedIn && <Fact label="Based in">{settings.basedIn}</Fact>}
              {settings.availability && <Fact label="Available for">{settings.availability}</Fact>}
              {settings.cvUrl && (
                <Fact label="CV">
                  <a href={settings.cvUrl} target="_blank" rel="noopener">
                    Read my CV<span className="vh"> (opens in a new tab)</span>
                  </a>
                </Fact>
              )}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
