/**
 * Prints what the portfolio assistant is allowed to know (PIE spec §5): every compiled record,
 * every rejected candidate with its reason, and the manifest version. Read-only.
 *   npm run ai:knowledge            human-readable report
 *   npm run ai:knowledge -- --json  the manifest exactly as /ai/knowledge.json serves it
 */
import { content } from '../../src/content';
import { collectCandidates, compileKnowledge } from '../../src/lib/portfolio-ai/knowledge/compiler';

const candidates = collectCandidates(content);
const { manifest, rejected } = compileKnowledge(content, candidates);

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
} else {
  const bytes = Buffer.byteLength(JSON.stringify(manifest));
  console.log(
    `Knowledge manifest ${manifest.version} — ${manifest.records.length} records, ${manifest.links.length} links, ${bytes} bytes`,
  );
  console.log(`\nCompiled (verified · public · approved):`);
  for (const r of manifest.records) console.log(`  ✓ ${r.id.padEnd(30)} ${r.sourcePath}`);
  const byReason = new Map<string, string[]>();
  for (const r of rejected) byReason.set(r.reason, [...(byReason.get(r.reason) ?? []), r.id]);
  console.log(`\nRejected (${rejected.length} of ${candidates.length} candidates):`);
  for (const [reason, ids] of byReason)
    console.log(`  ✗ ${reason.padEnd(13)} ${ids.length}: ${ids.join(', ')}`);
  console.log(`\nPending verification by collection: ${JSON.stringify(manifest.pending)}`);
  const approvals = content.aiKnowledge.verification.status;
  if (approvals === 'placeholder')
    console.log(
      `\nNote: ai-knowledge.json approvals are still "${approvals}" — the owner must confirm them before release.`,
    );
}
