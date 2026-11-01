// Lighthouse runs against a running production server (npm run build && npm start).
// Usage: node scripts/perf/lighthouse.mjs [baseUrl=http://localhost:3000]
// Writes docs/evidence/lighthouse/<name>.json (+ .html) and prints a summary table.
// Profiles:
//   mobile-static : Lighthouse mobile emulation (Moto G Power, 4x CPU, slow 4G), headless
//                   software GL → static tier (what a constrained phone without GPU gets)
//   desktop-gpu   : desktop preset, real GPU (ANGLE/D3D11) → full WebGL experience loads
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3000';
const outDir = 'docs/evidence/lighthouse';
mkdirSync(outDir, { recursive: true });
const lhBin = join('node_modules', 'lighthouse', 'cli', 'index.js');

const runs = [
  { name: 'mobile-static-home', url: `${base}/?intro=0`, args: [], flags: '--headless=new' },
  { name: 'mobile-static-case-study', url: `${base}/projects/tibyn`, args: [], flags: '--headless=new' },
  {
    name: 'desktop-gpu-home',
    url: `${base}/?intro=0`,
    args: ['--preset=desktop'],
    flags: '--headless=new --enable-gpu --ignore-gpu-blocklist --use-angle=d3d11',
  },
];

const rows = [];
for (const r of runs) {
  const path = join(outDir, r.name);
  execFileSync(
    process.execPath,
    [
      lhBin,
      r.url,
      ...r.args,
      '--output=json',
      '--output=html',
      `--output-path=${path}`,
      `--chrome-flags=${r.flags}`,
      '--quiet',
    ],
    { stdio: 'inherit' },
  );
  const report = JSON.parse(readFileSync(`${path}.report.json`, 'utf8'));
  const a = report.audits;
  const c = report.categories;
  rows.push({
    run: r.name,
    perf: Math.round(c.performance.score * 100),
    a11y: Math.round(c.accessibility.score * 100),
    bp: Math.round(c['best-practices'].score * 100),
    seo: Math.round(c.seo.score * 100),
    FCP: a['first-contentful-paint'].displayValue,
    LCP: a['largest-contentful-paint'].displayValue,
    TBT: a['total-blocking-time'].displayValue,
    CLS: a['cumulative-layout-shift'].displayValue,
    SI: a['speed-index'].displayValue,
  });
}
console.table(rows);
