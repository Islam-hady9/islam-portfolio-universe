# Motion refinement (P6)

One vocabulary across CSS, GSAP and the 3D world (`src/lib/motion.ts` ⇄ `globals.css`).

## Tokens

| Token | Value | Use | New in V3 |
|---|---|---|---|
| `--ease-out` / `MOTION.ease.enter` | cubic-bezier(0.16, 1, 0.3, 1) | arrivals, hovers, glow | — |
| `--ease-in-out` / `MOTION.ease.travel` | cubic-bezier(0.65, 0, 0.35, 1) | camera/page travel, sweeps | — |
| `--d-hover` / `hover` | 220 ms | small controls | — |
| `--d-focus` / `focus` | 320 ms | focus, label expansion | — |
| `--d-glow` / `glow` | 360 ms | surface light, border illumination, card frame | yes |
| `--d-fade` / `fade` | 420 ms | cross-fades, panel arrivals, answer entrance | yes |
| `--d-lift` / `lift` | 520 ms | elevation and tilt return (the damping of the tilt) | yes |
| `--d-reveal` / `reveal` | 820 ms | blocks rising into place | — |

Hard-coded equivalents were replaced by the tokens (header, node labels, project cards, pointer aura, assistant answer entrance, philosophy tiles). Entrance choreography with deliberately different timings (hero, reel, intro) was left as tuned.

## Surfaces

- **Glass cards** (`[data-spotlight][data-tilt]`): a damped tilt toward the pointer (≤ 1.2° X, ≤ 1.6° Y) composed with the existing lift; pointer light and border light; the transform's own `--d-lift` transition provides the damping, so no animation loop is added. Fine pointers with full motion only; touch gets `:active` feedback.
- **Project cards**: frame, corner brackets and accent spill warm with `--d-glow`; the lift is shallower on press; poster-mode tilt unchanged; in live mode the 3D camera still supplies the depth parallax.
- **Assistant states**: a light sweep over the status label while a turn is pending (motion-full only), the existing caret while tokens stream; answer entrance with `--d-fade`; field focus ring; send press; chips light up in the accent on hover and press on `:active`; notices are static (no motion needed to read them). Smart ready, download (progress meter), initializing, generating, complete, fallback and error states keep their existing labels and live-region announcements.

## 3D

- Portal: breathing, circulating light packets, convergence wave, ignition on arrival, one response pulse per completed answer (PORTAL-AND-FIGURE-REFINEMENT.md).
- Figure: breathing and posture sway.
- Worlds: ATS match event (pulse travels, cards answer back → front), MOViD signal sweep and hero light sweep, LifeAtlas contour wave and path light, TIBYN calm swell and pen ripples.
- Nothing in 3D reacts to tokens. During Local AI loading/generation the existing render hold pauses continuous rendering; the V3 pulse is a counter read once per frame after release — no extra GPU work during inference.

## Reduced motion

`prefers-reduced-motion` or the in-site setting: the ambient 3D clock is frozen (existing behaviour), so rotation, waves, packets, pulses, breathing and sway stop; the portal shows its full, fully-lit state (ignition sweep complete). No CSS tilt, no label sweep, no answer entrance animation. All information remains: every state label, notice, source and status is present as before (covered by the reduced-motion E2E tests).
