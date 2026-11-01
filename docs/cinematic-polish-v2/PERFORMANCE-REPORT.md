# Cinematic Polish V2 — Performance Report

Machine: Intel Core Ultra 7 255HX, 16 GB, Intel iGPU (Chromium/ANGLE D3D11), Windows 11, Node 24. Production builds via `next start`. Every number below was measured; ranges are shown where runs varied. Lighthouse 13.6 profiles as before: **mobile** = default simulated Moto G Power (4× CPU, slow 4G, static tier because headless uses software GL), **desktop** = `--preset=desktop` on the real GPU (WebGL loads).

## Measurement sessions (why there are ranges)
| Session | Build | Conditions | Notes |
|---|---|---|---|
| Baseline | `7ef9369` | previous phase, single runs | the numbers given in the brief |
| A | polish build before the final sky fix | 3 runs per profile | consistent |
| B | final candidate | 3 runs per profile | consistent on mobile |
| C | final build (sky seam fix only — no change on the mobile path) | 3 runs; **the owner's own Chrome was rendering a WebGL tab on the same iGPU (~1 CPU core continuously, measured)** | all metrics degraded together incl. no-WebGL mobile runs → environmental; committed reports in `docs/evidence/lighthouse/` are from this worst-case session |

Lighthouse proved noisy on this host even when idle: the **first page load in a fresh headless browser** paints 0.7–2.6 s late (reproduced independently of route — a harness cold-start artifact), so `scripts/perf/lighthouse.mjs --runs=3` now keeps the median run.

## Lighthouse (median of 3)
| Profile | Baseline | Session A | Session B | Session C (contended) |
|---|---|---|---|---|
| Mobile home — Perf | 87 | **94** | **93** | 85 (73 / 92 / 85) |
| Mobile home — LCP | 4.1 s | **3.1 s** (3.1 / 3.1 / 3.1) | **3.1 s** (3.1 / 3.1 / 3.1) | 4.1 s (4.1 / 3.2 / 4.1) |
| Mobile home — TBT / CLS | 30 ms / 0 | 20 ms / 0 | 80 ms / 0 | 70 ms / 0 |
| Mobile case study — Perf | 91 | **96** | **95** | 87 |
| Mobile case study — LCP | 3.5 s | **2.8 s** (×3) | **2.9 s** (3.8 / 2.8 / 2.9) | 3.6 s (3.6 / 3.9 / 2.9) |
| Desktop GPU home — Perf | 70 | 71 | 68 | 67 |
| Desktop GPU home — LCP | 0.9 s | 0.7 s | 0.7 s | 0.7 s |
| Desktop GPU home — TBT | 1,140 ms | 940 ms (940–1,250) | 2,070 ms (1,450–2,070) | 2,930 ms (1,450–2,930) |
| Desktop CLS | 0 | 0 | 0 | 0 (a 0.23 shift seen in one intermediate run → fixed with `scrollbar-gutter`) |

**Accessibility 100 and Best Practices 100 in every run.** SEO 66 is the intentional `noindex` of preview builds.

### Mobile LCP — what changed and what remains
- Bytes requested before the observed LCP: **459 KB → 316 KB**: GSAP (+ScrollTrigger/SplitText, ~51 KB) now loads after first paint; below-fold posters (61 KB) load after first paint (`DeferredImg`); fonts **99 → 67 KB** (subset to Latin-1 + punctuation + arrows, kerning/marks kept; JetBrains Mono 40 → 20 KB). GSAP's forced layouts (~1 s of 4×-throttled main thread) moved after first paint.
- Case study: the LCP poster now has a high-priority preload with `srcset`.
- **Not met: 2.5 s.** Remaining critical path ≈ 168 KB framework/app JS (Next 16 + React 19, evaluated before first paint in the unthrottled trace, so Lighthouse treats it as render-blocking), 67 KB fonts, 33 KB hero poster, 45 KB HTML+CSS. Tried and **rejected by measurement**: `experimental.inlineCss` (mobile LCP 3.1 → 3.2 s, case 2.8 → 2.9 s, TBT up). Further levers (not done): drop web fonts on phones, AVIF via `<picture>`, lazy-load the assistant/settings islands.

### Desktop TBT — root cause and what changed
- Instrumented with `scripts/perf/gl-stalls.mjs`: on ANGLE/D3D11 each program's HLSL compile happens **lazily at first use** (a `getProgramParameter(ACTIVE_UNIFORMS)` call blocks 100–900 ms per program) even though `KHR_parallel_shader_compile` is available and `compileAsync` reports completion. The one-time cost is therefore the sum of the programs the hero's first frame needs.
- First upgraded-core build: **3,859 ms of stalls over 19 programs** (Lighthouse TBT 5,210 ms). After making balanced use standard materials (physical clearcoat/anisotropy stays ultra-only) and 3-octave noise where detail is invisible: **1,253 ms over 10 programs** (sky 211, PMREM 428, three standard variants ~85–108 each, planet 149, terrain 85, aura 48, composer ~70) — every remaining stall belongs to the hero frame.
- Same-session A/B (identical conditions): pristine baseline `7ef9369` first-visit blocking **1,675 / 2,224 / 2,271 ms** (median 2,224) vs polished build **1,412 / 1,564 / 1,395 / 2,202 ms** across sessions A/B (median ≈ 1,490) → no regression despite the much richer core; under contention (session C) 2,636–3,057 ms. Repeat visits (warm shader cache): 133–250 ms (457 ms contended).
- **Not met: < 200 ms.** It would require not compiling the hero programs before first interaction or a pre-warmed browser shader cache; documented as a limitation.

## Frame rate (`docs/evidence/fps-profile.json`, 1440×900, tier pinned, 7 stations)
| Tier | Baseline | Session B (final candidate) | Session C (contended; committed JSON) |
|---|---|---|---|
| Balanced | 121–153 fps | **143–171 fps** (p95 ≤ 12.9 ms) | 117–145 fps |
| Ultra | 93–120 fps | **101–129 fps** (p95 ≤ 16.8 ms) | 90–109 fps |

Draw calls 21–43, triangles ≤ 82 k (balanced) / 127 k (ultra), programs 48–53, constant across stations. The richer core costs fewer frames than it might because balanced now uses standard materials and lighter noise.

## Long-session memory and stress (`scripts/qa/soak.mjs`, 10 cycles, ultra)
Each cycle: rapid scroll sweep through all nine anchors (down and up, 110 ms apart) + card → case study (portal transition) → back.
- JS heap (after forced GC): 27 MB at start → 33–45 MB from cycle 1 on, oscillating with GC timing, **no upward trend** across cycles 2–10.
- WebGL resources: geometries 45 → **73**, textures 21 → **22**, programs 52 → **54** after the first cycle (case-study + portal worlds), then **constant** for 9 more cycles.
- Camera re-synchronised every cycle; **0 runtime errors**.

## Main-thread and bundle notes
- Mobile TBT stays 20–80 ms (GSAP work moved after first paint and outside the LCP window).
- New code adds no runtime dependencies; the core module grew but stays inside the lazily loaded 3D chunk (not on the mobile critical path).
