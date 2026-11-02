// Content-freeze evidence: renders every route and records its visible text, links and images
// as JSON, so two builds can be diffed (`node scripts/qa/content-snapshot.mjs --diff a.json b.json`).
// Usage: node scripts/qa/content-snapshot.mjs <baseUrl> <out.json>
// Reduced motion keeps reveal choreography (line splitting) out of the text; static tier, no 3D.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const ROUTES = [
  '/',
  '/projects',
  '/projects/tibyn',
  '/projects/movid',
  '/projects/ats-matching',
  '/projects/lifeatlas',
  '/about',
  '/contact',
  '/resume',
];

if (process.argv[2] === '--diff') {
  const [a, b] = process.argv.slice(3).map((f) => JSON.parse(readFileSync(f, 'utf8')));
  let changes = 0;
  for (const route of ROUTES) {
    for (const part of ['header', 'main', 'footer']) {
      const la = a[route][part].split('\n');
      const lb = b[route][part].split('\n');
      const removed = la.filter((l) => !lb.includes(l));
      const added = lb.filter((l) => !la.includes(l));
      if (removed.length || added.length) {
        console.log(`\n### ${route} · ${part}`);
        removed.forEach((l) => console.log(`- ${l}`));
        added.forEach((l) => console.log(`+ ${l}`));
        changes += removed.length + added.length;
      }
    }
    const key = (l) => `${l.href} | ${l.text} | target=${l.target} rel=${l.rel} download=${l.download}`;
    const ka = new Set(a[route].links.map(key));
    const kb = new Set(b[route].links.map(key));
    const lr = [...ka].filter((k) => !kb.has(k));
    const ld = [...kb].filter((k) => !ka.has(k));
    if (lr.length || ld.length) {
      console.log(`\n### ${route} · links`);
      lr.forEach((l) => console.log(`- ${l}`));
      ld.forEach((l) => console.log(`+ ${l}`));
      changes += lr.length + ld.length;
    }
    const ia = new Set(a[route].images.map((i) => `${i.src} | ${i.alt}`));
    const ib = new Set(b[route].images.map((i) => `${i.src} | ${i.alt}`));
    const ir = [...ia].filter((k) => !ib.has(k));
    const id = [...ib].filter((k) => !ia.has(k));
    if (ir.length || id.length) {
      console.log(`\n### ${route} · images`);
      ir.forEach((l) => console.log(`- ${l}`));
      id.forEach((l) => console.log(`+ ${l}`));
      changes += ir.length + id.length;
    }
  }
  console.log(`\n${changes} changed line(s)`);
  process.exit(0);
}

const [base, out] = process.argv.slice(2);
if (!base || !out) {
  console.error('usage: content-snapshot.mjs <baseUrl> <out.json> | --diff <a.json> <b.json>');
  process.exit(2);
}
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const snapshot = {};
for (const route of ROUTES) {
  const sep = route.includes('?') ? '&' : '?';
  await page.goto(`${base.replace(/\/$/, '')}${route}${sep}intro=0&quality=static`, {
    waitUntil: 'networkidle',
  });
  snapshot[route] = await page.evaluate(() => {
    const text = (el) =>
      (el?.innerText ?? '')
        .split('\n')
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
    return {
      header: text(document.querySelector('header')),
      main: text(document.querySelector('main')),
      footer: text(document.querySelector('footer')),
      links: [...document.querySelectorAll('a[href]')].map((a) => ({
        href: a.getAttribute('href'),
        text: (a.textContent ?? '').replace(/\s+/g, ' ').trim(),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
        download: a.getAttribute('download'),
      })),
      images: [...document.querySelectorAll('main img')].map((i) => ({
        src: (i.getAttribute('src') ?? '').replace(/\?.*$/, ''),
        alt: i.getAttribute('alt'),
      })),
    };
  });
}
await browser.close();
writeFileSync(out, JSON.stringify(snapshot, null, 2));
console.log(`snapshot: ${Object.keys(snapshot).length} routes → ${out}`);
