import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { fontBody, fontDisplay, fontMono } from './fonts';
import { BOOT_SCRIPT } from '@/lib/boot-script';
import { baseMetadata, jsonLdString, personJsonLd } from '@/lib/seo';
import { content, getProjects, getSite } from '@/content';
import { compileKnowledge } from '@/lib/portfolio-ai/knowledge/compiler';
import { buildSuggestionMap } from '@/components/ask-ai/suggestions';
import { AssistantRoot } from '@/components/assistant/AssistantRoot';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AppRuntime } from '@/components/layout/AppRuntime';
import { ExperienceRoot } from '@/experience/ExperienceRoot';
import { PointerAura } from '@/components/motion/PointerAura';
import { RevealMotion } from '@/components/motion/RevealMotion';
import './globals.css';

export const metadata: Metadata = baseMetadata();

export const viewport: Viewport = {
  themeColor: '#06070a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const site = getSite();
  // AI Presence V1: one assistant for every route. Both values are computed at build time from
  // approved content (the manifest version for cache-busting, grounded per-route suggestions).
  const manifestVersion = compileKnowledge(content).manifest.version;
  const suggestionMap = buildSuggestionMap(getProjects().map((p) => ({ slug: p.slug, title: p.title })));
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(personJsonLd()) }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ExperienceRoot />
        <Header displayName={site.displayName} roleLabel={site.roleLabel} />
        <AssistantRoot manifestVersion={manifestVersion} suggestionMap={suggestionMap} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <AppRuntime />
        <RevealMotion />
        <PointerAura />
      </body>
    </html>
  );
}
