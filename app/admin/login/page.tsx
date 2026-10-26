import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeAdminPath } from '@/components/admin/auth';
import { XMark } from '@/components/admin/icons';
import LoginForm from '@/components/admin/LoginForm';
import { cms, cmsMode } from '@/lib/cms';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const destination = safeAdminPath(Array.isArray(next) ? next[0] : next);
  if (await (await cms()).currentAdmin()) redirect(destination);

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
        {cmsMode === 'local' && (
          <p className="adm-help">Local mode: the email and password are ADMIN_EMAIL and ADMIN_PASSWORD in .env.local.</p>
        )}
      </main>
    </div>
  );
}
