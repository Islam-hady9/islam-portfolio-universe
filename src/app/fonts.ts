import localFont from 'next/font/local';

/** Display — Sora (OFL). Geometric, wide; matches the reference's editorial headings. */
export const fontDisplay = localFont({
  src: [{ path: '../assets/fonts/sora-latin-wght-normal.woff2', weight: '100 800', style: 'normal' }],
  variable: '--font-display',
  display: 'swap',
  fallback: ['ui-sans-serif', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
  adjustFontFallback: 'Arial',
});

/** Body — Manrope (OFL). */
export const fontBody = localFont({
  src: [{ path: '../assets/fonts/manrope-latin-wght-normal.woff2', weight: '200 800', style: 'normal' }],
  variable: '--font-body',
  display: 'swap',
  fallback: ['ui-sans-serif', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
  adjustFontFallback: 'Arial',
});

/** Technical eyebrow labels — JetBrains Mono (OFL). Not preloaded: decorative, small. */
export const fontMono = localFont({
  src: [
    { path: '../assets/fonts/jetbrains-mono-latin-wght-normal.woff2', weight: '100 800', style: 'normal' },
  ],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
  adjustFontFallback: false,
});
