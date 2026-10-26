import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './admin.css';

// No wrapper element here: the case-study preview renders under /admin too and must look exactly like the site.
// The admin shell lives in (protected)/layout.tsx; the login page draws its own.

export const metadata: Metadata = {
  title: { default: 'Site admin', template: '%s | Site admin' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
