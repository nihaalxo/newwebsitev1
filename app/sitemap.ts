import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/components/site/config';
import { loadContent } from '@/lib/content/load';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const { projects, home } = loadContent();
  const newest = projects.map((p) => p.updatedAt).filter(Boolean).sort().at(-1);
  const highlighted = new Set(home.highlights);

  return [
    { url: absoluteUrl('/'), lastModified: newest, changeFrequency: 'monthly', priority: 1 },
    { url: absoluteUrl('/work'), lastModified: newest, changeFrequency: 'monthly', priority: 0.7 },
    ...projects.map((p) => ({
      url: absoluteUrl(`/work/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: 'yearly' as const,
      priority: highlighted.has(p.slug) ? 0.8 : 0.6,
    })),
  ];
}
