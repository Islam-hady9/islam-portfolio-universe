# Cinematic Fidelity V3 — Implementation plan

Rule for every wave: same design, same concepts, same vector language, higher fidelity. No layout, copy, content-gate or AI-behaviour change; no new post-processing pass; light count constant (lights inside gated groups would recompile lit materials on visibility changes); every new program is precompiled by the existing `compileAsync` warm-up.

| Wave | Scope | Files | Guardrails |
|---|---|---|---|
| P1 Glass | Token-driven glass material: base, tint, backdrop, optics, interaction, fallbacks; applied to philosophy/capability tiles, Ask My AI (panel, field, chips, answers, sources, Local AI cards), About, Contact, case-study cards and diagram, listing toolbar, journey detail, settings popover, node labels | `globals.css`, component modules + class names | Modules keep box sizes (`border: 1px solid transparent`); nested surfaces never blur twice; contrast ≥ 4.5:1; reduced transparency honoured |
| P2 Cards + AI panel | Card corner brackets, accent spill, glass badge, title separation, action button; panel states (send, chips, pending sweep, notices, long-conversation fade) | `ProjectPortalCard.module.css`, `AskAiPanel.module.css` | The live world window stays untinted; no AI logic change |
| P3 Worlds | ATS, MOViD, TIBYN, LifeAtlas refinements; shared AA ribbon helper; terrain tone + haze | `portals/worlds/*`, `objects/Terrain.tsx` | Concepts unchanged; LifeAtlas stays "concept"; worlds still animate only while rendered |
| P4 Portal | Machined ring, layered energy surface, inflow motes, ground spill/halo, breathing, pulses, ignition, assistant pulse | `objects/RingPortal.tsx`, `objects/portal-glow.ts`, `scenes/WorldLights.tsx`, `scenes/HomeWorld.tsx` | Ring/disc concept unchanged; cost measured; tiers scale strata and motes |
| P5 Figure | Coat silhouette, rim light, breathing, posture sway, contact shadow | `objects/Explorer.tsx` | `buildExplorerGeometry()` keeps its contract (MOViD reuses it) |
| P6 Motion | `--d-glow / --d-fade / --d-lift` tokens (mirrored in `MOTION`), damped tilt, assistant signal | `globals.css`, `lib/motion.ts`, `PointerAura.tsx`, store | Reduced motion: no tilt, no pulses, frozen 3D time; all information kept |
| P7 Performance | Interleaved A/B vs `adcd4ab`, GPU time per frame (timer query), frame-time percentiles, resources, memory, Lighthouse | `scripts/qa/fidelity-bench.mjs` | Contention recorded per window |
| P8–P9 | Full test matrix, new tests, matched before/after evidence, fixes | tests, `scripts/qa/fidelity-v3.mjs` | No claim without an executed run |
| P10 | Docs, focused commits, closure | `docs/cinematic-fidelity-v3/` | Clean tree; no push/deploy |

Genuine defects found on the way and fixed minimally: status-line contrast over the lit terrain (Ask My AI), the overlay seam between Ask My AI and Contact, the coat lathe profile order (inside-out faces), glass fallbacks that lost to module-level values (now `!important`), and — caught before commit — an invalid transform fallback in the first tilt draft a portal cleanup that disposed in-use geometries on material-only changes, and a portal housing that a governor tier change would have rebuilt without its instance matrices.
