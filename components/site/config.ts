/** Whose site this is. The name is fixed identity, not CMS content. */
export const OWNER_NAME = 'Nihaal Nazeer';

/** The public origin used for canonical links, the sitemap and share images. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://nihaalnazeer.com').replace(/\/+$/, '');

/**
 * The Lair, the walk-through 3D portfolio. Every Lair link on the site goes here and opens in a new tab. Set
 * NEXT_PUBLIC_LAIR_URL where the site is built to point somewhere else (it is read at build time).
 */
export const LAIR_URL = process.env.NEXT_PUBLIC_LAIR_URL || 'https://interactive.nihaalnazeer.com/?film=on';

/** Resolves a site path ("/uploads/x.webp") or an already absolute URL (an upload on the media domain) to an absolute URL. */
export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, `${SITE_URL}/`).toString();
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** mailto: link with a friendly subject line. */
export function mailto(email: string): string {
  return `mailto:${email}?subject=${encodeURIComponent('Hello Nihaal')}`;
}
