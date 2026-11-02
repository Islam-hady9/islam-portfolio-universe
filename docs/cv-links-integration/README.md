# Temporary CV & Verified Links Integration

Branch `feat/intelligence-universe`, 2026-11-02. Not pushed, merged or deployed. **Content freeze held**: the CV is an attached document and the source of links only — no CV text, dates, metrics, skills or projects entered the site.

## 1. The document

| | |
|---|---|
| Source | Owner-supplied `Islam_Abdelhady_CV.pdf` (4 pages, PDF 1.5, pdfTeX/hyperref, 18 link annotations) |
| Public file | `public/resume/Islam_Abdelhady_CV.pdf` → **`/resume/Islam_Abdelhady_CV.pdf`** |
| Size | 136,585 bytes |
| SHA-256 (source = copy = served = downloaded) | `244673cb86f56ec7a58c36b81e7ed6ee89d84d22f48554ff7eac05d43b7689d8` |
| Import | `npm run resume:import -- <file>` (`scripts/resume/import-resume.mjs`): plain byte copy, checksum verified before/after, writes `src/assets/resume.json`. No parsing, re-saving, compression or metadata change. `*.pdf binary` added to `.gitattributes` so git can never normalise its line endings. |

Behaviour (one canonical document, read by every action through `src/lib/resume.ts`):

| Control | Action |
|---|---|
| Hero **Download CV** | Downloads the PDF (`download="Islam_Abdelhady_CV.pdf"`); visible label unchanged, "Soon" badge removed, announced as "Download CV (PDF, 133 KB)" |
| `/resume` | Existing page, existing "available" copy: **Download resume** (download) + **View resume** (opens the PDF in the browser's own viewer, new tab, `noopener noreferrer`) |
| `/contact` → Resume channel | "PDF · 133 KB" with **View resume** + **Download** (replaces "Resume status · Soon") |
| Home contact section **Resume** ("Soon" badge removed), mobile menu **Resume** (unchanged) | Lead to `/resume` |

Why no embedded viewer: the site's security headers forbid framing for every response (`X-Frame-Options: DENY`, `frame-ancestors 'none'`, `object-src 'none'`). Loosening them, or adding a PDF rendering library, is not justified when the browsers' own viewers work: verified in Chromium (PDF viewer, 4 pages) and Firefox (pdf.js) with the production headers. `Cache-Control: public, max-age=0` means a replaced CV is never served stale.

## 2. Links

| Link | Wired to | Verification |
|---|---|---|
| LinkedIn `https://linkedin.com/in/islam-abd-elhady-323523211` | `social.json` → home contact section, `/contact`, footer icon (every page), JSON-LD `sameAs` | `owner_verified`, CV p.1 link annotation |
| GitHub `https://github.com/Islam-hady9` (unchanged URL) | same places (was already linked, flagged "pending confirmation") | `owner_verified`, CV p.1 (also the repo's git remote) |
| Email `mailto:eslamabdo71239@gmail.com` | `contact.json` → `/contact` Email channel | `owner_verified`, CV p.1 |
| Phone `+20 1066463355` / `tel:+201066463355` | **Not published** — `verified-links.json`, `publicDisplay: false` | `owner_verified`, CV p.1 header text |

External links keep the site's existing safe pattern (`target="_blank" rel="noopener noreferrer"`, "(opens in a new tab)" in the accessible name; icon-only footer links carry `aria-label`). No new buttons, no layout change.

## 3. Deferred (kept, not rendered) — `src/content/data/verified-links.json`

None of the CV's projects is one of the four portfolio projects (TIBYN, MOViD Studio, ATS Matching, LifeAtlas), so **no repository was attached to an existing project** (`matchedProject: null`). The site has no certificate records, so none were wired.

- **Repositories (6)**: DataOps LLM Engine · Eyes Mate: AI Assistant for the Visually Impaired · Brain Tumor Detection API · Generative AI Models · SmartAI Customer Support · Deep CUDA: GPU Acceleration from Scratch — exact `github.com/Islam-hady9/…` URLs.
- **Certificates (9)**: titles, issuers and dates exactly as printed, with their exact Google Drive URLs (including the two that carry `?usp=drive_link` / `?usp=drivesdk`).
- **Phone** (above).

The registry is zod-validated (`verifiedLinksSchema`), part of the content tree (so the gate sees it) but imported by no component. Extraction: PyMuPDF and pypdf (scratch environment, not a project dependency) and a raw zlib inflate — all three agree on the 18 URIs. A unit test re-inflates the committed PDF with `node:zlib` and proves every wired or registered link is in the PDF and every PDF link is accounted for.

## 4. Content preservation (evidence)

- **Data files**: 12 of 14 content files byte-identical to before (`assistant`, `attributions`, `capabilities`, `career`, `case-studies`, `home`, `media`, `philosophy`, `profile-extras`, `projects`, `site`, `universe`). Changed: `contact.json` (email, resume URL, two verification blocks), `social.json` (LinkedIn URL, two verification blocks). New: `verified-links.json`.
- **Rendered pages**: `node scripts/qa/content-snapshot.mjs` captured header/main/footer text, links and images of all 9 routes before and after (`--diff`). 53 changed lines, all link wiring or résumé labels: "Soon"/"Pending review"/"pending owner confirmation" notices removed; LinkedIn, email and PDF links added; `/resume` switched to its existing available state; `/about` "Records pending verification" 44 → 40 (four records became verified). No hero, identity, about prose, timeline, project, case-study, capability, philosophy, assistant or media text changed. Hero pixel baseline: the only changed pixels are the removed "SOON" badge and the shift of the next button (baseline refreshed).
- No media, 3D, motion, palette or layout files were touched.

## 5. Tests

| Suite | Result |
|---|---|
| Unit + component | **536 passed / 31 files** (+9): byte-for-byte asset + manifest, single canonical document, PDF-annotation provenance (nothing fabricated, nothing dropped), registry rules (no cross-assigned repositories), phone never in rendered content, GitHub rule now accepts owner-verified; SocialAction keeps all three states via synthetic fixtures |
| E2E (production build) | **116 passed, 3 skipped (by design), 0 failed — two consecutive full runs**; new `resume.spec.ts` in Chromium desktop + mobile, Firefox, WebKit (×3: 72/72): hero download checksum = original, PDF served as-is, `/resume` download + view (new tab; headless engines save it — checksum verified), contact channels, footer + home links with safe attributes, no phone on any route. Updated honesty crawl: `tel:` forbidden, `mailto:` only the verified address, external links only the verified profiles; axe on all routes unchanged (0 serious/critical) |
| Real GPU (3D smoke) | 4/4 (real 3D + stations, universe nodes, portals, reel pause) |
| Static | typecheck, ESLint, Prettier clean; `content:validate` OK; `content:gate` 40 pending |

## 6. Performance

Home initial JS 638.5 KB raw (+0.2 KB, the download branch in `ButtonLink`), 199.8 KB gzip (unchanged); HTML +0.1 KB gzip (home) / +0.3 KB (about, contact links); render-blocking CSS unchanged (3 files). The PDF is fetched only on click. No change measured worth a Lighthouse re-run.

## 7. Notes for the owner

1. **The PDF prints your phone number** (and email); publishing it as the downloadable CV makes the number public even though the site itself never shows it. Replace the PDF if that is not intended.
2. The demo assistant's contact answer still says "Direct contact details will be published after the final profile review." — AI-twin text was frozen in this task; update it in `assistant.json` during content population.
3. CV ↔ site discrepancies were not reconciled (by instruction): e.g. the CV's titles "AI/ML Engineer | LLM Engineer | MLOps Engineer" vs the site's "AI Full-Stack Engineer"; the CV's experience, skills, projects, education and certificates are not on the site.
4. Replacing the temporary CV: `npm run resume:import -- <new.pdf>` → re-run `npm test` (checksum/provenance tests then check the new file and its links) → commit. If its links change, update `social.json`/`contact.json`/`verified-links.json`.
5. `/favicon.ico` is not shipped (the site uses `icon.svg`); browsers show no tab icon on the raw PDF.
