# AI Presence V1 — Implementation Plan (as executed)

Branch `feat/intelligence-universe`, starting point `31df9d4` (Cinematic Fidelity V3 closure). Local work only: nothing pushed, merged or deployed, and no paid service used.

## P0 — Audit (what already existed)

| Area | Finding | Consequence |
| --- | --- | --- |
| Assistant UI | `AskAiPanel` holds the whole conversation in a local reducer (`ask-ai/state.ts`): turns, mode, Local AI lifecycle, streaming, announcements. It was rendered only inside the home page's Ask My AI section | Reuse this exact component. Never fork it, never lift its reducer |
| Smart Mode | `lib/portfolio-ai/smart/engine.ts` over the compiled manifest (`/ai/knowledge.json`, compiled from approved content at build time) | Untouched. Suggestions are validated against it |
| Local AI | `lib/portfolio-ai/local/*`: WebGPU worker, model catalog, consent card, cache, tab lock, answer verification | Untouched. One panel instance means one runtime |
| Cloud | `/api/assistant` is a 503 "unavailable" boundary from G0/G1; no provider, no keys | Unchanged; no cloud path added |
| 3D lifecycle | One persistent R3F canvas. `mediaOverlay` / `aiRenderHold` switch the frame loop to `demand` | The drawer adds `assistantOpen` to the same switch |
| Modal pattern | `IntroReelPlayer` uses a native modal `<dialog>` (inert background, cancel/close) | The drawer follows the same pattern |
| Shell | Root layout with Header and MobileMenu (`data-menu-open`). Magnetic hover (`data-magnetic`), Intelligent Glass classes (`glass--panel/flat/chip/mint`), motion tokens and `html[data-motion]` | The orb and drawer reuse all of them, with no new design primitives |
| Tests | Vitest (unit/component), Playwright (Chromium desktop and mobile, Firefox, WebKit, opt-in real-GPU project), visual baseline of the hero | Presence specs are added to all four default projects |

## Plan by milestone

| Milestone | Delivered |
| --- | --- |
| P1 Shared session | `assistant-store` plus the single-instance teleport (`AssistantRoot`). Queued questions with consume-once ids |
| P2 Drawer | `AssistantDrawer`: native dialog, desktop sheet and full-screen phone layout, scroll lock, focus in/out, closes on navigation |
| P3 Orb | `AssistantOrb`: CSS/SVG, phases, steps aside for the section, drawer and menu, tucks away from CTAs |
| P4 Hero | `HeroAssistantEntry` inside the hero's entrance cascade; compact rules for short windows and phones |
| P5 Suggestions | Route map built at build time; panel shows route suggestions until an answer brings its own |
| P6 Keyboard and a11y | Ctrl+K / ⌘K toggle, typing protection, dialog semantics, focus restore, reduced motion |
| P7 State motion | `presenceOf` mapping, published on transitions only |
| P8 Performance | Panel and Smart index lazy (proximity, hover/focus, open); 3D paused under the drawer. **Pending:** the runtime and bundle cost have not been measured yet (`scripts/qa/presence-perf.mjs`, `presence-bundle.mjs`) |
| P9 Validation | Final build: Chromium desktop 89 passed (1 skipped), Pixel 7 emulation 40 passed (5 skipped), Firefox 39 passed (3 skipped), Vitest 785/785, typecheck, lint and format clean. **Pending:** WebKit (its worker failed to start during a memory shortage), the real-GPU suite and the screenshots |
| P10 Closure | Local commits done. **Pending:** performance report, test results, closure report |

## Decisions and deviations

- **One instance, moved.** It is not two instances kept in sync, which would duplicate the index and the worker. See [ARCHITECTURE.md](ARCHITECTURE.md).
- **Suggestions limited to answerable questions.** Several of the mission's example questions are answered by the engine only with "details awaiting verification", or not at all ("Explain this project's architecture"). Only questions the engine answers from approved content with a source are offered; the table is in [INTERACTION-SPEC.md §4](INTERACTION-SPEC.md#4-context-aware-suggestions).
- **Hero supporting line omitted.** "Ask about my projects, experience, architecture, or technical stack" advertises topics the knowledge base cannot yet answer.
- **Shortcut is a toggle, platform-exact.** Ctrl+K on Windows/Linux and ⌘K on macOS, never intercepted while typing in a field.
- **No persistence.** The session lives in memory only, so no storage disclosure is needed.
- **Fixed during validation:**
  - A late `close` event after a fast reopen. An E2E failure under parallel load exposed it, and the trace confirmed it.
  - A reopen during the exit animation, which left an invisible modal. Found while analysing the first bug.
  - The first shortcut version, which accepted either modifier on every platform and also fired inside text fields. Found by re-checking the requirements.
  - The orb's tuck flipping back over the control it moved away from, and not re-checking after route changes or reveals. Found in review.
  - The orb painting over the first-visit intro and blocking "Skip intro". Found by the existing `motion.spec.ts`.
  - A horizontal overflow on 320 px screens from the section slot's grid. Found by the existing `visual.spec.ts`.

  The first four have regression tests in `tests/e2e/presence.spec.ts` or `tests/unit/portfolio-ai/presence.test.ts`; the last two are covered by the existing specs that found them.
