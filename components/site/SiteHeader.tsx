'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Labels } from '@/lib/cms/types';
import BrandLink from './BrandLink';
import { say } from './say';
import { isSoundOn, setSoundOn, soundOffOnServer, subscribeToSound } from './sound';

/** Where "Skip to the work" goes on each page. */
function skipTarget(pathname: string): string {
  if (pathname === '/') return '#work';
  if (/^\/work(\/[^/]+)?\/?$/.test(pathname)) return '#grid';
  return '#main';
}

/** "The Lair": the first word goes on narrow screens (span.the), as in the mockup. */
function DroppingFirstWord({ text }: { text: string }) {
  const space = text.indexOf(' ');
  if (space <= 0) return <>{text}</>;
  return (
    <>
      <span className="the">{text.slice(0, space + 1)}</span>
      {text.slice(space + 1)}
    </>
  );
}

/**
 * The fixed bar. On the home page it is clear over the hero and turns solid once the hero scrolls away; everywhere
 * else it is solid from the start. Sound is off on every visit, with one button to turn it on (the films carry their
 * own soundtracks).
 */
export default function SiteHeader({ labels }: { labels: Labels }) {
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
        {labels.skip}
      </a>
      <header className={home && heroInView ? 'bar' : 'bar solid'} id="bar">
        <div className="wrap">
          <BrandLink />
          <div className="bar-end">
            <nav className="nav" aria-label="Primary">
              <a href={`${at}#work`}>{labels.navWork}</a>
              <a href={`${at}#lair`}>
                <DroppingFirstWord text={labels.navLair} />
              </a>
              <a href={`${at}#about`} className="wide">
                {labels.navAbout}
              </a>
              <a href={`${at}#cv`} className="wide">
                {labels.navCv}
              </a>
              <a href={`${at}#contact`}>{labels.navContact}</a>
            </nav>
            <button className="sound" id="sound" type="button" aria-pressed={sound} onClick={toggleSound}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
                <path className="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
                <path className="mute" d="M16 9.5l5 5M21 9.5l-5 5" />
              </svg>
              <span className="sound-l">{labels.sound}</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
