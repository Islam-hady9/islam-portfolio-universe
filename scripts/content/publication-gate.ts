/**
 * Publication gate report (spec §10, G7). Lists every content record still marked
 * "placeholder". Exits 1 when the requested mode is VERIFIED_PUBLIC (or --strict) and any
 * placeholder remains — the same rule the production build enforces.
 * Usage: npm run content:gate [-- --strict]
 */
export {}; // module scope (keeps `main` out of the global namespace for tsc)

async function main() {
  const requested = process.env.NEXT_PUBLIC_CONTENT_MODE ?? 'DEMO_CONTENT';
  const strict = process.argv.includes('--strict') || requested === 'VERIFIED_PUBLIC';
  process.env.NEXT_PUBLIC_CONTENT_MODE = 'DEMO_CONTENT'; // load fixtures without tripping the gate
  const { content } = await import('../../src/content/index');
  const { collectUnverified } = await import('../../src/content/gate');
  const pending = collectUnverified(content);
  console.log(`requested mode: ${requested}`);
  console.log(`records pending verification: ${pending.length}`);
  for (const r of pending)
    console.log(`  - ${r.path}\n      source: ${r.source}${r.note ? `\n      note:   ${r.note}` : ''}`);
  if (strict && pending.length) {
    console.error(
      '\nPublication blocked: verify or remove the records above before a VERIFIED_PUBLIC build.',
    );
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
