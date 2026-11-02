/**
 * The canonical résumé document: the content record (contact.json → resume) joined with the
 * integrity manifest written by scripts/resume/import-resume.mjs. Every résumé action on the site
 * (hero download, /resume, contact page, home contact section) reads this, so replacing the CV is
 * `npm run resume:import -- <file>` — no component changes. Server-only (imports content).
 */
import manifest from '@/assets/resume.json';
import { getContact } from '@/content';

export interface ResumeDocument {
  /** Public URL of the PDF (served unchanged from public/). */
  href: string;
  /** Suggested file name for downloads. */
  fileName: string;
  bytes: number;
  /** "133 KB" */
  sizeLabel: string;
}

/** The owner-verified résumé, or null while none is configured (pages then explain the deferral). */
export function resumeDocument(): ResumeDocument | null {
  const { resume } = getContact();
  if (!resume.url || resume.verification.status === 'placeholder') return null;
  if (resume.url !== manifest.src) {
    throw new Error(
      `contact.json resume.url "${resume.url}" is not the imported résumé "${manifest.src}" (run npm run resume:import).`,
    );
  }
  return {
    href: manifest.src,
    fileName: manifest.fileName,
    bytes: manifest.bytes,
    sizeLabel: `${Math.round(manifest.bytes / 1024)} KB`,
  };
}
