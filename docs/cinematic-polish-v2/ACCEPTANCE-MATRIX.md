# Cinematic Polish V2 — Acceptance Matrix (Definition of Done)

`VERIFIED` = evidence attached · `VERIFIED*` = subjective criterion, engineering self-assessment (final sign-off is the owner's) · `PARTIAL` = gap stated.

| # | Definition of Done item | Status | Evidence |
|---|---|---|---|
| 1 | Hero Intelligence Core shows a substantial, verified visual improvement | VERIFIED* | `evidence/core-before-after.webp` (2× matched framing), `evidence/hero-before-after.webp`, `evidence/core-motion-after.webp`; geometry builders unit-tested (solidity/orientation of every face) |
| 2 | Galaxy and project worlds more polished and immersive | PARTIAL | Universe: lit worldlets, link packets, selection ripple (`evidence/universe-before-after.webp`). Worlds: MOViD upgraded (`evidence/project-worlds-before-after.webp`); TIBYN, ATS, LifeAtlas reviewed and left unchanged |
| 3 | Camera choreography coherent; no critical clipping or unwanted scene exposure | VERIFIED | `evidence/transitions-after.webp` (3D-only between stations); 10-cycle soak keeps the camera in sync; previous phase's ground-crossing guard re-verified |
| 4 | Motion systems refined and consistent | VERIFIED | `src/lib/motion.ts` tokens adopted by reveals, travel, node approach and portal; core intro/idle/pointer choreography (`MOTION-REFINEMENT.md`) |
| 5 | Interactive elements remain functional and accessible | VERIFIED | E2E 58/58 ×2 (navigation, keyboard, mobile menu, settings, assistant demo, portals); axe 0 serious/critical on 10 routes |
| 6 | Visual composition improved across major sections | VERIFIED* | Hero, universe, journey framing at every aspect, card spotlights; remaining sections reviewed (already matched the reference) — `evidence/stations-desktop-after.webp`, `evidence/stations-mobile-after.webp` |
| 7 | Mobile performance improved and measured | VERIFIED (target PARTIAL) | Home LCP 4.1 → 3.1 s, case study 3.5 → 2.8–2.9 s, Perf 87 → 93–94 / 91 → 95–96 (sessions A/B); 2.5 s target **not** met — root cause in `PERFORMANCE-REPORT.md` |
| 8 | Desktop main-thread blocking investigated and meaningfully reduced where feasible | PARTIAL | Root-caused to lazy ANGLE/D3D11 shader compiles (per-program stall list); stalls cut 3,859 → 1,253 ms after the core upgrade; same-session first-visit blocking median 2,224 → ≈ 1,490 ms vs baseline; Lighthouse TBT varied 940–2,930 ms with host load; < 200 ms not feasible without deferring hero programs |
| 9 | Responsive layouts reviewed | VERIFIED | 6-viewport overflow/screenshot suite; 4:3 journey fix (`evidence/journey-4x3-before-after.webp`); mobile station tour; `scrollbar-gutter` CLS fix |
| 10 | Existing functional and rendering baselines preserved | VERIFIED | Unit 473 → 478; E2E 58/58; GPU 4/4; axe clean; FPS ≥ baseline in the uncontended session |
| 11 | No critical visual, accessibility or runtime regressions remain | VERIFIED | Sky seam (introduced mid-phase) found by evidence review and fixed; soak 0 errors; reduced motion / no-WebGL / context loss suites pass |
| 12 | Evidence captured and documented | VERIFIED | `docs/cinematic-polish-v2/evidence/`, this folder's reports; raw captures and videos stay local (`.evidence-tmp/`, git-ignored) |
| 13 | Code changes committed locally | VERIFIED | see `CLOSURE-REPORT.md` → Git |
| 14 | Working tree clean | VERIFIED | `git status` empty after the closing commit |
| 15 | Remaining risks and limitations documented | VERIFIED | `CLOSURE-REPORT.md`, `PERFORMANCE-REPORT.md` |
