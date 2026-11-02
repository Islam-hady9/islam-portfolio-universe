# Project worlds refinement (P3)

The four procedural worlds render into per-card HDR targets (`PortalSystem`) and as the case-study hero. Concepts, camera framings, palettes and the "animate only while rendered in the last 500 ms" rule are unchanged.

## Shared

- **Anti-aliased ribbons** (`ribbonGeometry` + `RIBBON_GLSL` in `worlds/kit.ts`): camera-facing quad strips along polylines replace 1-px `LineSegments`/`Line`. The vertex shader widens each strip in proportion to its camera distance (`uAngular`, half-width in radians), so a line keeps one apparent width near and far and never breaks into dots when it would be sub-pixel (the first world-space version did exactly that on the LifeAtlas path and was replaced). A soft cross profile plus MSAA gives a stable stroke while the card camera moves.
- **SDF UI with `fwidth` anti-aliasing** for every new interface element (cards, rings, bezels, play glyph).

## ATS Matching (cyan)

- Cards: rounded-rect SDF with AA edge; cool vertical glass gradient and a slow diagonal sheen; perimeter stroke brightening at the corners and along the top edge; header with avatar ring, name/role lines and a divider; three skill chips; four body lines with rounded caps; five score bars; a match ring (track + progress arc). All abstract — no text, names or faces.
- Layer separation: each of the five cards carries its depth (`uDepth`); back cards are dimmer and cooler, front cards brighter and slightly more opaque.
- Data threads: 14 smooth centripetal Catmull-Rom curves (96 segments each) as ribbons, pulses travelling left → right.
- **Microanimation — a "match" event every 4.6 s**: the threads surge, the end nodes brighten, then each card answers in turn from back to front (border flash, ring fills further, bars rise slightly, the card lifts ~0.05 units).
- Platform ring: crisp AA rings, 72 ticks, a slowly scanning arc, an outward wave and a soft inner light in one shader (the separate glow plane was folded in: one draw call fewer).

## MOViD Studio (violet)

- Screens: a rounded glass inset in a dark bezel with a lit inner lip; a soft diagonal glass sheen.
- Content: five abstract footage variants (graded landscape with ridge and sun, audio waveform, levels, an edit timeline with lanes and a moving playhead, a vectorscope) — no text, no faces.
- **A signal travels across the arc** left → right; each screen and its bezel brighten as it passes.
- Depth: the outer rows sit 0.35 units deeper than the middle row, so the wall reads in layers; distance falloff kept.
- Hero screen: cinematic frame (graded sky, letterbox bars), a crisp rounded play triangle inside a ring with a slow progress arc, a light sweep across the glass every ~8 s.
- Polished floor: the existing mirror reflection plus a violet light pool thrown by the hero screen.

## TIBYN (teal, calm)

- Water: a long slow swell plus fine ripples (calmer normals than before), concentric ripples around each pen, a teal body lit slightly from within near the viewer.
- **Reflections**: the reflected ray samples the sky dome's gradient and moon lobe — or, when it meets one of the three mountain curtains, the mountain. The ridge silhouettes are baked into a 256×3 height texture and ray-tested in the water shader (nearest ridge first), so reflections are exact, wave-distorted and cost no extra geometry or draw calls. Pen and barge lights glint on the ripples.
- Atmosphere: a third, farthest and haziest ridge layer; each ridge fades toward a mist colour at its base; ridge lines get a finer octave and a faint moonlit crest; a far mist band.
- Structures: pens are now a floating collar (outer + inner pipe) with a raised handrail on 14 stanchions; a small feed barge with a lit cabin window and a mast light sits between the pens.
- Moon: a crisp disc with limb darkening, faint maria and a soft halo (it was a fuzzy glow).

## LifeAtlas (violet-mint, concept)

- Wireframe precision: a major grid plus a 4× finer minor grid that fades out where it would become sub-pixel (no moiré); elevation contours with brighter index contours every fifth line.
- **Wave propagation**: a ring of brighter lines travels outward from the energy source's ground point across the terrain (~11 s period).
- Depth: faint fill between the lines (teal low, violet high, facing-light shading) and an atmospheric shift toward a violet haze in the distance.
- Energy source: a small bright core, a soft halo, a slowly breathing ring and a faint beam toward the peak (it was a soft blob).
- Life path: a ribbon through the stars with a light travelling along it; it still draws itself on hover. Stars twinkle gently.
- Identity unchanged: the card and case study still say "Concept / In development"; the world implies no launched product.

## Global terrain and atmosphere

- Terrain (`objects/Terrain.tsx`): deterministic mineral tone variation (±12 %, low frequency, slightly paler ridges) as vertex colours on the faceted rock; distance haze (atmospheric perspective) mixed in before output; the portal terrain also receives the portal's light spill. All terrains still share one program (`iu-terrain-rim-v3`).
- Starfields, dust and fog: unchanged (restraint).

## Cost

Measured in PERFORMANCE-REPORT.md (GPU time per frame, interleaved A/B). Renderer counts at a live card (ultra): TIBYN 42 → 46 draw calls (pens' collars, barge, third ridge), 14k → 33k triangles; MOViD 40 → 40; ATS 42 → 41; LifeAtlas 38 → 38.
