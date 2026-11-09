'use client';

import { usePathname } from 'next/navigation';
import { OWNER_NAME } from './config';

/** The name in the bar and the footer: back to the top on the home page, home from anywhere else. */
export default function BrandLink() {
  const home = usePathname() === '/';
  return (
    <a className="brand" href={home ? '#top' : '/'} aria-label={`${OWNER_NAME}, ${home ? 'back to top' : 'home'}`}>
      <span>{OWNER_NAME}</span>
    </a>
  );
}
