import { describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config';
import { MODEL_CATALOG, MODEL_ORIGINS } from '@/lib/portfolio-ai/local/catalog';

async function csp() {
  const rules = await nextConfig.headers!();
  const header = rules[0]!.headers.find((h) => h.key === 'Content-Security-Policy')!;
  return Object.fromEntries(
    header.value.split(';').map((d) => {
      const [name, ...values] = d.trim().split(/\s+/);
      return [name!, values];
    }),
  ) as Record<string, string[]>;
}

describe('Content-Security-Policy for Local AI (PIE §9)', () => {
  it('allows WebAssembly compilation but never JavaScript eval in production', async () => {
    const policy = await csp();
    expect(policy['script-src']).toContain("'wasm-unsafe-eval'");
    if (process.env.NODE_ENV !== 'development') expect(policy['script-src']).not.toContain("'unsafe-eval'");
  });

  it('connects only to this origin and the pinned model hosts', async () => {
    const policy = await csp();
    expect(policy['connect-src']).toEqual(expect.arrayContaining(["'self'", ...MODEL_ORIGINS]));
    const allowed = (policy['connect-src'] ?? []).filter((s) => s !== "'self'" && s !== 'ws:');
    expect(allowed.sort()).toEqual([...MODEL_ORIGINS].sort());
  });

  it('covers every catalog artifact URL', async () => {
    const hosts = new Set(MODEL_ORIGINS.map((o) => o.replace('https://', '')));
    for (const m of Object.values(MODEL_CATALOG)) {
      for (const url of [m.modelUrl, m.modelLib]) {
        const host = new URL(url).host;
        expect(
          [...hosts].some((h) => (h.startsWith('*.') ? host.endsWith(h.slice(1)) : host === h)),
          url,
        ).toBe(true);
      }
    }
  });

  it('keeps framing, plugins and foreign workers blocked', async () => {
    const policy = await csp();
    expect(policy['frame-ancestors']).toEqual(["'none'"]);
    expect(policy['object-src']).toEqual(["'none'"]);
    expect(policy['worker-src']).toEqual(["'self'", 'blob:']);
  });
});
