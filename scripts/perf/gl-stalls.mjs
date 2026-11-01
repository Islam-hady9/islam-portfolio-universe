// Attributes main-thread WebGL stalls on a cold home-page load (real GPU, fresh profile): every
// getProgramParameter call slower than 15 ms is logged with the program it belongs to (three's
// SHADER_NAME, key defines and first custom uniforms). On ANGLE/D3D11 the HLSL compile of a
// program happens lazily at its first use, so these stalls are the cold shader-compile cost.
// Usage: node scripts/perf/gl-stalls.mjs [baseUrl=http://localhost:3000] [--quality=balanced]
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000').replace(/\/$/, '');
const quality = (args.find((a) => a.startsWith('--quality=')) ?? '').slice('--quality='.length);

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  const P = WebGL2RenderingContext.prototype;
  const srcOf = new WeakMap();
  const nameOf = new WeakMap();
  const shaderSource = P.shaderSource;
  P.shaderSource = function (shader, src) {
    srcOf.set(shader, src);
    return shaderSource.call(this, shader, src);
  };
  const attachShader = P.attachShader;
  P.attachShader = function (program, shader) {
    const s = srcOf.get(shader) || '';
    if (/gl_FragColor|pc_fragColor|layout\(location/.test(s) && !nameOf.has(program)) {
      const sn = (s.match(/#define SHADER_NAME (.*)/) || [])[1] || '';
      const defs = (s.match(/#define (USE_[A-Z_]+|PHYSICAL|STANDARD)/g) || []).map((d) => d.slice(8));
      const unis = [...s.matchAll(/uniform\s+\w+\s+(u[A-Z]\w*)/g)].map((m) => m[1]).slice(0, 3);
      nameOf.set(
        program,
        [sn, defs.length ? `[${defs.join(',')}]` : '', unis.length ? `{${unis.join(',')}}` : '']
          .join(' ')
          .trim(),
      );
    }
    return attachShader.call(this, program, shader);
  };
  window.__GL_STALLS__ = [];
  const getProgramParameter = P.getProgramParameter;
  P.getProgramParameter = function (program, pname) {
    const t0 = performance.now();
    const r = getProgramParameter.call(this, program, pname);
    const dt = performance.now() - t0;
    if (dt > 15) window.__GL_STALLS__.push([Math.round(t0), Math.round(dt), nameOf.get(program) || '?']);
    return r;
  };
});
const page = await context.newPage();
await page.goto(`${base}/?intro=0${quality ? `&quality=${quality}` : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 60000 });
await page.waitForTimeout(4000);
const { stalls, tier } = await page.evaluate(() => ({
  stalls: window.__GL_STALLS__,
  tier: window.__IU__.state().tier,
}));
await browser.close();
let total = 0;
console.log(`tier ${tier}`);
for (const [t, dt, name] of stalls) {
  total += dt;
  console.log(`${String(t).padStart(6)}  ${String(dt).padStart(5)} ms  ${name}`);
}
console.log(`total stalled: ${total} ms in ${stalls.length} program first-uses`);
