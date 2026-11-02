# Asset Manifest

Spec §3.5 / IU-018. Every shipped asset, its origin and licence. No stock imagery, third-party models, HDRIs or logos-as-art are used; the only photographic media are the owner's own portrait and reel. The machine-readable copy lives in `src/content/data/attributions.json` and is rendered on `/about#colophon`.

| Asset | Location | Origin | Licence | Optimisation |
|---|---|---|---|---|
| Sora (variable, latin) | `src/assets/fonts/sora-latin-wght-normal.woff2` | @fontsource-variable/sora 5.3.0, subset by `scripts/fonts/subset-fonts.py` | SIL OFL 1.1 (`sora.LICENSE.txt`; no Reserved Font Name) | woff2 subset (Latin-1 + punctuation + arrows), self-hosted via `next/font/local`, preloaded |
| Manrope (variable, latin) | `src/assets/fonts/manrope-latin-wght-normal.woff2` | @fontsource-variable/manrope 5.3.0 | SIL OFL 1.1 | woff2, preloaded |
| JetBrains Mono (variable, latin) | `src/assets/fonts/jetbrains-mono-latin-wght-normal.woff2` | @fontsource-variable/jetbrains-mono 5.3.0 | SIL OFL 1.1 | woff2, not preloaded |
| All 3D scenes, shaders, terrain, planets, galaxy, portals, project worlds | `src/experience/**` | Original, procedural (generated at runtime from code; seeded) | Original work for this portfolio | tiered particle/segment counts, instancing, precompiled programs |
| Environment reflections | `src/experience/scenes/SceneEnvironment.tsx` | Procedural light-formers rendered once to a cube map | Original | 256² PMREM, rendered once |
| Fallback posters | `public/images/posters/*.webp` (+ `-480`, `-800` variants) | Rendered from this site's own live scenes by `scripts/capture/posters.mjs` → `encode-posters.py` | Original | WebP q74–78, responsive `srcset`, ~0.6 MB total |
| UI icons | `src/components/ui/Icon.tsx` | Original 24×24 line geometry | Original | inline SVG |
| GitHub / LinkedIn marks | `src/components/ui/Icon.tsx` | Simplified original renderings | Trademarks of their owners; used only to label links to the owner's profiles (nominative use) | inline SVG |
| Brand mark / favicon | `src/components/layout/BrandMark.tsx`, `src/app/icon.svg` | Original | Original | SVG |
| Social card | `src/app/opengraph-image.tsx` | Generated at build (next/og) from brand tokens | Original | 1200×630 PNG |
| Owner portrait | `public/media/photo/portrait-{480,720,960,1112}.{avif,webp}`, `portrait-{720,1112}.jpg` | Owner-supplied photograph (2026-11-01); original kept locally in git-ignored `media-src/` | The owner's own photograph, supplied for this site | `scripts/media/process-media.py`: fresh pixel buffers (no EXIF/GPS/XMP/ICC), no retouching; AVIF q72 (16–52 KB) / WebP q82 / JPEG q84 fallback; 24 px blurred placeholder inlined |
| Owner intro reel | `public/media/video/intro-reel-1080.mp4` (remux, 7.3 MB), `intro-reel-720.mp4` (H.264 CRF 23 + AAC 128 k, 2.9 MB) | Owner-supplied 35 s vertical reel (2026-11-01); the source file indicates generative AI video tools (disclosed in the player, owner to confirm) | The owner's own video, supplied for this site | 1080p copied without re-encoding; 720p re-encoded (x264 slow, aq-mode 3 for dark scenes); `+faststart`; all container metadata removed; served poster-first, only after the player opens |
| Reel poster + thumbnail | `public/media/posters/intro-reel-{540,1080}.{avif,webp}`, `-540.jpg`; `public/media/thumbnails/intro-reel-{112,168}.{avif,webp}` | Frames of the owner's reel (poster 3.8 s, thumbnail crop 5.0 s) | As the reel | AVIF/WebP, 1–25 KB |
| Reel captions | `/media/captions/intro-reel.en.vtt` (static route) | Generated at build from the transcript cues in `src/content/data/media.json` (local Whisper transcription, owner to confirm) | As the reel | WebVTT, prerendered |
| Résumé (temporary CV) | `public/resume/Islam_Abdelhady_CV.pdf` → `/resume/Islam_Abdelhady_CV.pdf` | Owner-supplied PDF (2026-11-02), imported by `scripts/resume/import-resume.mjs` | The owner's own document | **None** — byte-for-byte copy, SHA-256 `244673cb…689d8` recorded in `src/assets/resume.json` |
| Approved reference | `docs/intelligence_universe_master/APPROVED_HOMEPAGE_REFERENCE.png` | Owner-supplied design reference | Not shipped (docs only) | — |

## Regenerating posters

```bash
npm run build && npx next start -p 3100                       # any running server works
npm run capture:posters -- http://localhost:3100              # GPU Chromium; DOM hidden while capturing
npm run capture:posters -- http://localhost:3100 --only=journey   # or just the posters a change affects
npm run capture:encode                                        # crops, WebP, srcset variants, src/assets/posters.json
```
Re-run after changing a scene so fallbacks keep matching the live 3D (raw captures stay in the git-ignored `.evidence-tmp/posters/`).

## Regenerating the personal media

```bash
# originals (not committed): media-src/portrait.jpeg, media-src/intro-reel.mp4
npm run media:process        # or: python scripts/media/process-media.py --photo <file> --video <file>
```
Writes `public/media/**` and `src/assets/media.json`. Poster time, thumbnail crop, widths and qualities live in `scripts/media/media.config.json`. Requires ffmpeg/ffprobe (libx264, aac) and Pillow with AVIF.
