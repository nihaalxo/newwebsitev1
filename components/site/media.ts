import type { Media } from '@/lib/cms/types';

/** Width of the small WebP the admin generates next to every image. */
const SMALL_WIDTH = 960;

/** src/srcSet for an image Media: the ~960px copy for cards and phones, the full file for wide screens. */
export function imageSources(media: Media): { src: string; srcSet?: string } {
  const full = media.width ?? 2400;
  if (!media.srcSmall || media.srcSmall === media.src || full <= SMALL_WIDTH) return { src: media.src };
  return { src: media.srcSmall, srcSet: `${media.srcSmall} ${SMALL_WIDTH}w, ${media.src} ${full}w` };
}

/** A still that reads at thumbnail size: the small image, or a video's poster. */
export function thumbnail(media: Media | null): string | null {
  if (!media) return null;
  if (media.kind === 'image') return media.srcSmall || media.src;
  return media.poster || null;
}

/** A full-size still for share cards: the image itself, or a video's poster. */
export function still(media: Media | null): Media | null {
  if (!media) return null;
  if (media.kind === 'image') return media;
  return media.poster ? { ...media, kind: 'image', src: media.poster } : null;
}
