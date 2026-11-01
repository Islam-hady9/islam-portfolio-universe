import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { fontBody, fontDisplay, fontMono } from './fonts';
import { BOOT_SCRIPT } from '@/lib/boot-script';
import { baseMetadata, jsonLdString, personJsonLd } from '@/lib/seo';
import { getSite } from '@/content';
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
