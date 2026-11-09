'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { saveSettings } from '@/app/admin/actions';
import type { CvSection, Media } from '@/lib/cms/types';
import { PDF_ACCEPT, uploadErrorMessage, uploadFile } from '@/lib/upload-client';
import { callServer } from './call-server';
import { ChoiceField, FieldError, TextAreaField, TextField } from './fields';
import { useFocusFirstInvalid, useStickyBarHeight } from './focus';
import { ChevronDown, ChevronUp } from './icons';
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

type FilmTime = 'heroFilmLoopStart' | 'heroFilmLoopEnd' | 'contactFilmStart';

/** Settings as the form edits them: education as one entry per line, the films' times as typed. */
type SettingsDraft = Omit<SettingsInput, 'education' | FilmTime> & { education: string } & Record<FilmTime, string>;

function toDraft(settings: SettingsInput): SettingsDraft {
  return {
    ...settings,
    education: settings.education.join('\n'),
    heroFilmLoopStart: String(settings.heroFilmLoopStart),
    heroFilmLoopEnd: String(settings.heroFilmLoopEnd),
    contactFilmStart: String(settings.contactFilmStart),
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
    heroFilmLoopStart: seconds(draft.heroFilmLoopStart),
    heroFilmLoopEnd: seconds(draft.heroFilmLoopEnd),
    contactFilmStart: seconds(draft.contactFilmStart),
  };
}

const FIVE_HELP =
  'The words in [square brackets] become the link to the Lair, which opens in a new tab. Put **two asterisks** around words for bold.';

type Notice = { tone: 'saved' | 'error'; text: string; fromFields?: boolean };

const SECTIONS = [
  { id: 'site', label: 'Whole site' },
  { id: 'hero', label: 'Hero' },
  { id: 'work', label: 'Work' },
  { id: 'lair', label: 'The Lair' },
  { id: 'about', label: 'About' },
  { id: 'cv', label: 'CV' },
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

  function setMedia(key: 'portrait' | 'lairFilm' | 'aboutFilm' | 'contactFilm') {
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
              Every word on the site that isn&apos;t a project, and the films behind it. Empty fields are hidden on the site
              rather than shown blank.
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
            <section className="adm-section" id="site" aria-labelledby="site-title">
              <h2 className="adm-h2" id="site-title">
                Whole site
              </h2>
              <TextAreaField
                id={fieldId('siteDescription')}
                label="Description for search engines"
                help="Shown under the site's name in search results and link previews. {count} becomes the number of published projects."
                rows={3}
                maxLength={LIMITS.description}
                value={draft.siteDescription}
                onChange={(siteDescription) => set('siteDescription', siteDescription)}
              />
              <TextField
                id={fieldId('fiveLine')}
                label="The invitation to the Lair"
                help={`Shown under your name, on All projects and at the end of every case file. ${FIVE_HELP}`}
                maxLength={LIMITS.line}
                value={draft.fiveLine}
                onChange={(fiveLine) => set('fiveLine', fiveLine)}
                error={errors.fiveLine}
              />
              <TextField
                id={fieldId('fiveFooter')}
                label="The invitation in the footer"
                help={FIVE_HELP}
                maxLength={LIMITS.line}
                value={draft.fiveFooter}
                onChange={(fiveFooter) => set('fiveFooter', fiveFooter)}
                error={errors.fiveFooter}
              />
            </section>

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
                help="Plays full-bleed behind your name. The first visit plays it from the start (the intro); later visits start at Loop from, over the poster. Keep it under about 20 MB."
                kind="video"
                value={draft.heroFilm}
                onChange={changeHeroFilm}
                folderHint="site/hero-film"
                previewStart={fromDraft(draft).heroFilmLoopStart || 0}
              />
              <div className="adm-grid-2">
                <TextField
                  id={fieldId('heroFilmLoopStart')}
                  label="Loop from (seconds)"
                  help="After the intro, the film repeats from here. Use a calm frame, ideally just before a lightning strike."
                  inputMode="decimal"
                  maxLength={6}
                  value={draft.heroFilmLoopStart}
                  onChange={(value) => set('heroFilmLoopStart', value)}
                  error={errors.heroFilmLoopStart}
                />
                <TextField
                  id={fieldId('heroFilmLoopEnd')}
                  label="Loop to (seconds)"
                  help="0 plays the whole film. Replacing or removing the film puts both times back to 0."
                  inputMode="decimal"
                  maxLength={6}
                  value={draft.heroFilmLoopEnd}
                  onChange={(value) => set('heroFilmLoopEnd', value)}
                  error={errors.heroFilmLoopEnd}
                />
              </div>
            </section>

            <section className="adm-section" id="work" aria-labelledby="work-section-title">
              <h2 className="adm-h2" id="work-section-title">
                Work
              </h2>
              <p className="adm-section-intro">The projects themselves, and which are highlighted, are set on the Projects page.</p>
              <div className="adm-grid-2">
                <TextField
                  id={fieldId('workTitle')}
                  label="Heading on the home page"
                  maxLength={60}
                  value={draft.workTitle}
                  onChange={(workTitle) => set('workTitle', workTitle)}
                />
                <TextField
                  id={fieldId('allProjectsTitle')}
                  label="Heading of the All projects page"
                  maxLength={60}
                  value={draft.allProjectsTitle}
                  onChange={(allProjectsTitle) => set('allProjectsTitle', allProjectsTitle)}
                />
              </div>
            </section>

            <section className="adm-section" id="lair" aria-labelledby="lair-section-title">
              <h2 className="adm-h2" id="lair-section-title">
                The Lair
              </h2>
              <p className="adm-section-intro">
                The band for your 3D portfolio. Its buttons and links go to the address in NEXT_PUBLIC_LAIR_URL, set where
                the site is built. How I built it opens the Immersive Portfolio Website case file.
              </p>
              <TextField
                id={fieldId('lairTitle')}
                label="Heading"
                maxLength={60}
                value={draft.lairTitle}
                onChange={(lairTitle) => set('lairTitle', lairTitle)}
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
              <TextAreaField
                id={fieldId('lairControls')}
                label="Controls"
                help={`One per line: the keys, a colon, then what they do, like “W A S D: Move”. Keys separated by spaces each get their own key cap. Up to ${LIMITS.controls} lines. Hidden on touch screens.`}
                rows={5}
                value={draft.lairControls}
                onChange={(lairControls) => set('lairControls', lairControls)}
                error={errors.lairControls}
              />
              <TextAreaField
                id={fieldId('lairNudge')}
                label="Line under the controls"
                help={PROSE_HELP}
                rows={2}
                maxLength={LIMITS.paragraph}
                value={draft.lairNudge}
                onChange={(lairNudge) => set('lairNudge', lairNudge)}
              />
              <TextField
                id={fieldId('lairTouch')}
                label="For touch screens"
                help="Shown instead of the controls on phones and tablets."
                maxLength={LIMITS.paragraph}
                value={draft.lairTouch}
                onChange={(lairTouch) => set('lairTouch', lairTouch)}
              />
              <MediaField
                id={fieldId('lairFilm')}
                label="Lair film"
                help="Fills the band behind the text and plays while it is on screen."
                kind="video"
                value={draft.lairFilm}
                onChange={setMedia('lairFilm')}
                folderHint="site/lair-film"
                altError={errors['lairFilm.alt']}
                tallCut
              />
            </section>

            <section className="adm-section" id="about" aria-labelledby="about-section-title">
              <h2 className="adm-h2" id="about-section-title">
                About
              </h2>
              <TextField
                id={fieldId('aboutTitle')}
                label="Heading"
                maxLength={60}
                value={draft.aboutTitle}
                onChange={(aboutTitle) => set('aboutTitle', aboutTitle)}
              />
              <TextAreaField
                id={fieldId('aboutStatement')}
                label="About statement"
                help={`A few sentences about you. To link a project, write [My Chaii London](/work/my-chaii-london). ${PROSE_HELP}`}
                rows={6}
                maxLength={LIMITS.paragraph}
                value={draft.aboutStatement}
                onChange={(aboutStatement) => set('aboutStatement', aboutStatement)}
              />
              <TextAreaField
                id={fieldId('education')}
                label="Studied"
                help={`One qualification per line, like “BA (Hons) Graphic and Media Design, UAL”. Up to ${LIMITS.educationEntries} lines.`}
                rows={3}
                value={draft.education}
                onChange={(education) => set('education', education)}
                error={errors.education}
              />
              <TextField
                id={fieldId('tools')}
                label="Tools"
                help="Like “Figma, Adobe Creative Suite and Blender”."
                maxLength={LIMITS.tools}
                value={draft.tools}
                onChange={(tools) => set('tools', tools)}
              />
              <div className="adm-grid-2">
                <TextField
                  id={fieldId('basedIn')}
                  label="Based in"
                  help="Your city, and whether you'd move."
                  maxLength={LIMITS.line}
                  value={draft.basedIn}
                  onChange={(basedIn) => set('basedIn', basedIn)}
                />
                <TextField
                  id={fieldId('availability')}
                  label="Available for"
                  help="Like “Full-time roles”."
                  maxLength={LIMITS.line}
                  value={draft.availability}
                  onChange={(availability) => set('availability', availability)}
                />
              </div>
              <div className="adm-grid-2">
                <MediaField
                  id={fieldId('portrait')}
                  label="Photo"
                  help="A real photo of you, behind the classified doors. Portrait, about 4 by 5."
                  kind="image"
                  value={draft.portrait}
                  onChange={setMedia('portrait')}
                  folderHint="site/portrait"
                  altError={errors['portrait.alt']}
                />
                <TextField
                  id={fieldId('aboutPhotoCaption')}
                  label="Caption under the photo"
                  maxLength={80}
                  value={draft.aboutPhotoCaption}
                  onChange={(aboutPhotoCaption) => set('aboutPhotoCaption', aboutPhotoCaption)}
                />
              </div>
              <MediaField
                id={fieldId('aboutFilm')}
                label="About film"
                help="Plays behind the section while it is on screen."
                kind="video"
                value={draft.aboutFilm}
                onChange={setMedia('aboutFilm')}
                folderHint="site/about-film"
              />
            </section>

            <section className="adm-section" id="cv" aria-labelledby="cv-section-title">
              <h2 className="adm-h2" id="cv-section-title">
                CV
              </h2>
              <p className="adm-section-intro">Positions and dates only. The PDF has the full details.</p>
              <TextField
                id={fieldId('cvTitle')}
                label="Heading"
                maxLength={60}
                value={draft.cvTitle}
                onChange={(cvTitle) => set('cvTitle', cvTitle)}
              />
              <div className="adm-grid-2">
                <TextField
                  id={fieldId('cvHeadline')}
                  label="Headline"
                  help="Separate the parts with | and each keeps to one line on wide screens."
                  maxLength={LIMITS.line}
                  value={draft.cvHeadline}
                  onChange={(cvHeadline) => set('cvHeadline', cvHeadline)}
                />
                <TextField
                  id={fieldId('cvPlace')}
                  label="Where you are"
                  help="Shown before your email and LinkedIn, like London."
                  maxLength={80}
                  value={draft.cvPlace}
                  onChange={(cvPlace) => set('cvPlace', cvPlace)}
                />
              </div>
              <CvField value={draft.cvUrl} onChange={(cvUrl) => set('cvUrl', cvUrl)} error={errors.cvUrl} />
              <CvEditor sections={draft.cvSections} onChange={(cvSections) => set('cvSections', cvSections)} errors={errors} />
            </section>

            <section className="adm-section" id="contact" aria-labelledby="contact-section-title">
              <h2 className="adm-h2" id="contact-section-title">
                Contact
              </h2>
              <TextField
                id={fieldId('contactTitle')}
                label="Heading read aloud"
                help="Screen readers announce this as the section's heading; on screen, the film says it."
                maxLength={LIMITS.line}
                value={draft.contactTitle}
                onChange={(contactTitle) => set('contactTitle', contactTitle)}
              />
              <TextField
                id={fieldId('contactFallback')}
                label="Line shown until the film plays"
                maxLength={LIMITS.line}
                value={draft.contactFallback}
                onChange={(contactFallback) => set('contactFallback', contactFallback)}
              />
              <TextAreaField
                id={fieldId('contactLead')}
                label="Line above your email"
                rows={2}
                maxLength={LIMITS.paragraph}
                value={draft.contactLead}
                onChange={(contactLead) => set('contactLead', contactLead)}
              />
              <TextField
                id={fieldId('email')}
                label="Email"
                help="Shown as a link people can click to write to you, and in the CV."
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
                  help="Your profile link, or just your @handle. Not shown on the site at the moment."
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
                previewStart={fromDraft(draft).contactFilmStart || 0}
              />
              <TextField
                id={fieldId('contactFilmStart')}
                label="Start the contact film at (seconds)"
                help="Skips any black at its start, like 0.8."
                inputMode="decimal"
                maxLength={6}
                value={draft.contactFilmStart}
                onChange={(value) => set('contactFilmStart', value)}
                error={errors.contactFilmStart}
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

/** Moves item `from` one place up (-1) or down (+1). */
function moved<T>(items: T[], from: number, by: -1 | 1): T[] {
  const to = from + by;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** The CV's sections, each a titled list of positions, in two columns on wide screens. */
function CvEditor({
  sections,
  onChange,
  errors,
}: {
  sections: CvSection[];
  onChange: (sections: CvSection[]) => void;
  errors: FieldErrors;
}) {
  const [announcement, setAnnouncement] = useState('');

  function patch(index: number, change: (section: CvSection) => CvSection) {
    onChange(sections.map((section, i) => (i === index ? change(section) : section)));
  }

  function addSection() {
    const ids = new Set(sections.map((s) => s.id));
    let n = sections.length + 1;
    while (ids.has(`section-${n}`)) n++;
    onChange([...sections, { id: `section-${n}`, title: '', column: 1, entries: [{ role: '', when: '', at: '' }] }]);
    setAnnouncement('Section added at the end.');
  }

  return (
    <div className="adm-story">
      <p className="adm-label">Sections</p>
      <ol className="adm-blocks">
        {sections.map((section, index) => {
          const key = `cvSections.${index}`;
          const name = section.title.trim() || `Section ${index + 1}`;
          return (
            <li key={section.id} className="adm-block">
              <div className="adm-block-head">
                <h3 className="adm-block-title">
                  {name}
                  <span className="adm-block-pos">
                    {index + 1} of {sections.length}
                  </span>
                </h3>
                <div className="adm-block-tools">
                  <button
                    type="button"
                    className="adm-icon-btn"
                    disabled={index === 0}
                    onClick={() => onChange(moved(sections, index, -1))}
                  >
                    <ChevronUp />
                    <span className="adm-vh">Move {name} up</span>
                  </button>
                  <button
                    type="button"
                    className="adm-icon-btn"
                    disabled={index === sections.length - 1}
                    onClick={() => onChange(moved(sections, index, 1))}
                  >
                    <ChevronDown />
                    <span className="adm-vh">Move {name} down</span>
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn-small adm-btn-quiet"
                    onClick={() => {
                      onChange(sections.filter((_, i) => i !== index));
                      setAnnouncement(`${name} removed.`);
                    }}
                  >
                    Remove<span className="adm-vh"> {name}</span>
                  </button>
                </div>
              </div>
              <div className="adm-block-body">
                <div className="adm-grid-2">
                  <TextField
                    id={fieldId(`${key}.title`)}
                    label="Section title"
                    maxLength={LIMITS.line}
                    value={section.title}
                    onChange={(title) => patch(index, (s) => ({ ...s, title }))}
                    error={errors[`${key}.title`]}
                  />
                  <ChoiceField
                    name={fieldId(`${key}.column`)}
                    legend="Column on wide screens"
                    value={section.column}
                    onChange={(column) => patch(index, (s) => ({ ...s, column }))}
                    options={[
                      { id: 1, label: 'Left' },
                      { id: 2, label: 'Right' },
                    ]}
                  />
                </div>
                {section.entries.map((entry, line) => {
                  const entryKey = `${key}.entries.${line}`;
                  const setEntry = (field: 'role' | 'when' | 'at') => (value: string) =>
                    patch(index, (s) => ({
                      ...s,
                      entries: s.entries.map((e, i) => (i === line ? { ...e, [field]: value } : e)),
                    }));
                  return (
                    <fieldset key={line} className="adm-cv-line">
                      <legend className="adm-label">
                        Line {line + 1}
                        <span className="adm-vh"> of {name}</span>
                      </legend>
                      <TextField
                        id={fieldId(`${entryKey}.role`)}
                        label="Position"
                        maxLength={LIMITS.line}
                        value={entry.role}
                        onChange={setEntry('role')}
                        error={errors[`${entryKey}.role`]}
                      />
                      <div className="adm-grid-2">
                        <TextField
                          id={fieldId(`${entryKey}.when`)}
                          label="When"
                          help="Like “Apr 2026 – Present”."
                          maxLength={80}
                          value={entry.when}
                          onChange={setEntry('when')}
                        />
                        <TextField
                          id={fieldId(`${entryKey}.at`)}
                          label="Where"
                          help="Like “Stack Design Studio, London”."
                          maxLength={LIMITS.line}
                          value={entry.at}
                          onChange={setEntry('at')}
                        />
                      </div>
                      <div className="adm-media-actions">
                        <button
                          type="button"
                          className="adm-btn adm-btn-small"
                          disabled={line === 0}
                          onClick={() => patch(index, (s) => ({ ...s, entries: moved(s.entries, line, -1) }))}
                        >
                          Move up<span className="adm-vh"> line {line + 1} of {name}</span>
                        </button>
                        <button
                          type="button"
                          className="adm-btn adm-btn-small adm-btn-quiet"
                          onClick={() => {
                            patch(index, (s) => ({ ...s, entries: s.entries.filter((_, i) => i !== line) }));
                            setAnnouncement(`Line ${line + 1} removed from ${name}.`);
                          }}
                        >
                          Remove<span className="adm-vh"> line {line + 1} of {name}</span>
                        </button>
                      </div>
                    </fieldset>
                  );
                })}
                <FieldError id={`${fieldId(`${key}.entries`)}-error`} message={errors[`${key}.entries`]} />
                <div>
                  <button
                    type="button"
                    className="adm-btn adm-btn-small"
                    onClick={() => {
                      patch(index, (s) => ({ ...s, entries: [...s.entries, { role: '', when: '', at: '' }] }));
                      setAnnouncement(`Line added to ${name}.`);
                    }}
                  >
                    Add a line<span className="adm-vh"> to {name}</span>
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <FieldError id={`${fieldId('cvSections')}-error`} message={errors.cvSections} />
      <div>
        <button type="button" className="adm-btn adm-btn-small" onClick={addSection}>
          Add a section
        </button>
      </div>
      <p className="adm-vh" role="status">
        {announcement}
      </p>
    </div>
  );
}
