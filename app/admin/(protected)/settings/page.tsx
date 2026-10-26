import type { Metadata } from 'next';
import { requireAdmin } from '@/components/admin/auth';
import SettingsForm from '@/components/admin/SettingsForm';

export const metadata: Metadata = { title: 'Site settings' };

export default async function SettingsPage() {
  const { store } = await requireAdmin('/admin/settings');
  const { updatedAt: _updatedAt, ...settings } = await store.getSettings();
  return <SettingsForm initial={settings} />;
}
