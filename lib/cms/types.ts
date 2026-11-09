// Shared content model. Both storage modes (local file, Supabase) read and write exactly these shapes.

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
  /** One sentence shown under the card title and at the top of the case study. */
  summary: string;
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

export interface Settings {
  /** Line under the name in the hero. */
  heroLead: string;
  aboutStatement: string;
  /** Empty strings are hidden on the public site. */
  basedIn: string;
  availability: string;
  cvUrl: string;
  /** Still of the 3D avatar, shown in About. */
  avatar: Media | null;
  /** A real photo, shown beside the avatar in About. */
  portrait: Media | null;
  email: string;
  linkedin: string;
  instagram: string;
  tools: string;
  education: string[];
  lairUrl: string;
  lairBlurb: string;
  /** e.g. "Built in Three.js, runs in the browser, 18 MB". Hidden when empty. */
  lairBuiltWith: string;
  /** Full-bleed hero film; `poster` is the still shown first. */
  heroFilm: Media | null;
  /** Seconds into the hero film to start from (skips the dark power-on on first view). */
  heroFilmStart: number;
  /**
   * The hero film loops between these two times, in seconds, so black at its start or end never leaves the first
   * screen empty. heroFilmLoopEnd 0 means no trimming: the film loops whole.
   */
  heroFilmLoopStart: number;
  heroFilmLoopEnd: number;
  lairFilm: Media | null;
  contactFilm: Media | null;
  updatedAt: string;
}

/** How the admin uploads a file: straight to disk in local mode, or to a Supabase signed URL. */
export type UploadTicket =
  | { mode: 'local'; url: string; publicUrl: string }
  | { mode: 'supabase'; bucket: string; path: string; token: string; publicUrl: string };

export type AuthResult = { ok: true } | { ok: false; error: string };
