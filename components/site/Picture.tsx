import type { Media } from '@/lib/cms/types';
import Film from './Film';
import { imageSources } from './media';

interface PictureProps {
  media: Media;
  /** The `sizes` attribute: how wide this picture renders at each breakpoint. */
  sizes: string;
  className?: string;
  /** Above the fold: load at once and at high priority. */
  priority?: boolean;
  /** Overrides media.alt, e.g. '' where a caption or link text already names the picture. */
  alt?: string;
}

/** An image Media as a responsive <img>, or a video Media as a silent looping film. */
export default function Picture({ media, sizes, className, priority = false, alt }: PictureProps) {
  if (media.kind === 'video') {
    return <Film media={media} className={className} ambient lazy={!priority} decorative={!(alt ?? media.alt)} />;
  }

  const { src, srcSet } = imageSources(media);
  return (
    <img
      className={className}
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      width={media.width}
      height={media.height}
      alt={alt ?? media.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
    />
  );
}
