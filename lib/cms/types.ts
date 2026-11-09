// Shared content model. Every storage mode (local file, Cloudflare D1 + R2, Supabase) reads and writes exactly these shapes.

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

export interface Project {
  id: string;
  slug: string;
  title: string;
  category: Category;
  year: number;
  /** Short discipline label shown on cards, e.g. "Brand identity" or "Vision Pro concept". */
  discipline: string;
  /** One sentence shown under the card title and at the top of the case file. */
  summary: string;
  /** What the images show, e.g. "Bags, cups, sachets, an enamel mug". Listed as "In the images" when set. */
  shown: string;
  /**
   * The project has no film and never will (it is shown by stills only), so the case file doesn't ask for a capture.
   * Only matters for spatial projects, which otherwise show a placeholder for a headset capture until a video is added.
   */
  stillOnly: boolean;
  cover: Media | null;
  /** Hex colour the case study is lit with, sampled from the cover. */
  accent: string;
  role: string;
  projectType: ProjectType;
  tools: string;
  deliverables: string;
  /** Optional external link (live product, video, press). */
  link: string;
  /**
   * Highlighted: shown as a large plate on the home page. Everything else published is listed under the highlights.
   * The admin labels this "Highlight" and allows at most MAX_HIGHLIGHTS, so the home page stays short.
   */
  featured: boolean;
  /** Lower comes first. */
  position: number;
  status: 'draft' | 'published';
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export type ProjectInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'> & {
  id?: string;
  /**
   * The `updatedAt` the editor loaded. When set and the stored project has changed since, saveProject throws
   * STALE_PROJECT_MESSAGE instead of overwriting the newer version.
   */
  expectedUpdatedAt?: string;
};

/** How many projects can be highlighted on the home page at once. */
export const MAX_HIGHLIGHTS = 3;

export const STALE_PROJECT_MESSAGE =
  'This project was changed somewhere else since you opened it (another tab, or the project list). Reload the page to get the latest version, then make your change again.';

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

/**
 * Every word on the public site that isn't a project. Lines marked "inline" accept **bold**; lines marked "five" put
 * the words in [square brackets] on the link to the Lair. Empty optional strings are hidden on the public site.
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
  updatedAt: string;
}

/**
 * How the admin uploads a file: straight to disk in local mode, to the site's own upload route on Cloudflare (which
 * writes to R2), or to a Supabase signed URL.
 */
export type UploadTicket =
  | { mode: 'local' | 'cloudflare'; url: string; publicUrl: string }
  | { mode: 'supabase'; bucket: string; path: string; token: string; publicUrl: string };

export type AuthResult = { ok: true } | { ok: false; error: string };
