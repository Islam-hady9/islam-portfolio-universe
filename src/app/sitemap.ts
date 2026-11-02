import type { MetadataRoute } from 'next';
import { getProjects } from '@/content';
import { siteUrl } from '@/lib/seo';
import { routes } from '@/lib/routes';

/** Absolute URLs require a confirmed domain (NEXT_PUBLIC_SITE_URL); otherwise empty. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = siteUrl();
  if (!url) return [];
  const paths = [
    routes.home,
    routes.projects,
    routes.about,
    routes.contact,
    ...getProjects().map((p) => routes.project(p.slug)),
  ];
  return paths.map((p) => ({
    url: new URL(p, url).toString(),
    changeFrequency: 'monthly',
    priority: p === '/' ? 1 : 0.7,
  }));
}
