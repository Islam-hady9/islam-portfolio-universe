# Cinematic Polish V2 — Motion Refinement

## Motion language (tokens)
`src/lib/motion.ts` is the single source for GSAP/WebGL choreography and mirrors the CSS custom properties in `globals.css`:

| Token | Value | Used by |
|---|---|---|
| `duration.hover` / `focus` / `reveal` | 0.22 / 0.32 / 0.82 s | CSS `--d-hover`, `--d-focus`, `--d-reveal`; block reveals |
| `duration.lines` | 0.95 s | masked headline lines |
| `duration.commit` / `settle` | 0.72 / 1.1 s | universe node approach, camera release |
| `duration.portal` / `portalSettle` | 0.82 / 0.6 s | card → case-study portal |
| `duration.travelMin…Max` | 0.9–1.8 s | anchor travel (scaled by distance) |
| `ease.enter` / `enterSoft` | `expo.out` / `power3.out` | things arriving (≙ `--ease-out`) |
| `ease.travel` | `power3.inOut` | camera/page travel, portal expansion (≙ `--ease-in-out`) |
| `ease.commit` / `release` | `power2.in` / `power2.out` | a choice being committed / released |
| `stagger.lines` / `items` | 70 / 60 ms | line and card cascades |

Literals in `RevealMotion`, `scroll.ts`, `UniverseStation` and `PortalSystem` were replaced by tokens (behaviour unchanged except reveal/stagger durations unified at 0.82 s).

## Hero core choreography
- **Intro**: gimbals unfold from a common plane (existing) **and** the fractured shell assembles (panels converge from ~0.85 units out as `unfold` → 1) while the emitter ignites — the core "comes together".
- **Idle**: distinct ring spin rates (0.055 / −0.08 / 0.03 / 0.16 rad/s) and precession phases; carriages counter-ride rings A/B; panels breathe ±0.018 with per-panel phase; circuit pulses travel along traces; core energy pulses as a sum of incommensurate sines (irregular, never strobing).
- **Pointer**: camera parallax (≤ 3° yaw / 2° pitch, existing) + an inertial lean of the gimbal assembly toward the pointer (damped, ≤ ~3°) — reads as mass and scale. Disabled with reduced motion (pointer smoothing is frozen there).

## Scroll choreography and transitions
- Verified, not rewritten: the previous phase's ground-crossing veils and parallax ground guard remain; this phase's transition sweep (`evidence/transitions-after.webp`) shows clean hero→identity, identity→universe (veil), universe→projects, capabilities→experience, experience→ask-ai (veil) and ask-ai→contact (veil).
- **Stress**: 10 cycles of rapid scroll sweeps (all nine anchors, 110 ms apart, down and up) + card→case-study→back round trips: camera parameter re-synchronised every cycle (`|s − sTarget| ≤ 0.002`), no errors (`PERFORMANCE-REPORT.md` → soak).

## Typography
Already compliant and kept: section headings reveal by masked lines (SplitText, 70 ms stagger), eyebrows/descriptions rise with blur-to-sharp, grids cascade; opacity-only (never `visibility`) so content stays focusable. GSAP now initialises only after first paint, so reveals never compete with LCP.

## Reduced motion
Unchanged and re-tested (`motion.spec`): no prelude, no hidden reveals, discrete station cuts with the veil, frozen ambient clock; the new core motions (carriages, breathing, pulses, lean) all derive from the frozen clock / pointer smoothing and therefore stop.
