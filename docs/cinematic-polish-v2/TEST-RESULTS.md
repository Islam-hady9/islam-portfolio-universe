# Cinematic Polish V2 — Test Results (final build)

Environment as in `PERFORMANCE-REPORT.md`; browsers: Playwright Chromium 156, Firefox 157, WebKit 27.2.

| Suite | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ exit 0 |
| Lint | `npm run lint` | ✅ exit 0, 0 problems |
| Format | `npx prettier --check .` | ✅ exit 0 |
| Unit + component | `npm test` | ✅ **24 files, 478 tests** (baseline 473) |
| Content | `npm run content:validate` / `content:gate` | ✅ valid; gate unchanged (42 placeholders, blocks `VERIFIED_PUBLIC`) |
| Production build | `npm run build` | ✅ 15 routes + `/api/assistant` |
| E2E (4 projects) | `E2E_PORT=3300 npx playwright test` | ✅ **58 / 58**, two consecutive full runs (chromium-desktop 49, chromium-mobile 5, firefox 2, webkit 2) |
| Accessibility | axe in `accessibility.spec` (10 routes) | ✅ 0 serious/critical |
| Visual baselines | `visual.spec` pixel baselines | ✅ regenerated for the new poster art, then 2 consecutive passes |
| Real GPU | `npm run test:e2e:gpu` | ✅ **4 / 4** (3D renders + 9 stations ACTIVE, nodes pinned/hover/approach, portal → case study, FPS profile) |
| Soak / stress | `node scripts/qa/soak.mjs <url> --cycles=10` | ✅ no resource growth after cycle 1, 0 errors, camera in sync |
| Lighthouse | `node scripts/perf/lighthouse.mjs <url> --runs=3` | see `PERFORMANCE-REPORT.md` |

## New / changed tests
- `core-geometry.test.ts` rewritten for the new builders: profile closure and orientation; chamfer/channel validation; groups (chrome + brushed); unit normals; envelope; **every face of the seamed ring points out of the solid (centroid ± ε probes against the lathed profile, incl. seam caps)**; pivots; carriage arcs; shell determinism, fracture ratio, radius bounds, winding vs normals, animation attributes (copper only on edge walls).
- `camera-path.test.ts`: `journeyMoonFor` keeps the 16:10 placement and the same screen position at 4:3 / 16:9 / 21:9; portrait untouched.
- `tiers.test.ts`: `coreDetail` must not increase on lighter tiers.
- E2E helpers: screenshots wait until in-viewport images (including deferred posters) have a source and are decoded; the 10-route smoke test has an explicit 90 s budget and ignores only WebKit's report of RSC prefetches aborted by `page.goto` (exact pattern), any other error still fails.

## Failures seen during the phase (all resolved)
| Failure | Cause | Resolution |
|---|---|---|
| Ring normal length test | three `LatheGeometry` leaves one normal unnormalised on 2-point strips | `normalizeNormals()` in the builder |
| Build type error | test file swapped during an A/B experiment | restored |
| Hero pixel baseline | poster art changed (new core) | baseline regenerated after visual review |
| Firefox smoke timeout (46 s > 45 s) | 10 network-idle navigations under parallel load | explicit 90 s budget |
| WebKit smoke "access control checks" | RSC prefetches aborted by hard navigation (timing shifted by deferred posters) | exact-pattern filter (documented artifact) |
