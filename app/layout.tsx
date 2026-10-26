import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { OWNER_NAME, SITE_URL } from '@/components/site/config';
import './globals.css';

// The owner's own typefaces. Nasalization sets title cards, the name and signage; Gilmer sets everything people read.
const titleFont = localFont({
  src: '../public/nasalization-rg.otf',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--f-title',
  fallback: ['Eurostile', 'Arial', 'sans-serif'],
});

const textFont = localFont({
  src: [
    { path: '../public/GilmerLight.otf', weight: '300', style: 'normal' },
    { path: '../public/GilmerMedium.otf', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  variable: '--f-text',
  fallback: ['Avenir Next', 'system-ui', 'sans-serif'],
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
