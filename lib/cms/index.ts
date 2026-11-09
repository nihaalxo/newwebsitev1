import 'server-only';
import type { CmsAdapter } from './adapter';
import { cloudflareEnv } from './cloudflare-env';

export type { CmsAdapter, CmsMode } from './adapter';
export * from './types';

/** Supabase is an alternative backend; it is used only when both public Supabase variables are set. */
const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let localAdapter: Promise<CmsAdapter> | null = null;

/**
 * The storage backend for this request. Server-only.
 *
 * - `npm run dev`: local mode (.cms/content.json and public/uploads), or Supabase when it is configured.
 * - On Cloudflare (deployed, or `npm run preview`): D1 and R2, whenever the CMS_DB binding is present.
 * - `npm run build`, then `npm start` (a plain Node server): Supabase when configured, otherwise local mode,
 *   read-only.
 *
 * The local adapter is imported only inside branches that a Cloudflare build drops whole. Next fixes
 * process.env.NODE_ENV and process.env.CMS_LOCAL_FILES into the code at build time (next.config.ts), and the
 * OpenNext build sets CMS_LOCAL_FILES to "off", so node:fs never reaches the Worker.
 */
export async function cms(): Promise<CmsAdapter> {
  if (process.env.NODE_ENV === 'development') {
    localAdapter ??= supabaseConfigured
      ? import('./supabase').then((m) => m.createSupabaseAdapter())
      : import('./local').then((m) => m.createLocalAdapter());
    return localAdapter;
  }

  const env = cloudflareEnv();
  if (env) {
    const { createCloudflareAdapter } = await import('./cloudflare');
    return createCloudflareAdapter(env);
  }
  if (supabaseConfigured) {
    const { createSupabaseAdapter } = await import('./supabase');
    return createSupabaseAdapter();
  }
  if (process.env.CMS_LOCAL_FILES === 'on') {
    localAdapter ??= import('./local').then((m) => m.createLocalAdapter());
    return localAdapter;
  }
  throw new Error(
    'No content store: this build runs on Cloudflare with the CMS_DB and CMS_UPLOADS bindings (see wrangler.jsonc ' +
      'and GO-LIVE.md). Use `npm run dev` for local mode, or `npm run preview` for the Cloudflare build.',
  );
}
