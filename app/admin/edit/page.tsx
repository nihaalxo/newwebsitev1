import type { Metadata } from 'next';
import { Suspense } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import EditScreen from '@/components/admin/EditScreen';

export const metadata: Metadata = { title: 'Edit project' };

export default function EditPage() {
  return (
    <AdminShell>
      <Suspense>
        <EditScreen />
      </Suspense>
    </AdminShell>
  );
}
