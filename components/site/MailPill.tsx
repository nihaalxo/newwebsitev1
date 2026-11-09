'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { mailto } from './config';

/**
 * The phone-only "Email me" pill. On the home page it shows between the hero and the contact section; elsewhere it
 * steps aside for the footer, which has its own link.
 */
export default function MailPill({ email }: { email: string }) {
  const pathname = usePathname();
  const [away, setAway] = useState(true);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const hero = document.querySelector('.hero');
    const watched = (hero ? [hero, document.getElementById('contact')] : [document.querySelector('.foot')]).filter(
      (el): el is Element => el !== null,
    );
    const seen = new Map<Element, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => seen.set(entry.target, entry.isIntersecting));
        setAway([...seen.values()].some(Boolean));
      },
      { threshold: 0.2 },
    );
    watched.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <a className={away ? 'mail-pill away' : 'mail-pill'} id="mail-pill" href={mailto(email)}>
      Email me
    </a>
  );
}
