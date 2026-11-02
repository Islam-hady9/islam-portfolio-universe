# Cinematic Fidelity V3 — Baseline audit (P0)

Baseline: commit `adcd4ab` on `feat/intelligence-universe` (end of the Portfolio Intelligence Engine phase). Its `src/` and `tests/` are byte-identical to `dcd7883`, the code the previous phase tested (`git diff --stat dcd7883 adcd4ab -- src tests` is empty; only benchmark scripts and docs differ).

## How the baseline was captured

- **Screenshots.** `node scripts/qa/fidelity-v3.mjs http://localhost:3310 .evidence-tmp/v3/before/fidelity` against a production build of `adcd4ab`, real Intel iGPU (Chromium + ANGLE/D3D11), 1440×900 at DPR 1, `quality=ultra`, intro skipped. The same script, unchanged, produced every "after" capture (matched viewport, tier, scroll anchor and hover point). Mobile captures use Pixel 7 emulation at `quality=balanced` — emulation, not a physical phone. Stations were also captured with `scripts/qa/stations.mjs` (`.evidence-tmp/v3/before/stations`).
- **Renderer resource counts.** `window.__IU__.frame()` (draw calls, triangles, points, programs, geometries, textures) at each capture, saved in `report.json` next to the images.
- **Performance.** The pre-V3 build was rebuilt from `git archive adcd4ab` in `.evidence-tmp/baseline-v3` and served on port 3320 for the interleaved A/B in PERFORMANCE-REPORT.md (same machine, same session).
- **Tests.** Baseline results are the previous phase's executed runs on identical app code (docs/portfolio-intelligence-engine/TEST-REPORT.md): Vitest 735/735, Playwright 160 passed / 3 skipped / 0 failed across Chromium desktop, Chromium mobile, Firefox and WebKit, real-GPU suite 9/9.

Machine caveat (applies to every number in this phase): the owner's own Chrome shares the integrated GPU and swung between idle and ~96 % of the 3D engine during this session (Windows GPU Engine counters). The owner's browser was never touched.

## Renderer resources at the baseline (ultra, 1440×900)

| Capture | Draw calls | Triangles | Points | Programs | Geometries |
|---|---|---|---|---|---|
| Projects station | 32 | 3,001 | 59,300 | 53 | 63 |
| Projects + TIBYN card live | 42 | 14,377 | 59,300 | 54 | 73 |
| Projects + MOViD card live | 40 | 4,091 | 59,300 | 54 | 79 |
| Projects + ATS card live | 42 | 3,017 | 59,326 | 54 | 88 |
| Projects + LifeAtlas card live | 38 | 31,005 | 59,911 | 54 | 92 |
| Ask My AI station (portal) | 26 | 46,205 | 5,900 | 54 | 98 |
| Case study TIBYN hero | 34 | 32,125 | 6,180 | 33 | 41 |
| Case study MOViD hero | 32 | 21,839 | 6,180 | 33 | 38 |

## What the baseline looked like (observations from the captures)

| Surface | Observation |
|---|---|
| Portal energy surface | Additive disc: the terrain showed through it, so it read as a flat, foggy pale "moon" rather than an aperture with depth. Mostly above the bloom threshold, so it bloomed as a whole. |
| Portal ring | 40 plain dark boxes plus dashed cyan seam boxes; no bevels, no layering, no metal highlights; no relationship with the ground beyond the point light. |
| Explorer figure | Capsule silhouette (cylindrical torso, stick arms, sphere head): read as a placeholder. |
| Ask My AI copy | The status line (muted grey, 0.78 rem) sat over the lit terrain and washed out; on mobile it was close to unreadable. |
| Section seams | The Ask My AI and Contact overlays ended with different densities at the shared edge — a visible horizontal step at the section boundary. |
| Project cards | Live worlds framed only by a 1-px line; flat badge; title over bright world areas lost contrast; plain action button. |
| Glass surfaces | Each component had its own translucent background/border/blur values (a separate set of values on each surface converted in V3); no shared optics (edge light, corner highlights), no tokens. |
| ATS world | Readable concept, low UI detail (one line style, plain border), 1-px GL lines for the threads (thin, aliased, shimmer as the card moves). |
| MOViD world | Flat screens with a 1.5 % frame line; three content variants; large flat play triangle. |
| TIBYN world | Water reflected a fixed bright colour (no mountains in the reflection); fuzzy moon glow; two ridge layers; single torus pens. |
| LifeAtlas world | Good wireframe; single grid level (moiré at distance), 1-px constellation line, energy source a soft blob. |

## Opportunities (impact × complexity × risk)

| # | Opportunity | Impact | Complexity | Risk | Decision |
|---|---|---|---|---|---|
| 1 | Shared Intelligent Glass system (tokens, five families, optics, interaction, fallbacks) | High — every panel | Medium | Low (CSS only; contrast must hold) | Do |
| 2 | Portal rebuild: machined ring + layered energy surface + ground integration | High — S8 hero moment | High | Medium (GPU cost, shader compile) | Do, measured |
| 3 | Explorer silhouette with coat, rim light, contact shadow | Medium | Low | Low (MOViD reuses the geometry API) | Do, keep `buildExplorerGeometry` |
| 4 | Card enclosure: corner brackets, glass badge, title separation, action button | Medium | Low | Low | Do; never tint the world window |
| 5 | Anti-aliased ribbon lines replacing 1-px GL lines (ATS threads, LifeAtlas path) | Medium | Medium | Low | Do |
| 6 | TIBYN reflections of the mountains, pens with collars/handrails, crisp moon | Medium | Medium | Low | Do, without extra draws (baked silhouette lookup) |
| 7 | MOViD bezels, richer abstract footage, signal sweep, refined play element | Medium | Low | Low | Do |
| 8 | ATS card UI geometry, layer separation, match event | Medium | Low | Low | Do |
| 9 | LifeAtlas two-level grid, contour wave, energy source | Medium | Low | Low | Do; keep "concept" identity |
| 10 | Terrain tone variation and atmospheric haze | Medium | Low | Low (all terrain shares one program) | Do |
| 11 | Motion tokens for glow/fade/lift, damped card tilt, assistant response pulse | Medium | Low | Low | Do; no per-token 3D work |
| 12 | Status-line contrast and section seam | High (readability) | Low | Low | Fix (genuine defects) |
| 13 | Post-processing changes (new passes) | — | — | High (cost, artificial look) | Not done |
| 14 | New camera framings or layout changes | — | — | Out of scope | Not done |
