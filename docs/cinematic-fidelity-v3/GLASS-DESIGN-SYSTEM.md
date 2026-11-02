# Intelligent Glass design system

One material, defined once in `src/app/globals.css` (`.glass`, families, accents, `[data-spotlight]`, `[data-tilt]`), driven by custom properties so components change *values*, never re-implement the material. It replaces the per-component translucent background/border/blur values each of those surfaces had (no shared tokens or optics before).

## Layers (bottom → top)

| Layer | What it is | Implementation |
|---|---|---|
| L1 structural base | Obsidian/graphite `rgb(14 17 22 / --g-a)`, dense enough for ≥ 4.5:1 body text over the universe's dark backdrops | last background layer |
| L2 tinted glass | The surface's own accent (cyan default, mint, violet) as a faint top-left radial, plus a controlled violet counter-tint bottom-right at 45 % of the tint | `--g-accent-rgb`, `--g-tint` |
| L3 backdrop | `blur(--g-blur) saturate(1.3)`; nested families (inset, chip) and long reading surfaces (flat) never sample the backdrop | `backdrop-filter` |
| L4 optics | Perimeter stroke (`--g-stroke`), top-edge light (`--g-edge`), soft inner bottom reflection, two corner glints (brighter top-left), a 38 % top sheen | inset box-shadows + radial/linear layers |
| L5 interaction | Pointer light (inner sheen) and border light that follow the pointer in the accent; damped tilt toward the pointer (≤ 1.6°); lift; touch `:active` feedback | `[data-spotlight]` (PointerAura writes `--sx/--sy` in px and `--tx/--ty` in −1…1), `[data-tilt]` → `--g-tilt` |

## Families

| Family | Use | Base `--g-a` | Blur | Notes |
|---|---|---|---|---|
| `.glass--panel` | Instrument housings: Ask My AI panel, settings popover | 0.72 (assistant 0.76, settings 0.92) | 20 px | accent stroke (0.2), accent halo in the drop shadow |
| `.glass--card` | Content tiles over the live 3D: philosophy, capabilities, contact channels, listing toolbar, journey detail | 0.6 (contact 0.7, journey 0.66) | 14 px | |
| `.glass--flat` | Long-form surfaces: case-study cards, system diagram, About cards and status facts | 0.66 | none | same optics, no GPU backdrop cost while reading |
| `.glass--inset` | Wells inside a panel: question field, answer cards, Local AI cards | 0.5 | none | inner shadow instead of a drop shadow |
| `.glass--chip` | Prompts, source citations, capability chips, Local AI actions | 0.42 | none | no drop shadow |

Accents: `.glass--mint`, `.glass--cyan`, `.glass--violet` (declared after the interaction layer so they win over its mint default). Answer cards set violet for Smart Answers and cyan for *Generated Locally* answers through the same properties.

## Fallbacks and accessibility

- No `backdrop-filter` support → the blurring families (panel, card) get a denser base, `--g-a: 0.88`.
- `prefers-reduced-transparency: reduce` → every glass surface goes near-opaque (`--g-a: 0.95`) with no blur.
- Both fallbacks are declared `!important`, so they also beat the per-surface `--g-a` a component module sets (module CSS loads after `globals.css`). The first draft lacked this, which would have left module-tuned surfaces translucent for users who asked for reduced transparency; caught in review, not by a test (Playwright cannot emulate that preference).
- Reduced motion / touch: no tilt (the tilt rule only applies under `html[data-motion='full']` with a fine pointer); pointer light only on hover-capable pointers; touch gets `:active` feedback.
- Focus: unchanged visible outlines (mint, 2 px) on every interactive glass element; the field well shows a mint stroke + ring on `:focus-within`.
- No layout shift: modules keep `border: 1px solid transparent` where they used a border, so box sizes are identical; hover uses transform/box-shadow only. The Ask My AI conversation's scroll-edge fade lives in a 10 px band offset by an equal negative margin, so the panel's text width and height did not change.

## Rules for components

1. Add `glass glass--<family> [glass--<accent>]` to the element; remove the module's own `background`, `border-color` and `backdrop-filter`.
2. Adjust with the properties (`--g-a`, `--g-tint`, `--g-stroke`, `--g-edge`, `--g-drop`, `--g-blur`) in the module — never a second background.
3. Never blur inside a blurred parent; long content surfaces use `flat`.
4. The project-card window onto a live world is **not** glass: it stays untinted. Its enclosure is drawn around it (perimeter stroke, top-edge light, corner brackets, an accent spill along the lower edge) and its text gets separation from shadow, not from an overlay.

## Where it is applied

Philosophy tiles; capability panels and chips; Ask My AI panel, field, send button, suggestion chips, answer cards (Smart / Generated Locally), source chips, Local AI consent/progress/unavailable cards and actions; About cards and status facts; Contact channels; case-study workflow/decision/challenge/result cards and the system diagram; projects listing toolbar; journey detail panel; settings popover; universe node labels (same optics, own accent stroke). Project cards: refined enclosure (see above), glass category badge and action button.

Not changed: the intro-reel player and portrait frame (frozen by the brief), the mobile menu sheet (full-screen, already opaque), the header.
