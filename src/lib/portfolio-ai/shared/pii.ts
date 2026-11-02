/**
 * Private-data detectors (PIE spec §5 exclusions, §10 post-generation check). The corpus never
 * contains a phone number, so any phone-like number in an answer is invented and must not ship.
 * Year ranges ("2019 – 2023") and short numbers are not phones.
 */
const PHONE_CANDIDATE = /(?<![\w/-])(?:\+|\b00)?\d[\d\s().\-–]{6,}\d(?![\w/])/g;
const YEAR_RANGE = /^\d{4}\s*[-–]\s*\d{4}$/;
/** Profile URLs carry numeric ids ("…/in/name-323523211"): they are links, not phone numbers. */
const URL_OR_EMAIL = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+|\bmailto:[^\s<>"'`]+|[\w.%+-]+@[\w.-]+\.[a-z]{2,}/gi;

export function findPhoneNumbers(text: string): string[] {
  const out: string[] = [];
  for (const m of text.replace(URL_OR_EMAIL, ' ').matchAll(PHONE_CANDIDATE)) {
    const value = m[0].trim();
    if (YEAR_RANGE.test(value)) continue;
    const digits = value.replace(/\D/g, '').length;
    if (digits >= 9 && digits <= 15) out.push(value);
  }
  return out;
}

/** Credential-shaped strings that must never appear in the corpus or an answer. */
const SECRET =
  /\b(?:sk|pk|rk|ghp|gho|github_pat|xox[abpr]|AKIA)[-_A-Za-z0-9]{12,}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/;

export function containsSecret(text: string): boolean {
  return SECRET.test(text);
}

export function containsPrivateData(text: string): boolean {
  return findPhoneNumbers(text).length > 0 || containsSecret(text);
}
