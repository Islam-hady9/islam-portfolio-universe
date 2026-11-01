/**
 * Validates every content file against the zod contracts and cross-references.
 * Usage: npm run content:validate
 */
export {}; // module scope (keeps `main` out of the global namespace for tsc)

async function main() {
  // Validate in a non-publishing mode so a VERIFIED_PUBLIC env does not mask schema errors.
  process.env.NEXT_PUBLIC_CONTENT_MODE = 'DEMO_CONTENT';
  const mod = await import('../../src/content/index');
  const problems = mod.validateReferences();
  const c = mod.content;
  console.log(
    `content OK: ${c.projects.length} projects, ${c.caseStudies.length} case studies, ` +
      `${c.career.entries.length} career entries, ${c.capabilities.length} capability groups, ` +
      `${c.assistant.entries.length} assistant entries`,
  );
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
