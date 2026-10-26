import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Matches the not-found page's own title, whichever of the two Next.js resolves the head from.
export const metadata: Metadata = { title: 'Page not found' };

// Any unknown URL renders the site's own 404 inside the site layout.
export default function Missing() {
  notFound();
}
