# Personal Media Integration — portrait + intro reel

Branch `feat/intelligence-universe`, 2026-11-01. Not pushed, merged or deployed. No CV content was added; the portrait and the reel are the owner's own files, supplied for this phase.

## 1. The media (analysed before designing)

| | Portrait | Intro reel |
|---|---|---|
| Source | Owner's `WhatsApp Image 2026-11-01 at 4.47.34 PM.jpeg` (from a `linkedIn-photos` folder) | Owner's `20261017-1729-critical-requirement-strict-facial-ident-….mp4` (from a `generated-videos` folder) |
| Format | 1112 × 1414 JPEG (≈ 4:5), sRGB, no EXIF/ICC (WhatsApp export, 108 KB) | 1080 × 1920 (9:16) H.264 High @ 30 fps, 35.0 s, AAC stereo, 7.3 MB (1.66 Mb/s) |
| Content | Seated, dark shirt, hand at the chin, gaze to **screen-left**; warm lamp-lit bokeh (plants, bookshelf). Low-key, amber-on-black — already in the site's tonal family | Motion-designed reel: constellation → close-up portrait with the word "question" → agent loop (planner / retriever / tool call / evaluator; "Automate", "Respond" struck through) → "Build" stack (React/Next.js, NestJS/FastAPI, LangGraph/RAG, PostgreSQL/Redis, Docker/Kubernetes/AWS) → TIBYN, MOViD Studio, AI Agents cards → framed portrait + name card ("Islam Abdelhady — AI Engineer · Technical Lead — Building what comes next.") |
| Audio | — | Narrated voice-over (centred, ‑16 LUFS) on a music bed; 9 spoken lines, transcribed locally (Whisper small, offline) and checked against the on-screen text |
| Provenance | Owner photograph | The source folder (`generated-videos`) and the file name (a generation prompt: "critical requirement: strict facial identity…") indicate **generative AI video tools** → disclosed in the player as *"Produced with generative AI video tools."*, flagged for the owner to confirm |

Choices that follow from the analysis:
- **Gaze direction** → the portrait sits on the *right* of the identity band, so the subject looks back across the statement.
- **Vertical 9:16 film** → a "cinema + notes" player on desktop (film left, title/transcript right), film-first on phones.
- **Poster** = the 3.8 s close-up with the italic word *question* (sharpest frame, and the reel's opening line "Every breakthrough begins with a question"); thumbnail = a 5.0 s face crop (no type in the crop).
- **The reel has its own typography** (name card, labels) → nothing is overlaid on the film during playback (see §4).

## 2. Placement and narrative

| Beat | Where | What |
|---|---|---|
| The universe (technical identity) | Hero (S1) | Unchanged composition. A quiet chip under the CTAs — face thumbnail, mint play badge, *Watch the introduction · 0:35 · PERSONAL REEL*. It does not compete with the core and costs ~2 KB, loaded after first paint. |
| The human behind it | Identity band (S2) | Portrait in an art-directed frame on the right; statement + pillars on the left. Caption *THE ENGINEER BEHIND THE UNIVERSE*; a glass *Watch the introduction* control docked in the frame. |
| Trust / emotional connection | Reel player (modal) | Opened from the hero chip or the portrait. |
| About | `/about` hero | The portrait leads the page (role as caption) with the same reel control; the identity band on /about omits it (no repetition). |

Not used, on purpose: a portrait in the hero (it would fight the approved focal point and become the mobile LCP), an autoplaying inline teaser (bandwidth, motion, and AI-generated motion of a face next to the real photograph risks an uncanny pairing), a third placement on /contact (crowding).

## 3. Media handling

- **Pipeline**: `npm run media:process` (`scripts/media/process-media.py`, config in `scripts/media/media.config.json`). Originals live in git-ignored `media-src/`; outputs: `public/media/{photo,video,posters,thumbnails}` + manifest `src/assets/media.json`.
- **Portrait**: AVIF q72 at 480/720/960/1112 w (16/27/38/52 KB), WebP q82, JPEG q84 fallback (720/1112). No retouching: q60 AVIF visibly smoothed beard/skin texture (a "beauty filter" look), so the quality was raised after a side-by-side check. Depth comes from the frame, not from edits to the face.
- **Reel**: 1080p **remuxed** without re-encoding (7.3 MB, used on ≥ 1.5 dppx desktops/tablets and tall screens via `<source media>`), 720p re-encoded H.264 CRF 23 + AAC 128 k (2.9 MB, default; Save-Data forces it), `+faststart`. WebM was not shipped: H.264 plays in Chromium, Firefox and WebKit (verified with real playback in all three).
- **Privacy**: every image is written from a fresh pixel buffer; every MP4 has container metadata dropped (verified: no EXIF/ICC/XMP, only structural tags).
- **Copy as content**: `src/content/data/media.json` (zod: `mediaContentSchema`) — portrait description, labels, 10 caption cues, 5 on-screen descriptions, provenance flag. Captions are served as WebVTT from the same cues (`/media/captions/intro-reel.en.vtt`, prerendered).
- **Verification**: portrait and reel records are `owner_verified` (owner-supplied files); the **transcript** and the **AI disclosure** are `placeholder` → listed by `npm run content:gate` and blocking `VERIFIED_PUBLIC` until the owner confirms (see `docs/content-population.md`).

## 4. Components and interaction

- `PersonalPortrait` — `<figure>` with AVIF/WebP/JPEG `<picture>`, intrinsic size + 4:5 frame (no layout shift), blurred inline placeholder, grade (caption scrim, vignette, a faint teal rim against the lamp-amber), static film grain, viewfinder corner marks, one hairline orbit + mint point behind the frame, pointer spotlight (fine pointers), a 3 % lean-in on hover, and a scroll **mask reveal** (new `data-reveal="mask"` in the shared GSAP system, motion tokens; off for reduced motion and for anything already on screen). Below the fold it loads after first paint (`DeferredImg`, now `<picture>`-aware); on /about it is eager + `fetchpriority="high"`.
- `IntroReelTrigger` — real `<button aria-haspopup="dialog">`, accessible name "Watch the introduction, 35 seconds video"; hover/focus/touch warm the player chunk.
- `IntroReelHost` + `reel-bus` — the player chunk (5.3 KB gzip) mounts after first paint; the trigger calls `open()` **synchronously inside the click**, so playback with sound starts within the user gesture.
- `IntroReelPlayer` — native modal `<dialog>`: focus moves to Play/Pause, the page behind is inert, **Escape / close button / backdrop click** close, focus returns to the trigger, page scroll is locked and restored. Poster-first (`preload="none"`, poster set only on open). Plays on open; **reduced motion opens on the poster** and waits for Play. Custom console: seek (with buffered range), time, captions, sound, full screen (element full screen; iOS native player with the VTT track), keyboard **K / Space, M, C, F, ← →**, polite status announcements, an error state that offers the MP4. **Captions sit in a reserved rail under the film and are on by default** (remembered). Interactive transcript (narration cues seek the film) + on-screen description = a complete text alternative. Ambient light from a blurred poster behind the film.
- While the player is open the WebGL loop pauses (`frameloop="demand"`).

Design iteration recorded in `evidence/reel-caption-iteration.webp`: the first version overlaid captions and controls on the film and covered the reel's own closing name card; the final version keeps the film clean.

## 5. Performance (measured)

Method: the pre-change build (commit `9014431`, served from a scratch copy on :3300) and the final build (:3301) measured **interleaved** (A, B, A, B…) with `scripts/perf/lighthouse.mjs --only=… --out=…` on an otherwise idle machine (the owner's Chrome measured at < 1 % of one core). Medians: before n = 6, after n = 3 on the final build. Lighthouse mobile = Moto G Power emulation, slow 4G, 4× CPU, static tier; desktop = real GPU, full WebGL.

| Page · profile | Metric | Before | After | Δ |
|---|---|---|---|---|
| Home · mobile | Performance | 94 | 93 | −1 |
| | FCP / LCP | 1.06 s / 3.12 s | 1.06 s / 3.26 s | 0 / **+0.14 s** |
| | TBT / CLS | 36 ms / 0 | 48 ms / 0 | +12 ms / 0 |
| | Transfer | 453 KB | 468 KB | +15 KB |
| About · mobile | Performance | 100 | 94 | −6 |
| | FCP / LCP | 1.06 s / 1.06 s (text) | 1.06 s / **3.13 s (portrait)** | 0 / +2.07 s |
| | TBT / CLS | 42 ms / 0 | 43 ms / 0 | — |
| | Transfer | 408 KB | 456 KB | +48 KB (portrait 28 KB, chunks, thumbnail) |
| Home · desktop GPU | Performance | 71 | 71 | 0 |
| | LCP / TBT / CLS | 0.68 s / 982 ms / 0 | 0.72 s / 935 ms / 0 | +0.05 s / noise / 0 |

| Budget item | Result |
|---|---|
| Video + poster bytes before the player opens | **0** (Lighthouse network log, E2E request log) |
| Initial JS (home / about) | +4.8 KB raw, **+2.1 KB gzip**; the player is a separate 5.3 KB-gzip chunk loaded after first paint |
| HTML | +3.2 KB gzip (home), +3.1 KB (about) — transcript cues, responsive `<picture>` markup |
| Render-blocking CSS | 3 files before and after; 16.6 → 18.2 KB gzip |
| Layout shift | CLS 0 in every run; portrait box identical before/after load (E2E) |
| GPU while the reel plays | **0 WebGL draw calls** (GPU E2E); rendering resumes on close |

Notes:
- The **+150 ms FCP** first measured on home came from one extra render-blocking CSS chunk (the new shared components changed CSS chunking); importing them in the same order on both routes restored three shared stylesheets — the final build's FCP is unchanged.
- **/about mobile LCP** moves from the text (1.06 s) to the priority-loaded portrait (3.13 s): an image LCP in Lighthouse's simulation is charged the framework JavaScript evaluated before it — the same known limitation that holds the home page at ~3.1 s (`docs/cinematic-polish-v2/PERFORMANCE-REPORT.md`). The score stays 94. If the metric matters more than the image on phones, a compact mobile portrait (smaller than the text block) would keep text as the LCP — an owner decision.
- One Lighthouse run hung (headless Chrome "Connection closed") and earlier "after" runs measured intermediate builds; both are excluded from the table (raw data stays in `.evidence-tmp/lh/`, git-ignored).

## 6. Tests

| Suite | Result |
|---|---|
| Unit + component (Vitest) | **527 passed / 30 files** (478 before): media manifest ↔ files + byte budgets; WebVTT builder + captions route; media contract, honesty and gate rules; player (modal lifecycle, focus return, scroll lock, world pause, K/M/C/Space, captions rail, transcript seek, reduced motion, error fallback); trigger; bus queueing; `CanvasBoundary` |
| E2E (Playwright, production build) | **92 passed, 3 skipped (by design), 0 failed — two consecutive full runs** on the final build |
| Media spec across engines | Chromium desktop, Chromium mobile (Pixel 7), Firefox, WebKit: real playback of the shipped MP4 in all four, captions, poster-first loading, keyboard + inert background + focus return, reduced motion, transcript reachability, WebVTT route, /about placement, CLS < 0.01 (Chromium), axe 0 serious/critical with the player open — repeated ×2: 66 passed |
| Responsive / visual | 6 viewports without horizontal overflow (after the fix); hero pixel baseline updated after review (diff = the chip + a 22 px rise of the centred copy) |
| Real GPU (opt-in) | 4/4: real 3D, universe nodes, portals, **new: 0 draw calls while the reel plays, resumes after** (the FPS profile was not re-run — 3D is unchanged and it would overwrite the committed FPS evidence) |
| Resilience (new) | Renderer that cannot initialise → posters, page intact (fails on the old build, passes now) |
| Static | typecheck, ESLint, Prettier clean; `content:validate` OK; `content:gate` 44 pending (42 + transcript + provenance) |

## 7. Defects found and fixed in this phase
1. **Horizontal overflow (2–9 px) on home** at 768/1024/1440 — the portrait's rotated orbit ellipse; geometry now stays inside the frame (caught by the responsive E2E suite).
2. **/about portrait collapsed to zero width on phones** (percentage width inside a shrink-to-fit grid cell) — caught in the first screenshot review; now sized from the viewport.
3. **Captions and controls covered the reel's name card** — redesigned (rail + console under the film).
4. **Extra render-blocking CSS request on home** (+150 ms simulated FCP): the new shared components changed the CSS chunking; importing them in the same order on both routes restored three shared stylesheets.
5. **Pre-existing, found by this phase's tests: a WebGL renderer that fails to initialise took the whole site down** to the global error screen ("Something went wrong. The site failed to load."). Reproduced in WebKit under load and deterministically in Chromium; `CanvasBoundary` now contains it (posters stay, `data-webgl="failed"`), with an E2E regression test.

## 8. Evidence (`docs/personal-media-integration/evidence/`, real GPU, 1440×900 and iPhone 13 profile)

| File | Shows |
|---|---|
| `hero-before-after.webp` | Hero with the reel chip under the CTAs |
| `identity-before-after.webp` | Identity band before / with the portrait and reel control |
| `portrait-detail.webp` | The portrait frame at 1× (grade, corners, caption, control) |
| `reel-player-desktop.webp` | Player: playing with captions · closing name card unobstructed · interactive transcript |
| `reel-caption-iteration.webp` | Design iteration: overlay captions/controls (rejected) vs rail + console |
| `about-before-after.webp` | /about hero before / with the portrait |
| `mobile-after.webp` | Phone: hero chip, identity portrait, player, name card, /about |
| `mobile-before-after.webp` | Phone: identity and /about before / after |

Reproduce: `node scripts/qa/media-evidence.mjs <baseUrl> <outDir>` (also prints the chosen video variant, requests before opening, focus and scroll state after closing, and page errors).

## 9. Remaining limitations and owner actions

1. **Confirm the reel's words** (`src/content/data/media.json`, then set the two `placeholder` records to `owner_verified`): the narration transcript (machine-transcribed locally) and the spelling in its last line (the reel's own card reads "Abdelhady", the site "Abd-Elhady").
2. **Confirm the AI disclosure** ("Produced with generative AI video tools.") — inferred from the source file; keep, reword, or set `aiGenerated: false`.
3. **Reconcile the reel's claims with the site**: its title card says "AI Engineer · Technical Lead" (site: "AI Full-Stack Engineer"); the TIBYN card says "aquaculture SaaS · live"; the stack card lists NestJS, Kubernetes and AWS. They are the owner's own words in the owner's video, quoted in the transcript — not verified by this phase.
4. **/about mobile LCP 1.06 → 3.13 s** and home mobile LCP +0.14 s (3.12 → 3.26 s) in Lighthouse's slow-4G simulation (see §5); FCP, TBT and CLS unchanged.
5. **No physical phone/tablet** was available: mobile verified in emulation only; the iOS native-fullscreen caption hand-off is implemented but not exercised on a real iPhone.
6. The 1080p variant (7.3 MB) goes to high-DPI desktops/tablets and tall screens — only when the visitor plays the reel; the default is 2.9 MB (720p). There is no WebM/AV1 copy (H.264 is universal in current browsers; an H.264-less build would see the error state with a link to the file).
7. The portrait source is a WhatsApp export (1112 px wide): sharp up to ~520 CSS px at 2×. A higher-resolution original would allow larger use.
8. Headless WebKit on Windows renders WebGL and video on the CPU; its E2E project now runs one worker at a time (D-41). Real Safari (macOS/iOS, GPU) was not available.
9. The final visual sign-off is the owner's.
