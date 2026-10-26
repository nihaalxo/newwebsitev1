// Rules shared by the admin's forms (messages next to fields) and its server actions (the check that counts).
// Pure functions only, so this module is safe in both client and server bundles.

import { SLUG_PATTERN } from '@/lib/cms/defaults';
import {
  CATEGORIES,
  type Block,
  type Category,
  type Project,
  type ProjectInput,
  type Settings,
  type UploadTicket,
} from '@/lib/cms/types';

export const LIMITS = {
  title: 120,
  slug: 80,
  discipline: 80,
  summary: 240,
  role: 160,
  tools: 400,
  deliverables: 400,
  url: 500,
  alt: 300,
  caption: 400,
  heading: 160,
  body: 20000,
  quote: 1000,
  cite: 200,
  blocks: 120,
  galleryItems: 48,
  line: 200,
  paragraph: 2000,
  educationEntries: 12,
} as const;

/** How the site's text renderer (components/site/RichText) reads plain text. Shown under long text fields. */
export const PROSE_HELP =
  'Leave an empty line between paragraphs. Put **two asterisks** around words for bold, or write [link text](https://example.com) for a link.';

/** The summary sits under the card title; past this it wraps awkwardly on the home page. */
export const SUMMARY_TARGET = 140;

export const YEAR_RANGE = { min: 1990, max: 2100 } as const;
export const HERO_START_MAX = 600;

export const HEX_PATTERN = /^#[0-9A-F]{6}$/i;

export type FieldErrors = Record<string, string>;

export const SLUG_TAKEN_MESSAGE = 'Another project already uses this web address. Try adding the year, like my-chaii-2024.';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SaveProjectResult = { ok: true; project: Project } | { ok: false; error: string; fieldErrors: FieldErrors };
export type SaveSettingsResult = { ok: true; settings: Settings } | { ok: false; error: string; fieldErrors: FieldErrors };
export type UploadTicketResult = { ok: true; ticket: UploadTicket } | { ok: false; error: string };
export type SignInState = { error: string | null; email: string };

export type SettingsInput = Omit<Settings, 'updatedAt'>;

/** Same pattern the storage layer and the database enforce. */
export { SLUG_PATTERN };

/** "My Chaii London!" -> "my-chaii-london" */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.slug)
    .replace(/-+$/, '');
}

/** "@nihaal" or "nihaal" -> the profile URL, so a pasted handle just works. Anything else is returned as-is. */
export function instagramUrl(value: string): string {
  const handle = /^@?([A-Za-z0-9._]{1,30})$/.exec(value);
  return handle ? `https://www.instagram.com/${handle[1]}/` : value;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** A path on this site, such as /uploads/cv.pdf. Rejects protocol-relative "//host" URLs. */
export function isSitePath(value: string): boolean {
  return /^\/(?!\/)[^\s\\]*$/.test(value);
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** DOM id for the control that shows the error stored under `key` (e.g. "blocks.abc.media.alt"). */
export function fieldId(key: string): string {
  return `f-${key.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

export function toInput(project: Project): ProjectInput {
  const { createdAt: _created, updatedAt: _updated, publishedAt: _published, ...input } = project;
  return input;
}

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** What a strong case study contains, per category. Shown under the Story heading. */
export const STORY_PROMPTS: Record<Category, string[]> = {
  brand: [
    'The brief',
    'Three decisions that shaped the identity (mark, type, pattern)',
    'The system (construction, type, palette, a page of guidelines)',
    'The identity in use',
  ],
  spatial: [
    'The brief',
    'The interaction model (windows or volumes, gaze and pinch, the first ten seconds)',
    'A capture from the headset or the visionOS simulator',
    'The toolchain',
    "What you'd do next",
  ],
  interface: ['The brief', 'Key flows', 'Final screens at device size', "What you'd change"],
  print: ['The brief', 'Process and dropped routes', 'The finished piece', 'Credits and tools'],
};

/**
 * Required fields always; a cover, its description and complete story blocks only when publishing,
 * so a half-written draft can always be saved. Uniqueness of the slug is checked on the server.
 */
export function validateProject(project: ProjectInput, publishing: boolean): FieldErrors {
  const errors: FieldErrors = {};

  if (!project.title.trim()) errors.title = 'Add a title.';

  if (!project.slug) errors.slug = 'Add a web address for the case study.';
  else if (!SLUG_PATTERN.test(project.slug)) {
    errors.slug = 'Use only lowercase letters, numbers and single hyphens, like my-chaii-london.';
  }

  if (!CATEGORIES.some((c) => c.id === project.category)) errors.category = 'Choose a category.';

  if (!Number.isInteger(project.year) || project.year < YEAR_RANGE.min || project.year > YEAR_RANGE.max) {
    errors.year = `Enter a year between ${YEAR_RANGE.min} and ${YEAR_RANGE.max}, like 2024.`;
  }

  if (!project.summary.trim()) errors.summary = 'Add a one-sentence summary.';

  if (project.link && !isHttpUrl(project.link)) {
    errors.link = 'Use a full web address that starts with https://';
  }

  if (!HEX_PATTERN.test(project.accent)) errors.accent = 'Use a hex colour like #6FF3FF.';

  // The editor stops adding at these limits; this catches anything that gets past it, so nothing is cut off on save.
  if (project.blocks.length > LIMITS.blocks) {
    errors.blocks = `A story holds at most ${LIMITS.blocks} blocks. Remove ${project.blocks.length - LIMITS.blocks}, or combine some.`;
  }
  for (const block of project.blocks) {
    if (block.type === 'gallery' && block.items.length > LIMITS.galleryItems) {
      errors[`blocks.${block.id}.items`] =
        `A gallery holds at most ${LIMITS.galleryItems} images. Remove ${block.items.length - LIMITS.galleryItems}, or move some to a second gallery.`;
    }
  }

  if (publishing) {
    if (!project.cover?.src) errors.cover = 'Add a cover image before publishing.';
    else if (!project.cover.alt.trim()) errors['cover.alt'] = 'Describe the cover image before publishing.';
    for (const block of project.blocks) Object.assign(errors, validateBlockForPublishing(block));
  }

  return errors;
}

function validateBlockForPublishing(block: Block): FieldErrors {
  const key = `blocks.${block.id}`;
  switch (block.type) {
    case 'text':
      return block.body.trim() ? {} : { [`${key}.body`]: 'Write some text, or remove this block.' };
    case 'quote':
      return block.text.trim() ? {} : { [`${key}.text`]: 'Write the quote, or remove this block.' };
    case 'image':
      if (!block.media.src) return { [`${key}.media`]: 'Add an image, or remove this block.' };
      return block.media.alt.trim() ? {} : { [`${key}.media.alt`]: 'Describe this image before publishing.' };
    case 'video':
      return block.media.src ? {} : { [`${key}.media`]: 'Add a video, or remove this block.' };
    case 'gallery': {
      if (block.items.length === 0) return { [`${key}.items`]: 'Add at least one image, or remove this block.' };
      const errors: FieldErrors = {};
      block.items.forEach((item, index) => {
        if (!item.alt.trim()) errors[`${key}.items.${index}.alt`] = `Describe image ${index + 1} before publishing.`;
      });
      return errors;
    }
  }
}

export function validateSettings(settings: SettingsInput): FieldErrors {
  const errors: FieldErrors = {};

  if (settings.email && !isEmail(settings.email)) errors.email = 'Enter an email address like name@example.com.';

  const links: [keyof SettingsInput, string][] = [
    ['linkedin', 'LinkedIn'],
    ['instagram', 'Instagram'],
    ['lairUrl', 'The Lair'],
  ];
  for (const [key, name] of links) {
    const value = settings[key];
    if (typeof value === 'string' && value && !isHttpUrl(value)) {
      errors[key] = `Use the full ${name} address, starting with https://`;
    }
  }

  if (settings.education.length > LIMITS.educationEntries) {
    errors.education = `List at most ${LIMITS.educationEntries} qualifications, one per line.`;
  }

  if (settings.cvUrl && !isHttpUrl(settings.cvUrl) && !isSitePath(settings.cvUrl)) {
    errors.cvUrl = 'Upload a PDF, or paste a full link that starts with https://';
  }

  if (!Number.isFinite(settings.heroFilmStart) || settings.heroFilmStart < 0 || settings.heroFilmStart > HERO_START_MAX) {
    errors.heroFilmStart = `Enter a number of seconds between 0 and ${HERO_START_MAX}, like 9.`;
  }

  if (settings.avatar?.src && !settings.avatar.alt.trim()) errors['avatar.alt'] = 'Describe the avatar still.';
  if (settings.portrait?.src && !settings.portrait.alt.trim()) errors['portrait.alt'] = 'Describe the portrait.';

  return errors;
}

export function errorCount(errors: FieldErrors): number {
  return Object.keys(errors).length;
}

/** "Fix 2 things before publishing." */
export function errorSummary(errors: FieldErrors, verb: string): string {
  const count = errorCount(errors);
  return `Fix ${count === 1 ? 'one thing' : `${count} things`} before ${verb}. Each is marked next to its field.`;
}
