import 'server-only';
import type { CmsAdapter } from './adapter';
import { cloudflareEnv } from './cloudflare-env';

export type { CmsAdapter, CmsMode } from './adapter';
export * from './types';

/** Supabase is an alternative backend; it is used only when both public Supabase variables are set. */
const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let devAdapter: Promise<CmsAdapter> | null = null;

/**
 * The storage backend for this request. Server-only.
 *
 * - `npm run dev`: local mode (.cms/content.json and public/uploads), or Supabase when it is configured.
 * - On Cloudflare (deployed, or `npm run preview`): D1 and R2, whenever the CMS_DB binding is present.
 * - Otherwise: Supabase when configured, or an error saying what is missing.
 *
 * The local adapter is imported only inside the development branch. Next replaces process.env.NODE_ENV at build
 * time, so a production build drops that branch whole and node:fs never reaches the Worker.
 */
export async function cms(): Promise<CmsAdapter> {
  if (process.env.NODE_ENV === 'development') {
    devAdapter ??= supabaseConfigured
      ? import('./supabase').then((m) => m.createSupabaseAdapter())
      : import('./local').then((m) => m.createLocalAdapter());
    return devAdapter;
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
  throw new Error(
    'No content store: this build runs on Cloudflare with the CMS_DB and CMS_UPLOADS bindings (see wrangler.jsonc ' +
      'and GO-LIVE.md), or with Supabase configured. Use `npm run dev` for local mode, or `npm run preview`.',
  );
}
