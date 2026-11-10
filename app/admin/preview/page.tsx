import '@/components/site/site.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import PreviewScreen from '@/components/admin/PreviewScreen';

// No admin chrome: the preview looks exactly as the site will.

export const metadata: Metadata = { title: 'Preview' };

export default function PreviewPage() {
  return (
    <Suspense>
      <PreviewScreen />
    </Suspense>
  );
}
