import type { Metadata } from 'next';
import AdminShell from '@/components/admin/AdminShell';
import ProjectsScreen from '@/components/admin/ProjectsScreen';

export const metadata: Metadata = { title: 'Projects' };

export default function ProjectsPage() {
  return (
    <AdminShell>
      <ProjectsScreen />
    </AdminShell>
  );
}
