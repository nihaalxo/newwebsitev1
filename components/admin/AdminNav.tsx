'use client';

import { usePathname } from 'next/navigation';

// Plain links rather than <Link>: each is a full page load, so an editor with unsaved changes can ask first.

const LINKS = [
  { href: '/admin', label: 'Projects', matches: (path: string) => path === '/admin' || path.startsWith('/admin/projects') },
  { href: '/admin/settings', label: 'Site settings', matches: (path: string) => path.startsWith('/admin/settings') },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="adm-nav" aria-label="Admin">
      {LINKS.map((link) => (
        <a key={link.href} href={link.href} aria-current={link.matches(pathname) ? 'page' : undefined}>
          {link.label}
        </a>
      ))}
      <a href="/" target="_blank" rel="noopener">
        View site<span className="adm-vh"> (opens in a new tab)</span>
      </a>
    </nav>
  );
}
