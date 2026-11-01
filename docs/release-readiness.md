# Release Readiness — The Intelligence Universe

Spec §13.3 / §14. Branch `feat/intelligence-universe`, 2026-11-01. Evidence: `docs/test-report.md`, `docs/acceptance-matrix.md`, `docs/evidence/`.

## Verdict for the next phase (G7 — CV population): **CONDITIONAL GO**

The engineering platform is complete and verified in real browsers: every P0 requirement except real-device mobile testing is met with evidence, and the content system was built for this hand-off. Content can be populated now **without touching UI, motion or 3D code**.

Conditions attached to the GO:
1. Content enters only through `src/content/data/*.json` with `verification.source` set, following `docs/content-population.md`; no fact is invented to fill a layout.
2. After each content swap: `npm run typecheck && npm test && npm run content:gate`, plus the E2E suite (longer real text can change layouts).
3. Public launch remains a **separate decision** (not part of G7): it requires the owner's approval, `VERIFIED_PUBLIC` with zero placeholders, a production domain, and the launch items below.

This is **not** a GO for public production launch.

## Completed and verified

| Area | State |
|---|---|
| Semantic site | Home S0–S9, `/projects` (filter + grid/list), 4 case studies, `/about` (content status, assistant notes, colophon), `/contact`, `/resume`, 404/error — SSG, one `h1` per page, axe-clean (0 serious/critical). |
| Real-time 3D | One persistent R3F canvas; orbital intelligence core (multi-axis chrome rings, energy emitter, fragments, sparks); terrain, planets, galaxy with DOM-pinned nodes, journey, portal and horizon stations; 4 procedural project worlds rendered live into card/hero portals. |
| Motion | Scroll-driven damped camera path with dwell, intro dolly, pointer parallax with ground guard, node approach, warp and ground-crossing veils, card → case-study portal transition, CSS hero entrance, opacity-only reveals, magnetic controls. |
| Resilience | Quality tiers + runtime governor + user override; static fallback with posters rendered from the live scenes; no-WebGL and context-loss paths tested; reduced motion honoured. |
| Honesty | Sample content labelled; no invented employers, dates, metrics, email or phone; demo assistant labelled on every answer and never calls the network; `/api/assistant` returns 503 until configured; preview builds are `noindex`. |
| Quality gates | typecheck, lint, 473 unit/component tests, build, 58 E2E across Chromium/Firefox/WebKit/mobile emulation, 4 real-GPU tests, Lighthouse, FPS and long-task profiles. |

## Mocked or demo (by design, labelled in the UI)
- Career journey: 8 **sample** milestones (no organisations or dates).
- Project summaries and case-study sections: placeholders or *In preparation*; architecture diagrams are labelled *Illustrative template*.
- AI Digital Twin: deterministic keyword retrieval over fixture knowledge, labelled *Demo*; the free-text box works only as that demo.
- GitHub link is derived from the repository remote and still marked `placeholder`.

## Blocked on the owner (cannot be inferred)
- CV and verified facts: roles, organisations, dates, outcomes, education, achievements.
- LinkedIn URL, public email, résumé PDF.
- Project media/client permissions; LifeAtlas description (currently *Concept / In development*).
- Live assistant: provider choice, budget, approved knowledge set (no paid service was added).
- Production domain and approval to publish/deploy.

## Known limitations (measured)
- **Mobile LCP 3.5–4.1 s** (Lighthouse slow-4G simulation) vs the 2.5 s budget; CLS 0, TBT 30–40 ms.
- **Desktop first visit:** ≈1.55 s of main-thread blocking from one-time shader compilation (repeat visits 122–200 ms).
- No physical phone or tablet was tested (emulation + Lighthouse only); WebGL verified on Chromium with an Intel iGPU only.
- No long-session memory soak test.
- At 4:3 the journey moon falls just outside the frame (decorative).
- Build prints a `metadataBase` notice until `NEXT_PUBLIC_SITE_URL` is set; R3F logs a `THREE.Clock` deprecation warning (upstream).

## Launch checklist (later, not G7)
- [ ] Owner-approved content; `npm run content:gate -- --strict` passes.
- [ ] `NEXT_PUBLIC_SITE_URL` set (canonical, sitemap, OG absolute URLs); `NEXT_PUBLIC_CONTENT_MODE=VERIFIED_PUBLIC`.
- [ ] Real-device pass: one mid-range Android, one iPhone, one tablet (touch, tier choice, thermal behaviour).
- [ ] Mobile LCP work (font subsetting, AVIF posters, prefetch policy) and re-measure.
- [ ] If the live assistant ships: grounded provider behind `/api/assistant`, rate limiting, spend caps, evaluation set (spec §9.3).
- [ ] Explicit approval to deploy.
