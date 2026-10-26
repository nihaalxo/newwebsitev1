import type { Media, Settings } from '@/lib/cms/types';
import { mailto } from './config';
import ContactForm from './ContactForm';
import CopyButton from './CopyButton';
import Film from './Film';
import Picture from './Picture';

// The contact film carries its own title cards. Its first line is set here too, as the card shown before the
// film's first frame arrives, so the film dissolves into its own title instead of covering this one.
const SETUP = 'Everybody needs some help at times.';
const PUNCHLINE = 'Who better to ask than a superhero?';

function ContactFilm({ media }: { media: Media }) {
  if (media.kind === 'image') return <Picture media={media} sizes="100vw" />;
  return (
    <>
      {media.poster ? (
        <img className="film-still" src={media.poster} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className="film-card" aria-hidden="true">
          {SETUP}
        </div>
      )}
      <Film media={media} ambient lazy dissolve decorative showPoster={false} />
    </>
  );
}

function ExternalButton({ href, children }: { href: string; children: string }) {
  return (
    <a className="btn btn-ghost" href={href} target="_blank" rel="noopener">
      {children}
      <span className="vh"> (opens in a new tab)</span>
    </a>
  );
}

export default function Contact({ settings }: { settings: Settings }) {
  const { email, linkedin, instagram, contactFilm } = settings;

  return (
    <section className="contact" id="contact" aria-labelledby="contact-title">
      {contactFilm && (
        <div className="film">
          <ContactFilm media={contactFilm} />
        </div>
      )}
      <div className="wrap contact-grid">
        <div>
          <h2 className="contact-title" id="contact-title">
            {contactFilm ? <span className="vh">{SETUP} </span> : <span className="setup">{SETUP} </span>}
            {PUNCHLINE}
          </h2>
          <p className="contact-lead">Tell me what you&apos;re working on: a brand, an interface or a whole world.</p>
          {email && (
            <a className="email" id="contact-email" href={mailto(email)}>
              {email}
            </a>
          )}
          {(email || linkedin || instagram) && (
            <div className="actions">
              {email && <CopyButton className="btn btn-ghost" text={email} label="Copy email" fallbackSelectId="contact-email" />}
              {linkedin && <ExternalButton href={linkedin}>LinkedIn</ExternalButton>}
              {instagram && <ExternalButton href={instagram}>Instagram</ExternalButton>}
            </div>
          )}
        </div>
        <ContactForm email={email} />
      </div>
    </section>
  );
}
