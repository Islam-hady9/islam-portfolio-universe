/**
 * Provenance of the CV integration: the public PDF is the owner's file, unchanged, and every
 * link wired on the site (or kept in the registry) is a link annotation of that PDF — nothing
 * fabricated, nothing dropped. Uses only node:zlib to read the PDF's compressed object streams.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import manifest from '@/assets/resume.json';
import { content } from '@/content';
import { resumeDocument } from '@/lib/resume';

const pdfPath = join(process.cwd(), 'public', ...manifest.src.split('/').filter(Boolean));
const pdf = readFileSync(pdfPath);

/** All /URI targets in the PDF's link annotations (object streams are Flate-compressed). */
function pdfUris(bytes: Buffer): string[] {
  const latin = bytes.toString('latin1');
  const chunks: string[] = [latin];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin))) {
    const start = m.index + m[0].length;
    const end = latin.indexOf('endstream', start);
    if (end < 0) break;
    try {
      chunks.push(inflateSync(bytes.subarray(start, end)).toString('latin1'));
    } catch {
      // Not a Flate stream (fonts, images with other filters): no annotations inside.
    }
  }
  return [...new Set(chunks.flatMap((c) => [...c.matchAll(/\/URI\s*\(([^)]*)\)/g)].map((x) => x[1]!)))];
}

describe('résumé asset', () => {
  it('is the imported file, byte for byte', () => {
    expect(existsSync(pdfPath)).toBe(true);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBe(manifest.bytes);
    expect(createHash('sha256').update(pdf).digest('hex')).toBe(manifest.sha256);
  });

  it('is the single canonical document every résumé action uses', () => {
    expect(content.contact.resume.url).toBe(manifest.src);
    const doc = resumeDocument();
    expect(doc).toEqual({
      href: manifest.src,
      fileName: manifest.fileName,
      bytes: manifest.bytes,
      sizeLabel: `${Math.round(manifest.bytes / 1024)} KB`,
    });
    expect(content.verifiedLinks.source.sha256).toBe(manifest.sha256);
  });
});

describe('links extracted from the CV', () => {
  const uris = pdfUris(pdf);
  const social = content.social.map((s) => s.url).filter((u): u is string => u !== null);
  const email = content.contact.email ? [`mailto:${content.contact.email}`] : [];
  const registry = [
    ...content.verifiedLinks.repositories.map((r) => r.url),
    ...content.verifiedLinks.certificates.map((c) => c.url),
  ];

  it('reads the PDF link annotations', () => {
    expect(uris.length).toBe(18);
  });

  it('wires and registers only links that exist in the PDF', () => {
    for (const u of [...social, ...email, ...registry]) expect(uris, u).toContain(u);
  });

  it('accounts for every link in the PDF (wired on the site or kept in the registry)', () => {
    const accounted = new Set([...social, ...email, ...registry]);
    expect(uris.filter((u) => !accounted.has(u))).toEqual([]);
  });

  it('keeps every unmatched repository and certificate out of the site', () => {
    expect(content.verifiedLinks.repositories).toHaveLength(6);
    expect(content.verifiedLinks.certificates).toHaveLength(9);
    // No CV project is one of the four existing portfolio projects.
    for (const r of content.verifiedLinks.repositories) expect(r.matchedProject, r.id).toBeNull();
  });
});
