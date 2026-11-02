# Security and privacy

PIE spec §9. Threat model, mitigations and the network observations that back them.

## Data flow in one sentence

Questions are typed into a React input, answered by code running in the visitor's browser (main thread for Smart Mode, a dedicated Web Worker for Local AI), and rendered as text; nothing about a question — not its text, length or count — is sent anywhere, logged or stored.

## Threats → mitigations

| Threat | Mitigation | Evidence |
|---|---|---|
| Unapproved / provisional claims (temporary CV, placeholders, reel narration) | build-time default-deny allowlist; eligibility = verified ∧ public ∧ approved; client re-validation of the manifest | `knowledge.test.ts` (placeholder text never in the manifest), golden-set 8-word leak check |
| Private data (phone, repos, certificates, salary, address, age, family…) | private registry never compiled (`not-public`); refusal concepts routed before anything else; the model is never called for blocked requests; verifier rejects phone-like numbers and credentials | 17/17 Smart refusals; Local AI eval: 0 private-data occurrences in raw model output; e2e: no `tel:` link anywhere |
| Prompt injection in the question | injection concepts → refusal before retrieval/generation | golden set c12, held-out h12 |
| Prompt injection inside indexed content | compiler rejects instruction-like/markup text (`unsafe-text`); evidence fenced as quoted data, quotes/tags/markup neutralized; system prompt says to ignore instructions inside evidence | `knowledge.test.ts`, `local.test.ts` |
| Malicious / invented links | manifest links: internal routes, verified https profiles, verified mailto only (`isSafeHref`); answers link only to allowlisted targets; generated URLs/emails not in the allowlist are replaced and the attempt rejected | `retrieval.test.ts`, `manifest.test.ts`, `local.test.ts` |
| XSS through generated text | answers are React text nodes (no HTML, no Markdown renderer); `[E#]` becomes a `<sup>` element | component test (an `<img onerror>` question renders no element) |
| Oversized input / DoS | 500-character input cap; ≤ 5 evidence snippets of ≤ 320 chars; ≤ 200 output tokens; one generation per tab; Stop; worker termination on crash | unit tests (prompt bounds, client) |
| Stale or mixed answers | requestId on every worker message; tokens of a cancelled/superseded request are dropped | `client-state.test.ts` |
| Model supply chain | WebLLM pinned to 0.2.86 (exact, Apache-2.0, one dependency `loglevel`); weights and tokenizer pinned to Hugging Face commit SHAs; WebGPU library pinned to a binary-mlc-llm-libs commit; **SRI hashes** for `mlc-chat-config.json`, the WebGPU library and `tokenizer.json` enforced by WebLLM (`onFailure: 'error'`); a failed check shows an integrity error and keeps Smart Mode | `catalog.ts`, `local.test.ts` |
| Remote code | no `eval`/`new Function` in the runtime bundle (checked); CSP keeps `'unsafe-eval'` out of production; `'wasm-unsafe-eval'` allows WebAssembly compilation only | `next.config.ts` |
| Data leak through analytics | the panel imports no analytics; the former demo's `track('assistant_demo_query')` call is gone | code review |
| Unreliable hardware detection | capability check uses only facts the browser reports (secure context, adapter, `shader-f16`, buffer limits); memory/storage are advisory and never shown as facts; failures after consent are caught and fall back | unit + GPU e2e |
| Unsafe claims about work or companies | claims with numbers or proper names absent from the corpus are "can't confirm"; generated sentences with such tokens are rejected | golden c10, held-out h10, `local.test.ts` |

## Content-Security-Policy (production)

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self';
connect-src 'self' https://huggingface.co https://*.hf.co https://raw.githubusercontent.com;
worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```

Changes from the previous policy: `'wasm-unsafe-eval'` (WebAssembly compilation for the tokenizer and runtime inside the worker; JavaScript `eval` stays blocked) and three `connect-src` hosts (model weights/tokenizer/config from Hugging Face and its `*.hf.co` CDN — observed redirect target `us.aws.cdn.hf.co` — and the compiled WebGPU library from `raw.githubusercontent.com`). The same header is served on the worker script (`/_next/static/chunks/turbopack-worker-*.js`), so it governs the worker. `X-Frame-Options: DENY` and the rest are unchanged.

Residual risk: the allowed hosts could serve other content to the page, but the page only fetches the pinned URLs, and the integrity-checked artifacts cannot be swapped silently; weight shards are commit-pinned (immutable URLs) but not SRI-checked by WebLLM 0.2.86. For a production launch, self-hosting the model files on the site's own origin would remove all third-party hosts (deployment decision — not done here).

## Network observations (production build, Chromium)

| Scenario | Observed | Source |
|---|---|---|
| Home page load, Ask My AI not yet near the viewport | no `/ai/knowledge.json`, no worker chunk, no model host | `ask-ai.spec.ts` "loads lazily" |
| Ask My AI section reached | exactly one `GET /ai/knowledge.json?v=k…` | same |
| Smart questions (all browsers) | no further requests; no request to `/api/*`; no non-GET request | `ask-ai.spec.ts`, `honesty.spec.ts` |
| Try Local AI → consent shown → **Not now** | 0 requests to model hosts, worker chunk not requested | `ask-ai.spec.ts` consent test |
| Consent accepted (real GPU, cold profile) | GETs only, only to this origin and the pinned model hosts | `local-ai.gpu.spec.ts` |
| Local AI questions | 0 requests while generating (eval runs: only the site's own origin — page assets) | `evidence/local-eval-summary.json`, `.evidence-tmp/ai/local-eval-*.json` `requestsByHost` |
| Local AI, model cached, 10 enable/answer/close cycles | 248 KB from the site itself, **0 requests to model hosts** | `evidence/local-bench-Qwen2.5-1.5B-warm-stress.json` |
| Second tab while the first holds Local AI | refused with "already running in another tab" (Web Lock), no download | `ask-ai.spec.ts` multi-tab test |

## Storage

| What | Where | Lifetime / control |
|---|---|---|
| Conversation | React state | tab only; "Clear conversation"; gone on reload |
| Knowledge manifest | HTTP cache | `max-age=0, must-revalidate`, version-keyed URL |
| Model files (~284 MB for 0.5B, ~875 MB for 1.5B) | Cache Storage `webllm/model`, `webllm/config`, `webllm/wasm` | until "Remove model from this device" or the visitor clears site data; partial downloads are kept and resumed |

No cookies, localStorage or IndexedDB are written by the assistant.
