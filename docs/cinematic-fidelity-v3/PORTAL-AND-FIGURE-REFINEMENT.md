# Portal and figure refinement (P4, P5)

Same concept: a monumental segmented dark-metal ring with illuminated seams around an energy surface, a lone explorer standing before it on a plateau (spec S8). Original design — a generic ring gate, not any franchise prop. Camera framings, the station layout and the light count are unchanged.

## Ring (`objects/RingPortal.tsx`)

| Element | Before | Now |
|---|---|---|
| Housing | 40 unbeveled boxes | 24 machined segments, each a merged extrusion: a nearly continuous rear plate, a proud inner band framing the surface and an outer band, separated by a recessed channel; beveled edges catch the environment light; panel gaps reveal the rear plate |
| Seams | 40 dashed emissive boxes | an illuminated channel (torus) recessed between the bands, carrying two light packets that circulate in opposite directions |
| Markings | — | 120 emissive marks (3 per segment on the outer band, the middle one longer; 2 fine ones on the inner band), lit as the packets pass |
| Small components | every 5th box chunkier | 8 clamps over the segment joints with stepped caps |
| Precision ring | — | a slowly turning lip + 120 teeth (every 10th longer) at the edge of the energy surface |

Exported builders (`buildPortalSectorGeometry`, `buildPortalClampGeometry`, `buildPrecisionRingGeometry`, `portalMarkings`, `PORTAL_PROFILE`) are unit-tested (radial bounds, tiling, bevels, marking layout).

## Energy surface

An opaque window onto a vortex receding behind the ring (no more additive see-through disc):

- **Layered translucent strata** sampled at increasing depth along the view ray (2–4 by tier: `2 + coreDetail`). Each stratum is narrower than the one in front; its luminous edge reads as one ring of a tunnel, and the strata shift against each other as the camera drifts (true parallax, `uCam` in disc space).
- **Swirl and distortion**: per stratum, a domain-warped, angle-periodic spiral (no seam) of thin filaments flowing slowly inward.
- **Convergence**: a small deep core with a darker ring around it; inflowing motes (Points, `round(dust × 0.2) + 100` by tier) spiral in from the rim.
- Brightness budget: the whole surface stays below the bloom threshold (1.0) at rest — only the rim flare of the arrival ignition crosses it — so it never blooms into a flat bright plate. The bloom comes from the channel's light packets and the markings they light.

## Environmental integration

- **Ground spill and contact glow**: the terrain the portal stands on binds shared uniforms (`objects/portal-glow.ts`) — a wide light pool falling forward from the ring and a tight contact glow where it meets the ground, both scaled by the portal's energy. No extra light: the station's portal point light keeps the light count constant and now breathes and pulses with the portal (`frame.portalEnergy`).
- **Base halo and atmospheric scatter**: two camera-facing glows in one draw call — a haze behind the ring (the ring silhouettes against scattered light) and a halo at its base.
- **Rim light on the figure**: see below.

## Motion

Slow precision-ring rotation; breathing (two slow sines on energy, light and spill); light packets circulating in the channel and lighting the markings; a convergence wave every 7 s (rim → core); an **ignition** each time the station is reached (markings light from the base upward over 1.8 s, rim flare decaying) — it re-arms when the station is left. **Assistant response**: a single restrained ring travelling core → rim when an answer completes (`assistantSignal` in the store increments once per completed answer; never per token; during Local AI generation rendering is held, so the pulse plays after release). Reduced motion: no ignition, pulse or rotation (frozen ambient clock), full brightness kept.

## Figure (`objects/Explorer.tsx`)

- Silhouette (~1.8 units, ≈ 7.5 heads): a tailored long coat (lathe profile from the hem at the knee through the waist to defined shoulders, flattened front-to-back), raised collar, neck, slightly elongated faceless head, separated arms (shoulder → elbow → wrist, tapered, with small hands), legs below the hem in a slight contrapposto, low boots. No face, no armour, no cartoon proportions. `buildExplorerGeometry()` keeps its contract (feet at y = 0, facing −z, positions + normals) for the MOViD world.
- Material: dark, slightly satin (roughness 0.72, metalness 0.25) with a **portal-facing rim light**: view-space fresnel weighted toward the portal's position, scaled by the portal's energy.
- Idle: restrained chest breathing (vertex expansion ≤ 2.2 %) and a slow posture sway (≤ 0.23° roll, ≈ 1° yaw). Reduced motion: still.
- Grounding: a soft contact pool under the feet and a fainter streak cast toward the camera by the portal light behind the figure.
- Scale and placement unchanged: the portal stays dominant, the figure small.

A defect found while refining: the first coat profile ran top → bottom, which turned the lathe inside-out (faces pointing inward) and let the hem cap show through as a bright line; the profile now runs bottom → top.

## Responsive framing

Captured at 1440×900, 1280×800, 1024×768 (4:3), 768×1024, 390×844 (Pixel 7 emulation) and 2560×1080 (`.evidence-tmp/v3/framing`, montage in VISUAL-EVIDENCE.md). The ring and figure stay in frame on all; on portrait viewports the copy sits over the portal as before — the darker interior now improves the contrast of the copy there (the status line in particular).

## Cost

Ask My AI station (ultra, 1440×900): 26 → 33 draw calls, 46k → 77k triangles, +380 points (motes), programs 54 → 63 (home scene, incl. worlds). GPU time per frame: PERFORMANCE-REPORT.md.
