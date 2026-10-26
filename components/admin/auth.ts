import 'server-only';

import { redirect } from 'next/navigation';
import { cms } from '@/lib/cms';

/**
 * Guard for admin pages. The (protected) layout checks too, but layouts are not re-run on every navigation,
 * so each page checks for itself. `returnTo` brings the owner back to the same page after signing in.
 */
export async function requireAdmin(returnTo = '/admin') {
  const store = await cms();
  const admin = await store.currentAdmin();
  if (!admin) redirect(`/admin/login?next=${encodeURIComponent(returnTo)}`);
  return { store, admin };
}

/** Only admin paths are allowed as a post-login destination, so the login page can't be used as an open redirect. */
export function safeAdminPath(value: unknown): string {
  if (typeof value !== 'string') return '/admin';
  const isAdminPath = /^\/admin(\/|\?|$)/.test(value) && !value.includes('\\') && !value.startsWith('/admin/login');
  return isAdminPath ? value : '/admin';
}
