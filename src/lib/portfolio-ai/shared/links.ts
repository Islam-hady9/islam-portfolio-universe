/**
 * Link allowlist (PIE spec §5, §10). An answer may only point to targets in the manifest's link
 * list: internal routes, verified public profiles and the verified mailto. Generated text is
 * never rendered as HTML or markdown, so a URL the model invents is removed, not linkified.
 * Pure functions: shared by the compiler, Smart Mode and the Local AI verifier.
 */
import type { LinkTarget } from './types';

/** Comparable form of an href: case-folded scheme/host, no "www.", no trailing slash. */
export function canonicalHref(href: string): string {
  const raw = href.trim().replace(/[.,;:!?)\]}>"'»]+$/u, '');
  if (/^mailto:/i.test(raw)) return `mailto:${raw.slice(7).toLowerCase()}`;
  if (raw.startsWith('/')) return raw.replace(/(.)\/+(?=$|#)/, '$1');
  try {
    const url = new URL(/^www\./i.test(raw) ? `https://${raw}` : raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return raw;
    const host = url.host.toLowerCase().replace(/^www\./, '');
    return `https://${host}${url.pathname.replace(/\/+$/, '')}${url.search}${url.hash}`;
  } catch {
    return raw;
  }
}

/** True only for an href present in the allowlist. */
export function isAllowedHref(href: string, links: readonly LinkTarget[]): boolean {
  const wanted = canonicalHref(href);
  return links.some((l) => canonicalHref(l.href) === wanted);
}

/** Absolute URLs, www-hosts, mailto links and bare email addresses found in free text. */
const URL_LIKE =
  /\b(?:https?:\/\/|www\.)[^\s<>"'`]+|\bmailto:[^\s<>"'`]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export interface FoundUrl {
  text: string;
  index: number;
  allowed: boolean;
}

export function findUrls(text: string, links: readonly LinkTarget[]): FoundUrl[] {
  const out: FoundUrl[] = [];
  for (const m of text.matchAll(URL_LIKE)) {
    const value = m[0].replace(/[.,;:!?)\]}>"'»]+$/u, '');
    const href = /^[^:/]+@/.test(value) ? `mailto:${value}` : value;
    out.push({ text: value, index: m.index ?? 0, allowed: isAllowedHref(href, links) });
  }
  return out;
}

/** Replaces every non-allowlisted URL/email in `text`; returns the cleaned text and what was removed. */
export function stripDisallowedUrls(
  text: string,
  links: readonly LinkTarget[],
  replacement = '[link removed]',
): { text: string; removed: string[] } {
  const removed: string[] = [];
  const cleaned = text.replace(URL_LIKE, (match) => {
    const value = match.replace(/[.,;:!?)\]}>"'»]+$/u, '');
    const tail = match.slice(value.length);
    const href = /^[^:/]+@/.test(value) ? `mailto:${value}` : value;
    if (isAllowedHref(href, links)) return match;
    removed.push(value);
    return replacement + tail;
  });
  return { text: cleaned, removed };
}
