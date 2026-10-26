import Link from 'next/link';
import type { Settings } from '@/lib/cms/types';
import { mailto, OWNER_NAME } from './config';
import XMark from './XMark';

export default function SiteFooter({ settings, showLair }: { settings: Settings; showLair: boolean }) {
  const { email, linkedin, instagram } = settings;

  return (
    <footer className="foot">
      <div className="wrap">
        <Link className="brand" href="/#top" aria-label={`${OWNER_NAME}, home`}>
          <XMark />
          <span>{OWNER_NAME}</span>
        </Link>
        {showLair && (
          <p>
            There&apos;s also a world you can walk around in. <Link href="/#lair">Enter the Lair</Link>
          </p>
        )}
        {(email || linkedin || instagram) && (
          <p className="foot-links">
            {email && <a href={mailto(email)}>Email</a>}
            {linkedin && (
              <a href={linkedin} target="_blank" rel="noopener">
                LinkedIn<span className="vh"> (opens in a new tab)</span>
              </a>
            )}
            {instagram && (
              <a href={instagram} target="_blank" rel="noopener">
                Instagram<span className="vh"> (opens in a new tab)</span>
              </a>
            )}
          </p>
        )}
      </div>
    </footer>
  );
}
