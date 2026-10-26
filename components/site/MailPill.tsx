'use client';

import { useEffect, useState } from 'react';
import { mailto } from './config';

/** Phones only: a floating "Email me" between the hero and Contact, out of the way while either is on screen. */
export default function MailPill({ email }: { email: string }) {
  const [away, setAway] = useState(true);

  useEffect(() => {
    const ends = ['hero', 'contact'].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (ends.length === 0 || !('IntersectionObserver' in window)) return;

    const visible = new Map<Element, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => visible.set(entry.target, entry.isIntersecting));
        setAway([...visible.values()].some(Boolean));
      },
      { threshold: 0.2 },
    );
    ends.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    // While away it is visibility: hidden, which also takes it out of the tab order.
    <a className={away ? 'mail-pill away' : 'mail-pill'} href={mailto(email)}>
      Email me
    </a>
  );
}
