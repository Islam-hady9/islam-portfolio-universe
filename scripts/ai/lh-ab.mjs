#!/usr/bin/env node
/**
 * Interleaved Lighthouse A/B (PIE spec §12: same machine, ≥ 3 runs per condition, alternating
 * order). Runs scripts/perf/lighthouse.mjs once per variant per round and summarises LCP, FCP,
 * TBT, CLS, performance score and JavaScript transfer for the home page.
 *   node scripts/ai/lh-ab.mjs --a http://localhost:3320 --b http://localhost:3310 [--rounds 3]
 *     [--dir .evidence-tmp/ai/lh] [--json docs/portfolio-intelligence-engine/evidence/lighthouse-ab.json]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const variants = { baseline: opt('a', 'http://localhost:3320'), feature: opt('b', 'http://localhost:3310') };
const rounds = Number(opt('rounds', '3'));
const profiles = (opt('only', 'mobile-static-home,desktop-gpu-home') ?? '').split(',');
const root = opt('dir', '.evidence-tmp/ai/lh');
const jsonOut = opt('json', 'docs/portfolio-intelligence-engine/evidence/lighthouse-ab.json');

const metrics = (file) => {
  const r = JSON.parse(readFileSync(file, 'utf8'));
  const a = r.audits;
  const scripts = a['resource-summary']?.details?.items?.find((i) => i.resourceType === 'script');
  return {
    perf: Math.round(r.categories.performance.score * 100),
    fcpMs: Math.round(a['first-contentful-paint'].numericValue),
    lcpMs: Math.round(a['largest-contentful-paint'].numericValue),
    tbtMs: Math.round(a['total-blocking-time'].numericValue),
    cls: Number(a['cumulative-layout-shift'].numericValue.toFixed(3)),
    scriptKB: scripts ? Math.round(scripts.transferSize / 1024) : null,
    totalKB: Math.round(a['total-byte-weight'].numericValue / 1024),
  };
};

const runs = [];
for (let i = 1; i <= rounds; i++) {
  const order = i % 2 ? Object.entries(variants) : Object.entries(variants).reverse();
  for (const [name, base] of order) {
    const out = join(root, `${name}-${i}`);
    mkdirSync(out, { recursive: true });
    execFileSync(
      process.execPath,
      ['scripts/perf/lighthouse.mjs', base, `--only=${profiles.join(',')}`, `--out=${out}`],
      {
        stdio: 'inherit',
      },
    );
    for (const p of profiles)
      runs.push({ round: i, variant: name, profile: p, ...metrics(join(out, `${p}.report.json`)) });
  }
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const summary = {};
for (const p of profiles) {
  summary[p] = {};
  for (const name of Object.keys(variants)) {
    const rs = runs.filter((r) => r.profile === p && r.variant === name);
    summary[p][name] = Object.fromEntries(
      ['perf', 'fcpMs', 'lcpMs', 'tbtMs', 'cls', 'scriptKB', 'totalKB'].map((k) => [
        k,
        median(rs.map((r) => r[k])),
      ]),
    );
    summary[p][name].lcpAll = rs.map((r) => r.lcpMs);
  }
}
console.log(JSON.stringify(summary, null, 2));
mkdirSync(dirname(jsonOut), { recursive: true });
writeFileSync(
  jsonOut,
  `${JSON.stringify({ date: new Date().toISOString(), variants, rounds, runs, summary }, null, 2)}\n`,
);
