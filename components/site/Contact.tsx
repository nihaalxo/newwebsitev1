import type { Settings } from '@/lib/cms/types';
import { mailto } from './config';
import ContactFilm from './ContactFilm';
import ContactForm from './ContactForm';
import CopyButton from './CopyButton';

export default function Contact({ settings }: { settings: Settings }) {
  const { email, linkedin, contactFilm, labels } = settings;
  return (
    <section className="contact" id="contact" aria-labelledby="contact-title">
      <div className="film">
        {settings.contactFallback && (
          <div className="film-fallback" aria-hidden="true">
            {settings.contactFallback}
          </div>
        )}
        {contactFilm && <ContactFilm film={contactFilm} start={settings.contactFilmStart} />}
      </div>
      <h2 className="vh" id="contact-title">
        {settings.contactTitle || 'Contact'}
      </h2>
      <div className="wrap contact-grid">
        <div>
          {settings.contactLead && <p className="contact-lead">{settings.contactLead}</p>}
          {email && (
            <a className="email" id="email" href={mailto(email)}>
              {email}
            </a>
          )}
          <div className="actions">
            {email && (
              <CopyButton
                className="btn btn-ghost"
                text={email}
                label={labels.copyEmail}
                copied={labels.copied}
                selected={labels.copySelected}
                selectId="email"
              />
            )}
            {linkedin && (
              <a className="btn btn-ghost" href={linkedin} target="_blank" rel="noopener">
                {labels.linkedin}
                <svg className="icon" aria-hidden="true">
                  <use href="#ext" />
                </svg>
                <span className="vh">(opens in a new tab)</span>
              </a>
            )}
          </div>
        </div>
        <ContactForm email={email} labels={labels} />
      </div>
    </section>
  );
}
