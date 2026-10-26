import { NextResponse, type NextRequest } from 'next/server';
import { cms } from '@/lib/cms';

// Sign out is a plain form POST to this route rather than a server action. A native form submission is a full page
// load, so an editor with unsaved changes gets the browser's "leave this page?" prompt first (useUnsavedWarning);
// a server action's redirect is a client-side navigation and skips it.
// Only POST is exported, so Next.js answers every other method with 405 and a link or prefetch can't sign anyone out.

/** The check Next.js applies to server actions: a form on another site can't post here. */
function fromThisSite(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  // Like server actions, allow a missing Origin: some browsers leave it off same-origin form posts.
  if (!origin) return true;
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host'))?.split(',')[0].trim();
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!fromThisSite(request)) return new NextResponse('Sign out from the admin itself.', { status: 403 });

  const store = await cms();
  if (await store.currentAdmin()) await store.signOut();
  // 303 so the browser follows with a GET, and Back doesn't offer to resubmit the form.
  return NextResponse.redirect(new URL('/admin/login', request.url), 303);
}
