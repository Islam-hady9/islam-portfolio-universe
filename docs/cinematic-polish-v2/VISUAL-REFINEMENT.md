# Cinematic Polish V2 — Visual Refinement

All captures: real GPU (Intel iGPU, ANGLE/D3D11), production build, ultra tier unless noted. Before = `7ef9369`; after = this phase.

## Hero intelligence core — `evidence/core-before-after.webp`, `evidence/hero-before-after.webp`, `evidence/core-motion-after.webp`

| Aspect | Before | After |
|---|---|---|
| Ring geometry | 3 U-channel lathe rings + a thin torus; plain profile | **Machined gimbal rings**: 45° chamfers on every outer edge (crisp specular lines), brushed channel interior as its own material group, 12/10 panel **seams** closed by end caps, radial **pivot bosses**; a 0.05-unit **precision dial ring** with 120 graduations (every 10th a lit index); inner gimbal with seated indicator studs |
| Secondary components | static clamps | **Carriages** (machined collars) ride rings A/B at their own counter-rates — mechanical precision in motion |
| Shell | box-instanced "cubes" | **Fractured spherical armour**: curved panels with thickness and walls, gaps, lifted plates; dense inner layer + sparse outer layer for depth; ~10% of panels carry emissive **copper inlays** on their edge walls (reference's amber glints) |
| Emitter | noise sphere + edge wireframe, blown-out glow | **Layered energy**: circuit sphere (printed traces, via pads, latitude rings, energy **pulses travelling along traces**), plasma aura (fresnel + flowing noise), small HDR hot core; glow sprite reduced — structure stays readable, only pulses/pads/inlays reach bloom |
| Materials | chrome + gunmetal | Physical chrome (clearcoat) + **anisotropic brushed** channel (tangents generated on the ring) on ultra; matched standard materials on balanced/lite |
| Lighting / environment | dark studio env → rings read black; violet rim + env strip produced a glare | Silver-tuned env: broad top softbox, front softbox, side softboxes for graded body reflections, thin edge strips for chamfer highlights; violet rim 1.6 → 0.32 and violet strip 1.8 → 0.6 (accent, not hotspot) |
| Motion | rings spin + precess | + carriages, + shell **assembles during the intro** (panels converge as the core ignites), + slow per-panel breathing, + gimbal assembly **leans toward the pointer** with inertia (≤ ~3°, on top of the camera parallax) |

Remaining gap vs the concept art: the reference is a painted render with more micro-detail and stronger edge-light on the ring faces; the real-time core is now structurally equivalent (two heavy machined rings crossing, fractured shell, circuit glow, copper accents) but cleaner. Final visual sign-off is the owner's.

## Universe — `evidence/universe-before-after.webp`
- Each destination is a **lit worldlet** (small body lit from the galactic core, fresnel rim in its accent colour) inside its halo ring — depth and parallax instead of a flat dot.
- Links carry **energy packets** outward; the hovered node grows, its link brightens and its orbit arc lights; selecting a node fires a **ripple** during the camera approach.

## Atmosphere
- Nebula is two-tone (violet wisps + teal billows), kept dim behind copy. An early teal "fringe" term exposed a value-noise lattice seam (hard-edged disc at the universe station) — removed; the band term no longer uses `pow()` on a negative base.

## Project worlds — `evidence/project-worlds-before-after.webp`
- **MOViD**: polished-floor mirror of the screen wall and hero panel (fading with depth), far screens recede; floor is translucent so the mirror reads through. TIBYN / ATS / LifeAtlas kept (already distinct and legible).

## Journey framing — `evidence/journey-4x3-before-after.webp`
- Moon placement is now aspect-aware (`journeyMoonFor`): the approved 16:10 screen position (right frame edge, clear of the subtitle) holds at 4:3, 16:9 and 21:9. At 4:3 it was previously off-frame.

## Cards
- Philosophy and capability cards get the same **pointer spotlight** language as project cards (soft inner sheen + mint border glow following the pointer, fine pointers only).

## Stations and mobile — `evidence/stations-desktop-after.webp`, `evidence/stations-mobile-after.webp`, `evidence/transitions-after.webp`
All nine stations re-captured after the changes (desktop ultra, mobile balanced) plus 3D-only frames between stations; previous-phase sheets in `docs/evidence/live-3d/` show the "before" state.

## Fallback posters
All posters were re-rendered from the updated live scenes (`npm run capture:posters`), so static/reduced-motion visitors see the new core.
