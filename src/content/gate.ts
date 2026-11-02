/**
 * Publication gate (spec §10.1 / G7). Walks every content record that carries a
 * `verification` block and reports those not yet verified. A VERIFIED_PUBLIC build
 * must have zero placeholders; DEMO_CONTENT and OWNER_REVIEW builds are allowed to.
 */
import type { ContentMode, Verification } from './schema';

export interface UnverifiedRecord {
  path: string;
  status: Verification['status'];
  source: string;
  note?: string;
}

function isVerification(value: unknown): value is Verification {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'source' in value &&
    typeof (value as Verification).status === 'string'
  );
}

/** Depth-first walk collecting `verification` blocks whose status is "placeholder". */
export function collectUnverified(root: unknown, path = 'content'): UnverifiedRecord[] {
  const out: UnverifiedRecord[] = [];
  const visit = (node: unknown, p: string) => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => {
        const id =
          typeof child === 'object' && child !== null && 'id' in child
            ? String((child as { id: unknown }).id)
            : typeof child === 'object' && child !== null && 'slug' in child
              ? String((child as { slug: unknown }).slug)
              : String(i);
        visit(child, `${p}[${id}]`);
      });
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'verification' && isVerification(value)) {
        if (value.status === 'placeholder') {
          out.push({ path: p, status: value.status, source: value.source, note: value.note });
        }
        continue;
      }
      visit(value, `${p}.${key}`);
    }
  };
  visit(root, path);
  return out;
}

export class PublicationGateError extends Error {
  constructor(public readonly records: UnverifiedRecord[]) {
    super(
      `VERIFIED_PUBLIC build blocked: ${records.length} placeholder record(s) remain.\n` +
        records.map((r) => `  - ${r.path} (${r.source})`).join('\n'),
    );
    this.name = 'PublicationGateError';
  }
}

export function assertPublishable(mode: ContentMode, root: unknown): void {
  if (mode !== 'VERIFIED_PUBLIC') return;
  const pending = collectUnverified(root);
  if (pending.length > 0) throw new PublicationGateError(pending);
}
