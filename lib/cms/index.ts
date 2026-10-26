import 'server-only';
import type { CmsAdapter } from './adapter';

export type { CmsAdapter } from './adapter';
export * from './types';

/** Supabase mode switches on as soon as both public Supabase variables are set. */
export const cmsMode: 'local' | 'supabase' =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'supabase' : 'local';

let adapter: Promise<CmsAdapter> | null = null;

/** The storage backend for this deployment. Server-only. */
export function cms(): Promise<CmsAdapter> {
  adapter ??=
    cmsMode === 'supabase'
      ? import('./supabase').then((m) => m.createSupabaseAdapter())
      : import('./local').then((m) => m.createLocalAdapter());
  return adapter;
}
