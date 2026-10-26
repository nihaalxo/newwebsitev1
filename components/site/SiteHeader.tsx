'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OWNER_NAME } from './config';
import MotionToggle from './MotionToggle';
import SoundToggle from './SoundToggle';
import XMark from './XMark';

/** Share of the hero scrolled away before the bar frosts over. */
const HERO_SETTLE = 0.18;

export default function SiteHeader({ showLair }: { showLair: boolean }) {
  const pathname = usePathname();
  const [solid, setSolid] = useState(false);

  // Clear over the hero film; frosted once the page moves under it. Re-measured on every route.
  useEffect(() => {
    const update = () => {
      const hero = document.getElementById('hero');
      const threshold = hero ? hero.offsetHeight * HERO_SETTLE : 8;
      setSolid(window.scrollY > threshold);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [pathname]);

  return (
    <header className={solid ? 'bar solid' : 'bar'}>
      <div className="wrap">
        <Link className="brand" href="/#top" aria-label={`${OWNER_NAME}, home`}>
          <XMark />
          <span>{OWNER_NAME}</span>
        </Link>
        <div className="bar-end">
          <nav className="nav" aria-label="Primary">
            <Link href="/#work">Work</Link>
            {showLair && (
              <Link href="/#lair">
                <span className="the">The </span>Lair
              </Link>
            )}
            <Link href="/#about" className="wide">
              About
            </Link>
            <Link href="/#contact">Contact</Link>
          </nav>
          <div className="bar-toggles">
            <MotionToggle />
            <SoundToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
