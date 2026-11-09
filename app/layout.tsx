import type { Metadata, Viewport } from 'next';
import { Michroma, Urbanist } from 'next/font/google';
import type { ReactNode } from 'react';
import { OWNER_NAME, SITE_URL } from '@/components/site/config';
import './globals.css';

// Michroma sets the name, titles and small signage; Urbanist sets everything people read. next/font downloads both
// at build time and serves them from the site itself, so no request goes to Google when a page loads.
const titleFont = Michroma({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-michroma',
});

const textFont = Urbanist({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-urbanist',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: OWNER_NAME, template: `%s | ${OWNER_NAME}` },
  applicationName: OWNER_NAME,
  authors: [{ name: OWNER_NAME, url: SITE_URL }],
  creator: OWNER_NAME,
};

export const viewport: Viewport = {
  themeColor: '#04070A',
  colorScheme: 'dark',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${titleFont.variable} ${textFont.variable}`} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
