import type { Metadata } from 'next';
import { getContentMode, getSite, getSocialLinks } from '@/content';

/** Absolute site origin, only when explicitly configured (spec §8.2: canonical once domain known). */
export function siteUrl(): URL | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function baseMetadata(): Metadata {
  const site = getSite();
  const url = siteUrl();
  const indexable = getContentMode() === 'VERIFIED_PUBLIC';
  return {
    metadataBase: url ?? undefined,
    title: { default: site.seo.title, template: `%s — ${site.name}` },
    description: site.seo.description,
    keywords: site.seo.keywords,
    applicationName: `${site.name} — ${site.portfolioIdentity}`,
    authors: [{ name: site.name }],
    creator: site.name,
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    alternates: url ? { canonical: '/' } : undefined,
    openGraph: {
      type: 'website',
      siteName: `${site.name} — The Intelligence Universe`,
      title: site.seo.title,
      description: site.seo.description,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: site.seo.title,
      description: site.seo.description,
    },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

/** schema.org Person built only from verified facts (spec §8.2). */
export function personJsonLd(): Record<string, unknown> {
  const site = getSite();
  const url = siteUrl();
  const sameAs = getSocialLinks()
    .filter((s) => s.url && s.verification.status !== 'placeholder')
    .map((s) => s.url as string);
  const person: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.name,
    jobTitle: site.verification.status !== 'placeholder' ? 'AI Full-Stack Engineer' : undefined,
  };
  if (url) person.url = url.toString();
  if (sameAs.length) person.sameAs = sameAs;
  return person;
}

/** Serialises JSON-LD safely for inline <script> (escapes "<" to avoid tag breakout). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
