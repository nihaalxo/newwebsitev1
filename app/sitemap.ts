import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/components/site/config';
import { getSettings, listPublished } from '@/components/site/data';

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, settings] = await Promise.all([listPublished(), getSettings()]);
  const newest = [settings.updatedAt, ...projects.map((p) => p.updatedAt)].filter(Boolean).sort().at(-1);

  return [
    { url: absoluteUrl('/'), lastModified: newest, changeFrequency: 'monthly', priority: 1 },
    ...projects.map((p) => ({
      url: absoluteUrl(`/work/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: 'yearly' as const,
      priority: p.featured ? 0.8 : 0.6,
    })),
  ];
}
