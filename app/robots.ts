import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/components/site/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
