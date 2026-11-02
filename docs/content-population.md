# G7 — Content Population Guide (CV phase)

Spec §10.3. The site is engineered so verified content replaces the fixtures **without touching UI, motion or 3D code**. This guide is the handoff for that phase.

## Where content lives

All content is JSON in `src/content/data/`, validated by zod (`src/content/schema.ts`) at build time and by `npm test`.

| File | Contract | Current state |
|---|---|---|
| `site.json` | `SiteIdentity` — name, role, hero copy, identity statement, pillars, SEO | Brand copy verbatim from the brief (`owner_verified`); pillar descriptions `placeholder` |
| `home.json` | `HomeCopy` — section eyebrows/titles/descriptions | From the brief (`owner_verified`) |
| `universe.json` | `UniverseNode[]` — 6 destinations | Labels from the brief; teasers drafted |
| `projects.json` | `ProjectSummary[]` — card data | Names/descriptors confirmed for design; summaries `placeholder` |
| `case-studies.json` | `CaseStudy[]` — full §4.3 schema | Mostly empty; diagrams are *illustrative templates* |
| `career.json` | `Career` — journey milestones | **Sample** milestones only (no organisations/dates) |
| `capabilities.json`, `philosophy.json` | groups / principles | Titles & skills from the brief; descriptions `placeholder` |
| `profile-extras.json` | education, research, achievements | Empty (nothing shown until verified) |
| `social.json`, `contact.json` | links, email, availability, resume URL | LinkedIn, GitHub, email and the résumé PDF are `owner_verified` from the temporary CV (2026-11-02); availability, location and response note still `null` |
| `verified-links.json` | registry: CV project repositories, certificate links, phone (`publicDisplay: false`) | **Not rendered** — exact links extracted from the CV for this phase; no repository matches an existing project |
| `assistant.json` | sample prompts + knowledge entries for the demo | Composed from the fixtures above |
| `attributions.json` | asset provenance | Complete |
| `media.json` | `MediaContent` — portrait description, reel labels, transcript cues + on-screen description, AI-provenance flag | Portrait and reel `owner_verified` (owner-supplied files); **transcript and AI disclosure `placeholder`** until confirmed (see below) |

Every record carries `verification: { status, source, note? }` with `status` ∈ `placeholder | owner_verified | public_verified`.

## Workflow

1. **Parse** the owner's CV, portfolio files and project materials.
2. **Propose** structured JSON for each file above, with `verification.source` pointing at the evidence (e.g. `"CV v1, p.2"`). Never manufacture dates, metrics, employers or outcomes; leave fields `null`/empty when unknown — the UI hides or labels them.
3. **List open questions** for anything missing (role per project, dates, permissions for media/clients).
4. **Owner review**: set `NEXT_PUBLIC_CONTENT_MODE=OWNER_REVIEW` for a review build (still `noindex`). The owner flips records to `owner_verified` (or `public_verified`) only after approving them.
5. **Swap fixtures** and run:
   ```bash
   npm run content:validate             # zod contracts + cross-references, with counts
   npm run typecheck && npm test        # schema + referential integrity + factual-safety tests
   npm run content:gate                 # lists every remaining placeholder record (add -- --strict to fail on any)
   ```
   Update `tests/unit/content/factual-safety.test.ts` where a rule was intentionally about sample data (e.g. career entries will now have organisations).
6. **Regenerate posters/OG** if names changed; re-run E2E (`npx playwright test`) to catch layout regressions from longer text.
7. **Publish** only with explicit approval: `NEXT_PUBLIC_CONTENT_MODE=VERIFIED_PUBLIC` and `NEXT_PUBLIC_SITE_URL=https://…`. The build **fails** if any placeholder remains (`src/content/gate.ts`), and only then are pages indexable (robots, sitemap, canonical, JSON-LD `sameAs`).

## Résumé PDF (temporary CV integrated 2026-11-02)
- Replace it with `npm run resume:import -- <file.pdf>` (byte-for-byte copy + checksum → `public/resume/Islam_Abdelhady_CV.pdf`, `src/assets/resume.json`); every résumé action reads that one document. Then `npm test` (the provenance test checks the new file's links against `social.json`, `contact.json` and `verified-links.json`).
- The CV text is **not** a content source yet: experience, skills, projects, education and certificates in it were deliberately not copied into the site. Use `verified-links.json` for their exact URLs when this phase populates them.
- The demo assistant's `kb-contact` answer still describes contact details as pending — update it with the other content.

## Personal media (portrait + intro reel)
- **To confirm** in `media.json`, then set each `verification.status` to `owner_verified`:
  - the narration in `introReel.transcript.cues`, including the spelling of the name in the last line (the reel's own card reads "Abdelhady"; the site uses "Abd-Elhady");
  - the claims quoted in `transcript.visuals` (the reel's title card says "AI Engineer · Technical Lead", the site's role is "AI Full-Stack Engineer"; the TIBYN card says "aquaculture SaaS · live"; the stack card lists NestJS, Kubernetes and AWS);
  - `introReel.provenance` — keep `aiGenerated: true` with its label if generative video tools were used (the source file's name is a generation prompt), or set it to `false`.
- Captions (`/media/captions/intro-reel.en.vtt`) and the player's transcript update from the same cues automatically.
- Replacing the photo or the reel: drop the new originals into `media-src/` and run `npm run media:process` (see `docs/asset-manifest.md`), then re-run the E2E media spec.

## What changes automatically when content changes
- Cards, case-study sections (empty sections collapse into an "In preparation" panel), journey timeline (sample tags disappear when entries are verified), contact channels (live links appear when URLs exist), resume page (offers the download once a verified `resume.url` exists), JSON-LD, sitemap.
- The assistant demo answers come from `assistant.json`; for the **live** assistant see below.

## Assistant activation (after knowledge approval)
- UI contract: `src/lib/assistant/contracts.ts` (`AskRequest`, `GroundedAnswer`, `SourceReference`, `ResponseStatus`, `SafetyPolicy`).
- Server boundary: `src/app/api/assistant/route.ts` (validation in `request-schema.ts`, safety in `safety.ts`) currently returns `503 unavailable`. Plug a grounded provider in there (retrieval over approved, versioned knowledge; citations; refusal of unknowns; rate limiting; spend controls; secrets server-side only — never `NEXT_PUBLIC_`).
- Switch the UI with `NEXT_PUBLIC_ASSISTANT_MODE=live`. Build a regression/evaluation set before launch (spec §9.3).
