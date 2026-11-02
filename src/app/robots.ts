import type { MetadataRoute } from 'next';
import { getContentMode } from '@/content';
import { siteUrl } from '@/lib/seo';

/** Crawlable only once content is verified and public (spec §10, §8.2). */
export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  if (getContentMode() !== 'VERIFIED_PUBLIC') {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: url ? new URL('/sitemap.xml', url).toString() : undefined,
  };
}
