# Cinematic Polish V2 — Implementation Plan (as executed)

Order followed: AUDIT → BASELINE → PLAN → REFINE → IMPLEMENT → MEASURE → TEST → COMPARE → FIX → COMMIT → CLOSE. Architecture preserved: one persistent R3F canvas, native-scroll orchestrator, DOM-first semantics, tiered quality, content contracts. No new runtime dependencies.

| Phase | Work item | Files | Status |
|---|---|---|---|
| A Audit | Visual/3D/motion/perf audit with GPU captures, Lighthouse internals, CPU profile, GL instrumentation | `AUDIT.md`, `scripts/perf/cpu-profile.mjs`, `scripts/perf/gl-stalls.mjs` | ✅ |
| B Core | Machined gimbal rings (chamfers, brushed channel group, seams + caps, pivots), carriages, dial ring, fractured two-layer shell, circuit emitter + plasma aura + hot core, pointer lean, shell assembly in the intro | `src/experience/objects/core/{geometry,materials,shaders}.ts`, `OrbitalCore.tsx`, `quality/tiers.ts` (`coreDetail`) | ✅ |
| B Core | Silver-tuned procedural environment, violet demoted to accent | `scenes/SceneEnvironment.tsx` | ✅ |
| C Universe | Lit worldlets, link energy packets, selection ripple | `scenes/UniverseStation.tsx` | ✅ |
| C Atmosphere | Two-tone nebula (teal billows), cheaper noise where detail is invisible | `objects/Sky.tsx`, `Planet.tsx`, `Atmospherics.tsx`, `portals/worlds/kit.ts` | ✅ |
| C Worlds | MOViD polished-floor mirror + distance dimming (one program per material) | `portals/worlds/MovidWorld.tsx` | ✅ |
| D Motion | Shared motion tokens; GSAP choreography reads them | `src/lib/motion.ts`, `RevealMotion`, `scroll.ts`, `UniverseStation`, `PortalSystem` | ✅ |
| E Interaction | Pointer spotlight on philosophy/capability cards | `PointerAura.tsx`, `globals.css`, section components | ✅ |
| F Performance | GSAP after first paint; deferred below-fold posters; font subsetting; case-study LCP preload; phone poster variants; balanced → standard materials; `scrollbar-gutter`; inline CSS **tested and rejected** (measured worse) | `src/lib/after-load.ts`, `components/ui/DeferredImg.tsx`, `SceneArt.tsx`, `ProjectPoster.tsx`, `scripts/fonts/subset-fonts.py`, `scripts/capture/encode-posters.py`, `globals.css`, `tiers.ts` | ✅ |
| G Responsive | Aspect-aware journey moon (4:3 → 21:9) | `orchestrator/camera-path.ts` (`journeyMoonFor`), `HomeWorld.tsx` | ✅ |
| H A11y/resilience | No regressions: axe 0 serious/critical (10 routes), reduced motion, no-WebGL, context loss — all still tested | existing suites | ✅ |
| I Validation | Unit, E2E ×2, GPU, Lighthouse ×3 medians, long tasks, GL stalls, 10-cycle soak, rapid scroll + route stress | `scripts/qa/soak.mjs`, `scripts/perf/lighthouse.mjs --runs` | ✅ |
| J Evidence | Before/after sheets, motion strips, station/mobile/transition sheets | `evidence/`, `scripts/qa/core-evidence.mjs` | ✅ |

Explicitly out of scope (content freeze): CV data, content schemas, publication gate, assistant behaviour.
