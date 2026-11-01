# Cinematic Polish V2 — Closure Report

Branch `feat/intelligence-universe`, 2026-11-01. Not pushed, merged or deployed. Content freeze respected (no CV data, schemas or gates touched).

## What changed
1. **Hero intelligence core rebuilt for fidelity**: precision-machined gimbal rings (chamfers, brushed channel, seams with caps, pivots), riding carriages, a graduated dial ring, a fractured two-layer curved shell with copper inlays, and a layered emitter (circuit traces with travelling pulses, plasma aura, hot core); silver-tuned environment; intro assembly, panel breathing and inertial pointer lean.
2. **Universe**: lit destination worldlets, energy packets on links, selection ripple; two-tone nebula.
3. **Project worlds**: MOViD gains a polished-floor mirror and depth falloff.
4. **Motion system**: shared motion tokens across GSAP/WebGL choreography; GSAP now initialises after first paint.
5. **Interaction**: pointer spotlight on philosophy/capability cards.
6. **Responsive**: aspect-aware journey moon (4:3 → 21:9); `scrollbar-gutter: stable` removes a mid-load layout shift.
7. **Performance**: deferred below-fold posters, subset fonts (99 → 67 KB), case-study LCP preload, lighter phone posters, standard materials on balanced, 3-octave noise where detail is invisible.
8. **Tooling**: CPU profiler, GL-stall attribution, soak/stress runner, core evidence capture, median-of-N Lighthouse.
9. **Defects found and fixed this phase**: sky lattice seam (hard-edged disc at the universe station), unnormalised lathe normals, flaky screenshot/smoke timing.

## Measured outcome (details: `PERFORMANCE-REPORT.md`)
| Metric | Baseline | After (uncontended sessions) |
|---|---|---|
| Mobile home LCP / Perf | 4.1 s / 87 | **3.1 s / 93–94** |
| Mobile case-study LCP / Perf | 3.5 s / 91 | **2.8–2.9 s / 95–96** |
| CLS (mobile, desktop) | 0, 0 | 0, 0 |
| Desktop TBT | 1,140 ms | 940–2,070 ms (host-load dependent; same-session first-visit blocking median 2,224 → ≈ 1,490 ms) |
| FPS balanced / ultra | 121–153 / 93–120 | **143–171 / 101–129** |
| Soak (10 cycles) | not tested | heap plateau, GPU resources constant, 0 errors |
| Tests | 473 unit, 58 E2E, 4 GPU | **478 unit, 58 E2E (×2), 4 GPU**, axe 0 serious/critical |

## Remaining limitations
- **Mobile LCP above 2.5 s** in Lighthouse's slow-4G simulation (≈ 2.8–3.1 s): the framework JS (~168 KB) evaluated before first paint is treated as render-blocking; inline CSS was tried and measured worse.
- **Desktop cold first visit** still blocks ~1.3–2.2 s on Windows/ANGLE (lazy HLSL compile of the hero programs); repeat visits 133–250 ms.
- Measurements on this host are sensitive to other GPU work (documented session C).
- No physical phone/tablet was available — mobile verified by emulation and Lighthouse only.
- Value-noise hash is precision-sensitive (the seam fix removed the visible case; other noise uses are smooth in practice).
- Three of the four project worlds were reviewed but not changed.
- Final visual sign-off belongs to the owner.

## Verdict
- **CV population (next phase): CONDITIONAL GO** — the experience is polished, stable and fully tested; conditions as in `docs/release-readiness.md` (content via the documented process, re-run tests and gate).
- **Public deployment: NO-GO for now** — mobile LCP budget not met, no real-device pass, desktop cold-start blocking, owner visual sign-off and content approval pending.

## Git
See the commit list in the final delivery message; working tree clean after the closing commit.
