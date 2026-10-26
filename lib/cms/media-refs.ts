import type { Media, Project, Settings } from './types';

/*
 * Finds uploads that nothing points at any more, so deleting a project or replacing an image also removes the file.
 * Only files the admin uploaded (under projects/ or site/) are ever candidates; seeded and committed files never are.
 */

function mediaUrls(media: Media | null | undefined): string[] {
  if (!media) return [];
  return [media.src, media.srcSmall, media.poster].filter((url): url is string => Boolean(url));
}

/** Every file a project uses: cover, block images and videos, gallery items and posters. */
export function projectMediaUrls(project: Pick<Project, 'cover' | 'blocks'>): string[] {
  const urls = mediaUrls(project.cover);
  for (const block of project.blocks) {
    if (block.type === 'image' || block.type === 'video') urls.push(...mediaUrls(block.media));
    if (block.type === 'gallery') block.items.forEach((item) => urls.push(...mediaUrls(item)));
  }
  return urls;
}

export function settingsMediaUrls(settings: Settings): string[] {
  const urls = [settings.avatar, settings.portrait, settings.heroFilm, settings.lairFilm, settings.contactFilm].flatMap(mediaUrls);
  if (settings.cvUrl) urls.push(settings.cvUrl);
  return urls;
}

/** URLs from `before` that appear nowhere in `stillUsed`. */
export function orphanedUrls(before: string[], stillUsed: Iterable<string>): string[] {
  const keep = new Set(stillUsed);
  return [...new Set(before)].filter((url) => !keep.has(url));
}

/** The upload path inside the media store (e.g. "projects/x/cover-1.webp") when `url` is an admin upload, else null. */
export function uploadPathFromUrl(url: string, publicPrefix: string): string | null {
  if (!url.startsWith(publicPrefix)) return null;
  const relative = decodeURIComponent(url.slice(publicPrefix.length).split(/[?#]/)[0]);
  if (relative.includes('..') || !/^(projects|site)\//.test(relative)) return null;
  return relative;
}
