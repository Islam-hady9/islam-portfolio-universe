# Portfolio Intelligence Engine — Ask My AI

The Ask My AI section of the home page is now a working, privacy-preserving assistant with two answer engines over one approved corpus. Specification: [PORTFOLIO_INTELLIGENCE_ENGINE_MASTER_SPEC.md](./PORTFOLIO_INTELLIGENCE_ENGINE_MASTER_SPEC.md). Branch `feat/intelligence-universe` — local commits only; not pushed, merged or deployed.

## What a visitor gets

**Smart Mode (default).** "Smart Mode — Instant answers from portfolio". Type a question (English or Arabic, including Egyptian colloquial) or tap a suggestion; the answer appears in a few milliseconds, labelled **Smart Answer**, built only from approved public portfolio text, with numbered sources linking to where that text is published and next-step links (projects, résumé, LinkedIn, GitHub, email). Private or off-topic questions are refused; questions without approved evidence get "I don't have verified information on that yet. You can browse the projects or contact Islam." No model, no WebGPU, no server — the index (~10 KB of approved records + a small search library) loads only when the section approaches the viewport.

**Local AI (opt-in).** "Try Local AI (runs on your device)" → the browser is checked for WebGPU → a disclosure offers two models — **Qwen2.5 1.5B Instruct, ≈ 875 MB (recommended by the evaluation; preselected)** or **Qwen2.5 0.5B Instruct, ≈ 284 MB (light; preselected instead on data-saver, low-memory or touch-first devices)**, both Apache-2.0 — and states browser storage, GPU/memory use, that the 3D scene pauses while the model works, and that nothing leaves the device → only after **Download and start** do model files download (progress, Cancel). A model already stored in the browser is reused without asking again. Answers then stream from a language model running in a Web Worker on the visitor's GPU, labelled **Generated Locally**, grounded in the same approved sources and checked after generation; anything that fails the check is replaced by the Smart answer with an explanation. **Back to Smart Mode** is always available and frees the model; **Remove model from this device** clears its storage. Browsers without WebGPU get a plain explanation and keep Smart Mode.

Nothing typed is sent anywhere, stored, or logged; there are no cloud inference calls, API keys or paid services.

## Current knowledge (honest coverage)

Only owner-verified, public and explicitly approved records are used: name and role, the hero/identity statements, the portfolio description, the capability and journey headings, the contact invitation, public email, LinkedIn, GitHub, the existence of the résumé PDF and of the intro reel, and facts about the assistant itself. Projects, case studies, capability details, the journey timeline, principles, the reel narration and the temporary CV's contents are **not** used because they are placeholders or pending sign-off — the assistant says so and links to the pages. Details: [KNOWLEDGE-POLICY.md](./KNOWLEDGE-POLICY.md).

## Documents

| | |
|---|---|
| [AUDIT.md](./AUDIT.md) | repository findings and pre-change baseline |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | modules, data flow, worker boundary, ADRs |
| [KNOWLEDGE-POLICY.md](./KNOWLEDGE-POLICY.md) | eligibility, approvals, exclusions |
| [MODEL-EVALUATION.md](./MODEL-EVALUATION.md) | runtime spike, model candidates, artifacts, licenses, benchmarks |
| [RAG-AND-ANSWER-CONTRACT.md](./RAG-AND-ANSWER-CONTRACT.md) | retrieval, routing, prompt, verification, fallbacks |
| [UI-STATE-SPEC.md](./UI-STATE-SPEC.md) | the 18 UI states, accessibility |
| [GPU-AND-PERFORMANCE.md](./GPU-AND-PERFORMANCE.md) | 3D coexistence, before/after measurements |
| [SECURITY-AND-PRIVACY.md](./SECURITY-AND-PRIVACY.md) | threat model, CSP, network observations |
| [EVALUATION-RESULTS.md](./EVALUATION-RESULTS.md) | golden set, held-out set, Local AI review |
| [TEST-REPORT.md](./TEST-REPORT.md) | suites executed and results |
| [ACCEPTANCE-MATRIX.md](./ACCEPTANCE-MATRIX.md) | gates AI-0 … AI-8 |
| [CLOSURE-REPORT.md](./CLOSURE-REPORT.md) | commits, open risks, verdicts |
| [evidence/](./evidence) | machine-written reports (evaluations, benchmarks) |

## Commands

| Command | Purpose |
|---|---|
| `npm run ai:knowledge` (`-- --json`) | what the assistant may know: compiled records, rejected candidates and reasons |
| `npm run ai:eval:smart` | Smart Mode golden-set evaluation → `evidence/smart-eval.json` |
| `node scripts/ai/eval-local.mjs --base <url> --model <id>` | Local AI golden-set run on a real GPU (production build) |
| `node scripts/ai/bench-smart.mjs`, `bench-3d.mjs`, `bench-local.mjs` | browser latency, 3D frame-rate A/B, Local AI install/stress benchmarks |
| `npm run test:e2e:gpu -- -g "Local AI"` | real-GPU Local AI end-to-end test (downloads the model once into a git-ignored profile) |

## Owner follow-ups

1. Confirm `src/content/data/ai-knowledge.json` (currently `placeholder`; the publication gate counts it).
2. The section copy in `home.json` still says "through a future intelligent portfolio assistant" and the status "Concept Preview — AI assistant not yet connected"; the status line is no longer rendered (replaced by the live mode status), the body text is unchanged pending your wording.
3. `/contact` still has a button "Try the assistant preview" — consider "Ask the portfolio assistant".
4. `assistant.json` (the former demo's 10 placeholder answers) is no longer used by the UI; it still counts in the publication gate — remove or keep as you prefer.
5. As records become verified, approve them in `ai-knowledge.json` — answers improve without code changes.
