#!/usr/bin/env node
/**
 * AI Presence V1 bundle cost: per-route first-load bytes of a baseline build (A) and the current
 * build (B) — the HTML document (it carries the RSC payload), every script and stylesheet the
 * document references — raw and gzip (level 6, like a typical server). Then, on B, the bytes that
 * arrive only on demand when the assistant drawer is opened from a page without the Ask My AI
 * section (/about): the assistant UI chunks and the knowledge index.
 *   node scripts/qa/presence-bundle.mjs --a http://localhost:3320 --b http://localhost:3310 \
 *     [--out docs/ai-presence-v1/evidence/bundle-cost.json]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const A = opt('a', 'http://localhost:3320');
const B = opt('b', 'http://localhost:3310');
const out = opt('out', 'docs/ai-presence-v1/evidence/bundle-cost.json');
const ROUTES = ['/', '/projects', '/projects/tibyn', '/about', '/contact', '/resume'];

const gz = (buf) => gzipSync(buf, { level: 6 }).length;
const kb = (n) => Math.round((n / 1024) * 10) / 10;

async function bytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function route(base, path) {
  const html = await bytes(base + path);
  const text = html.toString('utf8');
  const scripts = [...new Set([...text.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
  const styles = [
    ...new Set(
      [...text.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)]
        .map((m) => /href="([^"]+)"/.exec(m[0])?.[1])
        .filter(Boolean),
    ),
  ];
  const sum = async (list) => {
    let raw = 0;
    let gzip = 0;
    for (const src of list) {
      const b = await bytes(new URL(src, base).href);
      raw += b.length;
      gzip += gz(b);
    }
    return { files: list.length, rawKB: kb(raw), gzipKB: kb(gzip) };
  };
  return {
    html: { rawKB: kb(html.length), gzipKB: kb(gz(html)) },
    js: await sum(scripts),
    css: await sum(styles),
  };
}

async function onDemand(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const seen = new Map();
  page.on('response', async (r) => {
    const u = r.url();
    if (!/\.(js|css|json)(\?|$)/.test(u) || seen.has(u)) return;
    try {
      const b = await r.body();
      seen.set(u, { raw: b.length, gzip: gz(b), at: Date.now() });
    } catch {
      /* redirects / aborted */
    }
  });
  await page.goto(`${base}/about?intro=0&quality=static`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const before = new Set(seen.keys());
  await page.locator('[data-testid="assistant-orb"]').click({ force: true });
  await page
    .locator('[data-ai-host="drawer"] [data-testid="ask-ai-panel"][data-smart="ready"]')
    .waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  const added = [...seen.entries()].filter(([u]) => !before.has(u));
  await browser.close();
  const files = added.map(([u, v]) => ({
    file: new URL(u).pathname,
    rawKB: kb(v.raw),
    gzipKB: kb(v.gzip),
  }));
  const total = (re) => {
    const xs = files.filter((f) => re.test(f.file));
    return {
      files: xs.length,
      rawKB: kb(xs.reduce((a, f) => a + f.rawKB * 1024, 0)),
      gzipKB: kb(xs.reduce((a, f) => a + f.gzipKB * 1024, 0)),
    };
  };
  return { js: total(/\.js$/), css: total(/\.css$/), json: total(/\.json$/), files };
}

const rows = {};
for (const path of ROUTES) {
  const [a, b] = [await route(A, path), await route(B, path)];
  rows[path] = {
    baseline: a,
    current: b,
    delta: {
      htmlGzipKB: kb((b.html.gzipKB - a.html.gzipKB) * 1024),
      jsGzipKB: kb((b.js.gzipKB - a.js.gzipKB) * 1024),
      cssGzipKB: kb((b.css.gzipKB - a.css.gzipKB) * 1024),
      jsFiles: b.js.files - a.js.files,
    },
  };
  console.log(path, JSON.stringify(rows[path].delta));
}
const demand = await onDemand(B);
console.log(
  'on demand (B, /about → drawer):',
  JSON.stringify({ js: demand.js, css: demand.css, json: demand.json }),
);
const result = {
  generatedAt: new Date().toISOString(),
  baseline: A,
  current: B,
  routes: rows,
  onDemand: demand,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
