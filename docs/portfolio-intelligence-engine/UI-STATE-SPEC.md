# UI state specification — Ask My AI

PIE spec §3. Code: `src/components/ask-ai/` (`state.ts` reducer + `uiState()`, `AskAiPanel.tsx`, `LocalAiCard.tsx`, `AnswerCard.tsx`, `copy.ts`). The panel keeps the existing glass card, typography, input, chips and section layout (the stylesheet moved from `assistant/AssistantPanel.module.css` and was extended); the section, portal art and 3D station are unchanged.

## Observable attributes (tests and QA)

`[data-testid="ask-ai-panel"]` carries `data-state` (the spec state below), `data-mode` (`smart`/`local`), `data-local` (Local AI subsystem), `data-smart` (`idle`/`loading`/`ready`/`error`) and `data-motion` (`full`/`reduced`). Each turn is `[data-testid="assistant-answer"]` with `data-turn-state`, `data-mode`, `data-status`, `data-intent`. `window.__IU__.state().aiRenderHold` reports the 3D pause.

## States

| `data-state` | When | What the visitor sees |
|---|---|---|
| `smart-ready` | default; Local AI off | "Smart Mode — Instant answers from portfolio", "Try Local AI (runs on your device)", notice "Answers use approved public portfolio information only.", input, 4 suggestions |
| `smart-searching` | a question is waiting for the lazy index | the question + "Searching approved content…" |
| `smart-answer` | last Smart answer answered/partial | "Smart Answer" label, text, Sources, Explore links, follow-up suggestions |
| `smart-no-match` | last Smart answer refused / insufficient evidence | the refusal/abstention with contact or project links |
| `capability-check` | after "Try Local AI" | "Checking whether this device can run a local model…" |
| `local-unavailable` | no secure context / WebGPU / adapter / shader-f16 / limits | reason in plain words + "Smart Mode keeps working" + Back to Smart Mode |
| `local-consent` | capable device, model not fully cached | model choice (Qwen2.5 1.5B preselected; 0.5B preselected on data-saver / low-memory / touch-first devices), disclosure: download size (measured), model + license link + revision, browser storage size and how it is removed, GPU/memory impact and 3D pause, privacy (nothing sent to a server), optional nature; data-saver and low-storage warnings; **Download and start** / **Not now** |
| `model-downloading` | fetching model files | stage + shard count + percent, `<progress>`, 3D-pause note, **Cancel** |
| `model-initializing` | loading weights to the GPU / compiling shaders, then a one-token warm-up so the first question does not pay the WebGPU pipeline compilation | same, labelled "Preparing the model on your GPU" / "Compiling GPU shaders"; 3D paused |
| `local-ready` | model loaded | "Local AI — Generated on your device", "Qwen2.5 … is running on your device", **Back to Smart Mode**, **Remove model from this device** |
| `local-generating` | streaming | streamed text with caret (static "Writing the answer…" under reduced motion), **Stop** replaces Send; 3D paused |
| `local-answer` | last answer generated and verified | "Generated Locally" label, text with [E#] marks, "Sources given to the model" (cited ones marked), disclaimer that it can make mistakes |
| `local-cancelled` | Stop pressed | "Stopped. Your question is back in the box." — the question is restored to the input |
| `local-error` | download/init/runtime error | specific message (network, storage full, integrity, worker crash…) + **Try again** + Back to Smart Mode; the turn shows the Smart answer with a notice |
| `resource-pressure` | GPU out of memory / device lost | "The GPU ran out of resources or was reset, so Local AI stopped and the 3D scene resumed. Smart Mode is answering." |
| `switching-mode` | Back to Smart Mode while the worker unloads | transient |
| `offline-without-model` | offline and the model is not cached | "You're offline and the model isn't stored on this device yet. Smart Mode works offline." |
| `reduced-motion` | `prefers-reduced-motion` or the site's motion preference | `data-motion="reduced"`: no caret, no streaming animation, answer-in animation off (site rule `html[data-motion='full']`); text is never suppressed |

Smart answers inside Local AI mode (blocked request, no evidence, Arabic, failed verification, runtime error) are labelled **Smart Answer** and carry a notice explaining why — a template is never shown as "Generated Locally" and vice versa.

## Interaction

- **Enter** sends (single-line input, 500-character cap, `enterKeyHint="send"`, `dir="auto"` for Arabic). Suggestions send on click. Send is disabled when empty.
- **Stop** cancels generation; **Clear conversation** resets the per-tab history (max 8 turns, never persisted).
- On any failure the question is restored to the input.
- Live region (`aria-live="polite"`, visually hidden) announces summaries only — "Smart Answer: 2 source(s).", "Generated Locally: 3 source(s).", "Stopped…", errors, readiness — never the token stream (the streaming element is `aria-hidden`).
- Answers in Arabic render `dir="rtl" lang="ar"`.
- Touch targets ≥ 40–44 px; the input uses 16 px text on phones so iOS does not zoom when the keyboard opens; the conversation scrolls inside the card on desktop and flows with the page on phones.
- Focus returns to the input when Local AI becomes ready.
