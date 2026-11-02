#!/usr/bin/env node
/**
 * Cinematic Fidelity V3 performance A/B: the pre-V3 build (baseline) against the V3 build
 * (feature) on the same machine, real GPU (Chromium + ANGLE/D3D11), pinned tier (no governor),
 * rounds interleaved with alternating order. Per scenario: settle, then an 8 s window measured
 * two ways — GPU time per frame from one EXT_disjoint_timer_query_webgl2 TIME_ELAPSED query
 * spanning the window (the cost metric: precise, independent of the compositor's tick), and
 * presented-frame intervals from requestAnimationFrame (headless ticks at up to 240 Hz, so FPS
 * is quantised; its p95/p99/max show hitches). Plus the renderer's resource counts and the JS
 * heap. Per variant-round: GPU process memory of this browser and the 3D-engine load of other
 * processes on the shared GPU (context for every number).
 *   node scripts/qa/fidelity-bench.mjs --a http://localhost:3320 --b http://localhost:3310 \
 *     [--rounds 3] [--tier balanced] [--out docs/cinematic-fidelity-v3/evidence/perf-ab-balanced.json]
 */
import { chromium } from '@playwright/test';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const variants = { baseline: opt('a', 'http://localhost:3320'), feature: opt('b', 'http://localhost:3310') };
const rounds = Number(opt('rounds', '3'));
const tier = opt('tier', 'balanced');
const out = opt('out', `docs/cinematic-fidelity-v3/evidence/perf-ab-${tier}.json`);
const SLUGS = ['tibyn', 'movid', 'ats-matching', 'lifeatlas'];
const RECORD_MS = 8000;

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
};
const median = (xs) => pct(xs, 0.5);
const round1 = (x) => Math.round(x * 10) / 10;

function ps(script) {
  try {
    return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}
function psAsync(script) {
  return new Promise((done) =>
    execFile(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { encoding: 'utf8' },
      (err, stdout) => done(err ? '' : String(stdout).trim()),
    ),
  );
}
/**
 * 3D-engine load per process (mean of three samples, 2 s apart), sampled in parallel with a
 * measurement window so it costs no benchmark time. Context only: the GPU is shared.
 */
const LOAD_PS =
  "$s=(Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage' -SampleInterval 2 -MaxSamples 3 -ErrorAction SilentlyContinue).CounterSamples; " +
  "$g=$s | Group-Object { ($_.InstanceName -split '_')[1] } | ForEach-Object { [pscustomobject]@{pid=[int]$_.Name; pct=[math]::Round(($_.Group | Measure-Object CookedValue -Sum).Sum / 3,1)} }; " +
  '@($g | Where-Object { $_.pct -gt 0.5 } | Sort-Object pct -Descending) | ConvertTo-Json -Compress';
async function gpuLoadAsync() {
  const txt = await psAsync(LOAD_PS);
  try {
    const v = JSON.parse(txt || '[]');
    return Array.isArray(v) ? v : [v];
  } catch {
    return [];
  }
}
/** Process ids of this benchmark's own browser (its profile directory is on the command line). */
function ownPids(match) {
  try {
    const v = JSON.parse(
      ps(
        `@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${match}') } | ForEach-Object { $_.ProcessId }) | ConvertTo-Json -Compress`,
      ) || '[]',
    );
    return Array.isArray(v) ? v : [v];
  } catch {
    return [];
  }
}
function gpuMem(match) {
  try {
    return JSON.parse(ps(`& '${resolve('scripts/ai/gpu-mem.ps1')}' -Match '${match}'`) || 'null');
  } catch {
    return null;
  }
}

/** Installed before any page script: remembers every WebGL2 context, exposes a measurement window. */
function benchInit() {
  const contexts = [];
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const ctx = getContext.call(this, type, attrs);
    if (ctx && type === 'webgl2' && !contexts.includes(ctx)) contexts.push(ctx);
    return ctx;
  };
  const raf = window.requestAnimationFrame.bind(window);
  const nextFrame = () => new Promise((r) => raf(r));
  window.__benchWindow = async (ms) => {
    const gl = contexts
      .filter((c) => c.canvas.isConnected)
      .sort((x, y) => y.canvas.width * y.canvas.height - x.canvas.width * x.canvas.height)[0];
    const ext = gl?.getExtension('EXT_disjoint_timer_query_webgl2');
    const q = ext ? gl.createQuery() : null;
    let last = await nextFrame();
    if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    const t0 = last;
    const intervals = [];
    while (last - t0 < ms) {
      const t = await nextFrame();
      intervals.push(t - last);
      last = t;
    }
    if (q) gl.endQuery(ext.TIME_ELAPSED_EXT);
    const wallMs = last - t0;
    let gpuMs = null;
    let disjoint = null;
    if (q) {
      for (let i = 0; i < 300 && gpuMs === null; i++) {
        await new Promise((r) => setTimeout(r, 16));
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
          disjoint = Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT));
          gpuMs = Number(gl.getQueryParameter(q, gl.QUERY_RESULT)) / 1e6;
        }
      }
      gl.deleteQuery(q);
    }
    return { intervals, wallMs, gpuMs, disjoint, timer: Boolean(ext) };
  };
}

async function record(page) {
  const w = await page.evaluate((ms) => window.__benchWindow(ms), RECORD_MS);
  const diag = await page.evaluate(() => {
    const f = window.__IU__?.frame?.() ?? {};
    const mem = performance.memory?.usedJSHeapSize ?? null;
    return {
      drawCalls: f.drawCalls,
      triangles: f.triangles,
      points: f.points,
      programs: f.programs,
      geometries: f.geometries,
      textures: f.textures,
      heapMB: mem ? Math.round(mem / 1048576) : null,
      tier: window.__IU__?.state?.().tier,
    };
  });
  const frames = w.intervals;
  return {
    gpuMsPerFrame: w.gpuMs === null ? null : Math.round((w.gpuMs / frames.length) * 100) / 100,
    gpuBusyPct: w.gpuMs === null ? null : round1((w.gpuMs / w.wallMs) * 100),
    disjoint: w.disjoint,
    fps: round1((frames.length / w.wallMs) * 1000),
    p95Ms: round1(pct(frames, 0.95)),
    p99Ms: round1(pct(frames, 0.99)),
    maxMs: round1(Math.max(...frames)),
    over33: frames.filter((x) => x > 33.4).length,
    frames: frames.length,
    ...diag,
  };
}

const centre = (page, id) =>
  page.evaluate((sid) => {
    const el = document.getElementById(sid);
    if (!el) return;
    const r = el.getBoundingClientRect();
    window.scrollTo({
      top: sid === 'top' ? 0 : Math.max(0, r.top + window.scrollY + r.height / 2 - window.innerHeight / 2),
      behavior: 'instant',
    });
  }, id);

async function runVariant(name, base, roundNo) {
  const profile = `.evidence-tmp/v3/bench-profile-${name}-${tier}-${roundNo}`;
  rmSync(profile, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: 'chromium',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-precise-memory-info'],
  });
  await context.addInitScript(benchInit);
  const page = context.pages()[0] ?? (await context.newPage());
  const own = ownPids(profile.split('/').pop());
  const measure = async () => {
    const loadP = gpuLoadAsync();
    const m = await record(page);
    const load = await loadP;
    const other = load.filter((x) => !own.includes(x.pid));
    return {
      ...m,
      otherGpuPct: round1(other.reduce((acc, x) => acc + x.pct, 0)),
      topOther: other.slice(0, 2),
    };
  };
  const url = (path) => `${base}${path}?intro=0&quality=${tier}`;
  const scenarios = {};
  await page.goto(url('/'), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  for (const id of ['top', 'ask-ai']) {
    await centre(page, id);
    await page.waitForTimeout(4000);
    scenarios[id] = await measure();
  }
  // Live project worlds: hover each card (one world renders into its card).
  await centre(page, 'projects');
  await page.waitForTimeout(3000);
  for (const slug of SLUGS) {
    await page.locator(`[data-project-card="${slug}"]`).hover({ position: { x: 160, y: 120 } });
    await page.waitForTimeout(2500);
    scenarios[`card-${slug}`] = await measure();
  }
  await page.mouse.move(4, 450);
  for (const slug of ['movid', 'tibyn']) {
    await page.goto(url(`/projects/${slug}`), { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);
    scenarios[`case-${slug}`] = await measure();
  }
  const mem = gpuMem(profile.split('/').pop());
  await context.close();
  rmSync(profile, { recursive: true, force: true });
  return { variant: name, round: roundNo, gpuMemory: mem, scenarios };
}

const runs = [];
for (let i = 1; i <= rounds; i++) {
  const order = i % 2 ? Object.entries(variants) : Object.entries(variants).reverse();
  for (const [name, base] of order) {
    const r = await runVariant(name, base, i);
    runs.push(r);
    console.log(
      `${name} r${i}: ${Object.entries(r.scenarios)
        .map(([k, v]) => `${k} gpu ${v.gpuMsPerFrame}ms/f ${v.fps}fps p99 ${v.p99Ms}ms`)
        .join(' | ')}`,
    );
  }
}
const summary = {};
for (const key of Object.keys(runs[0].scenarios)) {
  summary[key] = {};
  for (const name of Object.keys(variants)) {
    const rs = runs.filter((r) => r.variant === name).map((r) => r.scenarios[key]);
    // Clean windows: no GPU disjoint event and other processes below 15 % of the 3D engine.
    const clean = rs.filter((r) => r.gpuMsPerFrame !== null && !r.disjoint && r.otherGpuPct < 15);
    const pick = clean.length >= 2 ? clean : rs.filter((r) => r.gpuMsPerFrame !== null && !r.disjoint);
    summary[key][name] = {
      gpuMsPerFrame: median(pick.map((r) => r.gpuMsPerFrame)),
      cleanWindows: clean.length,
      gpuMsAll: rs.map((r) => r.gpuMsPerFrame),
      otherGpuPctAll: rs.map((r) => r.otherGpuPct),
      disjoint: rs.some((r) => r.disjoint),
      fps: median(rs.map((r) => r.fps)),
      fpsAll: rs.map((r) => r.fps),
      p95Ms: median(rs.map((r) => r.p95Ms)),
      p99Ms: median(rs.map((r) => r.p99Ms)),
      maxMs: median(rs.map((r) => r.maxMs)),
      drawCalls: rs[0].drawCalls,
      triangles: rs[0].triangles,
      programs: rs[0].programs,
      geometries: rs[0].geometries,
      textures: rs[0].textures,
      heapMB: median(rs.map((r) => r.heapMB ?? 0)),
    };
  }
  const a = summary[key].baseline;
  const b = summary[key].feature;
  summary[key].gpuDeltaPct = round1(((b.gpuMsPerFrame - a.gpuMsPerFrame) / a.gpuMsPerFrame) * 100);
  summary[key].fpsDeltaPct = round1(((b.fps - a.fps) / a.fps) * 100);
}
const gpuMemory = Object.fromEntries(
  Object.keys(variants).map((name) => [name, runs.filter((r) => r.variant === name).map((r) => r.gpuMemory)]),
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `${JSON.stringify({ date: new Date().toISOString(), tier, rounds, variants, summary, gpuMemory, runs }, null, 2)}\n`,
);
console.log(JSON.stringify(summary, null, 1));
