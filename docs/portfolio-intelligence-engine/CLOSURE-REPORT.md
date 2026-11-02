# Closure report — Portfolio Intelligence Engine

Branch `feat/intelligence-universe`, 2026-11-02. Local commits only — **not pushed, merged or deployed**. Spec: [PORTFOLIO_INTELLIGENCE_ENGINE_MASTER_SPEC.md](./PORTFOLIO_INTELLIGENCE_ENGINE_MASTER_SPEC.md).

## What shipped

- **Smart Mode (default)** — in-browser, deterministic, source-cited answers in English and Arabic over a default-deny manifest of verified, public, approved records; refusals for private/confidential/injection requests; honest partial answers with links for everything still pending; ~18 KB gzip, loaded only when Ask My AI approaches the viewport.
- **Local AI (opt-in)** — WebLLM 0.2.86 in a dedicated worker on WebGPU; consent card with model choice (Qwen2.5 1.5B preselected by evaluation, 0.5B light option), measured sizes, license, storage, GPU/3D impact and privacy; progress + cancel; streamed answers with `[E#]` citations, a post-generation verifier, one strict retry and Smart fallback with a visible reason; cache status and removal; one model per browser profile.
- **Coexistence with the 3D world** — the existing render pause is reused while the model loads or writes; nothing else in the scene changed.
- **Honesty fixes outside the panel** — `/about` no longer claims the assistant is a demo; the "Concept Preview — AI assistant not yet connected" status is no longer rendered.
- No cloud inference, API keys, paid services, telemetry of questions or conversation storage.

## Measured (details in the linked documents)

| | Result |
|---|---|
| Smart Mode golden set | 76/76 (100 %), refusals 17/17; held-out first run 28/30 (93.3 %) |
| Smart Mode in browser | index 1.8 ms desktop / 11.6 ms at 4× CPU; answer p95 0.3 / 1.5 ms |
| Local AI (1.5B, preselected) | claim support 92.6 % (assistant review, human review pending), citation IDs 100 % valid, 0 private data in 122 raw outputs, answers ~half of eligible questions locally |
| Local AI (0.5B, light) | claim support 86.4 %, citation IDs 81 % valid (gate not met) |
| Runtime spike | WebLLM ~4× faster than Transformers.js on this GPU with correct output (Transformers.js q4f16 output was corrupted) |
| Homepage LCP A/B | mobile 3.33 → 3.29 s, desktop 0.74 → 0.73 s (no regression); TBT lower; mobile FCP +150 ms (simulated) |
| 3D FPS A/B at the Ask My AI station | −1.7 % (inside noise; target < 5 %) |
| Local AI stress (1.5B, real GPU) | 10/10 enable → answer → close cycles, 0 errors; GPU memory 1.8–1.9 GB loaded → 0.3 GB after every exit; JS heap flat ~26 MB; 3D hold always released; first-answer TTFT 23–65 s → 6–9 s after adding a setup warm-up |

## Verdicts

The two verdicts are deliberately separate.

### 1. AI feature (Portfolio Intelligence Engine): **CONDITIONAL GO**

Complete and verified for owner review and internal use. **Smart Mode is GO**: every Smart gate is met in four browsers, it adds no measurable LCP or FPS cost, and it never states an unapproved fact. **Local AI is a CONDITIONAL GO** — it genuinely generates on-device after consent, meets the claim-support, citation-validity and no-leak gates with the preselected 1.5B model, and falls back honestly on every failure path tested. Conditions:

1. A human (the owner) repeats the claim review of the listed Local AI answers (the 92.6 % is an assistant review).
2. The owner confirms `src/content/data/ai-knowledge.json` (approvals are an engineering default, `placeholder`).
3. The owner signs off the panel visually (screens in `evidence/screens/`) and decides the stale section copy ("…through a future intelligent portfolio assistant.", `/contact` "Try the assistant preview").
4. Accepted limitations are understood: Local AI verified on one browser/GPU pair only (Chromium + Intel Xe-LPG); Arabic questions are answered by Smart Mode in Local AI mode; ~875 MB download for the preselected model; first session needs ~20–40 s of shader compilation on an integrated GPU (now done during setup); mobile FCP +150 ms (simulated).

### 2. Public launch of the site: **NO-GO** (unchanged by this phase)

This feature does not change the existing launch blockers and adds two of its own:

- Pre-existing: mobile LCP 3.3 s vs the 2.5 s budget; 41 records still `placeholder` (`VERIFIED_PUBLIC` build blocked by the publication gate); no physical-device testing; production domain/hosting not chosen; owner visual and content sign-off outstanding.
- New: Local AI depends on two third-party hosts at run time (Hugging Face CDN, raw.githubusercontent.com) — acceptable for a preview, but a public launch should decide whether to self-host the pinned model files on the site's own origin (deployment decision); human review of generated answers is pending.

## Commits (local, not pushed)

| Commit | Scope |
|---|---|
| `0247bd2` feat(ai): approved knowledge manifest and Smart Mode engine | compiler, approvals file, manifest route, Smart engine, golden sets, unit tests, dependencies. **Note:** this commit also carries the removal of the old demo panel files (`AssistantPanel.tsx`, its test, the stylesheet move) that had been staged earlier; the intermediate tree at this commit does not build on its own (the old section still imports the panel) — it builds from `dcd7883` on. History was not rewritten to fix this. |
| `1197605` feat(ai): opt-in Local AI runtime in a Web Worker | catalog, protocol, worker, client, capability, cache, prompt, verifier, orchestration, Web Lock, CSP, unit tests |
| `dcd7883` feat(ask-ai): Smart Mode and Local AI in the Ask My AI section | panel, Local AI card, answer card, reducer, 3D render hold, `/about` honesty fix, component/unit/E2E/GPU tests |
| docs commit | this folder, evidence, evaluation/benchmark tooling, decisions D-45…D-47, acceptance-matrix and release-readiness notes |

Not committed (git-ignored): model weights and browser profiles (`.evidence-tmp/ai-gpu-profile`, ~1.5 GB, kept so `npm run test:e2e:gpu -- -g "Local AI"` does not re-download — delete it freely), raw evaluation logs, Lighthouse reports. The spike profiles (2.6 GB) and the baseline build copy were deleted.

## Open risks and limitations

1. **Human review pending** for Local AI answers (assistant-reviewed 92.6 %); two subtle errors passed the verifier in the reviewed sample.
2. **One browser/GPU pair** for Local AI (Chromium + Intel Xe-LPG iGPU). No discrete GPU, no Firefox/Safari WebGPU path tested (they get the "unavailable" message), **no physical phone**.
3. **GPU contention during measurement** from the owner's Chrome (45–99 % of the iGPU); in-app Local AI timings are pessimistic, spike timings optimistic.
4. **Download size**: 875 MB for the preselected model (284 MB light option); first session needs ~35 s of setup on this iGPU.
5. **Arabic generation disabled** (Smart Mode answers Arabic questions in both modes).
6. **Sparse approved corpus**: most portfolio questions get honest "awaiting verification" answers until the owner verifies and approves records.
7. **Mobile FCP +150 ms** (simulated) from 3 KB of extra critical CSS; LCP unchanged.
8. **Third-party model hosts** at run time (Hugging Face CDN, GitHub raw) — pinned and SRI-checked (weights commit-pinned, not SRI-checked by the runtime).
9. Stale copy outside the panel awaiting the owner: `home.json` assistant body ("future … assistant") and status string (no longer rendered), `/contact` "Try the assistant preview", unused `assistant.json` demo data (still counted by the publication gate).
10. Turbopack emits the worker's TypeScript source as an unreferenced static asset (`/_next/static/media/local-ai.worker.*.ts`) next to the bundled worker — harmless (no secrets, never requested) but noted.
