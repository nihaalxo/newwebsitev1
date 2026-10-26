import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps the Supabase admin session fresh. Server Components can't write cookies, so an expired access token is
 * refreshed here, before /admin renders, and the new cookies go out on the response.
 * In local mode there is nothing to refresh: the admin pages check the signed nn_admin cookie themselves.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Update the request too, so pages rendered for this request already see the refreshed session.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cache-Control and friends, so a CDN never serves one person's session cookie to someone else.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Nothing may run between creating the client and this call: it is what triggers the refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
