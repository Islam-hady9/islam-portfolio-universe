# Knowledge policy — what the assistant may state as fact

PIE spec §5. Implemented in `src/lib/portfolio-ai/knowledge/compiler.ts`, approvals in `src/content/data/ai-knowledge.json`, report with `npm run ai:knowledge`.

## Rule

A record reaches the assistant only if **all three** hold:

1. `verification === 'verified'` — its content record is `owner_verified` or `public_verified` (placeholders never qualify);
2. `visibility === 'public'` — it is already published on the site (the unrendered registry in `verified-links.json` is private by definition);
3. `approvedForAi === true` — its source key is explicitly approved in `ai-knowledge.json`.

Approval is **default-deny** and separate from verification: an exact key (`contact.email`) wins over a collection wildcard (`project.*`); a key that is not listed is denied. The compiler additionally rejects a candidate whose text contains a phone number or credential (`pii`), instruction-like or markup text (`unsafe-text` — e.g. "ignore previous instructions", `<script`, `javascript:`), or whose link is not in the allowlist (`invalid-url`). Rejected text is never written to the manifest.

There is no full-repository ingestion: every candidate is produced by an explicit extractor over the zod-validated `content` object. Nothing reads the filesystem, the CV PDF, the reel transcript or source code.

## Current corpus (manifest `k…`, 16 records, ~10 KB)

| Record | Source (verbatim) | Why it is allowed |
|---|---|---|
| `profile-role` | `site.json` SEO title + proposition | owner_verified, public, approved |
| `profile-statement` | `site.json` hero statement | owner_verified, public, approved |
| `profile-identity` | `site.json` identity statement | owner_verified, public, approved |
| `profile-portfolio` | `home.json` universe title + description | owner_verified, public, approved |
| `profile-capabilities-heading` | `home.json` capabilities title only | heading is verified; the capability details are placeholders |
| `profile-journey-heading` | `home.json` experience title + subtitle only | heading is verified; journey entries are samples |
| `contact-invitation` | `home.json` contact title + body | owner_verified |
| `contact-email`, `contact-linkedin`, `contact-github` | `contact.json` / `social.json` | owner_verified links from the owner's CV annotations |
| `contact-resume` | **availability only** ("can be viewed or downloaded from the Résumé page") | the PDF is a document, never a content source |
| `media-reel` | **existence only** (duration, where to play it) | the transcript and on-screen claims await sign-off |
| `faq-assistant-modes`, `-privacy`, `-sources` | facts about the assistant itself | enforced by tests (`tests/unit/portfolio-ai`, `tests/e2e/ask-ai.spec.ts`) |
| `site-content-status` | computed from verification statuses | lets the assistant say honestly what is still pending |

## Excluded (43 candidates rejected on the current content)

| Reason | Candidates |
|---|---|
| `not-verified` (26) | 4 project summaries, 4 case studies, 4 capability groups, 8 journey entries, 5 principles, the reel transcript |
| `not-public` (16) | the phone number, 6 CV repositories, 9 CV certificates (`verified-links.json`) |

Placeholders are not "hidden but usable": they are not in the manifest at all, and a unit test asserts that no placeholder summary, tagline, capability description or journey summary appears anywhere in the shipped JSON, and that no 8-word fragment of rejected text is ever reproduced in an answer (golden-set check).

Project **names** appear only as navigation link labels with `pendingDetails: true` (e.g. "TIBYN has a page on this site, but its details haven't been verified yet"). They are page titles, not claims about the work.

## The temporary CV

The PDF stays a downloadable document. The assistant can say that a résumé exists and where to get it; it never quotes, summarizes or "knows" its contents, and it is not described as trained on it. The CV's repositories, certificates and phone number stay in the private registry.

## Manifest

`/ai/knowledge.json` — a `force-static` route compiled at build time from the content (`src/app/ai/knowledge.json/route.ts`). Versioned by a SHA-256 over records + links + pending counts (`k` + 12 hex), records carry an 8-hex content hash, text is chunked deterministically on sentence boundaries (≤ 480 chars; current records are single chunks), duplicates across sections are dropped. The page renders only the version string; the panel fetches the JSON lazily and **re-validates it** in the browser (`parseManifest`: eligibility flags, safe hrefs, allowlisted record links, no duplicates). Content changes produce a new version; no model retraining exists or is needed.

## Owner actions

1. Review `src/content/data/ai-knowledge.json` and set its `verification.status` to `owner_verified` (it is `placeholder`, so the publication gate counts it: 40 → 41 pending).
2. When project, capability, journey or principle records become verified, add exact approvals (e.g. `{"source": "project.tibyn", "approvedForAi": true}`) — the assistant then quotes them with citations; no code change.
3. The reel transcript can be approved with `media.transcript` once its wording is confirmed.
