# Visual evidence (P9)

Every before/after pair below was captured by the same script with identical settings — `node scripts/qa/fidelity-v3.mjs <base> <dir>`: real Intel iGPU (Chromium + ANGLE/D3D11), 1440×900 at DPR 1, `quality=ultra`, intro skipped, the same scroll anchors (section centred) and the same hover point on each card (160, 120). **Before** = production build of `adcd4ab`; **after** = the V3 build. Mobile = Pixel 7 *emulation* at `quality=balanced` on the same GPU, not a physical phone. Animated content differs slightly between any two captures because the scenes are alive; tiles marked t+… are frames of one sequence. Sheets: `python scripts/qa/fidelity-evidence.py <before> <after> <framing>`; raw PNGs stay in the git-ignored `.evidence-tmp/v3/`.

| Sheet | Shows | What to look at |
|---|---|---|
| [01-projects-station](evidence/01-projects-station.webp) | Projects station, cards at rest | Glass card frame with corner brackets, glass badge, title separation; **posters re-rendered from the refined worlds** (so resting cards match the live worlds they cross-fade into) |
| [02-card-worlds-live](evidence/02-card-worlds-live.webp) | Each card hovered (live world in the card) | ATS card UI geometry and layer separation; MOViD bezels and footage; TIBYN water and moon; LifeAtlas grid and energy source |
| [03-world-motion-strips](evidence/03-world-motion-strips.webp) | 4 frames, 350 ms apart, per world (after) | ATS match pulse and card response; MOViD signal travelling across the screens; TIBYN calm swell; LifeAtlas wave and path light |
| [04-case-study-heroes](evidence/04-case-study-heroes.webp) | The four case-study heroes | Full-frame worlds: TIBYN reflections, collared pens, barge, third ridge; MOViD bezels and play ring; ATS cards and platform ring; LifeAtlas two-level grid, haze, source |
| [05-portal-and-figure](evidence/05-portal-and-figure.webp) | Portal + explorer close-up, and 3 frames 600 ms apart | Machined ring (bands, channel, clamps, markings), layered energy surface with a deep core instead of the see-through disc, ground spill/contact glow, light packets and convergence wave between frames |
| [06-figure-zoom](evidence/06-figure-zoom.webp) | The explorer at 3× | Capsule placeholder → coat silhouette with shoulders, separated arms, stance, rim light |
| [07-ask-ai-station](evidence/07-ask-ai-station.webp) | Whole Ask My AI station | Portal integration; legible status line over the lit ground (was washed out); glass panel |
| [08-ai-panel](evidence/08-ai-panel.webp) | Panel ready and with a Smart Answer | Glass panel, field well, chips, violet Smart Answer card, source chips; identical text width (no reflow) |
| [09-glass-tiles-2x](evidence/09-glass-tiles-2x.webp) | Philosophy and capability tiles at 2× | Top-edge light, corner glint, accent tint, glass chips |
| [10-glass-sections](evidence/10-glass-sections.webp) | Philosophy, capabilities, projects listing | The glass system in context; layouts unchanged |
| [11-mobile](evidence/11-mobile.webp) | Projects, Ask My AI, MOViD case (emulated phone) | Re-rendered posters on touch (no hover), darker portal interior behind the copy, legible status line |
| [12-portal-framing](evidence/12-portal-framing.webp) | Ask My AI at 1280×800, 1024×768, 768×1024, 390×844 (emulated), 2560×1080 | Ring and figure stay framed on laptop, 4:3, tablet, mobile and ultrawide |

Renderer resource counts for every capture: [evidence/renderer-resources.json](evidence/renderer-resources.json).

The "after" captures come from the 15:44 production build. The three fixes made after it (glass fallbacks for reduced transparency / no backdrop support, the portal's behaviour on a runtime tier change, mesh names) do not change what these captures show: the fallbacks only apply under those preferences, and the tier-change fix only matters when the tier changes after load.

**Recordings:** `scripts/qa/fidelity-record.mjs` (portal motion and the response pulse, card hovers, a case-study hero; output kept local under `.evidence-tmp/v3/video`, raw video is not committed) was written but **not run** — the servers were stopped by Claude Code's memory-pressure guard before it could run, and were not restarted. The motion evidence available is the frame strips in sheets 03 and 05.

## Reading the evidence honestly

- The glass change is deliberately restrained; it is easiest to see at 2× (sheet 09) and on the assistant panel (sheet 08). The largest visible changes are the portal (05, 07), the figure (06), TIBYN and the posters (01, 04, 11).
- Final visual sign-off belongs to the owner. These sheets show what changed; they do not certify taste.
