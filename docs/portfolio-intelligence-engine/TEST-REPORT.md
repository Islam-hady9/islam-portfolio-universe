# Test report (gate AI-7)

Every suite below was executed in this session on the production build unless marked otherwise. Machine and conditions: see GPU-AND-PERFORMANCE.md.

## Static checks

| Check | Result |
|---|---|
| `tsc --noEmit` (strict, whole repo) | pass |
| `npm run lint` (ESLint, whole repo) | pass, 0 problems |
| Prettier (`src`, `tests`, `scripts`, configs) | pass |
| `npm run content:validate` | OK (4 projects, 4 case studies, 8 career entries, 4 capability groups, 10 assistant entries) |
| `npm run content:gate` | 41 records pending (40 before + `ai-knowledge.json`, pending the owner's confirmation) — DEMO_CONTENT build allowed, VERIFIED_PUBLIC still blocked as before |
| `npm audit --omit=dev` | 0 vulnerabilities |

## Unit and component (Vitest, jsdom)

New suites (`tests/unit/portfolio-ai/`, `tests/component/ask-ai/`):

| File | Covers |
|---|---|
| `knowledge.test.ts` | eligibility (verified ∧ public ∧ approved), default-deny approvals, wildcard vs exact, placeholder text never shipped, transcript and private registry excluded, unsafe-text / PII / invalid-url rejection, deterministic version + chunking, link allowlist |
| `retrieval.test.ts` | Arabic normalization (alef/hamza/ya/ta marbuta, diacritics, tatweel, digits), identifiers (Next.js, C++, C#, .NET), script splitting, language detection, stemming variants, EN↔AR concept bridge, URL canonicalization/stripping, phone/secret detectors |
| `smart.test.ts` | the whole golden set as individual tests + the ≥ 90 % and 100 %-refusal gates, answer contract (E-ids exist, allowlisted links), generation gating, freshness (new manifest version replaces old answers), empty corpus, latency budget |
| `manifest.test.ts` | client re-validation (eligibility, unsafe hrefs, unknown schema, duplicates), version-keyed fetch + cache-bypassing reload, HTTP errors, held-out regression |
| `local.test.ts` | prompt contract (fencing, bounds, decoding), verifier (invalid citations, invented names/numbers, unsupported sentences, phone, links, verbatim quotes, first person, intensifiers, malformed email, abstention, Arabic partial coverage), orchestration (blocked/no-evidence never call the model, strict retry, fallback, model-abstained fallback, cancellation, Arabic policy), protocol helpers, catalog pinning + SRI |
| `client-state.test.ts` | worker client with a fake worker (no worker before init, streaming, stale-token drop, one generation at a time, typed errors, device loss, crash, dispose), capability check (secure context, WebGPU, adapter, shader-f16, limits, storage/data-saver hints), cache state/clear, the 18-state reducer, Web Lock |
| `csp.test.ts` | `'wasm-unsafe-eval'` without `'unsafe-eval'`, connect-src = self + pinned model hosts, catalog URLs covered, framing/plugins blocked |
| `AskAiPanel.test.tsx` | spec labels, nothing loaded up front, Enter → labelled answer with sources + live-region summary, markup in a question never rendered, follow-up + clear, Local AI unavailable path, index-load error restores the question |

Results: see the run table in §Results.

## End-to-end (Playwright, production build)

| Spec | Projects | What it proves |
|---|---|---|
| `ask-ai.spec.ts` | Chromium desktop, Chromium mobile (Pixel 7), Firefox, WebKit | lazy loading (no manifest/model/worker before the section), labels and notice, sourced English answer, Arabic RTL answer, refusal/abstention/follow-up/clear, suggestions, no-WebGPU path, consent disclosure + model choice + decline with zero model requests, offline without a model, second tab refused (Web Lock), reduced motion |
| `honesty.spec.ts` (updated) | Chromium desktop | link inventory; assistant answers only in the browser — no `/api/*` call, no non-GET request; template answers never labelled "Generated Locally"; injection refused |
| `local-ai.gpu.spec.ts` (new, opt-in `gpu`) | real Intel iGPU | consent → download/initialize → streamed answer (Generated Locally, or Smart with notice), 3D hold on during generation and released after, blocked question never reaches the model, Stop restores the question, Back to Smart Mode releases model + hold, only GET requests to self and pinned model hosts |
| existing suites | all projects | regression of navigation, media, résumé, projects, accessibility (axe), visual, motion, mobile, WebGL (GPU) |

## Results

All runs on the final production build (commit `dcd7883` code + this documentation), 2026-11-02.

| Suite | Command | Result |
|---|---|---|
| Unit + component | `npx vitest run` | **735 passed / 38 files** (was 536 / 31 before this phase; the 9 tests of the removed demo panel are gone, 208 portfolio-ai unit tests + 6 panel component tests are new) |
| E2E, all default projects | `E2E_PORT=3310 npx playwright test` | **160 passed, 3 skipped (by design), 0 failed** in 7.1 min — Chromium desktop, Chromium mobile (Pixel 7), Firefox, WebKit; includes `ask-ai.spec.ts` (12 tests × 4 projects incl. axe on answer + consent states) and the updated `honesty.spec.ts` |
| E2E, real GPU (Intel Xe-LPG, Chromium) | `E2E_PORT=3310 node scripts/qa/e2e-gpu.mjs` | **9 passed / 9** in 3.0 min — 4 Local AI (consent → ready → streamed answer with 3D hold on/off, blocked question never reaches the model, Stop restores the question, Back to Smart Mode releases model + hold, GET-only traffic to self + pinned hosts) and the 5 existing WebGL tests (stations, universe nodes, portals, reel pause, FPS profile) |
| Smart golden / held-out | `npm run ai:eval:smart`, `manifest.test.ts` | 76/76, refusals 17/17; held-out 30/30 now (28/30 first run) |
| Local AI golden / held-out (real GPU, both models) | `node scripts/ai/eval-local.mjs …` | EVALUATION-RESULTS.md |
| Benchmarks | `bench-smart`, `bench-3d`, `lh-ab`, `bench-local` | GPU-AND-PERFORMANCE.md |

Flakiness observed and handled: one WebKit run of "reduced motion is honoured" timed out under load in `scrollIntoViewIfNeeded` (passed 3/3 in isolation); the helper now scrolls with `scrollIntoView({ behavior: 'instant' })` instead of waiting for element stability. No other failure occurred in the final runs.

Not executed (and why): physical phone/tablet (none available); discrete-GPU or Safari/Firefox WebGPU Local AI runs (not available — those browsers get the unavailable path, which is tested); WebGPU device loss / GPU OOM (not simulatable — unit-tested); cold in-app install of the 1.5B model in the stress run (network-bound; measured in the spike and the evaluation instead).
