import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function supabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return { url, anonKey };
}

/**
 * A client acting as the signed-in visitor, so Row Level Security applies to everything it does.
 * Create one per request; never share it between requests.
 */
export async function createSessionClient(): Promise<SupabaseClient> {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies. That's fine: middleware.ts refreshes the session on /admin requests.
        }
      },
    },
  });
}

let publicClient: SupabaseClient | null = null;

/** An anonymous client for the public site. It never reads cookies, so pages using it can be rendered statically. */
export function createPublicClient(): SupabaseClient {
  if (!publicClient) {
    const { url, anonKey } = supabaseEnv();
    publicClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return publicClient;
}
