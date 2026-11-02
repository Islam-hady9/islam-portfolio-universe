#!/usr/bin/env node
/**
 * AI Presence V1 runtime cost on the real GPU (Chromium + ANGLE/D3D11, 1440×900, DPR 1), one build:
 *  1. Idle cost of the always-on orb — /about at the static tier (no WebGL, so the orb is the only
 *     continuous animation on screen), orb shown vs. removed (display:none injected before any page
 *     script). Per 8 s window: renderer main-thread busy time, style recalculations, layer paints
 *     (CDP LayerTree.layerPainted), renderer process CPU time, and this browser's share of the GPU
 *     3D engine (Windows GPU Engine counters, own processes only).
 *  2. The 3D pause while the drawer is open — home hero at the balanced tier: WebGL GPU time per
 *     frame (one EXT_disjoint_timer_query_webgl2 query spanning the window) and the same counters,
 *     drawer closed → open → closed again.
 * Rounds interleaved, variant order alternating, a fresh browser profile per variant-round. The GPU
 * is shared with whatever else runs on the machine: other processes' 3D load is recorded per window.
 *   node scripts/qa/presence-perf.mjs [--base http://localhost:3310] [--rounds 3] [--out file.json]
 */
import { chromium } from '@playwright/test';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const base = opt('base', 'http://localhost:3310');
const rounds = Number(opt('rounds', '3'));
const out = opt('out', 'docs/ai-presence-v1/evidence/runtime-cost.json');
const WINDOW_MS = 8000;

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
};
const median = (xs) => (xs.length ? pct(xs, 0.5) : null);
const r2 = (x) => (x === null || x === undefined ? null : Math.round(x * 100) / 100);

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
const LOAD_PS =
  "$s=(Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage' -SampleInterval 2 -MaxSamples 3 -ErrorAction SilentlyContinue).CounterSamples; " +
  "$g=$s | Group-Object { ($_.InstanceName -split '_')[1] } | ForEach-Object { [pscustomobject]@{pid=[int]$_.Name; pct=[math]::Round(($_.Group | Measure-Object CookedValue -Sum).Sum / 3,2)} }; " +
  '@($g | Where-Object { $_.pct -gt 0 } | Sort-Object pct -Descending) | ConvertTo-Json -Compress';
async function gpuLoad() {
  try {
    const v = JSON.parse((await psAsync(LOAD_PS)) || '[]');
    return Array.isArray(v) ? v : [v];
  } catch {
    return [];
  }
}
function ownPids(match) {
  try {
    const txt = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${match}') } | ForEach-Object { $_.ProcessId }) | ConvertTo-Json -Compress`,
      ],
      { encoding: 'utf8' },
    ).trim();
    const v = JSON.parse(txt || '[]');
    return Array.isArray(v) ? v : [v];
  } catch {
    return [];
  }
}

/** Installed before any page script: remembers WebGL2 contexts; GPU time over a window. */
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
  window.__gpuWindow = async (ms) => {
    const gl = contexts
      .filter((c) => c.canvas.isConnected)
      .sort((x, y) => y.canvas.width * y.canvas.height - x.canvas.width * x.canvas.height)[0];
    const ext = gl?.getExtension('EXT_disjoint_timer_query_webgl2');
    const q = ext ? gl.createQuery() : null;
    let last = await nextFrame();
    if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    const t0 = last;
    let frames = 0;
    while (last - t0 < ms) {
      last = await nextFrame();
      frames++;
    }
    if (q) gl.endQuery(ext.TIME_ELAPSED_EXT);
    let gpuMs = null;
    if (q) {
      for (let i = 0; i < 300 && gpuMs === null; i++) {
        await new Promise((r) => setTimeout(r, 16));
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
          gpuMs = gl.getParameter(ext.GPU_DISJOINT_EXT)
            ? null
            : Number(gl.getQueryParameter(q, gl.QUERY_RESULT)) / 1e6;
          if (gpuMs === null) break;
        }
      }
      gl.deleteQuery(q);
    }
    return { gpuMs, wallMs: last - t0, frames, timer: Boolean(ext) };
  };
}

const hideOrb = () => {
  const s = document.createElement('style');
  s.textContent = '[data-testid="assistant-orb"]{display:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.append(s), { once: true });
};

async function open(name) {
  const profile = `.evidence-tmp/presence/perf-profile-${name}`;
  rmSync(profile, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: 'chromium',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-precise-memory-info'],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('LayerTree.enable');
  let paints = 0;
  cdp.on('LayerTree.layerPainted', () => paints++);
  const own = ownPids(profile.split('/').pop());
  const metrics = async () =>
    Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  /** One measurement window; `gpu` adds the WebGL timer query. */
  const measure = async (gpu = false) => {
    const loadP = gpuLoad();
    const m0 = await metrics();
    const p0 = paints;
    const t0 = Date.now();
    const w = gpu
      ? await page.evaluate((ms) => window.__gpuWindow(ms), WINDOW_MS)
      : await page.waitForTimeout(WINDOW_MS).then(() => null);
    const sec = (Date.now() - t0) / 1000;
    const m1 = await metrics();
    const load = await loadP;
    const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
    const per = (k) => r2(((m1[k] - m0[k]) * 1000) / sec);
    return {
      mainThreadMsPerS: per('TaskDuration'),
      scriptMsPerS: per('ScriptDuration'),
      styleMsPerS: per('RecalcStyleDuration'),
      layoutMsPerS: per('LayoutDuration'),
      rendererCpuMsPerS: per('ProcessTime'),
      styleRecalcsPerS: r2((m1.RecalcStyleCount - m0.RecalcStyleCount) / sec),
      layoutsPerS: r2((m1.LayoutCount - m0.LayoutCount) / sec),
      paintsPerS: r2((paints - p0) / sec),
      ownGpu3dPct: r2(load.filter((x) => own.includes(x.pid)).reduce((a, x) => a + x.pct, 0)),
      otherGpu3dPct: r2(load.filter((x) => !own.includes(x.pid)).reduce((a, x) => a + x.pct, 0)),
      heapMB: heap ? r2(heap / 1048576) : null,
      ...(w
        ? {
            webglGpuMsPerFrame: w.gpuMs === null ? null : r2(w.gpuMs / w.frames),
            webglGpuBusyPct: w.gpuMs === null ? null : r2((w.gpuMs / w.wallMs) * 100),
            rafFps: r2((w.frames / w.wallMs) * 1000),
          }
        : {}),
    };
  };
  const close = async () => {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  };
  return { context, page, measure, close };
}

async function idleRound(variant, round) {
  const s = await open(`idle-${variant}-${round}`);
  if (variant === 'no-orb') await s.context.addInitScript(hideOrb);
  await s.page.goto(`${base}/about?intro=0&quality=static`, { waitUntil: 'networkidle' });
  await s.page.mouse.move(4, 450);
  await s.page.waitForTimeout(3000);
  const orbShown = await s.page.evaluate(() => {
    const o = document.querySelector('[data-testid="assistant-orb"]');
    return Boolean(o && getComputedStyle(o).display !== 'none');
  });
  const m = await s.measure(false);
  await s.close();
  return { variant, round, orbShown, ...m };
}

async function drawerRound(round) {
  const s = await open(`drawer-${round}`);
  await s.context.addInitScript(benchInit);
  await s.page.goto(`${base}/?intro=0&quality=balanced`, { waitUntil: 'networkidle' });
  await s.page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 });
  await s.page.mouse.move(4, 450);
  await s.page.waitForTimeout(3000);
  const closed = await s.measure(true);
  const body = s.page.locator('[data-testid="assistant-orb"] [data-orb-body]');
  const b = await body.boundingBox();
  await s.page.mouse.click(b.x + Math.min(b.width, 1439 - b.x) / 2, b.y + b.height / 2);
  await s.page.locator('[data-ai-host="drawer"] [data-testid="ask-ai-panel"][data-smart="ready"]').waitFor({
    timeout: 20000,
  });
  await s.page.mouse.move(4, 450);
  await s.page.waitForTimeout(1500);
  const paused = await s.page.evaluate(() => window.__IU__?.state?.().assistantOpen === true);
  const openM = await s.measure(true);
  await s.page.keyboard.press('Escape');
  await s.page.getByTestId('assistant-drawer').waitFor({ state: 'hidden' });
  await s.page.waitForTimeout(3000);
  const after = await s.measure(true);
  await s.close();
  return { round, paused, closed, open: openM, after };
}

mkdirSync('.evidence-tmp/presence', { recursive: true });
const idle = [];
const drawer = [];
for (let r = 1; r <= rounds; r++) {
  for (const v of r % 2 ? ['orb', 'no-orb'] : ['no-orb', 'orb']) {
    const row = await idleRound(v, r);
    idle.push(row);
    console.log(JSON.stringify(row));
  }
  const row = await drawerRound(r);
  drawer.push(row);
  console.log(JSON.stringify(row));
}

const keys = [
  'mainThreadMsPerS',
  'styleMsPerS',
  'rendererCpuMsPerS',
  'styleRecalcsPerS',
  'paintsPerS',
  'ownGpu3dPct',
  'otherGpu3dPct',
];
const summarise = (rows, ks) => Object.fromEntries(ks.map((k) => [k, r2(median(rows.map((x) => x[k])))]));
const gpuKeys = [...keys, 'webglGpuMsPerFrame', 'webglGpuBusyPct', 'rafFps', 'heapMB'];
const summary = {
  idle: {
    orb: summarise(
      idle.filter((x) => x.variant === 'orb'),
      keys,
    ),
    noOrb: summarise(
      idle.filter((x) => x.variant === 'no-orb'),
      keys,
    ),
  },
  drawer: {
    closed: summarise(
      drawer.map((x) => x.closed),
      gpuKeys,
    ),
    open: summarise(
      drawer.map((x) => x.open),
      gpuKeys,
    ),
    after: summarise(
      drawer.map((x) => x.after),
      gpuKeys,
    ),
  },
};
const result = {
  generatedAt: new Date().toISOString(),
  base,
  rounds,
  windowMs: WINDOW_MS,
  method:
    'Chromium (Playwright) + ANGLE/D3D11, headless, 1440x900, DPR 1, fresh profile per variant-round, interleaved. Medians of rounds.',
  summary,
  idle,
  drawer,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 1));
