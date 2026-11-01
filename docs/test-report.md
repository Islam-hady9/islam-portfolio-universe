# Test Report — The Intelligence Universe

> **Update — Personal Media Integration (2026-11-01):** portrait + intro reel, see [`docs/personal-media-integration/README.md`](personal-media-integration/README.md) — 527 unit/component tests, 92 E2E (Chromium desktop/mobile, Firefox, WebKit) ×2 with 0 failures, 4 GPU; interleaved Lighthouse before/after (home mobile LCP 3.12 → 3.26 s, /about mobile LCP 1.06 → 3.13 s, CLS 0, zero video bytes before the player opens).
>
> **Update — Cinematic Polish V2:** current results are in [`docs/cinematic-polish-v2/TEST-RESULTS.md`](cinematic-polish-v2/TEST-RESULTS.md) and [`PERFORMANCE-REPORT.md`](cinematic-polish-v2/PERFORMANCE-REPORT.md) (478 unit tests, 58 E2E ×2, 4 GPU, soak; mobile LCP 3.1 s / 2.8–2.9 s). The sections below record the previous phase.

Spec §13.3. Every number below was produced by a command in this file, on the environment below, against the **final production build** of branch `feat/intelligence-universe` on 2026-11-01. Nothing is estimated.

## Environment

| Item | Value |
|---|---|
| OS | Windows 11 Home Single Language 10.0.26300 |
| CPU / RAM | Intel Core Ultra 7 255HX (20 threads) / 16 GB |
| GPUs | Intel Graphics (iGPU, used by Chromium/ANGLE D3D11 by default) · NVIDIA RTX 5060 Laptop (not selected by Chromium) |
| Runtime | Node 24.12.0, npm 11.7.0, Python 3.14 (Pillow) for evidence encoding |
| Framework | Next.js 16.4.3 (Turbopack), React 19.3.1, three 0.186.1, R3F 9.8.2 |
| Test tools | Vitest 5.0.5 (jsdom 30), Playwright 1.64.1, @axe-core/playwright 4.14, Lighthouse 13.6 |
| Browsers | Chromium 156.0.8078.4 · Firefox 157.0 · WebKit 27.2 (Playwright builds) |
| Build under test | `next build` → `next start -p 3300` |

## Commands

```bash
npm run typecheck                 # tsc --noEmit (strict)
npm run lint                      # eslint .
npm test                          # vitest run (unit + component)
npm run build                     # next build
npm run content:validate          # zod contracts + cross-references
npm run content:gate              # lists placeholder records; fails in VERIFIED_PUBLIC mode
npx playwright test               # E2E: chromium-desktop, chromium-mobile, firefox, webkit (needs a build)
npm run test:e2e:gpu              # real-GPU WebGL suite (opt-in project `gpu`)
npm run perf:fps                  # GPU frame-rate profile → docs/evidence/fps-profile.json
npm run perf:lighthouse -- http://localhost:3300
node scripts/perf/long-tasks.mjs http://localhost:3300
node scripts/qa/stations.mjs http://localhost:3300/ out/ --gpu --quality=ultra   # station tour
node scripts/qa/transitions.mjs http://localhost:3300 out/                        # 3D between stations
node scripts/qa/record.mjs http://localhost:3300 docs/evidence/video              # motion recordings
```

`E2E_PORT=3300` points Playwright at an already running server instead of starting one.

> Headless browsers render WebGL with SwiftShader (software). The site classifies software renderers as the **static** tier, so the default E2E projects exercise the static/fallback experience deterministically. Real-GPU behaviour is covered by the opt-in `gpu` project and the GPU QA scripts (new-headless Chromium, ANGLE/D3D11 on the Intel iGPU).

## Results (final build)

| Suite | Result |
|---|---|
| Typecheck (`tsc --noEmit`, strict) | ✅ exit 0 |
| Lint (`eslint .`, next core-web-vitals + typescript) | ✅ exit 0, 0 problems |
| Format (`prettier --check .`) | ✅ exit 0 (formatting-only commit `c33a8e1`, re-verified with typecheck, lint, unit, build, 58 E2E and 3 functional GPU tests) |
| Unit + component (Vitest) | ✅ **24 files, 473 tests passed**, 0 skipped |
| Content validation / gate | ✅ valid; gate lists 42 placeholder records and exits 1 when `NEXT_PUBLIC_CONTENT_MODE=VERIFIED_PUBLIC` (by design) |
| Production build | ✅ 15 routes (static/SSG) + `/api/assistant` (dynamic) |
| E2E · chromium-desktop (1440×900) | ✅ 49 passed (navigation, projects, honesty audit, 10× axe, keyboard, motion/fallback/context-loss, 6-viewport responsive, 2 pixel baselines) |
| E2E · chromium-mobile (Pixel 7) | ✅ 5 passed (mobile menu focus/inert/Escape, vertical universe list, touch targets, smoke) |
| E2E · firefox-desktop | ✅ 2 passed (smoke) |
| E2E · webkit-desktop | ✅ 2 passed (smoke) |
| **E2E total** | ✅ **58 passed**, 0 failed, 0 flaky |
| E2E · gpu (real GPU, serial) | ✅ 4 passed: 3D renders (>10 draw calls, >10k tris), camera reaches all 9 stations with scene state `ACTIVE`; nodes pinned to 3D + hover + approach + travel; portal live on hover → transition → live case-study hero; FPS profile recorded |
| Accessibility (axe, WCAG 2.0/2.1/2.2 A+AA tags) | ✅ 0 serious/critical violations on `/`, `/projects`, 4 case studies, `/about`, `/contact`, `/resume`, 404 |

### What the E2E suites assert (highlights)
- **IU-006 link inventory:** every `href` on every route resolves (HTTP < 400), every hash target exists, no `mailto:`/`tel:`, the only external host is `github.com`.
- **IU-007:** no reference-image employers (Assiut, USAID, VEEM, DigiTee, NOBEL, Zedny, 4D Company) appear anywhere; "Sample journey" is visible; LifeAtlas never says "health".
- **IU-008:** "Demo mode" visible; each sample prompt yields an answer labelled *Demo* with the "Not generated by a language model" disclaimer; injection attempts are refused; **zero requests to `/api/*`**; `/api/assistant` returns 503 `unavailable` (POST), 400 (invalid), 405 (GET).
- **IU-011:** with `getContext('webgl*')` forced to `null`, the tier is `static`, no canvas exists, posters show, and anchors/cards still work with zero runtime errors. Forced `lite` tier survives `WEBGL_lose_context` loss → DOM stays usable → restore returns to `ready`.
- **IU-010:** reduced motion → no prelude, nothing hidden by reveals; prelude plays once per session and ends < 2.6 s; skip button works; skip link focuses `#main`; arrow/Home/End keyboard navigation on milestones; settings dialog closes on Escape and returns focus.
- Pixel baselines wait until every in-viewport image is decoded (`viewportImagesDecoded`), so they never race the poster art (this race was found and fixed in this pass — see defects).

## Performance

### Lighthouse 13.6 (production, `scripts/perf/lighthouse.mjs`)

Mobile = Lighthouse default (simulated Moto G Power, 4× CPU slowdown, slow 4G). Desktop = `--preset=desktop` on the real GPU (WebGL loads).

| Run | Perf | A11y | Best pr. | SEO* | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| mobile · home | 87 | 100 | 100 | 66 | 1.1 s | **4.1 s** | 30 ms | 0 |
| mobile · case study | 91 | 100 | 100 | 66 | 0.9 s | **3.5 s** | 40 ms | 0 |
| desktop GPU · home (cold) | 70 | 100 | 100 | 66 | 0.3 s | 0.9 s | **1,140 ms** | 0 |

\*SEO 66 is intentional: preview builds (`DEMO_CONTENT`) emit `noindex` and `Disallow: /` until content is verified (D-11).

Mobile history, same profile (what each fix bought): Perf 56 → 83 → 86 → 87; TBT 7,210 ms → 310 ms → 40 ms → 30 ms after (1) deferring the 3D enhancement until load + idle/first interaction on touch devices, (2) idle-scheduling reveal setup, (3) moving zod out of the client bundle and lazy-loading GSAP for anchor travel.

### Main-thread long tasks on desktop (real GPU, unthrottled, `scripts/perf/long-tasks.mjs`, two runs)

| Visit | 3D ready at | Long tasks (start ms, duration ms) | Σ blocking >50 ms |
|---|---|---|---|
| First (fresh profile: cold HTTP + shader cache) | 2,920 / 3,041 ms | run 1: (25, 57) (784, 224) (1,054, 54) (1,368, 168) (1,537, **1,294**) | 1,547 / 1,579 ms |
| Repeat (same browser) | 806 / 968 ms | run 1: (14, 73) (260, 56) (582, 123) (706, 70) | **122 / 200 ms** |

The ~1.3 s first-visit task is one-time HLSL shader compilation for programs the first frames need (environment PMREM filters, the composer's merged effect pass); it starts after `load` + idle with the canvas still invisible.

### Frame rate (`docs/evidence/fps-profile.json`)

Headless Chromium on the Intel iGPU (ANGLE D3D11), 1440×900 @1× DPR, one page at a time, tier pinned, 4 s settle, 2.5 s rAF sample per station. Headless frames are not vsync-capped. Frosted-glass `backdrop-filter` is active (it was silently missing before this pass — see defects), and philosophy/capabilities are the stations with the most glass over the live canvas.

| Tier | top | universe | philosophy | capabilities | experience | ask-ai | contact |
|---|---|---|---|---|---|---|---|
| balanced fps (p95 ms) | 128 (8.4) | 126 (12.5) | 153 (12.6) | 140 (16.6) | 121 (12.5) | 121 (12.6) | 121 (12.5) |
| ultra fps (p95 ms) | 95 (12.6) | 102 (12.6) | 120 (12.5) | 120 (16.7) | 102 (12.6) | 105 (12.5) | 93 (12.6) |

Draw calls 21–38, triangles 3k–107k, shader programs constant at 49–51 across stations (all precompiled; no compilation during travel). Auto-detected tier on this machine: `balanced`.

## Evidence index

| Path | Content |
|---|---|
| `docs/evidence/screenshots/` | home hero, full page and case study at 1440×900, 1920×1080, 1024×768, 768×1024, 390×844, 320×640 (static tier, from `visual.spec.ts`, WebP) |
| `docs/evidence/live-3d/stations-desktop-ultra.webp` | all 9 home stations, real GPU, 1440×900, ultra |
| `docs/evidence/live-3d/stations-mobile-balanced.webp` | all 9 stations, 390×844 touch emulation, balanced |
| `docs/evidence/live-3d/transitions-desktop-ultra.webp` | 3D only (DOM hidden) between stations, incl. the three ground-crossing veils, and the identity station with the pointer at top/middle/bottom |
| `docs/evidence/live-3d/project-portals-live.webp`, `portal-transition.webp` | four live project portals; card → case-study portal sequence |
| `docs/evidence/lighthouse/*.report.html` | the three Lighthouse runs above (JSON kept locally, git-ignored) |
| `docs/evidence/fps-profile.json` | per-station FPS / p95 / max / draw calls / triangles / programs |
| `docs/evidence/video/` | 01 hero gyroscope + parallax, 02 scroll journey, 03 universe node approach, 04 portal transition — WebM recorded on the GPU (≈15 MB, **local only, git-ignored**; regenerate with `npm run qa:record -- <url>`) |
| `tests/e2e/__screenshots__/` | pixel baselines (hero + projects, static tier) |

## Defects found and fixed during verification

| Found by | Defect | Fix |
|---|---|---|
| E2E keyboard/visibility | Reveals used `visibility:hidden` → unrevealed links unfocusable | opacity-only reveals |
| E2E header nav | `next/link` swallowed same-page anchors | capture-phase anchor handling |
| E2E overflow scans | `aspect-ratio` + `min-height` widened boxes at 320/1024 px | `minmax(0,1fr)` grids, explicit widths |
| axe | Label-in-name (WCAG 2.5.3) on brand links | visible text + sr-only suffix |
| GPU profiling | Lights in gated groups changed light count → program recompiles while travelling | constant `WorldLights` |
| GPU profiling | Precompile used wrong output colour space under the composer | compile against a linear target |
| Firefox smoke | zod's JIT probe tripped the CSP (`eval`) | zod removed from client bundle |
| Unit suite (independent reviewer) | Demo tokenizer kept trailing `.`; anchors could exceed `maxScroll`; torn shard faces; `//host` passed as internal href; over-broad privacy filters | fixed + regression tests |
| Lighthouse | 3D initialised during load on emulated mobile (TBT 7.2 s) | deferred enhancement, idle scheduling |
| Computed-style check | **Glass blur missing in Chromium/Firefox**: Lightning CSS dropped `backdrop-filter` because the `-webkit-` declaration came after it | prefixed declaration first (12 rules); verified `getComputedStyle(header).backdropFilter = blur(16px) saturate(1.3)` |
| Transition sweep (`scripts/qa/transitions.mjs`) | **Camera passed through three terrain layers** between stations (identity→universe, experience→ask-ai, ask-ai→contact) → floating terrain sheets / hard slab edge | crossing points solved on the path; short canvas veil from 1.4 units above ground; the layer above is hidden under the veil (unit-tested: 0 at every station, opaque at contact) |
| Pointer test at identity | **Moving the mouse toward the header opened a hole in the ground** (2° pitch parallax sank the camera below the hero terrain, revealing the galaxy) | rig ground guard (parallax never takes the camera within 0.35 of a visible ground) + identity camera raised 0.5 |
| Station review at 4 aspect ratios | Journey moon overlapped the right-aligned subtitle at 16:10 and 16:9 | moon moved to the right frame edge (reference composition); journey poster re-rendered |
| Visual baseline review | Hero pixel baseline had been captured before the poster decoded (timing-dependent) | screenshots wait for in-viewport images to decode; baseline regenerated and verified stable twice |
| Windows run of npm scripts | `VAR=value cmd` scripts and missing script files | cross-platform `scripts/qa/e2e-gpu.mjs`; content scripts implemented |

## Known gaps (not hidden)

- **Mobile LCP 3.5–4.1 s** in Lighthouse's slow-4G simulation vs the 2.5 s budget. LCP element is the hero poster image (preloaded, `fetchpriority=high`). Next levers: subset JetBrains Mono (used only for labels), AVIF posters via an image CDN, trim Link prefetch on slow connections.
- **Desktop first-visit blocking ≈1.55 s** (one-time shader compilation, canvas still hidden). Repeat visits: 122–200 ms.
- Real phones were not available; mobile behaviour was verified with Chromium device emulation (Pixel 7) and Lighthouse simulation only.
- WebGL on Firefox/WebKit was exercised only in their software paths (static tier) in this environment.
- At 4:3 the journey moon now sits just outside the frame (decorative; the station still has terrain and aurora).
