# ISLAM — The Intelligence Universe

A cinematic, interactive 3D portfolio for an AI full-stack engineer: one persistent real-time WebGL world (orbital intelligence core, galaxy of destinations, project portal worlds) behind a fully semantic, accessible Next.js site.

> **Status: engineering preview.** All copy that is not from the design brief is labelled sample/placeholder content, the AI Digital Twin is a clearly labelled local demo, and preview builds are `noindex`. Real CV content is added in the next phase — see [`docs/content-population.md`](docs/content-population.md).

## Quick start

Requirements: Node ≥ 20.19 (developed on Node 24), npm.

```bash
npm install
cp .env.example .env.local      # optional; defaults are safe
npm run dev                     # http://localhost:3000 (or http://127.0.0.1:3000)
```

> **Page looks static under `npm run dev` (no 3D, no animations)?** Next 16's dev server rejects dev requests from hostnames it doesn't trust, and the page then never hydrates (it falls back to the static images). `localhost` and `127.0.0.1` are allowed; for anything else — e.g. your LAN IP when testing from a phone — add the hostname to `allowedDevOrigins` in `next.config.ts`, or use a production build (`npm run build && npm start`), which has no such check.

Production build:

```bash
npm run build
npm start                       # or: npx next start -p 3300
```

Useful URL flags: `?quality=ultra|balanced|lite|static` (force a tier), `?intro=0` (skip the first-visit prelude), `?debug=1` (exposes `window.__IU_DEBUG__` to hide/show named 3D objects for profiling). Read-only experience state (tier, WebGL status, scene states) is exposed on `window.__IU__` for tests and QA.

## Scripts

| Script                                                                            | What it does                                                                                                    |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`                                                 | Next.js dev server, production build, production server                                                         |
| `npm run typecheck` / `lint` / `format:check`                                     | `tsc --noEmit`, ESLint, Prettier check                                                                          |
| `npm test`                                                                        | Vitest unit + component suites                                                                                  |
| `npm run test:e2e`                                                                | Playwright: Chromium desktop + mobile, Firefox, WebKit (needs a build; `E2E_PORT=3300` reuses a running server) |
| `npm run test:e2e:gpu`                                                            | Opt-in real-GPU WebGL suite (3D render, stations, nodes, portals, FPS)                                          |
| `npm run perf:fps`                                                                | GPU frame-rate profile → `docs/evidence/fps-profile.json`                                                       |
| `npm run perf:lighthouse -- <url>`                                                | Lighthouse mobile + desktop-GPU runs → `docs/evidence/lighthouse/`                                              |
| `npm run content:validate`                                                        | Validates all content JSON against the zod contracts                                                            |
| `npm run content:gate [-- --strict]`                                              | Lists records still pending verification; fails in `VERIFIED_PUBLIC` mode                                       |
| `npm run capture:posters -- <url> [--only=journey]` then `npm run capture:encode` | Re-render fallback posters from the live scenes                                                                 |
| `npm run qa:stations -- <url> <out> --gpu` / `npm run qa:record -- <url>`         | Station screenshots / motion recordings on the GPU                                                              |
| `npm run check`                                                                   | typecheck + lint + test + build                                                                                 |

More QA tools: `scripts/qa/transitions.mjs` (3D between stations), `scripts/perf/long-tasks.mjs` (load-time main-thread blocking), `scripts/qa/montage.py` (evidence contact sheets).

## Architecture

**Persistent WebGL experience + semantic HTML interface + one motion orchestrator.**

- **DOM first.** Every section, link and control is real HTML (SSG). The canvas is decorative (`aria-hidden`, pointer-transparent), so keyboard, screen readers and no-WebGL browsers get the full site.
- **One canvas, many worlds.** `src/experience/` mounts a single React Three Fiber canvas in the root layout after load/idle. Native scroll is the only scroll source: the orchestrator maps it to a damped camera-path parameter with dwell at each section; scene groups mount once and are gated by path range (no recompiles while travelling).
- **Portals.** Four procedural project worlds render into render targets and are composited into tracked card/hero rectangles; a card expands into its case study across the route change.
- **Adaptive quality.** Capability detection → `ultra / balanced / lite / static`, a runtime FPS governor, and a user override in the settings panel. Software renderers and reduced-motion users get posters rendered from the live scenes.
- **Content is data.** `src/content/data/*.json`, validated by zod; every record carries a verification status. A publication gate blocks public builds that still contain placeholders.
- **Honest assistant.** `src/lib/assistant/` holds typed contracts, a safety policy and a deterministic demo provider; `src/app/api/assistant` is the server boundary for a future grounded provider (secrets server-side only).

```
src/app/            routes, metadata, API boundary
src/components/     layout, scenes (S0–S9), projects, case study, assistant, ui
src/experience/     canvas, orchestrator (scroll → path), rigs (camera), scenes, objects, portals, quality, shaders
src/content/        zod schemas, JSON fixtures, loader, publication gate
src/lib/            routes, scroll, SEO, preferences, assistant
tests/              unit, component, e2e (Playwright)
scripts/            QA, perf, poster capture, content tools
docs/               plan, decisions, acceptance matrix, test report, readiness, guides, evidence
```

## Documentation

- [`docs/implementation-plan.md`](docs/implementation-plan.md) — architecture, milestones, progress
- [`docs/decisions.md`](docs/decisions.md) — decision log (D-01…)
- [`docs/acceptance-matrix.md`](docs/acceptance-matrix.md) — IU-001…IU-022 with evidence
- [`docs/test-report.md`](docs/test-report.md) — commands, results, performance, defects
- [`docs/release-readiness.md`](docs/release-readiness.md) — verdict and launch checklist
- [`docs/content-population.md`](docs/content-population.md) — CV/content hand-off guide
- [`docs/asset-manifest.md`](docs/asset-manifest.md) — asset provenance and licences

The authoritative product spec and approved visual reference live in `docs/intelligence_universe_master/`.

## Environment

See [`.env.example`](.env.example). Nothing secret is needed to build or run. `NEXT_PUBLIC_*` values are public by definition — never put keys there. The site stays `noindex` until `NEXT_PUBLIC_CONTENT_MODE=VERIFIED_PUBLIC` and `NEXT_PUBLIC_SITE_URL` are set for an approved release.
