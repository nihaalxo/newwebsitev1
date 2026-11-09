'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import BrandLink from './BrandLink';
import { say } from './say';
import { isSoundOn, setSoundOn, soundOffOnServer, subscribeToSound } from './sound';

/** Where "Skip to the work" goes on each page. */
function skipTarget(pathname: string): string {
  if (pathname === '/') return '#work';
  if (/^\/work(\/[^/]+)?\/?$/.test(pathname)) return '#grid';
  return '#main';
}

/**
 * The fixed bar. On the home page it is clear over the hero and turns solid once the hero scrolls away; everywhere
 * else it is solid from the start. Sound is off on every visit, with one button to turn it on (the films carry their
 * own soundtracks).
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const home = pathname === '/';
  const [heroInView, setHeroInView] = useState(true);
  const sound = useSyncExternalStore(subscribeToSound, isSoundOn, soundOffOnServer);

  useEffect(() => {
    if (!home) return;
    const hero = document.querySelector('.hero');
    if (!hero || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setHeroInView(entry.intersectionRatio >= 0.82), {
      threshold: [0, 0.82, 1],
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [home]);

  const at = home ? '' : '/';
  const toggleSound = () => {
    setSoundOn(!sound);
    say(sound ? 'Sound off' : 'Sound on');
  };

  return (
    <>
      <a className="skip" href={skipTarget(pathname)}>
        Skip to the work
      </a>
      <header className={home && heroInView ? 'bar' : 'bar solid'} id="bar">
        <div className="wrap">
          <BrandLink />
          <div className="bar-end">
            <nav className="nav" aria-label="Primary">
              <a href={`${at}#work`}>Work</a>
              <a href={`${at}#lair`}>
                <span className="the">The </span>Lair
              </a>
              <a href={`${at}#about`} className="wide">
                About
              </a>
              <a href={`${at}#cv`} className="wide">
                CV
              </a>
              <a href={`${at}#contact`}>Contact</a>
            </nav>
            <button className="sound" id="sound" type="button" aria-pressed={sound} onClick={toggleSound}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
                <path className="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
                <path className="mute" d="M16 9.5l5 5M21 9.5l-5 5" />
              </svg>
              <span className="sound-l">Sound</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
