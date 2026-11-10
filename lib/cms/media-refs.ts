import type { Media, Project } from './types';

function mediaUrls(media: Media | null | undefined): string[] {
  if (!media) return [];
  return [media.src, media.srcSmall, media.srcTall, media.poster].filter((url): url is string => Boolean(url));
}

/** Every file a project uses: cover, block images and videos, gallery items, posters and tall cuts. */
export function projectMediaUrls(project: Pick<Project, 'cover' | 'blocks'>): string[] {
  const urls = mediaUrls(project.cover);
  for (const block of project.blocks) {
    if (block.type === 'image' || block.type === 'video') urls.push(...mediaUrls(block.media));
    if (block.type === 'gallery') block.items.forEach((item) => urls.push(...mediaUrls(item)));
  }
  return urls;
}
