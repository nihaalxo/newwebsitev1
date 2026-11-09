import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeAdminPath } from '@/components/admin/auth';
import { XMark } from '@/components/admin/icons';
import LoginForm from '@/components/admin/LoginForm';
import { cms } from '@/lib/cms';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const destination = safeAdminPath(Array.isArray(next) ? next[0] : next);
  const store = await cms();
  if (await store.currentAdmin()) redirect(destination);

  return (
    <div className="adm adm-login">
      <main className="adm-login-panel">
        <p className="adm-brand">
          <XMark />
          <span className="adm-brand-name">Nihaal Nazeer</span>
          <span className="adm-brand-sub">Site admin</span>
        </p>
        <div>
          <h1 className="adm-h1">Sign in</h1>
          <p className="adm-lede">To edit your projects and site settings.</p>
        </div>
        <LoginForm next={destination} />
        {store.mode === 'local' && (
          <p className="adm-help">Local mode: the email and password are ADMIN_EMAIL and ADMIN_PASSWORD in .env.local.</p>
        )}
        {store.mode === 'cloudflare' && (
          <p className="adm-help">The email and password are the Worker secrets ADMIN_EMAIL and ADMIN_PASSWORD.</p>
        )}
      </main>
    </div>
  );
}
