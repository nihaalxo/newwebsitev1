import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import AdminHeader from '@/components/admin/AdminHeader';
import { cms, cmsMode } from '@/lib/cms';

// Every admin page except sign-in. Each page also checks the session itself (see components/admin/auth.ts),
// because a layout isn't re-run on every navigation.

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const admin = await (await cms()).currentAdmin();
  if (!admin) redirect('/admin/login');

  return (
    <div className="adm">
      <a className="adm-skip" href="#adm-main">
        Skip to content
      </a>
      <AdminHeader email={admin.email} mode={cmsMode} />
      <main className="adm-main" id="adm-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
