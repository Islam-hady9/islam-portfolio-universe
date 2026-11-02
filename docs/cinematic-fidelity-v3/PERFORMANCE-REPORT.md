# Performance report (P7)

Same machine, same session: Windows 11, Intel integrated GPU (Xe-LPG, ANGLE/D3D11), Chromium (Playwright) at 1440×900, DPR 1. **Baseline** = production build of `adcd4ab` (rebuilt from `git archive` in `.evidence-tmp/baseline-v3`, port 3320). **V3** = the final working tree (port 3310). The owner's own Chrome shared the GPU throughout (idle at times, up to ~96 % of the 3D engine at others) and was never touched; every window below records that load.

## Method

`node scripts/qa/fidelity-bench.mjs --rounds N --tier balanced|ultra` — rounds interleaved, order alternating (baseline first in odd rounds), a fresh browser profile per variant-round, tier pinned with `?quality=` (no governor). Scenarios: hero station, Ask My AI station (portal), each project card hovered (live world in the card), MOViD and TIBYN case-study heroes. For each scenario, after a settle:

- **GPU time per frame** — one `EXT_disjoint_timer_query_webgl2` `TIME_ELAPSED` query spanning an 8 s window, divided by the frames presented in it. This is the cost metric. Caveat: on ANGLE/D3D11 the query measures elapsed GPU time across the window, so other GPU work interleaved with ours (the compositor, other processes) inflates it; windows are therefore tagged with the 3D-engine load of **other** processes (Windows GPU Engine counters sampled during the window, the benchmark's own browser excluded) and summarised over **clean windows** (no disjoint event, other load < 15 %), falling back to all windows when fewer than two are clean.
- **Frame pacing** — presented-frame intervals from `requestAnimationFrame` (headless Chromium ticks at up to 240 Hz, so FPS is quantised; p99 and max show hitches).
- Renderer resources (`window.__IU__.frame()`), JS heap, and GPU process memory of the benchmark browser at the end of each run.

The `balanced` tier is what this integrated GPU auto-selects; `ultra` is what discrete GPUs get.

## Poster weight (re-rendered from the refined scenes)

The resting cards, the static/lite tiers, touch devices and the case-study heroes show WebP posters rendered from the live scenes (`scripts/capture/posters.mjs` + `encode-posters.py`, same crops, sizes and qualities as before). Finer detail (LifeAtlas minor grid, TIBYN water, the portal) compresses less:

| Set | Before | After |
|---|---|---|
| Home posters, desktop full-size (hero, journey, portal, horizon, universe, 4 project cards) | 314 KB | 367 KB (+52 KB) |
| — of which the hero (preloaded; the mobile LCP element), full / 800w / 480w | 61 / 33 / 16 KB | 59 / 32 / 16 KB (smaller) |
| Home posters, phone 480w variants (all but the hero load deferred, after first paint) | 96 KB | 119 KB (+24 KB) |
| Case-study hero (that page's LCP image), TIBYN full / 800w / 480w | 29 / 10 / 5 KB | 44 / 15 / 7 KB |
| Case-study hero, MOViD | 34 / 12 / 6 KB | 28 / 10 / 5 KB |
| Case-study hero, ATS | 27 / 9 / 5 KB | 29 / 10 / 5 KB |
| Case-study hero, LifeAtlas | 81 / 30 / 13 KB | 141 / 42 / 16 KB |

Lowering the WebP quality for the LifeAtlas poster was tried (q60 still 107 KB) and rejected: it smears exactly the thin lines the refinement added. Its LCP effect is measured below.

## GPU time per frame — balanced tier (auto-selected on this iGPU), 4 interleaved rounds

Clean-window medians (no disjoint event, other processes < 15 % of the 3D engine); raw windows and contention in [evidence/perf-ab-balanced.json](evidence/perf-ab-balanced.json).

| Scenario | Baseline | V3 | Δ | Clean windows (b · v) | Note |
|---|---|---|---|---|---|
| Hero station | 5.01 ms | 5.36 ms | +7 % | 4/4 · 4/4 | inside the baseline's own window spread (4.81–5.61 ms) |
| **Ask My AI station (portal)** | 4.83 ms | 5.59 ms | **+16 % (+0.76 ms)** | 4/4 · 3/4 | the new ring, energy surface, motes, glows and spill; one V3 window at 49.8 % outside load excluded |
| TIBYN card live | 4.41 ms | 4.43 ms | 0 % | 4/4 · 3/4 | |
| MOViD card live | 4.36 ms | 4.09 ms | −6 % | 4/4 · 3/4 | |
| ATS card live | 4.16 ms | 4.25 ms | +2 % | 4/4 · 4/4 | |
| LifeAtlas card live | 4.25 ms | 4.36 ms | +3 % | 4/4 · 4/4 | |
| MOViD case-study hero | 5.30 ms | 4.99 ms | −6 % | 4/4 · 4/4 | |
| TIBYN case-study hero | 5.44 ms | 5.59 ms | +3 % | 4/4 · 4/4 | water now ray-tests three baked ridge profiles |

Reading: the only clear cost is the portal station, +0.76 ms of GPU time per frame — about 4.5 % of a 60 Hz frame budget; everything else is within ±7 %, i.e. within the noise of single windows on this shared GPU. Frame pacing (quantised presented frames, medians of windows): portal station p99 12.6 → 16.7 ms (one more 240 Hz tick at the 99th percentile), all other scenarios unchanged (≈ 12.5 ms). Max frame times include rare 40–160 ms hitches in **both** builds (garbage collection / compositor), not a V3 pattern.

Memory: GPU process memory of the benchmark browser 367 → 378 MB (median of runs, +~10 MB; baseline runs 359–385 MB, V3 372–388 MB); JS heap +0–3 MB per scenario (e.g. portal station 24 → 27 MB).

## Ultra tier (4× MSAA) — incomplete

The ultra A/B was stopped by Claude Code's memory-pressure guard (the machine ran critically low on RAM; the benchmark, both servers and nothing else of this session were stopped) after **one** interleaved round, before the per-window contention tags were written. Single-round raw GPU time per frame, baseline → V3, for orientation only: hero 6.31 → 6.37 ms, portal station 6.06 → 6.59 ms (+9 %), cards 5.39–5.56 → 5.53–5.78 ms (0 to +7 %), MOViD case 7.60 → 7.56 ms, TIBYN case 8.01 → 8.70 ms (+9 %). Not used for conclusions.

## Bundle (from the two production builds on disk, no server)

| | Baseline | V3 | Δ |
|---|---|---|---|
| All static JS chunks (incl. the lazily loaded 3D and AI code) | 8,109 KB (2,780 KB gz) | 8,143 KB (2,791 KB gz) | +34 KB (+11 KB gz, +0.4 %) |
| CSS (render-blocking) | 95.6 KB (23.9 KB gz) | 101.0 KB (25.1 KB gz) | +5.4 KB (+1.2 KB gz) |

The JS growth is the new portal, figure and world code, which loads with the deferred 3D enhancement after first paint; the CSS growth is the glass system.

## Not measured in this session

Stopped before they could run (same memory-pressure stop; not restarted on my own per the guard's instruction): the interleaved **Lighthouse A/B** (mobile LCP, desktop loading, TBT — `node scripts/ai/lh-ab.mjs --a <baseline> --b <v3> --rounds 3 --only mobile-static-home,desktop-gpu-home,mobile-static-case-lifeatlas --dir .evidence-tmp/v3/lh --json docs/cinematic-fidelity-v3/evidence/lighthouse-ab.json`), the **first-load shader-compile stall and long-task** comparison (`scripts/perf/gl-stalls.mjs`, `scripts/perf/long-tasks.mjs` on both builds), the **responsiveness A/B** (`scripts/qa/fidelity-latency.mjs`: first hover → live world, Enter → Smart answer) and the **Local AI GPU-memory coexistence** comparison (`scripts/ai/bench-local.mjs` with the model cached for origin `localhost:3310`, so the baseline must be served on that port for its run). What is known without them: the home page's LCP element (the hero poster) got slightly smaller (61.3 → 58.7 KB full, 16.1 → 15.7 KB phone variant); the LifeAtlas case-study LCP image grew (81 → 141 KB full, 30 → 42 KB at 800w); the new shader programs (+9 on the home scene) are compiled by the existing `compileAsync` warm-up with parallel compilation, but their first-load stall was not measured; render-blocking CSS grew 1.2 KB gzipped.

## Conclusion

Measured: V3's only clear GPU cost is the portal station on the auto-selected balanced tier, **+0.76 ms per frame (+16 %)** — about 4.5 % of a 60 Hz frame — with GPU process memory +~10 MB and JS heap +0–3 MB; worlds, cards and case studies are within ±7 % (noise on this shared GPU). Not yet measured: LCP, first-load stalls and responsiveness A/Bs (commands above), and a complete ultra-tier A/B. "Optimized" is not claimed.
