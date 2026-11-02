# Acceptance matrix — gates AI-0 … AI-8

Status: `MET` (evidence attached) · `MET*` (met by an assistant self-review; the owner's confirmation is pending) · `PARTIAL` (gap stated) · `OPEN` (owner action / external). Evidence paths are relative to `docs/portfolio-intelligence-engine/` unless they start with `src/`, `tests/` or `scripts/`.

| Gate | Requirement (spec §13) | Status | Evidence / gap |
|---|---|---|---|
| **AI-0** Audit | existing UI/API/content/3D patterns documented; baseline captured | MET | AUDIT.md; baseline = commit `e33860b`, built and served beside the feature for interleaved A/B (GPU-AND-PERFORMANCE.md) |
| **AI-1** Knowledge | public-only compiler, schema, provenance, unit tests, placeholder exclusion, build integration | MET | `src/lib/portfolio-ai/knowledge/compiler.ts`, `src/content/data/ai-knowledge.json` (default-deny), static `/ai/knowledge.json`, client re-validation; `tests/unit/portfolio-ai/knowledge.test.ts`, `manifest.test.ts`; KNOWLEDGE-POLICY.md. Owner must confirm the approvals file (`placeholder`). |
| **AI-2** Smart Mode | search, ranking, answers, citations, bilingual basics, abstention, UI, fallback; browser QA | MET | golden set 76/76, refusals 17/17, held-out first run 28/30; in-browser index 1.8 ms / 11.6 ms (4× CPU), p95 0.3 / 1.5 ms; `ask-ai.spec.ts` green in Chromium desktop + mobile, Firefox, WebKit |
| **AI-3** Local runtime PoC | engine/model comparison, exact supported artifact, consent, WebGPU compatibility, worker streaming, measured GPU impact | MET | MODEL-EVALUATION.md §1–2 (WebLLM vs Transformers.js on the target GPU; commit-pinned artifacts with SRI); GPU memory and 3D impact in GPU-AND-PERFORMANCE.md §5 |
| **AI-4** Local AI product | download/cache, streaming, cancel/retry, constrained RAG, citations, refusal, fallback, full state machine | MET | worker protocol + client (`client-state.test.ts`), 18-state reducer, consent with model choice, progress + cancel, cache status/clear, Web Lock, verifier + strict retry + Smart fallback; `local-ai.gpu.spec.ts` on the real GPU |
| **AI-5** Cinematic integration | pause/resume world, camera/scroll continuity, static fallback, responsive and reduced-motion UX | MET (one limitation) | `aiRenderHold` reuses the existing `frameloop` pause; released on every exit path (GPU E2E + 10-cycle stress); reduced motion honoured (E2E); FPS A/B −1.7 %. Limitation: while the model initializes or writes, the camera advances only on scroll events (on-demand frames), not continuously. |
| **AI-6** Security & eval | automated security/privacy, golden set, human answer reviews, no-data-leak tests | MET* | no request bodies, no `/api` calls, no model bytes before consent (E2E, all browsers); CSP tests; 0 private data in 122 raw model outputs; Local AI gates met by the 1.5B model on **assistant** review — **human review pending** (EVALUATION-RESULTS.md) |
| **AI-7** Final hardening | unit/integration/E2E/cross-browser, real GPU, Lighthouse, memory stress, comparison evidence, docs, commits | MET (with stated gaps) | TEST-REPORT.md; Lighthouse A/B; 10-cycle stress; 13 documents; local commits. Gaps: no physical phone, no discrete GPU, timings under GPU contention from the owner's Chrome, mobile FCP +150 ms (simulated) |
| **AI-8** Sign-off | separate feature and public-launch verdicts; owner keeps visual/product approval | MET | CLOSURE-REPORT.md |

## Definition of done (spec §19)

| Item | Status |
|---|---|
| Smart Mode works with approved public knowledge, correct source links, robust abstention | MET |
| Local AI genuinely generates with a real on-device model after explicit consent on at least one tested GPU/browser; honest fallback elsewhere | MET (Chromium + Intel Xe-LPG; Firefox/WebKit and no-WebGPU browsers get the unavailable message + Smart Mode) |
| No model weights before opt-in; no cloud inference or chat upload | MET (E2E network assertions) |
| Tested model/runtime with documented size, license, performance, limitations | MET (MODEL-EVALUATION.md) |
| UI native to the cinematic section, accessible on desktop/mobile | MET* (same glass card and layout; axe suite; owner visual sign-off pending — `evidence/screens/`) |
| Shared corpus, deterministic content update, source validation, no unapproved CV claims | MET |
| GPU contention handled without crash, broken 3D or stale worker state | MET on the tested machine (10 cycles; device loss covered by unit tests only — not simulatable here) |
| Security, privacy, jailbreak / prompt-injection and hallucination-risk tests recorded | MET |
| Existing tests and major visual interactions keep their baseline | see TEST-REPORT.md |
| Actual E2E, WebGPU, memory and performance evidence (or explicit gaps) | MET with gaps listed |
| Local commits; no push, merge or deploy | MET |
| Release readiness described accurately; owner sign-off outstanding | MET |
