import type { AuthResult, Project, ProjectInput, Settings, UploadTicket } from './types';

export type CmsMode = 'local' | 'cloudflare' | 'supabase';

/**
 * One storage backend. `local` keeps content in .cms/content.json and files in public/uploads (development only);
 * `cloudflare` keeps content in D1 and files in R2 and is what runs in production; `supabase` (Postgres + Storage +
 * Auth) is kept as an alternative and is used only when it is configured and the Cloudflare bindings are absent.
 *
 * Public reads never require a session. Every admin method must verify the session itself
 * (in Supabase mode Row Level Security enforces it as well) and throw `new Error('UNAUTHORIZED')` when there is none.
 */
export interface CmsAdapter {
  readonly mode: CmsMode;

  // Public reads: published content only.
  listPublished(): Promise<Project[]>;
  getPublishedBySlug(slug: string): Promise<Project | null>;
  getSettings(): Promise<Settings>;

  // Admin.
  listAll(): Promise<Project[]>;
  getById(id: string): Promise<Project | null>;
  /** Creates when input.id is missing. Sets updatedAt, and publishedAt the first time status becomes 'published'. */
  saveProject(input: ProjectInput): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  /** ids in their new order; positions become 0..n-1. */
  reorder(ids: string[]): Promise<void>;
  saveSettings(settings: Omit<Settings, 'updatedAt'>): Promise<Settings>;
  /** `path` is relative inside the media store, e.g. "projects/my-chaii/cover-1718000000.webp". */
  createUpload(path: string, contentType: string): Promise<UploadTicket>;

  // Auth.
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  currentAdmin(): Promise<{ email: string } | null>;
}
