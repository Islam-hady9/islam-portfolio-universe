# Test results (P8)

All runs below were executed in this session (2026-11-02). Browser suites ran on the production build of the V3 working tree made at 15:44 (`next build`, served by `next start` on port 3310) — see "Final code state" for the three small fixes made after that build, Windows 11, Intel integrated GPU (Xe-LPG, ANGLE/D3D11). The owner's own Chrome shared that GPU throughout (up to ~96 % of its 3D engine at times); it was not touched.

## Static checks

| Check | Result |
|---|---|
| `tsc --noEmit` (strict, whole repo) | pass |
| ESLint | pass, 0 problems on `src`, `tests`, `scripts`; root `npm run lint` re-run after deleting the temporary baseline copy (see "Final run" below) |
| Prettier (`src`, `tests`, `scripts`, configs) | pass |
| `npm run content:validate` | OK — 4 projects, 4 case studies, 8 career entries, 4 capability groups, 10 assistant entries (unchanged) |
| `npm run content:gate` | 41 records pending (unchanged) — DEMO_CONTENT allowed, VERIFIED_PUBLIC still blocked |
| `npm audit --omit=dev` | 0 vulnerabilities |

## Unit and component (Vitest, jsdom)

**752 passed / 41 files** (baseline 735 / 38). New in V3 (17 tests, 3 files):

| File | Covers |
|---|---|
| `tests/unit/experience/objects/portal-figure.test.ts` (10) | portal housing segment stays outside the energy surface and inside its rear plate; one segment spans one segment angle (24 tile the ring with a joint gap); bevels present; clamps beyond the outer band; precision ring at the surface edge; marking layout (5 per segment, kinds, within their bands); explorer stands on the origin at ~1.8 units, adult proportions, positions + unit normals only; terrain tone variation deterministic and within ±12 % |
| `tests/unit/experience/objects/ribbon.test.ts` (4) | ribbon topology (2 vertices per point, 2 triangles per segment), centreline vertices with unit side vectors, strips perpendicular to the view direction, `aT`/`aLane` attributes |
| `tests/component/ask-ai/glass-and-signal.test.tsx` (3) | the panel uses the glass families (panel, inset field, chip prompts, inset answers, chip sources); the portal signal increments exactly once per completed answer — never while typing; the store counter |

## End-to-end (Playwright, production build, software GL)

| Run | Result |
|---|---|
| Full suite, 4 projects (`E2E_PORT=3310 npx playwright test`) | **159 passed, 1 failed, 3 skipped (by design)** in 4.9 min — Chromium desktop 76, Chromium mobile (Pixel 7) 30, Firefox 27, WebKit 26 |
| The failure | WebKit, `ask-ai.spec.ts` "suggestions answer with one click": the Smart engine stayed `idle` for 15 s after the panel scrolled into view (its lazy load did not start in time under load at the end of the run). Every other WebKit assistant test, using the same helper, passed. The lazy-load path is untouched by V3 (the panel diff adds class names and one post-answer signal call). Re-run in isolation: **3 / 3 passed**. Same class of WebKit-under-load flake recorded in the previous phase. |
| New `glass.spec.ts`, 4 projects, `--repeat-each=5` | **50 passed, 10 skipped** (the two pointer-tilt tests are skipped on the touch project by design): nested glass surfaces (field, chips, answers, sources) never use a backdrop filter; tiles tilt (3D transform) only with full motion and a fine pointer; no tilt under reduced motion |
| Pixel baselines (`visual.spec.ts`, static tier) | hero and projects index pass within their 2 % tolerance; baselines unchanged |

Coverage of the required categories inside these runs: accessibility (axe on the home sections, About, Contact, the assistant's answer and consent states — `accessibility.spec.ts`, `ask-ai.spec.ts`); reduced motion (`motion.spec.ts`, `ask-ai.spec.ts`, `glass.spec.ts`); no-WebGL path (`motion.spec.ts` "no-WebGL browsers get the full site with static art"); context loss (`motion.spec.ts` "forced lite tier renders WebGL and survives a context loss"); AI Smart smoke (`ask-ai.spec.ts` on 4 projects, `honesty.spec.ts`); Local AI fallback without WebGPU (`ask-ai.spec.ts`).

While developing the new spec, its first two drafts failed intermittently in Firefox (the tilt test, and in one repeated run also the reduced-motion test; the second draft's wait-for-reveal poll with a wheel nudge timed out). A direct Firefox probe showed no residual inline transform on the tile, so the exact cause was not isolated. The helper now uses Playwright's actionability-checked `hover()` and re-asserts the hover inside the poll; after that change: 50 / 50 over five repeats on all four projects.

## Real GPU (opt-in `gpu` project, Intel Xe-LPG)

`E2E_PORT=3310 node scripts/qa/e2e-gpu.mjs` — **9 passed / 9** in 2.5 min:

- Local AI (cached Qwen2.5-1.5B in the git-ignored test profile): consent → download/initialize → streamed, cited answer with the 3D render hold on during generation and released after; blocked questions never reach the model; Stop mid-generation keeps the question; Back to Smart Mode releases the model and the hold.
- WebGL: real 3D renders and the camera travels through every station without console errors (the new portal, figure, terrain and world shaders compile and run); universe nodes; a project portal goes live on hover and transitions into the case study; the intro reel stops and resumes rendering; the per-station frame-rate profile (recorded under contention, saved as `evidence/fps-profile-gpu-suite.json`; the tracked `docs/evidence/fps-profile.json` was restored to its earlier reference values).

Real-GPU evidence captures (`scripts/qa/fidelity-v3.mjs`, 37 captures incl. emulated mobile, plus five portal framings): no page or console errors.

## Final code state (after the last browser runs)

Three small fixes were made after the 15:44 build, found by review: the glass fallbacks for reduced transparency / no backdrop support now use `!important` (they lost to module-level `--g-a` values); the portal's mote count no longer lives in the housing geometry memo, and instance matrices are re-applied whenever the instanced meshes are rebuilt (a governor tier change would otherwise have collapsed the housing segments onto one angle); the portal meshes are named for the debug tool. Two browser tests were added for them: `glass.spec.ts` "reduced transparency" (Chromium, DevTools-protocol media emulation; skips itself where the feature is not exposed) and `webgl.spec.ts` "a runtime tier change keeps the portal housing intact" (real GPU).

On the final code: `tsc` pass; `npm run lint` (whole repo, after deleting the temporary baseline copy) pass, 0 problems; Prettier pass; **Vitest 752 / 752**.

**Pending (not executed):** the final rebuild and the browser suites on it — full E2E on four projects (including the two new tests) and the real-GPU suite. Claude Code's memory-pressure guard stopped both servers and the benchmark of this session when the machine ran critically low on RAM, with the instruction not to restart them without being asked; they were not restarted. Commands: `npx next build`, `npx next start -p 3310`, `E2E_PORT=3310 npx playwright test`, `E2E_PORT=3310 node scripts/qa/e2e-gpu.mjs` (then restore `docs/evidence/fps-profile.json`).

## Not executed

- Physical phones/tablets (none available) — mobile evidence is Pixel 7 emulation on the desktop GPU.
- Safari/Firefox with a real GPU, discrete GPUs, macOS/Linux.
- `prefers-reduced-transparency` (Playwright cannot emulate it; the fallback is CSS-only and reviewed in code).
- A human visual review — final visual sign-off is the owner's.
