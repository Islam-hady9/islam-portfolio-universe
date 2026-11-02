# Architecture

One assistant, two answer engines, one corpus, one answer contract (PIE spec §0, §4).

```text
src/content/data/*.json  (zod-validated content authority — unchanged)
        │  + src/content/data/ai-knowledge.json (explicit, default-deny approvals)
        ▼
knowledge/compiler.ts  ── build time ──►  /ai/knowledge.json  (force-static, versioned, ~10 KB)
  extractors → eligibility (verified·public·approved)          │  page renders only the version string
  → PII / unsafe-text / link checks → chunk → hash             │
                                                               ▼  lazy fetch (section near viewport / focus)
┌──────────────────────── browser (main thread) ────────────────────────┐
│ shared/manifest.ts  parseManifest(): re-validates every invariant     │
│ retrieval/          normalize (EN/AR) · concepts (bilingual bridge)   │
│                     · search-index (MiniSearch, field boosts)         │
│ smart/engine.ts     route → refuse | clarify | template | search      │
│                     → SmartAnswer {text, evidence E1…, links, status, │
│                       grounding: evidence | blocked | none}           │
│ components/ask-ai/  AskAiPanel (reducer state machine, 18 UI states)  │
│        │ opt-in only                                                  │
│        ▼                                                              │
│ local/capability.ts  secure context · navigator.gpu · adapter ·       │
│                      shader-f16 · buffer limits · storage hint        │
│ local/cache.ts       Cache Storage status / clear (no runtime load)   │
│ local/client.ts      one worker per tab · requestId guard · cancel    │
│ local/orchestrate.ts Smart routing decides → generate → verify →      │
│                      strict retry → else Smart answer (+ notice)      │
│ local/verify.ts      citations ∈ evidence · links ∈ allowlist ·       │
│                      no phone/secret · sentence support (EN)          │
│ state: experience-store.aiRenderHold → frameloop 'demand' (3D pause)  │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │ typed protocol (local/protocol.ts)
                                 ▼  INIT · PROGRESS · READY · GENERATE · TOKEN · COMPLETE · CANCEL · DISPOSE · ERROR
┌──────────── Web Worker: src/workers/local-ai.worker.ts ───────────────┐
│ @mlc-ai/web-llm 0.2.86 MLCEngine (WebGPU) · local/prompt.ts           │
│ model files: Hugging Face (commit-pinned) + WebGPU lib (GitHub,       │
│ commit-pinned) · SRI-verified config/lib/tokenizer · Cache Storage    │
└───────────────────────────────────────────────────────────────────────┘
```

No server code path takes a question. The previous `/api/assistant` route still returns 503 and is not called by the UI.

## Modules

| Path | Responsibility |
|---|---|
| `src/lib/portfolio-ai/shared/` | types (spec §5/§10 contracts), link allowlist + URL stripping, PII detectors, manifest parsing/loading |
| `src/lib/portfolio-ai/knowledge/compiler.ts` | candidates from every content collection with their real status → rejection reasons → deterministic manifest (server/build only, `node:crypto`) |
| `src/lib/portfolio-ai/retrieval/` | EN/AR normalization, bilingual concept dictionary, MiniSearch index (shared by both modes) |
| `src/lib/portfolio-ai/smart/` | intent routing, approved templates (EN/AR), evidence assembly, follow-ups, claim checking |
| `src/lib/portfolio-ai/local/` | model catalog, protocol, capability, cache, client, prompt, verifier, orchestration |
| `src/workers/local-ai.worker.ts` | the only importer of WebLLM |
| `src/components/ask-ai/` | panel, answer card, Local AI card, reducer, UI copy |
| `src/app/ai/knowledge.json/route.ts` | static manifest |
| `scripts/ai/` | knowledge report, Smart/Local evaluations, golden-set scoring |

## Loading and bundle boundaries (measured in the production build)

| Moment | What loads |
|---|---|
| Page load | the panel shell (part of the home client bundle) and the manifest version string; **no** engine, MiniSearch, manifest, worker or model |
| Ask My AI within 600 px of the viewport, or pointer/focus on the panel | Smart chunk (engine + MiniSearch + dictionary) and `/ai/knowledge.json` |
| "Try Local AI" | capability/cache/client chunks (small); **no worker yet** |
| Consent accepted (or model already cached) | the worker bootstrap + WebLLM chunk (6.1 MB uncompressed), then the pinned model files |

## Decisions (ADRs)

**ADR-1 Runtime: WebLLM 0.2.86, not Transformers.js 4.3.1.** Spike on the target iGPU (MODEL-EVALUATION.md): same model class, WebLLM decoded ~30 tok/s with coherent output and a 40 MB JS heap; Transformers.js q4f16 decoded 6.5–7.4 tok/s, produced degenerate output (repetition loops, corrupted Arabic) and used 1.8 GB of JS memory, and pulled ONNX Runtime WASM from a third CDN. WebLLM's worker streaming and Cache Storage caching worked. Only one runtime ships.

**ADR-2 Own worker protocol instead of WebLLM's `WebWorkerMLCEngine`.** The spec's typed messages (requestId on every message) make stale-token suppression, one-generation-per-tab and crash handling explicit and unit-testable with a fake worker; the runtime never touches the main thread.

**ADR-3 Smart routing gates generation.** The model is called only when the deterministic router found approved evidence and the request is not blocked. Refusals, out-of-scope, clarifications and no-evidence questions are answered by Smart Mode and labelled "Smart Answer" with the reason — the model is never asked to decide whether to reveal private data.

**ADR-4 Verify, retry once, fall back.** Generated text must cite only provided evidence, contain no non-allowlisted link and no phone/credential, and (English) every sentence must be lexically supported; numbers and Latin proper names must appear in the evidence in any language. One stricter greedy retry; otherwise the grounded Smart answer with an explicit notice.

**ADR-5 Arabic: Smart Mode answers Arabic questions in Local AI mode (v1).** Evidence is English; Arabic output cannot be lexically verified, and the spike showed hallucinated Arabic at 1.5B and empty Arabic at 0.5B. Arabic questions get the Smart answer with the notice "Local AI answers in English only for now". Revisit with bilingual approved records or a larger model.

**ADR-6 3D coexistence through the existing pause.** `aiRenderHold` joins `mediaOverlay` in the one `frameloop` expression (`'demand'` while either is set): continuous rendering stops during model initialization and generation, frames still render on scroll, nothing is unmounted, and the hold is released on every exit path (ready, error, cancel, back, unmount, pagehide). Download alone does not pause 3D.

**ADR-7 Model choice by evaluation.** Qwen2.5-1.5B-Instruct q4f16_1 is preselected (it met the claim-support, citation-validity and no-leak gates); Qwen2.5-0.5B is the light option, preselected on constrained or metered devices; the visitor confirms one of them before anything downloads, and a model already stored is reused without asking again. See MODEL-EVALUATION.md §3–4.

**ADR-9 One local model per browser profile.** A Web Lock (`portfolio-local-ai`) is held from the capability check until Local AI is closed; a second tab is told Local AI is running elsewhere and keeps Smart Mode.

**ADR-8 No conversation persistence, no telemetry of content.** History is React state (max 8 turns), cleared by "Clear conversation" or reload; the only persisted data are model files in Cache Storage, with a visible "Remove model from this device" control.
