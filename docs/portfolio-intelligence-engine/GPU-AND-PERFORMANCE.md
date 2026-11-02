# GPU coexistence and performance

PIE spec §8, §12. Machine: Intel Core Ultra 7 255HX, 16 GB RAM, Intel Xe-LPG iGPU (shared memory), Windows 11; Playwright Chromium 156 (headless) with `--enable-gpu --ignore-gpu-blocklist --use-angle=d3d11`. Production builds served locally: feature (this branch) on :3310, baseline (commit `e33860b`) on :3320.

**Measurement conditions (stated, not hidden).** During this session the machine was under heavy memory pressure (0.8–1.4 GB of 15.4 GB RAM free; commit 42/50 GB; WSL, Docker and several editors running — the owner's processes, left untouched), and for part of it the owner's own Chrome held ~45–53 % of the integrated GPU's 3D engine (a WebGL tab). Every comparison below is interleaved A/B on the same machine within minutes; absolute numbers are lower than an idle machine would give, and the rows say which runs were contended.

## 1. What loads when (production build)

| Payload | Size | When |
|---|---|---|
| Home HTML | 141.9 KB (26.9 KB gzip) — baseline 150.4 KB (28.7 KB gzip): **−8.4 KB**, the old demo serialized its fixture answers into the page | page load |
| Panel shell (in the home client chunk) | chunk `0e6nybr6mrua8.js` 49.7 KB / 15.3 KB gzip (shared with other home code) | page load |
| Smart engine + MiniSearch + dictionary | 55.8 KB / **18.2 KB gzip** | lazily: Ask My AI within 600 px, or pointer/focus on the panel |
| Knowledge manifest `/ai/knowledge.json` | 10.1 KB (~3 KB gzip) | same moment, one request |
| Local AI client/orchestration/capability chunks | ≈ 15 KB / ≈ 7 KB gzip | after "Try Local AI" |
| Worker + WebLLM runtime | 6.14 MB / 2.18 MB gzip / 1.46 MB brotli | after consent (or cached model) |
| Model files | 283.6 MB (0.5B) / 874.6 MB (1.5B) | after consent; Cache Storage afterwards |

Zero model bytes and no worker chunk before consent are asserted by `tests/e2e/ask-ai.spec.ts` in every browser project.

## 2. Smart Mode latency (in the browser)

`scripts/ai/bench-smart.mjs`, 3 runs per profile, median; User Timing marks recorded by the panel itself; 760 `answer()` calls per run (76 golden questions × 10).

| Profile | Index build | Lazy load total (chunk + manifest + index) | Answer p50 | Answer p95 | Target |
|---|---|---|---|---|---|
| Desktop | 1.8 ms | 108 ms | 0.1 ms | 0.3 ms | index ≤ 300 ms, p95 ≤ 150 ms |
| Mobile emulation, 4× CPU throttling | 11.6 ms | 165 ms | 0.4 ms | 1.5 ms | index ≤ 800 ms, p95 ≤ 400 ms |

(Chromium coarsens `performance.now()` to 0.1 ms. "Lazy load total" includes the local network fetch, which the spec excludes from the index target.) Evidence: `evidence/smart-browser-bench.json`.

## 3. Homepage Lighthouse A/B (no hero LCP regression)

`scripts/ai/lh-ab.mjs`: `scripts/perf/lighthouse.mjs` profiles `mobile-static-home` (Moto G Power emulation, 4× CPU, slow 4G, static tier) and `desktop-gpu-home` (desktop preset, real GPU); 3 rounds, order alternating per round. Medians (all runs in `evidence/lighthouse-ab.json`):

| Profile | Variant | Perf | FCP | **LCP** (3 runs) | TBT | CLS | JS transfer |
|---|---|---|---|---|---|---|---|
| Mobile | baseline `e33860b` | 86 | 1.06 s | **3.33 s** (3.33 / 3.84 / 3.29) | 277 ms | 0 | 232 KB |
| Mobile | feature | 92 | 1.21 s | **3.29 s** (3.69 / 3.29 / 3.17) | 90 ms | 0 | 240 KB |
| Desktop GPU | baseline | 68 | 0.29 s | **0.74 s** (0.75 / 0.74 / 0.72) | 1,898 ms | 0 | 559 KB |
| Desktop GPU | feature | 69 | 0.29 s | **0.73 s** (0.75 / 0.73 / 0.73) | 1,538 ms | 0 | 568 KB |

- **LCP: no regression** on either profile (differences are inside the run-to-run spread). Mobile LCP stays above the 2.5 s budget exactly as before this phase (pre-existing launch blocker, unchanged).
- TBT is lower in the feature build on both profiles (the old demo panel hydrated its fixture knowledge; the new shell hydrates only a version string).
- **Mobile FCP +150 ms (1.06 → 1.21 s, all three feature runs at 1.21 s)** in Lighthouse's simulated slow-4G: the page makes the same 39 requests; render-blocking CSS grew by 3 KB (panel, Local AI card and conversation styles) and JS by 8 KB transfer. FCP remains "good" (< 1.8 s) and is not a spec gate, but it is a measurable cost. Suggested follow-up: move the Local AI card and conversation styles into lazily loaded components so they leave the critical CSS.
- Desktop TBT (≈ 1.5–1.9 s) is the pre-existing one-time shader compilation of the 3D world, not this feature.

## 4. 3D frame rate with Smart Mode (A/B)

`scripts/ai/bench-3d.mjs`: real GPU, quality pinned to `balanced` (governor off), camera parked on the Ask My AI station, 3 interleaved rounds; renderer frame-rate EMA sampled every 250 ms for 8 s idle and 8 s while six questions are typed and answered (English, Arabic, a refusal). **The owner's Chrome was using ~99 % of the GPU's 3D engine during this run**, which plausibly explains why both variants sit near 60 fps; the comparison is interleaved, so it is fair, but the absolute values are not the machine's capability (Polish V2 measured 143–171 fps with the GPU free).

| Variant | Idle (median of rounds) | While asking | Draw calls / programs |
|---|---|---|---|
| Baseline | 60 fps (58 / 61 / 60) | 58 fps (52 / 58 / 60) | 26 / 49 |
| Feature | 59 fps (60 / 59 / 56) | 57 fps (57 / 59 / 54) | 26 / 49 |

Median difference **−1.7 % idle, −1.7 % while asking** — under the 5 % target and inside the per-round spread (±4 fps). Same draw calls and shader programs: the feature adds nothing to the 3D scene. Evidence: `evidence/fps-ab.json`.

## 5. Local AI on the GPU — install, memory, 3D coexistence, stress

`scripts/ai/bench-local.mjs` (production build, real GPU, model already cached in the git-ignored profile; GPU memory = Windows "GPU Process Memory → Shared Usage" of the browser's processes, the integrated GPU's equivalent of VRAM; heap = page `performance.memory`). Qwen2.5-1.5B (preselected). The owner's Chrome used 4–99 % of the same GPU during this run.

| Moment | Browser GPU memory | Page JS heap | 3D render hold |
|---|---|---|---|
| Before Local AI (3D world running) | 0.40 GB | 25 MB | off |
| Model ready | 1.47 GB | — | on while initializing, off when ready |
| After 3 answers (KV cache allocated) | **1.90 GB** | — | on during each generation, off after |
| After **Back to Smart Mode** | **0.38 GB** (released) | 25 MB | off |

**10 cycles** of Try Local AI → ready → one answer → Back to Smart Mode: **10/10 completed, 0 console/page errors**, render hold released after every cycle, WebGL `ready` after every cycle, browser GPU memory after each exit 0.29–0.37 GB (no growth), JS heap 25.3–27.0 MB (flat), no network request to a model host (cache hit), only 248 KB from the site itself. 6/10 answers were shown as Generated Locally, 4/10 fell back to the Smart answer (the contact question, whose 1.5B output repeatedly contained a malformed email and was rejected — see EVALUATION-RESULTS.md).

| Timing (warm cache, contended GPU) | Value |
|---|---|
| Try Local AI → ready | 4.8–25.7 s per cycle (12.6 s in the first) |
| First token of each new session (WebGPU pipeline compilation) | 23–65 s before the warm-up change |
| Subsequent answers in the same session | TTFT 4.9–5.5 s, 6–12 tok/s |

**Optimization applied after this run:** a one-token warm-up inside initialization (behind the "Compiling GPU shaders" progress, 3D paused) so that the pipeline compilation no longer lands on the visitor's first question — re-measured below.

Cold install (no cache) was measured in the spike and the evaluation, not in this stress run: 0.5B 49 s at ~6 MB/s; 1.5B 170 s at ~5.5 MB/s and 633 s when the CDN slowed to ~0.2–3 MB/s — download time is dominated by the visitor's network, which the consent card's size disclosure makes explicit.

Not simulatable here: WebGPU device loss and GPU out-of-memory (covered by unit tests of the error classification, client and reducer — the panel moves to `resource-pressure`, disposes the model, releases the hold and keeps Smart Mode).

**After the warm-up change** (`evidence/local-bench-Qwen2.5-1.5B-warmup.json`, same machine, 3 cycles + initial session):

| | Before warm-up | After warm-up |
|---|---|---|
| Try Local AI → ready, first session of the browser | 12.6 s | 37.5 s (includes the compilation, shown as "Compiling GPU shaders", 3D paused) |
| Try Local AI → ready, later sessions | 4.8–25.7 s | 9.9–11.6 s |
| **First answer TTFT of a session** | **23–65 s** | **6.1–8.8 s** |
| Later answers TTFT | 4.9–5.5 s | 5.2–6.3 s |
| GPU memory loaded / after Back to Smart Mode | 1.90 / 0.29–0.38 GB | 1.82 / 0.30 GB |
| Errors | 0 | 0 |
