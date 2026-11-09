'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { saveSettings } from '@/app/admin/actions';
import type { Media } from '@/lib/cms/types';
import { PDF_ACCEPT, uploadErrorMessage, uploadFile } from '@/lib/upload-client';
import { callServer } from './call-server';
import { TextAreaField, TextField } from './fields';
import { useFocusFirstInvalid, useStickyBarHeight } from './focus';
import MediaField, { UploadProgress } from './MediaField';
import {
  LIMITS,
  PROSE_HELP,
  errorCount,
  errorSummary,
  fieldId,
  instagramUrl,
  validateSettings,
  type FieldErrors,
  type SettingsInput,
} from './rules';
import { UploadTrackerProvider, useUploadCount, useUploadTracker } from './upload-tracker';
import { useUnsavedWarning } from './useUnsavedWarning';

type FilmTime = 'heroFilmStart' | 'heroFilmLoopStart' | 'heroFilmLoopEnd';

/** Settings as the form edits them: education as one entry per line, the film's times as typed. */
type SettingsDraft = Omit<SettingsInput, 'education' | FilmTime> & { education: string } & Record<FilmTime, string>;

function toDraft(settings: SettingsInput): SettingsDraft {
  return {
    ...settings,
    education: settings.education.join('\n'),
    heroFilmStart: String(settings.heroFilmStart),
    heroFilmLoopStart: String(settings.heroFilmLoopStart),
    heroFilmLoopEnd: String(settings.heroFilmLoopEnd),
  };
}

/** A time as typed: a decimal comma is fine, and an empty box means 0. */
function seconds(typed: string): number {
  const value = typed.trim().replace(',', '.');
  return value === '' ? 0 : Number(value);
}

function fromDraft(draft: SettingsDraft): SettingsInput {
  return {
    ...draft,
    // A bare @handle becomes the profile link here, so it's checked and sent as the URL the server would store.
    instagram: instagramUrl(draft.instagram),
    education: draft.education
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean),
    heroFilmStart: seconds(draft.heroFilmStart),
    heroFilmLoopStart: seconds(draft.heroFilmLoopStart),
    heroFilmLoopEnd: seconds(draft.heroFilmLoopEnd),
  };
}

type Notice = { tone: 'saved' | 'error'; text: string; fromFields?: boolean };

const SECTIONS = [
  { id: 'hero', label: 'Hero' },
  { id: 'lair', label: 'The Lair' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
];

export default function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(toDraft(initial)));
  const [savedFilm, setSavedFilm] = useState(initial.heroFilm?.src);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [uploads, track] = useUploadCount();
  const focusFirstInvalid = useFocusFirstInvalid();
  const bar = useRef<HTMLDivElement>(null);
  useStickyBarHeight(bar);

  const dirty = useMemo(() => JSON.stringify(draft) !== savedJson, [draft, savedJson]);
  useUnsavedWarning(dirty || uploads > 0);

  // Errors clear as they're fixed; new ones only appear when saving.
  useEffect(() => {
    setErrors((current) => {
      if (errorCount(current) === 0) return current;
      const now = validateSettings(fromDraft(draft));
      const still = Object.keys(current).filter((key) => key in now);
      if (still.length === errorCount(current) && still.every((key) => now[key] === current[key])) return current;
      return Object.fromEntries(still.map((key) => [key, now[key]]));
    });
  }, [draft]);

  useEffect(() => {
    if (errorCount(errors) === 0) setNotice((n) => (n?.fromFields ? null : n));
  }, [errors]);

  function set<K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice((n) => (n?.tone === 'saved' ? null : n));
  }

  function setMedia(key: 'avatar' | 'portrait' | 'lairFilm' | 'contactFilm') {
    return (media: Media | null) => set(key, media);
  }

  /** Loop times belong to one film, so a different file, or none, starts them over. A new poster or description keeps them. */
  function changeHeroFilm(media: Media | null) {
    setDraft((current) =>
      media?.src === current.heroFilm?.src
        ? { ...current, heroFilm: media }
        : { ...current, heroFilm: media, heroFilmLoopStart: '0', heroFilmLoopEnd: '0' },
    );
    setNotice((n) => (n?.tone === 'saved' ? null : n));
  }

  async function save() {
    if (busy) return;
    if (uploads > 0) {
      setNotice({ tone: 'error', text: 'A file is still uploading. Save again when it finishes.' });
      return;
    }
    const before = draft;
    const input = fromDraft(draft);
    const found = validateSettings(input);
    if (errorCount(found) > 0) {
      setErrors(found);
      setNotice({ tone: 'error', text: errorSummary(found, 'saving'), fromFields: true });
      focusFirstInvalid();
      return;
    }

    setErrors({});
    setNotice(null);
    setBusy(true);
    const result = await callServer(() => saveSettings(input), (error) => ({ ok: false as const, error, fieldErrors: {} }));
    setBusy(false);

    if (!result.ok) {
      setErrors(result.fieldErrors);
      setNotice({ tone: 'error', text: result.error, fromFields: errorCount(result.fieldErrors) > 0 });
      if (errorCount(result.fieldErrors) > 0) focusFirstInvalid();
      return;
    }

    const { updatedAt: _updatedAt, ...stored } = result.settings;
    const storedDraft = toDraft(stored);
    setDraft((current) => (current === before ? storedDraft : current));
    setSavedJson(JSON.stringify(storedDraft));
    setSavedFilm(stored.heroFilm?.src);
    setNotice({ tone: 'saved', text: 'Saved. The site now shows these changes.' });
  }

  const loopWasReset = draft.heroFilm?.src !== savedFilm && seconds(draft.heroFilmLoopEnd) === 0;
  const unsaved = loopWasReset ? 'Unsaved changes. The hero film changed, so its loop times went back to 0.' : 'Unsaved changes';
  const status = busy
    ? { tone: 'busy', text: 'Saving…' }
    : uploads > 0
      ? { tone: 'busy', text: 'Uploading. Save when it finishes.' }
      : (notice ?? (dirty ? { tone: 'dirty', text: unsaved } : { tone: 'saved', text: 'No unsaved changes' }));

  return (
    <UploadTrackerProvider value={track}>
      <div className="adm-editor-page">
        <div className="adm-page-head">
          <div>
            <h1 className="adm-h1">Site settings</h1>
            <p className="adm-lede">
              Everything on the home page that isn&apos;t a project. Empty fields are hidden on the site rather than shown
              blank.
            </p>
          </div>
        </div>

        <div className="adm-editor">
          <nav className="adm-toc" aria-label="Sections of this form">
            <ol>
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="adm-form">
            <section className="adm-section" id="hero" aria-labelledby="hero-title">
              <h2 className="adm-h2" id="hero-title">
                Hero
              </h2>
              <TextAreaField
                id={fieldId('heroLead')}
                label="Line under your name"
                help="Shown under your name, over the hero film. Keep it short enough to fit one line on a phone."
                rows={2}
                maxLength={LIMITS.line}
                value={draft.heroLead}
                onChange={(heroLead) => set('heroLead', heroLead)}
              />
              <MediaField
                id={fieldId('heroFilm')}
                label="Hero film"
                help="Plays full-bleed behind your name. A small file, under about 10 MB, keeps the page quick to open."
                kind="video"
                value={draft.heroFilm}
                onChange={changeHeroFilm}
                folderHint="site/hero-film"
                previewStart={fromDraft(draft).heroFilmStart || 0}
              />
              <TextField
                id={fieldId('heroFilmStart')}
                label="Start the film at (seconds)"
                help="Skips the dark power-on so the page opens on the lit suit, like 9. Then use that frame as the poster above, so the first thing people see matches."
                inputMode="decimal"
                maxLength={6}
                value={draft.heroFilmStart}
                onChange={(value) => set('heroFilmStart', value)}
                error={errors.heroFilmStart}
              />
              <TextField
                id={fieldId('heroFilmLoopStart')}
                label="Loop from (seconds)"
                help="The film loops between this time and the next, so any black at its start or end never leaves the first screen empty."
                inputMode="decimal"
                maxLength={6}
                value={draft.heroFilmLoopStart}
                onChange={(value) => set('heroFilmLoopStart', value)}
                error={errors.heroFilmLoopStart}
              />
              <TextField
                id={fieldId('heroFilmLoopEnd')}
                label="Loop to (seconds)"
                help="0 plays the whole film. Replacing or removing the film puts both loop times back to 0, because they belong to the old film."
                inputMode="decimal"
                maxLength={6}
                value={draft.heroFilmLoopEnd}
                onChange={(value) => set('heroFilmLoopEnd', value)}
                error={errors.heroFilmLoopEnd}
              />
            </section>

            <section className="adm-section" id="lair" aria-labelledby="lair-title">
              <h2 className="adm-h2" id="lair-title">
                The Lair
              </h2>
              <p className="adm-section-intro">The band for your 3D portfolio world. It&apos;s hidden when all of these are empty.</p>
              <TextField
                id={fieldId('lairUrl')}
                label="Link to the Lair"
                help="Where the Enter the Lair button goes. Starts with https://"
                type="url"
                spellCheck={false}
                maxLength={LIMITS.url}
                value={draft.lairUrl}
                onChange={(lairUrl) => set('lairUrl', lairUrl.trim())}
                error={errors.lairUrl}
              />
              <TextAreaField
                id={fieldId('lairBlurb')}
                label="Description"
                help={PROSE_HELP}
                rows={4}
                maxLength={LIMITS.paragraph}
                value={draft.lairBlurb}
                onChange={(lairBlurb) => set('lairBlurb', lairBlurb)}
              />
              <TextField
                id={fieldId('lairBuiltWith')}
                label="Built with"
                help="Like “Built in Three.js, runs in the browser, 18 MB”."
                maxLength={LIMITS.line}
                value={draft.lairBuiltWith}
                onChange={(lairBuiltWith) => set('lairBuiltWith', lairBuiltWith)}
              />
              <MediaField
                id={fieldId('lairFilm')}
                label="Walkthrough film"
                help="Plays beside the description when it scrolls into view."
                kind="video"
                value={draft.lairFilm}
                onChange={setMedia('lairFilm')}
                folderHint="site/lair-film"
              />
            </section>

            <section className="adm-section" id="about" aria-labelledby="about-title">
              <h2 className="adm-h2" id="about-title">
                About
              </h2>
              <TextAreaField
                id={fieldId('aboutStatement')}
                label="About statement"
                help={`A few sentences about you. To link a project, write [My Chaii London](/work/my-chaii-london). ${PROSE_HELP}`}
                rows={6}
                maxLength={LIMITS.paragraph}
                value={draft.aboutStatement}
                onChange={(aboutStatement) => set('aboutStatement', aboutStatement)}
              />
              <div className="adm-grid-2">
                <TextField
                  id={fieldId('basedIn')}
                  label="Based in"
                  help="Your city, like London."
                  maxLength={LIMITS.line}
                  value={draft.basedIn}
                  onChange={(basedIn) => set('basedIn', basedIn)}
                />
                <TextField
                  id={fieldId('availability')}
                  label="Available for"
                  help="Like “Full-time roles and freelance, from January”."
                  maxLength={LIMITS.line}
                  value={draft.availability}
                  onChange={(availability) => set('availability', availability)}
                />
              </div>
              <CvField value={draft.cvUrl} onChange={(cvUrl) => set('cvUrl', cvUrl)} error={errors.cvUrl} />
              <div className="adm-grid-2">
                <MediaField
                  id={fieldId('avatar')}
                  label="3D avatar still"
                  kind="image"
                  value={draft.avatar}
                  onChange={setMedia('avatar')}
                  folderHint="site/avatar"
                  altError={errors['avatar.alt']}
                />
                <MediaField
                  id={fieldId('portrait')}
                  label="Portrait photo"
                  help="A real photo of you, shown beside the avatar."
                  kind="image"
                  value={draft.portrait}
                  onChange={setMedia('portrait')}
                  folderHint="site/portrait"
                  altError={errors['portrait.alt']}
                />
              </div>
              <TextField
                id={fieldId('tools')}
                label="Tools"
                help="Like “Blender, After Effects, Illustrator and Photoshop”."
                maxLength={LIMITS.tools}
                value={draft.tools}
                onChange={(tools) => set('tools', tools)}
              />
              <TextAreaField
                id={fieldId('education')}
                label="Education"
                help={`One qualification per line, like “BA (Hons) Graphic and Media Design, UAL”. Up to ${LIMITS.educationEntries} lines.`}
                rows={3}
                value={draft.education}
                onChange={(education) => set('education', education)}
                error={errors.education}
              />
            </section>

            <section className="adm-section" id="contact" aria-labelledby="contact-title">
              <h2 className="adm-h2" id="contact-title">
                Contact
              </h2>
              <TextField
                id={fieldId('email')}
                label="Email"
                help="Shown as a link people can click to write to you."
                type="email"
                autoComplete="email"
                spellCheck={false}
                maxLength={LIMITS.line}
                value={draft.email}
                onChange={(email) => set('email', email.trim())}
                error={errors.email}
              />
              <div className="adm-grid-2">
                <TextField
                  id={fieldId('linkedin')}
                  label="LinkedIn"
                  help="Your profile link, starting with https://"
                  type="url"
                  spellCheck={false}
                  maxLength={LIMITS.url}
                  value={draft.linkedin}
                  onChange={(linkedin) => set('linkedin', linkedin.trim())}
                  error={errors.linkedin}
                />
                <TextField
                  id={fieldId('instagram')}
                  label="Instagram"
                  help="Your profile link, or just your @handle."
                  spellCheck={false}
                  maxLength={LIMITS.url}
                  value={draft.instagram}
                  onChange={(instagram) => set('instagram', instagram.trim())}
                  error={errors.instagram}
                />
              </div>
              <MediaField
                id={fieldId('contactFilm')}
                label="Contact film"
                help="The short film above the contact form, with its own title cards."
                kind="video"
                value={draft.contactFilm}
                onChange={setMedia('contactFilm')}
                folderHint="site/contact-film"
              />
            </section>
          </div>
        </div>

        <div className="adm-bar" ref={bar} role="region" aria-label="Save settings">
          <p className="adm-bar-status" data-tone={status.tone} role="status">
            {status.text}
          </p>
          <div className="adm-bar-buttons">
            <button type="button" className="adm-btn adm-btn-primary" onClick={save} aria-disabled={busy || undefined}>
              Save settings
            </button>
          </div>
        </div>
      </div>
    </UploadTrackerProvider>
  );
}

/** A CV is either an uploaded PDF or a link to one somewhere else; both end up as a URL. */
function CvField({ value, onChange, error }: { value: string; onChange: (url: string) => void; error?: string }) {
  const id = fieldId('cvUrl');
  const track = useUploadTracker();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ label: string; progress: number | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  async function upload(file: File) {
    const label = `Uploading ${file.name}`;
    setProblem(null);
    setBusy({ label, progress: null });
    setAnnouncement(`${label}.`);
    try {
      onChange(await track(uploadFile(file, 'site/cv', (progress) => setBusy({ label, progress }))));
      setAnnouncement('CV uploaded.');
    } catch (failure) {
      const text = uploadErrorMessage(failure);
      setProblem(text);
      setAnnouncement(text);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="adm-field">
      <TextField
        id={id}
        label="CV"
        help="Upload a PDF, or paste a link to one. Leave empty to hide it."
        placeholder="https://"
        spellCheck={false}
        maxLength={LIMITS.url}
        value={value}
        onChange={(url) => onChange(url.trim())}
        error={problem ?? error}
      />
      <div className="adm-media-actions">
        <button
          type="button"
          className="adm-btn adm-btn-small"
          onClick={() => !busy && fileInput.current?.click()}
          aria-disabled={busy ? true : undefined}
        >
          {value ? 'Replace with a PDF' : 'Upload a PDF'}
        </button>
        {value && (
          <a className="adm-btn adm-btn-small adm-btn-quiet" href={value} target="_blank" rel="noopener">
            Open the current CV<span className="adm-vh"> (opens in a new tab)</span>
          </a>
        )}
      </div>
      {busy && <UploadProgress busy={busy} />}
      <input
        ref={fileInput}
        type="file"
        accept={PDF_ACCEPT}
        hidden
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void upload(file);
        }}
      />
      <p className="adm-vh" role="status">
        {announcement}
      </p>
    </div>
  );
}
