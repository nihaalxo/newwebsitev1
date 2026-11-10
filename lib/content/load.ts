import 'server-only';
import { cache } from 'react';
import type { Published } from './assemble';
import { readContent } from './read';

/**
 * The published content, for the pages: read from content/ when the site is built, and on every reload under
 * `npm run dev`. Any problem stops the build with every message, so a broken file never reaches the live site.
 */
export const loadContent = cache((): Published => {
  const { projects, home, redirects, warnings, errors } = readContent();
  for (const warning of warnings) console.warn(`content: ${warning}`);
  if (errors.length > 0) {
    throw new Error(`The content has ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n${errors.map((e) => `  ${e}`).join('\n')}`);
  }
  return { projects, home, redirects };
});
