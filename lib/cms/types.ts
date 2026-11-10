// The content model. Projects live in content/projects/<slug>.json, the home page's order and highlights in
// content/home.json, and every other word on the site in components/site/copy.ts. The admin's drafts (Draft,
// HomeDraft) live in R2 until they are published.

import type { Labels } from './labels';

export type { LabelKey, Labels } from './labels';

export type Category = 'brand' | 'spatial' | 'interface' | 'print';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'brand', label: 'Brand' },
  { id: 'spatial', label: 'Spatial' },
  { id: 'interface', label: 'Interface' },
  { id: 'print', label: 'Print and motion' },
];

/** '' means "not set": the public site hides unset fields instead of showing a placeholder. */
export type ProjectType = 'client' | 'uni' | 'self' | '';

export const PROJECT_TYPES: { id: ProjectType; label: string }[] = [
  { id: 'client', label: 'Client project' },
  { id: 'uni', label: 'UAL brief' },
  { id: 'self', label: 'Self-initiated' },
];

export interface Media {
  kind: 'image' | 'video';
  /** Full-size file: images are WebP at most 2400px wide; videos are uploaded as-is. */
  src: string;
  /** Images only: a ~960px WebP for cards and thumbnails. */
  srcSmall?: string;
  /** Videos only: optional still shown before playback. */
  poster?: string;
  /** Videos only: an optional portrait cut, played instead of `src` on screens taller than they are wide. */
  srcTall?: string;
  alt: string;
  width?: number;
  height?: number;
}

export type Block =
  | { id: string; type: 'text'; heading?: string; body: string }
  | { id: string; type: 'image'; media: Media; caption?: string; size: 'full' | 'wide' | 'inset' }
  | { id: string; type: 'gallery'; items: Media[]; columns: 2 | 3; caption?: string }
  | { id: string; type: 'video'; media: Media; caption?: string; loop: boolean }
  | { id: string; type: 'quote'; text: string; cite?: string };

export type BlockType = Block['type'];

/** One case study, as stored in content/projects/<slug>.json. Only published projects have a file. */
export interface Project {
  id: string;
  slug: string;
  title: string;
  category: Category;
  /** Short discipline label shown on cards, e.g. "Brand identity" or "Vision Pro concept". */
  discipline: string;
  year: number;
  /** One sentence shown under the card title and at the top of the case file. */
  summary: string;
  /** Hex colour the case study is lit with, sampled from the cover. */
  accent: string;
  cover: Media | null;
  /** What the images show, e.g. "Bags, cups, sachets, an enamel mug". Listed as "In the images" when set. */
  shown: string;
  /**
   * The project has no film and never will (it is shown by stills only), so the case file doesn't ask for a capture.
   * Only matters for spatial projects, which otherwise show a placeholder for a headset capture until a video is added.
   */
  stillOnly: boolean;
  role: string;
  projectType: ProjectType;
  tools: string;
  deliverables: string;
  /** Optional external link (live product, video, press). */
  link: string;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

/**
 * A project as the editor holds it. A new one has no id until the editor gives it one, and empty timestamps until
 * it is first published (lib/admin-api/plan.ts sets them).
 */
export type ProjectInput = Omit<Project, 'id'> & { id?: string };

/** How many projects can be highlighted on the home page at once. */
export const MAX_HIGHLIGHTS = 3;

/** content/home.json: the order of the work, and the projects shown large on the home page. Both by slug. */
export interface HomeLayout {
  /** At most MAX_HIGHLIGHTS slugs, in the order they show. Each is also in `order`. */
  highlights: string[];
  /** Every published project's slug, in site order. */
  order: string[];
}

/**
 * content/redirects.json: old project addresses, e.g. "/work/old-name": { to: "/work/new-name", status: 301 }. While a
 * project is off the site, its addresses go to "/work" with a 302 and carry its `id`, so they lead to it again once it
 * is published again.
 */
export type Redirects = Record<string, { to: string; status: 301 | 302; id?: string }>;

/**
 * A project being edited in the admin, kept in R2 (drafts/<id>.json) until it is published. `base` is the published
 * file the draft started from, so a change made elsewhere since (by Claude, or another tab) is noticed.
 */
export interface Draft {
  project: ProjectInput & { id: string };
  /** What Publish does with it: put it on the site, take it off (keeping the draft), or delete it. */
  action: 'publish' | 'unpublish' | 'delete';
  /** editing: being worked on. publishing: committed, waiting for the build. failed: the build failed. hidden: taken off the site. */
  state: 'editing' | 'publishing' | 'failed' | 'hidden';
  base: { path: string; blobSha: string } | null;
  /** The commit that published it, while it is publishing. */
  commit?: string;
  savedAt: string;
}

/** The home page's order and highlights as changed in the admin, by project id, until they are published. */
export interface HomeDraft {
  highlights: string[];
  order: string[];
  base: { blobSha: string };
  savedAt: string;
}

/** One line of the CV: the position, when, and where. */
export interface CvEntry {
  role: string;
  /** e.g. "Apr 2026 – Present" or "2025". */
  when: string;
  /** e.g. "Stack Design Studio, London". */
  at: string;
}

/** A titled group of CV lines, placed in the left (1) or right (2) column on wide screens. */
export interface CvSection {
  /** Stable id, used for the heading's anchor ("cv-<id>"). Lowercase words joined by hyphens. */
  id: string;
  title: string;
  column: 1 | 2;
  entries: CvEntry[];
}

/** One part of a strong case file, e.g. "The brief": "Who it was for and what had to change…". */
export interface StoryPrompt {
  heading: string;
  hint: string;
}

/** What a strong case file covers, by category. */
export type StoryPrompts = Record<Category, StoryPrompt[]>;

/**
 * Every word on the public site that isn't a project (components/site/copy.ts). Lines marked "inline" accept
 * **bold**; lines marked "five" put the words in [square brackets] on the link to the Lair. Empty optional strings are
 * hidden on the public site.
 */
export interface Settings {
  /** The home page's description for search engines and link previews. "{count}" becomes the number of projects. */
  siteDescription: string;
  /** Line under the name in the hero. */
  heroLead: string;
  /** Full-bleed hero film; `poster` is the still shown when the intro is skipped or the film can't play. */
  heroFilm: Media | null;
  /**
   * After the intro, the hero film loops between these two times, in seconds. heroFilmLoopEnd 0 means no trimming:
   * the film loops whole.
   */
  heroFilmLoopStart: number;
  heroFilmLoopEnd: number;
  /** The "If you have 5 minutes" line under the hero, on All projects and in every case file (five). */
  fiveLine: string;
  /** The same invitation in the footer (five). */
  fiveFooter: string;
  workTitle: string;
  allProjectsTitle: string;
  lairTitle: string;
  /** Paragraph above the controls (inline). */
  lairBlurb: string;
  /** One control per line, written "keys: what they do", e.g. "W A S D: Move". */
  lairControls: string;
  /** Paragraph under the controls (inline). */
  lairNudge: string;
  /** Shown instead of the controls on touch screens. */
  lairTouch: string;
  lairFilm: Media | null;
  aboutTitle: string;
  aboutStatement: string;
  education: string[];
  tools: string;
  basedIn: string;
  availability: string;
  /** A real photo, shown in About behind the "classified" doors. */
  portrait: Media | null;
  aboutPhotoCaption: string;
  /** The film behind About. */
  aboutFilm: Media | null;
  cvTitle: string;
  /** e.g. "AI-Integrated Product Designer | Creative Technology". Each part keeps to one line on wide screens. */
  cvHeadline: string;
  /** Shown before the email and LinkedIn in the CV, e.g. "London". */
  cvPlace: string;
  /** The CV PDF. Empty hides the download button. */
  cvUrl: string;
  cvSections: CvSection[];
  /** Read aloud as the contact section's heading (the film says it on screen). */
  contactTitle: string;
  /** Shown where the contact film would be, until it loads or when it can't play. */
  contactFallback: string;
  contactLead: string;
  email: string;
  linkedin: string;
  instagram: string;
  contactFilm: Media | null;
  /** Seconds into the contact film to start from. */
  contactFilmStart: number;
  /** The short words: the menu, buttons, the contact form's messages, the case file's labels (lib/cms/labels.ts). */
  labels: Labels;
  /**
   * Shown as "To add" notes in a published case file that has no text yet, and above the story in the project
   * editor.
   */
  storyPrompts: StoryPrompts;
}
