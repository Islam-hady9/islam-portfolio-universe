# Decision Log

Non-trivial implementation decisions and deviations from IU-MASTER-001 suggestions (spec §16 permits these; each is recorded here).

| # | Decision | Rationale |
|---|---|---|
| D-01 | Next.js 16 App Router, React 19.3, TypeScript strict, npm. | Spec default stack; npm is universally available (no lockfile existed). |
| D-02 | TypeScript pinned to 6.0.3, not 7.x. | TS 7 is the native (Go) port; Next's type-check and typescript-eslint use the JS compiler API. 6.0 is the stable JS-API line. |
| D-03 | CSS Modules + global design tokens (custom properties), no Tailwind. | Spec allows "Tailwind or token-based CSS". The design is bespoke (masks, glass, cinematic gradients); modules keep markup semantic and styles co-located. |
| D-04 | Fonts: Sora (display), Manrope (body), JetBrains Mono (labels) — OFL, self-hosted woff2 copied from `@fontsource-variable/*`, loaded with `next/font/local`. | Spec-suggested pairing; offline-deterministic builds; licences shipped beside files. |
| D-05 | One fixed, pointer-transparent canvas in the root layout; all interaction via DOM. | Spec §6.1 persistent canvas; guarantees keyboard/screen-reader/no-WebGL parity. |
| D-06 | Native scroll only; camera pulls `scrollY` per frame; ScrollTrigger for DOM reveals; ScrollToPlugin for anchor travel. No Lenis. | Spec §6.1 "prefer native scroll"; one scroll source. |
| D-07 | Camera = damped path parameter over a Catmull-Rom station path with dwell easing, plus lens shift (`setViewOffset`) for off-centre framing per aspect class. | Keeps subjects composed beside DOM copy without changing perspective; damping in path space prevents clipping through geometry. |
| D-08 | Project cards: poster by default, live 3D mini-world on hover/focus/transition, composited from an FBO with a rounded-rect SDF mask. Card tilt applied in-scene (camera parallax), CSS tilt only in poster mode. | Avoids fixed-canvas/DOM scroll desync and draws real depth; one WebGL context. |
| D-09 | Hero type scale `clamp(3.1rem, 4.9vw, 7rem)` instead of suggested `6.8vw`; section titles ~`3.1vw`. | Reference headline spans ≈28–30% of width; spec says scales are suggestions to adjust with QA. |
| D-10 | Content as JSON in `src/content/data`, validated by zod at build; every record carries `verification.status` (`placeholder` / `owner_verified` / `public_verified`) and `source`. Copy authored verbatim in the owner's spec is `owner_verified` with source `IU-MASTER-001 §x`; anything drafted during engineering is `placeholder`. | Content swap without touching scene/layout code (spec §10.1); auditable provenance. |
| D-11 | Global content mode `NEXT_PUBLIC_CONTENT_MODE` (`DEMO_CONTENT` default). Non-public modes emit `noindex` and show a discreet "Preview content" indicator; a publication-gate test fails if `VERIFIED_PUBLIC` is set while any rendered record is `placeholder`. | Spec §10 deferred-content gate made executable. |
| D-12 | No contact email/phone/social URL is invented. Unconfigured channels render an honest "available after profile review" state; `/resume` explains deferral. | Spec §4.2, §10.2. |
| D-13 | Assistant runs a local deterministic demo provider (keyword retrieval over fixture knowledge, citations to fixture IDs, `mode: "demo"`). `/api/assistant` implements the contract and returns `503 not_configured` until a provider is wired. | Spec §9.1: no paid calls, honest labeling; free-text input works *as a labeled demo*. |
| D-14 | Prelude only on first visit on desktop fine-pointer, CSS-timed (≤2.4 s) with JS early-dismiss; skipped on mobile, reduced motion and repeat visits. | Spec S0 + LCP budget on mobile. |
