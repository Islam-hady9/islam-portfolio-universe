// Lighthouse runs against a running production server (npm run build && npm start).
// Usage: node scripts/perf/lighthouse.mjs [baseUrl=http://localhost:3000] [--runs=3]
// With --runs=N each profile runs N times (fresh Chrome each time); the median run by performance
// score is kept as the report and every run is printed — single cold runs are noisy.
// Writes docs/evidence/lighthouse/<name>.json (+ .html) and prints a summary table.
// Profiles:
//   mobile-static : Lighthouse mobile emulation (Moto G Power, 4x CPU, slow 4G), headless
//                   software GL → static tier (what a constrained phone without GPU gets)
//   desktop-gpu   : desktop preset, real GPU (ANGLE/D3D11) → full WebGL experience loads
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const cli = process.argv.slice(2);
const base = cli.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000';
const repeat = Math.max(1, Number((cli.find((a) => a.startsWith('--runs=')) ?? '--runs=1').slice(7)));
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
const summarise = (report) => {
  const a = report.audits;
  const c = report.categories;
  return {
    perf: Math.round(c.performance.score * 100),
    a11y: Math.round(c.accessibility.score * 100),
    bp: Math.round(c['best-practices'].score * 100),
    seo: Math.round(c.seo.score * 100),
    FCP: a['first-contentful-paint'].displayValue,
    LCP: a['largest-contentful-paint'].displayValue,
    lcpMs: a['largest-contentful-paint'].numericValue,
    TBT: a['total-blocking-time'].displayValue,
    CLS: a['cumulative-layout-shift'].displayValue,
    SI: a['speed-index'].displayValue,
  };
};
for (const r of runs) {
  const results = [];
  for (let i = 0; i < repeat; i++) {
    const path = join(
      outDir,
      repeat > 1 ? `${r.name}-run${i + 1}` /* no dots: Lighthouse strips them as an extension */ : r.name,
    );
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
    results.push({ path, ...summarise(JSON.parse(readFileSync(`${path}.report.json`, 'utf8'))) });
  }
  const sorted = [...results].sort((x, y) => x.perf - y.perf || y.lcpMs - x.lcpMs);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (repeat > 1) {
    for (const ext of ['json', 'html']) {
      copyFileSync(`${median.path}.report.${ext}`, join(outDir, `${r.name}.report.${ext}`));
    }
    for (const x of results)
      for (const ext of ['json', 'html']) rmSync(`${x.path}.report.${ext}`, { force: true });
  }
  const { path: _p, lcpMs: _l, ...shown } = median;
  rows.push({
    run: r.name,
    ...shown,
    ...(repeat > 1
      ? {
          'perf (all)': results.map((x) => x.perf).join('/'),
          'LCP (all)': results.map((x) => x.LCP).join(' / '),
          'TBT (all)': results.map((x) => x.TBT).join(' / '),
        }
      : {}),
  });
}
console.table(rows);
