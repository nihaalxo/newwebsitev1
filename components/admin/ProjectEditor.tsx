'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProject, saveProject } from '@/app/admin/actions';
import { CATEGORIES, PROJECT_TYPES, type Block, type Project, type ProjectInput, type ProjectType } from '@/lib/cms/types';
import AccentField from './AccentField';
import BlockEditor from './BlockEditor';
import { callServer } from './call-server';
import { SelectField, SwitchField, TextAreaField, TextField } from './fields';
import { useFocusFirstInvalid, useStickyBarHeight } from './focus';
import MediaField from './MediaField';
import { caseStudyPath, editPath, previewPath } from './paths';
import {
  LIMITS,
  SLUG_TAKEN_MESSAGE,
  STORY_PROMPTS,
  SUMMARY_TARGET,
  categoryLabel,
  errorCount,
  errorSummary,
  fieldId,
  slugify,
  toInput,
  validateProject,
  type FieldErrors,
} from './rules';
import StatusBadge from './StatusBadge';
import { UploadTrackerProvider, useUploadCount } from './upload-tracker';
import { useUnsavedWarning } from './useUnsavedWarning';

/** What is stored right now, as opposed to what is being edited. */
export interface SavedState {
  status: Project['status'];
  slug: string;
  publishedAt: string | null;
  /** The stored version. Sent with each save, so one made from an out-of-date copy is refused, not written over it. */
  updatedAt: string;
}

interface ProjectEditorProps {
  /** emptyProject() for a new project, otherwise the stored project. */
  initial: ProjectInput;
  /** null until the project has been saved once. */
  saved: SavedState | null;
  /** Web addresses other projects already use. */
  takenSlugs: string[];
  /** e.g. "nihaalnazeer.com", for showing the case study's address. */
  siteHost: string;
}

type Intent = 'draft' | 'publish' | 'unpublish';
type Notice = { tone: 'saved' | 'info' | 'error'; text: string; fromFields?: boolean };
type Status = { tone: 'idle' | 'busy' | 'saved' | 'dirty' | 'error' | 'info'; text: string };

const SECTIONS = [
  { id: 'basics', label: 'Basics' },
  { id: 'cover', label: 'Cover' },
  { id: 'details', label: 'Details' },
  { id: 'story', label: 'Story' },
  { id: 'home', label: 'Home page' },
];

const PROJECT_TYPE_OPTIONS: { id: ProjectType; label: string }[] = [{ id: '', label: 'Not set' }, ...PROJECT_TYPES];

/** The slug follows the title until the project is published or the owner writes their own. */
function slugFollowsTitle(project: ProjectInput, saved: SavedState | null): boolean {
  if (saved?.publishedAt) return false;
  return project.slug === '' || project.slug === slugify(project.title);
}

export default function ProjectEditor({ initial, saved: initiallySaved, takenSlugs, siteHost }: ProjectEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProjectInput>(initial);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  const [saved, setSaved] = useState<SavedState | null>(initiallySaved);
  const [autoSlug, setAutoSlug] = useState(() => slugFollowsTitle(initial, initiallySaved));
  const [taken, setTaken] = useState(() => new Set(takenSlugs));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [checkedForPublishing, setCheckedForPublishing] = useState(false);
  const [busy, setBusy] = useState<Intent | 'delete' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [uploads, track] = useUploadCount();
  const focusFirstInvalid = useFocusFirstInvalid();
  const bar = useRef<HTMLDivElement>(null);
  useStickyBarHeight(bar);

  const dirty = useMemo(() => JSON.stringify(draft) !== savedJson, [draft, savedJson]);
  const isPublished = saved?.status === 'published';
  const folder = `projects/${draft.slug || draft.id || 'new'}`;
  useUnsavedWarning(dirty || uploads > 0);

  const findErrors = useCallback(
    (project: ProjectInput, publishing: boolean) => {
      const found = validateProject(project, publishing);
      if (!found.slug && taken.has(project.slug)) found.slug = SLUG_TAKEN_MESSAGE;
      return found;
    },
    [taken],
  );

  // Once errors are showing, each one disappears as soon as it's fixed. New ones only appear on the next save.
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

  // Opening or closing the delete question swaps the bar's buttons; put keyboard focus on the one that replaced it.
  useEffect(() => {
    if (!pendingFocus) return;
    document.getElementById(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, confirmingDelete]);

  /** Any edit retires "Saved" and other passing notices; errors stay until they're fixed. */
  function edit(change: (project: ProjectInput) => ProjectInput) {
    setDraft(change);
    setNotice((n) => (n && n.tone !== 'error' ? null : n));
  }

  function set<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
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

  async function save(intent: Intent): Promise<Project | null> {
    if (busy) return null;
    if (uploads > 0) {
      setNotice({ tone: 'error', text: 'A file is still uploading. Save again when it finishes.' });
      return null;
    }

    const publishing = intent === 'publish';
    const before = draft;
    const outgoing: ProjectInput = {
      ...draft,
      status: publishing ? 'published' : 'draft',
      expectedUpdatedAt: saved?.updatedAt,
    };
    const verb = publishing ? 'publishing' : 'saving';

    setCheckedForPublishing(publishing);
    const found = findErrors(outgoing, publishing);
    if (errorCount(found) > 0) {
      setErrors(found);
      setNotice({ tone: 'error', text: errorSummary(found, verb), fromFields: true });
      focusFirstInvalid();
      return null;
    }

    setErrors({});
    setNotice(null);
    setBusy(intent);
    const result = await callServer(() => saveProject(outgoing), (error) => ({ ok: false as const, error, fieldErrors: {} }));
    setBusy(null);

    if (!result.ok) {
      const fieldErrors = result.fieldErrors;
      if (fieldErrors.slug === SLUG_TAKEN_MESSAGE) setTaken((current) => new Set(current).add(outgoing.slug));
      setErrors(fieldErrors);
      setNotice({ tone: 'error', text: result.error, fromFields: errorCount(fieldErrors) > 0 });
      if (errorCount(fieldErrors) > 0) focusFirstInvalid();
      return null;
    }

    const { project } = result;
    const stored = toInput(project);
    // If the owner kept typing while the save was in flight, keep their newer text; it stays "unsaved".
    setDraft((current) => (current === before ? stored : { ...current, id: project.id, status: project.status }));
    setSavedJson(JSON.stringify(stored));
    setSaved({ status: project.status, slug: project.slug, publishedAt: project.publishedAt, updatedAt: project.updatedAt });
    if (project.publishedAt) setAutoSlug(false);
    if (!before.id) window.history.replaceState(null, '', editPath(project.id));

    const address = `${siteHost}${caseStudyPath(project.slug)}`;
    const text =
      intent === 'draft'
        ? 'Draft saved. Only you can see it.'
        : intent === 'unpublish'
          ? 'Unpublished. It’s a draft again and hidden from the site.'
          : isPublished
            ? 'Updated. The live page now shows these changes.'
            : `Published. It’s live at ${address}.`;
    setNotice({ tone: 'saved', text });
    return project;
  }

  async function openPreview() {
    if (busy) return;
    // Open the tab during the click so pop-up blockers allow it, then send it to the preview once there's one to show.
    const tab = window.open('', '_blank');
    let id = draft.id;
    if (!id || (dirty && !isPublished)) {
      const project = await save('draft');
      if (!project) {
        tab?.close();
        return;
      }
      id = project.id;
    } else if (dirty) {
      setNotice({ tone: 'info', text: 'The preview shows the published version. Choose Update to include your latest changes.' });
    }
    if (tab) tab.location.href = previewPath(id);
    else window.open(previewPath(id), '_blank');
  }

  function startDelete() {
    setConfirmingDelete(true);
    setPendingFocus('adm-delete-cancel');
  }

  function cancelDelete() {
    setConfirmingDelete(false);
    setPendingFocus('adm-delete-start');
  }

  async function confirmDelete() {
    if (!draft.id || busy) return;
    setBusy('delete');
    const id = draft.id;
    const result = await callServer(() => deleteProject(id), (error) => ({ ok: false as const, error }));
    if (!result.ok) {
      setBusy(null);
      // The focused "Delete project" button goes with the question; land on Delete again, next to the message.
      cancelDelete();
      setNotice({ tone: 'error', text: result.error });
      return;
    }
    // A client-side navigation, so the unsaved-changes prompt doesn't ask about a project that no longer exists.
    router.replace('/admin');
    router.refresh();
  }

  const status: Status = busy
    ? { tone: 'busy', text: busyText(busy, isPublished) }
    : uploads > 0
      ? { tone: 'busy', text: 'Uploading. Save when it finishes.' }
      : notice
        ? notice
        : dirty
          ? { tone: 'dirty', text: 'Unsaved changes' }
          : saved
            ? { tone: 'saved', text: isPublished ? 'Published. No unsaved changes.' : 'Draft saved. No unsaved changes.' }
            : { tone: 'idle', text: 'Not saved yet' };

  const heading = draft.title.trim() || (saved ? 'Untitled project' : 'New project');
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
              <StatusBadge status={saved?.status ?? null} />
              <span>
                {!saved ? 'Not saved yet.' : isPublished ? 'Live on the site.' : 'Only you can see drafts.'}
              </span>
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
                help="One sentence, shown under the card title and at the top of the case study."
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
                onChange={(cover) => set('cover', cover)}
                folderHint={`${folder}/cover`}
                error={errors.cover}
                altError={errors['cover.alt']}
              />
            </section>

            <section className="adm-section" id="details" aria-labelledby="details-title">
              <h2 className="adm-h2" id="details-title">
                Details
              </h2>
              <p className="adm-section-intro">Shown in a row of facts under the summary. Anything left empty is hidden.</p>
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
                    <li key={prompt}>{prompt}</li>
                  ))}
                </ul>
              </div>
              <BlockEditor blocks={draft.blocks} onChange={changeBlocks} errors={errors} folderHint={folder} />
            </section>

            <section className="adm-section" id="home" aria-labelledby="home-title">
              <h2 className="adm-h2" id="home-title">
                Home page
              </h2>
              <SwitchField
                id={fieldId('featured')}
                label="Show as a large image on the home page"
                help="When off, it's listed under More work instead. Set the order on the Projects page."
                checked={draft.featured}
                onChange={(featured) => set('featured', featured)}
              />
              <AccentField
                id={fieldId('accent')}
                value={draft.accent}
                onChange={(accent) => set('accent', accent)}
                cover={draft.cover}
                error={errors.accent}
              />
            </section>
          </div>
        </div>

        <div className="adm-bar" ref={bar} role="region" aria-label="Save and publish">
          <p className="adm-bar-status" data-tone={status.tone} role="status">
            {status.text}
          </p>
          {confirmingDelete ? (
            <div className="adm-confirm" role="group" aria-labelledby="adm-delete-question">
              <p id="adm-delete-question">
                Delete “{draft.title || 'this project'}”? It disappears from the site straight away, and this can’t be undone.
              </p>
              <button type="button" className="adm-btn adm-btn-danger" onClick={confirmDelete} aria-disabled={lock}>
                {busy === 'delete' ? 'Deleting…' : 'Delete project'}
              </button>
              <button id="adm-delete-cancel" type="button" className="adm-btn" onClick={cancelDelete} aria-disabled={lock}>
                Keep it
              </button>
            </div>
          ) : (
            <div className="adm-bar-buttons">
              {saved && (
                <button id="adm-delete-start" type="button" className="adm-btn adm-btn-quiet" onClick={startDelete} aria-disabled={lock}>
                  Delete
                </button>
              )}
              <button type="button" className="adm-btn" onClick={openPreview} aria-disabled={lock}>
                Preview<span className="adm-vh"> (opens in a new tab)</span>
              </button>
              {isPublished && saved && (
                <a className="adm-btn" href={caseStudyPath(saved.slug)} target="_blank" rel="noopener">
                  View live<span className="adm-vh"> (opens in a new tab)</span>
                </a>
              )}
              {isPublished ? (
                <button type="button" className="adm-btn" onClick={() => save('unpublish')} aria-disabled={lock}>
                  Unpublish
                </button>
              ) : (
                <button type="button" className="adm-btn" onClick={() => save('draft')} aria-disabled={lock}>
                  Save draft
                </button>
              )}
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => save('publish')} aria-disabled={lock}>
                {isPublished ? 'Update' : 'Publish'}
              </button>
            </div>
          )}
        </div>
      </div>
    </UploadTrackerProvider>
  );
}

function busyText(busy: Intent | 'delete', isPublished: boolean): string {
  switch (busy) {
    case 'draft':
      return 'Saving draft…';
    case 'publish':
      return isPublished ? 'Updating…' : 'Publishing…';
    case 'unpublish':
      return 'Unpublishing…';
    case 'delete':
      return 'Deleting…';
  }
}
