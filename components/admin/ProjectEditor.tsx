'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/admin-api/client';
import { sanitizeProject } from '@/lib/admin-api/sanitize';
import { STORY_PROMPTS } from '@/lib/cms/story-prompts';
import { CATEGORIES, PROJECT_TYPES, type Block, type Draft, type Media, type Project, type ProjectInput, type ProjectType } from '@/lib/cms/types';
import AccentField from './AccentField';
import { useAdmin } from './AdminShell';
import BlockEditor from './BlockEditor';
import { sampleAccent } from './color';
import { SelectField, SwitchField, TextAreaField, TextField } from './fields';
import { useFocusFirstInvalid, useStickyBarHeight } from './focus';
import MediaField from './MediaField';
import { caseStudyPath, editPath, previewPath, type PreviewView } from './paths';
import {
  LIMITS,
  SLUG_TAKEN_MESSAGE,
  SUMMARY_TARGET,
  categoryLabel,
  errorCount,
  errorSummary,
  fieldId,
  slugify,
  validateProject,
  type FieldErrors,
} from './rules';
import StatusBadge, { statusOf } from './StatusBadge';
import { UploadTrackerProvider, useUploadCount } from './upload-tracker';
import { useUnsavedWarning } from './useUnsavedWarning';

/*
 * One project's editor. Every change is saved as a draft (autosave 3 s after the last change, or Save), which only
 * the admin sees. Publish sends the draft to the site as a commit; the site rebuilds in 2 to 4 minutes.
 */

export type EditableProject = ProjectInput & { id: string };

/** The draft as the server holds it, or null when there is none. */
export interface StoredDraft {
  etag: string;
  savedAt: string;
  state: Draft['state'];
  action: Draft['action'];
}

interface ProjectEditorProps {
  initial: EditableProject;
  stored: StoredDraft | null;
  /** The project as the live site shows it, or null when it isn't on the site. */
  live: Project | null;
  /** The site changed this project since the draft began. */
  stale: boolean;
  /** Web addresses other projects already use. */
  takenSlugs: string[];
  /** e.g. "nihaalnazeer.com", for showing the case study's address. */
  siteHost: string;
}

type Busy = 'save' | 'publish' | 'unpublish' | 'delete' | 'discard' | 'resolve' | null;
type Notice = { tone: 'saved' | 'info' | 'error'; text: string; fromFields?: boolean; reload?: boolean };
type Status = { tone: 'idle' | 'busy' | 'saved' | 'dirty' | 'error' | 'info'; text: string };
type Confirm = 'delete' | 'unpublish' | 'discard' | null;

const AUTOSAVE_MS = 3000;
const DEFAULT_ACCENT = '#6FF3FF';

const SECTIONS = [
  { id: 'basics', label: 'Basics' },
  { id: 'cover', label: 'Cover' },
  { id: 'details', label: 'Details' },
  { id: 'story', label: 'Story' },
  { id: 'home', label: 'Home page' },
];

const PROJECT_TYPE_OPTIONS: { id: ProjectType; label: string }[] = [{ id: '', label: 'Not set' }, ...PROJECT_TYPES];

/** The content as the server would store it, to tell a real change from the server's own tidying. */
const canonical = (project: unknown) => JSON.stringify(sanitizeProject(project)?.input ?? project);

/** "14:02" */
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function ProjectEditor({ initial, stored: initialStored, live: initialLive, stale: initialStale, takenSlugs, siteHost }: ProjectEditorProps) {
  const { state: adminState, refresh } = useAdmin();
  const [draft, setDraft] = useState<EditableProject>(initial);
  const [savedJson, setSavedJson] = useState(() => (initialStored || initialLive ? JSON.stringify(initial) : ''));
  const [stored, setStored] = useState<StoredDraft | null>(initialStored);
  const [live] = useState<Project | null>(initialLive);
  const [stale, setStale] = useState(initialStale);
  const [autoSlug, setAutoSlug] = useState(() => !initialLive && (initial.slug === '' || initial.slug === slugify(initial.title)));
  const [taken, setTaken] = useState(() => new Set(takenSlugs));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [checkedForPublishing, setCheckedForPublishing] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState<Confirm>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [uploads, track] = useUploadCount();
  const focusFirstInvalid = useFocusFirstInvalid();
  const bar = useRef<HTMLDivElement>(null);
  const saving = useRef<Promise<StoredDraft | null> | null>(null);
  useStickyBarHeight(bar);

  const dirty = useMemo(() => JSON.stringify(draft) !== savedJson, [draft, savedJson]);
  const onSite = Boolean(live);
  const folder = draft.id;
  useUnsavedWarning(dirty || uploads > 0);

  const findErrors = useCallback(
    (project: ProjectInput, publishing: boolean) => {
      const found = validateProject(project, publishing);
      if (!found.slug && taken.has(project.slug)) found.slug = SLUG_TAKEN_MESSAGE;
      return found;
    },
    [taken],
  );

  // Once errors are showing, each one disappears as soon as it's fixed. New ones only appear on the next check.
  useEffect(() => {
    setErrors((current) => {
      if (errorCount(current) === 0) return current;
      const now = findErrors(draft, checkedForPublishing);
      const still = Object.keys(current).filter((key) => key in now);
      if (still.length === errorCount(current) && still.every((key) => now[key] === current[key])) return current;
      return Object.fromEntries(still.map((key) => [key, now[key]]));
    });
  }, [draft, checkedForPublishing, findErrors]);

  useEffect(() => {
    if (errorCount(errors) === 0) setNotice((n) => (n?.fromFields ? null : n));
  }, [errors]);

  useEffect(() => {
    if (!pendingFocus) return;
    document.getElementById(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, confirming]);

  /** Any edit retires "Saved" and other passing notices; errors stay until they're fixed. */
  function edit(change: (project: EditableProject) => EditableProject) {
    setDraft(change);
    setNotice((n) => (n && n.tone !== 'error' ? null : n));
  }

  function set<K extends keyof EditableProject>(key: K, value: EditableProject[K]) {
    edit((project) => ({ ...project, [key]: value }));
  }

  function changeTitle(title: string) {
    edit((project) => ({ ...project, title, slug: autoSlug ? slugify(title) : project.slug }));
  }

  function changeSlug(value: string) {
    const slug = value.toLowerCase().replace(/\s+/g, '-');
    // Clearing the box hands the address back to the title.
    setAutoSlug(slug === '');
    set('slug', slug);
  }

  function tidySlug() {
    const slug = slugify(draft.slug);
    if (slug !== draft.slug) set('slug', slug);
    if (slug && taken.has(slug)) setErrors((current) => ({ ...current, slug: SLUG_TAKEN_MESSAGE }));
  }

  function changeYear(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    set('year', digits ? Number(digits) : Number.NaN);
  }

  function changeBlocks(change: (blocks: Block[]) => Block[]) {
    edit((project) => ({ ...project, blocks: change(project.blocks) }));
  }

  /** A new cover lights the case file with its own colour, unless an accent was already chosen. */
  function changeCover(cover: Media | null) {
    set('cover', cover);
    if (cover?.kind !== 'image' || !cover.src || draft.accent.toUpperCase() !== DEFAULT_ACCENT) return;
    sampleAccent(cover.srcSmall || cover.src)
      .then((hex) => edit((project) => (project.accent.toUpperCase() === DEFAULT_ACCENT ? { ...project, accent: hex } : project)))
      .catch(() => {});
  }

  // ---------------------------------------------------------------- saving

  /** Saves the draft as it is now. Resolves to what the server holds, or null when it refused. */
  async function save(action: Draft['action'] = stored?.action ?? 'publish', quiet = false): Promise<StoredDraft | null> {
    if (saving.current) await saving.current;
    const work = (async (): Promise<StoredDraft | null> => {
      const outgoing = draft;
      const found = findErrors(outgoing, false);
      if (errorCount(found) > 0) {
        if (!quiet) {
          setCheckedForPublishing(false);
          setErrors(found);
          setNotice({ tone: 'error', text: errorSummary(found, 'saving'), fromFields: true });
          focusFirstInvalid();
        }
        return null;
      }
      let etag = stored?.etag ?? null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await api.saveDraft(outgoing.id, outgoing, action, etag);
        if (result.ok) {
          const next: StoredDraft = { etag: result.etag, savedAt: result.savedAt, state: stored?.state === 'hidden' ? 'hidden' : 'editing', action };
          setStored(next);
          setSavedJson(JSON.stringify(outgoing));
          if (!initialStored && !initialLive) window.history.replaceState(null, '', editPath(outgoing.id));
          return next;
        }
        if (result.status === 409 && attempt === 0) {
          // The server may have changed the draft's state itself (after a publish); then its content is still ours.
          const remote = await api.draft(outgoing.id);
          if (remote.ok && canonical(remote.draft.project) === canonical(JSON.parse(savedJson || 'null'))) {
            etag = remote.etag;
            continue;
          }
          if (!remote.ok && remote.status === 404 && !stored) {
            etag = null;
            continue;
          }
          setNotice({ tone: 'error', text: 'Changed in another tab: reload', reload: true });
          return null;
        }
        if (result.errors?.[outgoing.id]) {
          setErrors(result.errors[outgoing.id]);
          focusFirstInvalid();
        }
        setNotice({ tone: 'error', text: result.error, fromFields: Boolean(result.errors) });
        return null;
      }
      return null;
    })();
    saving.current = work;
    try {
      return await work;
    } finally {
      saving.current = null;
    }
  }

  // Autosave, 3 s after the last change, unless a file is still uploading or something else is happening.
  useEffect(() => {
    if (!dirty || uploads > 0 || busy || notice?.reload) return;
    const timer = window.setTimeout(() => {
      setBusy('save');
      void save(undefined, true).finally(() => setBusy(null));
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty, uploads, busy, notice?.reload]);

  async function saveNow() {
    if (busy) return;
    if (uploads > 0) {
      setNotice({ tone: 'error', text: 'A file is still uploading. Save again when it finishes.' });
      return;
    }
    setBusy('save');
    const result = await save();
    setBusy(null);
    if (result) setNotice({ tone: 'saved', text: `Saved ${clock(result.savedAt)}. Only you can see it until you publish.` });
  }

  /** Saves with `action`, then publishes this project (and the home page's draft, if there is one). */
  async function publishAs(action: Draft['action'], kind: Exclude<Busy, null>) {
    if (busy) return;
    if (uploads > 0) {
      setNotice({ tone: 'error', text: 'A file is still uploading. Publish when it finishes.' });
      return;
    }
    if (action === 'publish') {
      setCheckedForPublishing(true);
      const found = findErrors(draft, true);
      if (errorCount(found) > 0) {
        setErrors(found);
        setNotice({ tone: 'error', text: errorSummary(found, 'publishing'), fromFields: true });
        focusFirstInvalid();
        return;
      }
    }
    setBusy(kind);
    setNotice(null);
    const saved = dirty || !stored || stored.action !== action ? await save(action) : stored;
    if (!saved) {
      setBusy(null);
      return;
    }
    const result = await api.publish([{ id: draft.id, etag: saved.etag }], adminState.homeDraft?.etag ?? null);
    if (!result.ok) {
      setBusy(null);
      if (result.errors?.[draft.id]) {
        setErrors(result.errors[draft.id]);
        if (result.errors[draft.id].slug === SLUG_TAKEN_MESSAGE) setTaken((t) => new Set(t).add(draft.slug));
        setNotice({ tone: 'error', text: errorSummary(result.errors[draft.id], 'publishing'), fromFields: true });
        focusFirstInvalid();
      } else if (result.conflicts?.length) {
        const own = result.conflicts.find((c) => c.id === draft.id) ?? result.conflicts[0];
        if (own.reason.startsWith('Changed on the site')) setStale(true);
        setNotice({ tone: 'error', text: own.id === 'home' ? `The home page order: ${own.reason}. Reload the project list.` : own.reason });
      } else {
        setNotice({ tone: 'error', text: result.error });
      }
      await refresh();
      return;
    }
    if (result.commit === null) {
      // Nothing differed from the site: the draft is done with.
      setStored(null);
      setNotice({ tone: 'saved', text: 'Nothing to publish: the site already shows this.' });
    } else {
      const fresh = await api.draft(draft.id);
      setStored(fresh.ok ? { etag: fresh.etag, savedAt: fresh.draft.savedAt, state: fresh.draft.state, action: fresh.draft.action } : null);
      const text =
        action === 'delete'
          ? 'Deleting. It leaves the site once the build is live, in 2 to 4 minutes.'
          : action === 'unpublish'
            ? 'Taking it off the site. The build takes 2 to 4 minutes; it then waits here as a hidden project.'
            : `Publishing. It is live at ${siteHost}${caseStudyPath(draft.slug)} once the build finishes, in 2 to 4 minutes.`;
      setNotice({ tone: 'info', text });
    }
    setBusy(null);
    setConfirming(null);
    await refresh();
  }

  async function openPreview(view: PreviewView) {
    if (busy) return;
    // Open the tab during the click so pop-up blockers allow it, then send it to the preview once the draft is saved.
    const tab = window.open('', '_blank');
    if (dirty || !stored) {
      const saved = await save();
      if (!saved && !live) {
        tab?.close();
        return;
      }
    }
    const href = previewPath(draft.id, view);
    if (tab) tab.location.href = href;
    else window.open(href, '_blank');
  }

  /** Back to the project as the site shows it: the draft goes. */
  async function discard() {
    if (busy) return;
    setBusy('discard');
    const result = await api.deleteDraft(draft.id);
    setBusy(null);
    setConfirming(null);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error });
      return;
    }
    if (!live) {
      window.location.assign('/admin');
      return;
    }
    const fresh = { ...live } as EditableProject;
    setDraft(fresh);
    setSavedJson(JSON.stringify(fresh));
    setStored(null);
    setStale(false);
    setErrors({});
    setNotice({ tone: 'saved', text: 'Changes discarded. This is the project as the site shows it.' });
    await refresh();
  }

  /** "Keep my draft": it now starts from the project as the site shows it. */
  async function keepDraft() {
    if (busy) return;
    setBusy('resolve');
    const result = await api.resolve(draft.id);
    setBusy(null);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error });
      return;
    }
    setStored((s) => (s ? { ...s, etag: result.etag, savedAt: result.savedAt } : s));
    setStale(false);
    setNotice({ tone: 'saved', text: 'Kept. Publishing this draft replaces the version on the site.' });
    await refresh();
  }

  async function deleteProject() {
    if (live) return publishAs('delete', 'delete');
    if (busy) return;
    setBusy('delete');
    const result = stored ? await api.deleteDraft(draft.id) : ({ ok: true } as const);
    if (!result.ok) {
      setBusy(null);
      setConfirming(null);
      setNotice({ tone: 'error', text: result.error });
      return;
    }
    // Nothing left to lose, so the unsaved-changes prompt has nothing to ask about.
    setSavedJson(JSON.stringify(draft));
    window.location.assign('/admin');
  }

  function ask(which: Confirm) {
    setConfirming(which);
    setPendingFocus(which ? 'adm-confirm-cancel' : null);
  }

  const status: Status = busy
    ? { tone: 'busy', text: busyText(busy) }
    : uploads > 0
      ? { tone: 'busy', text: 'Uploading. It saves when the file is in.' }
      : notice
        ? notice
        : dirty
          ? { tone: 'dirty', text: 'Unsaved changes' }
          : stored
            ? { tone: 'saved', text: `Saved ${clock(stored.savedAt)}` }
            : live
              ? { tone: 'saved', text: 'No changes from the site.' }
              : { tone: 'idle', text: 'Not saved yet' };

  const badge = statusOf(onSite, stored);
  const stateLine =
    badge === 'live'
      ? 'Live on the site.'
      : badge === 'changed'
        ? stored?.action === 'delete'
          ? 'Live. Marked to be deleted when you publish.'
          : stored?.action === 'unpublish'
            ? 'Live. Marked to come off the site when you publish.'
            : 'Live. Your changes are a draft until you publish.'
        : badge === 'publishing'
          ? 'Publishing: the site is rebuilding.'
          : badge === 'failed'
            ? 'The last publish failed. The site shows the previous version.'
            : badge === 'hidden'
              ? 'Taken off the site. Publish to put it back.'
              : 'Not on the site. Only you can see it.';
  const heading = draft.title.trim() || (stored || live ? 'Untitled project' : 'New project');
  const lock = busy ? true : undefined;

  return (
    <UploadTrackerProvider value={track}>
      <div className="adm-editor-page">
        <div className="adm-page-head">
          <div>
            <p className="adm-crumb">
              <a href="/admin">All projects</a>
            </p>
            <h1 className="adm-h1">{heading}</h1>
            <p className="adm-lede adm-state-line">
              <StatusBadge status={stored || live ? badge : 'new'} />
              <span>{stateLine}</span>
            </p>
          </div>
        </div>

        {stale && (
          <div className="adm-alert adm-list-alert" role="alert">
            <p>Changed on the site since this draft began. Keep your draft to publish it over the site&apos;s version, or discard it.</p>
            <button type="button" className="adm-btn adm-btn-small" onClick={keepDraft} aria-disabled={lock}>
              {busy === 'resolve' ? 'Keeping…' : 'Keep my draft'}
            </button>
            <button type="button" className="adm-btn adm-btn-small adm-btn-quiet" onClick={discard} aria-disabled={lock}>
              Discard
            </button>
          </div>
        )}

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
            <section className="adm-section" id="basics" aria-labelledby="basics-title">
              <h2 className="adm-h2" id="basics-title">
                Basics
              </h2>
              <TextField
                id={fieldId('title')}
                label="Title"
                required
                value={draft.title}
                maxLength={LIMITS.title}
                onChange={changeTitle}
                error={errors.title}
              />
              <TextField
                id={fieldId('slug')}
                label="Web address"
                required
                help={
                  <>
                    The case study lives at {siteHost}/work/<strong>{draft.slug || 'your-project'}</strong>.{' '}
                    {autoSlug
                      ? 'It follows the title until you change it.'
                      : 'Changing it after publishing breaks links people have saved.'}
                  </>
                }
                value={draft.slug}
                maxLength={LIMITS.slug}
                spellCheck={false}
                onChange={changeSlug}
                onBlur={tidySlug}
                error={errors.slug}
              />
              <div className="adm-grid-2">
                <SelectField
                  id={fieldId('category')}
                  label="Category"
                  required
                  help="The filter it appears under on the home page."
                  value={draft.category}
                  options={CATEGORIES}
                  onChange={(category) => set('category', category)}
                  error={errors.category}
                />
                <TextField
                  id={fieldId('year')}
                  label="Year"
                  required
                  help="The year you made it."
                  inputMode="numeric"
                  maxLength={4}
                  value={Number.isFinite(draft.year) ? String(draft.year) : ''}
                  onChange={changeYear}
                  error={errors.year}
                />
              </div>
              <TextField
                id={fieldId('discipline')}
                label="Discipline"
                help="A short label shown on the card, like “Brand identity” or “Vision Pro concept”."
                value={draft.discipline}
                maxLength={LIMITS.discipline}
                onChange={(discipline) => set('discipline', discipline)}
              />
              <TextAreaField
                id={fieldId('summary')}
                label="Summary"
                required
                help="One sentence, shown under the card title and at the top of the case file."
                rows={3}
                target={SUMMARY_TARGET}
                maxLength={LIMITS.summary}
                value={draft.summary}
                onChange={(summary) => set('summary', summary)}
                error={errors.summary}
              />
            </section>

            <section className="adm-section" id="cover" aria-labelledby="cover-title">
              <h2 className="adm-h2" id="cover-title">
                Cover
              </h2>
              <p className="adm-section-intro">
                The image on the home page card and at the top of the case study. Needed before publishing. Landscape works
                best; each card crops it to fit.
              </p>
              <MediaField
                id={fieldId('cover')}
                label="Cover image"
                kind="image"
                required
                value={draft.cover}
                onChange={changeCover}
                folderHint={`${folder}/cover`}
                error={errors.cover}
                altError={errors['cover.alt']}
              />
              <AccentField
                id={fieldId('accent')}
                value={draft.accent}
                onChange={(accent) => set('accent', accent)}
                cover={draft.cover}
                error={errors.accent}
              />
            </section>

            <section className="adm-section" id="details" aria-labelledby="details-title">
              <h2 className="adm-h2" id="details-title">
                Details
              </h2>
              <p className="adm-section-intro">
                Shown in a row of facts under the summary. Role, type and tools show a “To add” prompt until they are filled
                in; the rest is hidden when empty.
              </p>
              <TextField
                id={fieldId('shown')}
                label="In the images"
                help="What the cover and images show, like “Bags, cups, sachets, an enamel mug”."
                value={draft.shown}
                maxLength={LIMITS.summary}
                onChange={(shown) => set('shown', shown)}
              />
              <div className="adm-grid-2">
                <TextField
                  id={fieldId('role')}
                  label="Your role"
                  help="Like “Lead designer” or “Design and 3D”."
                  value={draft.role}
                  maxLength={LIMITS.role}
                  onChange={(role) => set('role', role)}
                />
                <SelectField
                  id={fieldId('projectType')}
                  label="Project type"
                  help="Choose Not set to leave it off the page."
                  value={draft.projectType}
                  options={PROJECT_TYPE_OPTIONS}
                  onChange={(projectType) => set('projectType', projectType)}
                />
              </div>
              <TextField
                id={fieldId('tools')}
                label="Tools"
                help="Like “Blender, After Effects, Illustrator”."
                value={draft.tools}
                maxLength={LIMITS.tools}
                onChange={(tools) => set('tools', tools)}
              />
              <TextField
                id={fieldId('deliverables')}
                label="Deliverables"
                help="What you made, like “Logo, packaging, brand guidelines”."
                value={draft.deliverables}
                maxLength={LIMITS.deliverables}
                onChange={(deliverables) => set('deliverables', deliverables)}
              />
              <TextField
                id={fieldId('link')}
                label="External link"
                type="url"
                help="Optional. A live product, a film or press coverage. Paste the full address, starting with https://"
                placeholder="https://"
                value={draft.link}
                maxLength={LIMITS.url}
                spellCheck={false}
                onChange={(link) => set('link', link.trim())}
                error={errors.link}
              />
            </section>

            <section className="adm-section" id="story" aria-labelledby="story-title">
              <h2 className="adm-h2" id="story-title">
                Story
              </h2>
              <div className="adm-prompts">
                <p>A strong {categoryLabel(draft.category).toLowerCase()} case study covers:</p>
                <ul>
                  {STORY_PROMPTS[draft.category].map((prompt) => (
                    <li key={prompt.heading}>
                      <strong>{prompt.heading}</strong>
                      {prompt.hint && `: ${prompt.hint}`}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="adm-help">
                Text blocks with a heading show side by side in the case file; images, galleries, videos and quotes run the
                full width. Until there is any text, the case file shows these prompts as “To add” notes. The first video
                replaces the cover at the top of the case file.
              </p>
              <BlockEditor blocks={draft.blocks} onChange={changeBlocks} errors={errors} folderHint={folder} />
              {draft.category === 'spatial' && (
                <SwitchField
                  id={fieldId('stillOnly')}
                  label="Stills only, no capture to come"
                  help="Spatial projects without a video ask for a short capture from the headset or the visionOS simulator. Turn this on when the project is shown by stills alone."
                  checked={draft.stillOnly}
                  onChange={(stillOnly) => set('stillOnly', stillOnly)}
                />
              )}
            </section>

            <section className="adm-section" id="home" aria-labelledby="home-title">
              <h2 className="adm-h2" id="home-title">
                Home page
              </h2>
              <p className="adm-help adm-help-flush">
                Highlight it on the home page from the <a href="/admin">project list</a>
                {onSite ? '.' : ': a project not on the site yet can be highlighted there, and the highlight goes up when it is published.'}
              </p>
            </section>
          </div>
        </div>

        <div className="adm-bar" ref={bar} role="region" aria-label="Save and publish">
          <p className="adm-bar-status" data-tone={status.tone} role="status">
            {status.text}
            {notice?.reload && (
              <>
                {' '}
                <button type="button" className="adm-btn adm-btn-small" onClick={() => window.location.reload()}>
                  Reload
                </button>
              </>
            )}
          </p>
          {adminState.homeDraft && !confirming && (
            <p className="adm-help adm-bar-note">Publish also sends the home page&apos;s new order and highlights from the project list.</p>
          )}
          {confirming ? (
            <div className="adm-confirm" role="group" aria-labelledby="adm-confirm-question">
              <p id="adm-confirm-question">{confirmQuestion(confirming, draft.title, onSite, stored?.state === 'hidden')}</p>
              <button
                type="button"
                className={`adm-btn ${confirming === 'discard' ? 'adm-btn-primary' : 'adm-btn-danger'}`}
                onClick={() => (confirming === 'delete' ? deleteProject() : confirming === 'unpublish' ? publishAs('unpublish', 'unpublish') : discard())}
                aria-disabled={lock}
              >
                {confirmButton(confirming, busy)}
              </button>
              <button id="adm-confirm-cancel" type="button" className="adm-btn" onClick={() => ask(null)} aria-disabled={lock}>
                Keep it
              </button>
            </div>
          ) : (
            <div className="adm-bar-buttons">
              {(stored || live) && (
                <button type="button" className="adm-btn adm-btn-quiet" onClick={() => ask('delete')} aria-disabled={lock}>
                  Delete
                </button>
              )}
              {live && stored && (
                <button type="button" className="adm-btn adm-btn-quiet" onClick={() => ask('discard')} aria-disabled={lock}>
                  Discard changes
                </button>
              )}
              {live && (
                <button type="button" className="adm-btn adm-btn-quiet" onClick={() => ask('unpublish')} aria-disabled={lock}>
                  Take off the site
                </button>
              )}
              <details className="adm-menu">
                <summary className="adm-btn">Preview</summary>
                <div className="adm-menu-list" role="group" aria-label="Preview, in a new tab">
                  <button type="button" className="adm-btn adm-btn-small adm-btn-quiet" onClick={() => openPreview('case')}>
                    Case file<span className="adm-vh"> (opens in a new tab)</span>
                  </button>
                  <button type="button" className="adm-btn adm-btn-small adm-btn-quiet" onClick={() => openPreview('home')}>
                    Home<span className="adm-vh"> (opens in a new tab)</span>
                  </button>
                  <button type="button" className="adm-btn adm-btn-small adm-btn-quiet" onClick={() => openPreview('work')}>
                    All projects<span className="adm-vh"> (opens in a new tab)</span>
                  </button>
                </div>
              </details>
              {live && (
                <a className="adm-btn" href={caseStudyPath(live.slug)} target="_blank" rel="noopener">
                  View live<span className="adm-vh"> (opens in a new tab)</span>
                </a>
              )}
              <button type="button" className="adm-btn" onClick={saveNow} aria-disabled={lock}>
                Save
              </button>
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => publishAs('publish', 'publish')} aria-disabled={lock}>
                Publish
              </button>
            </div>
          )}
        </div>
      </div>
    </UploadTrackerProvider>
  );
}

function confirmQuestion(which: Exclude<Confirm, null>, title: string, onSite: boolean, hidden: boolean): string {
  const name = `“${title.trim() || 'this project'}”`;
  switch (which) {
    case 'delete':
      return onSite
        ? `Delete ${name}? It leaves the site when the build is live, its address leads to All projects, and this can’t be undone here.`
        : hidden
          ? `Delete ${name}? It is not on the site now, its address keeps leading to All projects, and this can’t be undone.`
          : `Delete ${name}? It was never on the site, and this can’t be undone.`;
    case 'unpublish':
      return `Take ${name} off the site? Its address will lead to All projects. It stays here, hidden, to publish again later.`;
    case 'discard':
      return `Discard your changes to ${name}? The project goes back to how the site shows it.`;
  }
}

function confirmButton(which: Exclude<Confirm, null>, busy: Busy): string {
  switch (which) {
    case 'delete':
      return busy === 'delete' ? 'Deleting…' : 'Delete project';
    case 'unpublish':
      return busy === 'unpublish' ? 'Taking it off…' : 'Take it off the site';
    case 'discard':
      return busy === 'discard' ? 'Discarding…' : 'Discard changes';
  }
}

function busyText(busy: Exclude<Busy, null>): string {
  switch (busy) {
    case 'save':
      return 'Saving…';
    case 'publish':
      return 'Publishing…';
    case 'unpublish':
      return 'Taking it off the site…';
    case 'delete':
      return 'Deleting…';
    case 'discard':
      return 'Discarding…';
    case 'resolve':
      return 'Keeping your draft…';
  }
}
