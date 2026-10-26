import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * The Supabase client for client components, used by the admin to send files to a signed upload URL:
 * `createSupabaseBrowserClient().storage.from(ticket.bucket).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType })`.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    // Written out in full so Next.js inlines them into the browser bundle.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
