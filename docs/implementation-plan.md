# Implementation Plan — The Intelligence Universe

Spec: `docs/intelligence_universe_master/MASTER_IMPLEMENTATION_SPEC.md` (IU-MASTER-001 v1.0.0)
Reference: `docs/intelligence_universe_master/APPROVED_HOMEPAGE_REFERENCE.png` (941×1672, compressed full-page concept)
Branch: `feat/intelligence-universe` · Status tracking: `docs/acceptance-matrix.md` · Decisions: `docs/decisions.md`

## 0. Audit summary (2026-11-01)

| Item | Finding |
|---|---|
| Repo | `README.md` + untracked `docs/` only. No app code, no lockfile, no CI. Remote `origin` on GitHub (not pushed to). |
| Toolchain | Node 24.12, npm 11.7, Python 3.14 + PIL, Playwright browsers cached (Chromium/Firefox/WebKit), Chrome 156. |
| Hardware | Intel Core Ultra 7 255HX, 16 GB RAM, NVIDIA RTX 5060 Laptop + Intel iGPU (real-GPU FPS profiling possible in headed Chromium). |
| Stack versions (registry, today) | next 16.4.3 · react 19.3.1 (R3F caps `<19.4`) · three 0.187 · @react-three/fiber 9.8.2 · drei 10.7.9 · postprocessing 6.39.5 / @react-three/postprocessing 3.2.2 · gsap 3.15 · zod 4 · zustand 5 · vitest 5 + vite 8 · @playwright/test 1.64. TypeScript pinned to **6.0.3** (7.x is the native port; tooling relies on the JS API). |

### Spec ↔ reference reconciliation
| Topic | Reference shows | Resolution (spec priority §2) |
|---|---|---|
| Journey entries | Named institutions/employers | **Not used.** Labeled sample milestones until CV (spec §4.2, S7). |
| LifeAtlas | "AI × HEALTH", health platform blurb | `Concept / In development`, no health claim (§3.5, §4.2). |
| Ask My AI | "trained on my portfolio", live-looking send | Honest demo mode, persistent DEMO labeling, local deterministic answers (§9.1, S8). |
| Hero body / universe / contact copy | Slight wording variants | Spec copy verbatim. |
| MOViD subtitle | "Agentic Video Generation Studio" | Spec: "Agentic Video Production Studio". |
| Vertical density | Whole page ≈ 2.6 viewports, hero ≈ 0.5 viewport | Expand to cinematic stages (hero ≈ 100vh) per §3.3; keep order, composition, hierarchy. |
| Type scale | Section titles ≈ 24–30 px @1440 | Between reference and spec suggestion; tuned by screenshot QA (§3.2 says "adjust with QA"). |

## 1. Architecture (spec §6.1)

**Persistent WebGL experience + semantic HTML interface + unified motion orchestrator.**

```
app/ (Next.js App Router, SSG)          ── semantic DOM, metadata, routes
  layout.tsx ── <Header/> <main/> <Footer/> + <ExperienceRoot/> (lazy, client-only)
experience/
  canvas/       one fixed, pointer-transparent <Canvas>; context-loss recovery; fallback layer
  orchestrator/ scroll → path parameter s, scene state machine, transitions, test hooks
  rigs/         camera path (pure math), damping, pointer parallax, lens-shift framing
  scenes/       HomeWorld (stations), DeepSpaceWorld (inner pages)
  objects/      OrbitalCore, Galaxy, Planet, Terrain, Starfield, Nebula, Portal, Explorer …
  portals/      4 project mini-worlds rendered to FBOs, composited into tracked DOM rects
  quality/      capability detection, tiers, runtime FPS governor, user override
  shaders/      GLSL as TS strings
content/        zod schemas + JSON fixtures + loader + publication gate
lib/            motion (GSAP reveals, scroll-to), assistant contracts + demo provider, seo, analytics stub
```

Key rules
- Native scroll is the single scroll source. The camera *pulls* `scrollY` each frame; DOM reveals use ScrollTrigger; no smooth-scroll library.
- Camera follows a Catmull-Rom path through station poses. Scroll maps to path parameter `s` with dwell easing at stations; `s` is damped (not Cartesian position) so the camera never cuts through geometry; large anchor jumps use a short "warp" dip instead of a dizzying fly-through.
- Overrides (node approach, portal expansion) blend on top of the path with GSAP-driven weights; one owner per property.
- The canvas is decorative (`aria-hidden`), `pointer-events: none`. All interaction is DOM (links/buttons), so everything works without WebGL.
- Content is data (JSON validated by zod at build). Components never hardcode personal facts.

## 2. Milestones (gates from spec §12)

| Gate | Deliverables | Depends on | Validation |
|---|---|---|---|
| **G0** Foundation | Next/TS strict, ESLint, Vitest, Playwright, tokens, fonts (OFL, self-hosted), content schema + fixtures + gate, route skeletons | — | install, typecheck, lint, build green |
| **G1** Semantic UI | All 9 home sections + header/footer/mobile menu, inner routes, icons, responsive CSS 320→1920 | G0 | screenshots at 6 viewports vs reference; no overflow |
| **G2** WebGL foundation | Shared canvas, quality tiers, orbital core, stars/nebula/planet/terrain, galaxy + nodes, journey/portal/horizon stations, project mini-worlds, fallback + context loss | G0/G1 | real-browser renders, `renderer.info`, forced-fallback test |
| **G3** Motion | Camera choreography, prelude, hero intro, reveals (SplitText masks), node approach, portal transition, magnetic/aura, reduced-motion paths | G2 | E2E + video capture, scene-state assertions |
| **G4** Routes & data | `/projects` filter, `/projects/[slug]` case-study template, `/about`, `/contact`, `/resume`, 404/error, SEO (metadata, OG, sitemap, robots, JSON-LD) | G1 | route smoke tests, slug 404 |
| **G5** AI preview | Assistant UI, contracts, demo provider, API route skeleton (503 until configured), safety policy | G0 | unit + e2e for demo labeling, no network |
| **G6** QA | Unit/component/E2E/a11y/visual suites, Lighthouse, GPU FPS profiling, posters for fallback, docs + evidence | all | `docs/test-report.md`, `docs/release-readiness.md` |
| G7 | Owner CV population | **deferred** | — |

## 3. Risks

| Risk | Mitigation |
|---|---|
| Fixed canvas lags native DOM scroll by a frame (portal cards) | Live card worlds only render on hover/focus/transition (when not scrolling); posters otherwise; case-study hero edges feathered. |
| Tone-mapping/colour mismatch between composer and portal passes | Portal FBOs composited by a shader that applies tone mapping + sRGB itself. |
| LCP delayed by intro/reveals | Prelude only on first desktop visit (CSS-gated); hero text revealed by CSS (no JS dependency); mobile shows content immediately. |
| Bundle weight | 3D chunk lazy-loaded after hydration; initial route JS kept to DOM + GSAP. Measured, not assumed. |
| Headless browsers use software GL | Tier detection treats SwiftShader as low tier; E2E forces tiers via `?quality=`; FPS measured in headed Chromium on the real GPU. |
| Fabricated facts | Verification status on every record, DEMO_CONTENT mode banner, publication gate test fails `VERIFIED_PUBLIC` builds with placeholders. |

## 4. Progress log

Updated as gates complete — see bottom of `docs/acceptance-matrix.md` for evidence links.
