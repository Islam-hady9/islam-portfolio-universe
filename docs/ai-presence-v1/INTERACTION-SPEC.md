# AI Presence V1 — Interaction Specification

How the global assistant behaves, as implemented and tested. Evidence screenshots are pending.

## 1. The orb

| | |
| --- | --- |
| Where | Bottom-right, `max(20px, safe-area inset + 14px)` from both edges; 58 px (54 px on phones); dock layer, above content, below modals |
| What | A miniature of the Intelligence Core: glass sphere, breathing core, two slow orbit rings. CSS/SVG only, with no canvas, no JS animation loop and no model |
| Hover (fine pointer) | Label pill "Ask My AI" with the platform shortcut, plus the site's existing magnetic pull. Hovering or focusing also prefetches the assistant UI module, and nothing else |
| Click / tap / Enter / Space | Opens the drawer and remembers the orb as the opener |
| Accessible name | "Ask My AI", plus " — searching the portfolio", " — writing an answer", " — downloading the local model, 42 %", and so on while something is happening. Also `aria-haspopup="dialog"`, `aria-expanded`, and `aria-keyshortcuts` with the platform's chord |

**Phases** (they follow the assistant; transitions only, never per token):

| Phase | Visual |
| --- | --- |
| idle / ready | Slow breathing core (4.8 s), orbit rings 36 s per turn |
| retrieving / initializing | Orbits speed up (7 s per turn) |
| downloading | Progress ring around the sphere (rounded to 1 %) |
| generating | Core pulse (1.5 s), orbits 12 s per turn |
| complete | One soft glow, then back to ready |
| fallback | Small violet status dot. Smart Mode answered instead of Local AI |
| error | Small amber status dot. Calm, never an alarm |

**Stepping aside.** The orb fades out (hidden from assistive technology too):

- while the drawer is open;
- while at least 35 % of the Ask My AI section's own panel is on screen;
- while the mobile menu is open;
- during the first-visit intro prelude, whose "Skip intro" sits in the same corner.

The orb also checks for a link, button, field or label underneath its resting position. If one is there, it **tucks** about 60 % past the screen edge: still visible and tappable, so it never covers a call to action. Hover or keyboard focus brings it back.

The check runs 140 ms after scrolling or resizing settles, after any reveal animation or transition ends, and on every route change. It always probes the resting position, so a tucked orb never flips back over the control it moved away from.

**Reduced motion:** no breathing, orbiting, pulsing or glow; the phases still read through the status dot, the progress ring and the label.

## 2. The drawer

| | Desktop / tablet (≥ 768 px) | Phone (≤ 767 px) |
| --- | --- | --- |
| Shape | Right-hand glass sheet, `min(31rem, 100vw)` wide, full height, rounded on the left | Full screen, respecting safe areas |
| Height | `100dvh` | Follows the visual viewport, so the on-screen keyboard never hides the question field |
| Entrance (full motion) | Sheet glides in from the right, scrim fades | Sheet rises slightly and fades in |
| Exit (full motion) | 220 ms reverse | 220 ms reverse |

**Content:**

- **Header:** "Ask My AI", a subtitle ("The same assistant everywhere on this site · answers from approved content") and a close button ("Close Ask My AI").
- **Body:** the same `AskAiPanel` the section shows: Smart Mode by default, Local AI behind its existing consent card, streaming, citations, suggestions, and the download, initialising, error and fallback states.
- **Footer:**
  - On the home page, "Continue in the Ask My AI section": closes the drawer and scrolls to the section, which shows the same conversation.
  - Elsewhere, "Open the full Ask My AI experience": a link to `/#ask-ai`.
  - An "Esc to close" hint (desktop).

**Semantics:**

- A native modal `<dialog>`, labelled by its title. The page behind it is inert: it cannot be focused or clicked, and screen readers do not read it.
- The page does not scroll underneath, and the 3D world pauses on its last frame.

**Opening:**

- On desktop the question field receives focus once the panel is in place, unless the visitor has already moved focus.
- On touch screens nothing is focused automatically, so no keyboard surprise.

**Closing:** Escape, the close button, a click on the scrim, the shortcut, or navigating to another page (for example a source link inside an answer). Focus returns to the element that opened the drawer. The conversation, draft and mode stay in the shared session.

**Fast reopen** (found and fixed during this phase). Closing and immediately reopening never leaves the drawer shut, invisible or the page scroll-locked:

- Escape followed at once by the shortcut works.
- So does a reopen during the exit animation.

## 3. The hero entry

Under the existing hero actions. It joins the hero's entrance cascade and never replaces or shrinks the Intelligence Core or the existing CTAs.

- Eyebrow **MEET MY INTELLIGENCE** · title **"Curious about what I build?"** · primary button **Ask Islam's AI** with the shortcut hint.
- Three suggestion chips: *What does Islam build?* · *Does he work on AI?* · *Which projects can I explore?* A chip opens the drawer and asks that question exactly once. If a turn is already running, the question lands in the draft instead of starting a second turn.
- **Compact rules:**
  - The chips hide on short desktop windows (height ≤ 820 px) and on phones.
  - On phones only the eyebrow, title and button remain, with no shortcut hint.
  - The suggested supporting line ("Ask about my projects, experience, architecture, or technical stack") was left out deliberately: experience and architecture are not yet in the approved knowledge, so the line would invite questions the assistant must decline.

## 4. Context-aware suggestions

- Each route has its own grounded questions, chosen at build time from the projects list: home, projects, each case study ("Tell me about <project>"), about, contact and resume.
- Unknown routes fall back to the home set.
- After an answer, the answer's own suggested follow-ups take precedence.
- A unit test asserts that every suggestion is answered by the real Smart engine from approved content with at least one source (status `answered`, or `partial` with a source).

The mission's example questions were run through the same engine:

| Example | Engine result | Used? |
| --- | --- | --- |
| What does Islam build? | answered | Yes (hero, home) |
| Which projects should I explore? | partial, with project links | As "Which projects can I explore?" |
| How can I contact him? | answered, 4 sources | Yes |
| What are his strongest AI skills? / What is my AI expertise? | "answered" with only the generic headline | No. "Does he work on AI?" answers the same intent honestly |
| Tell me about the ATS system. | "answered" with an unrelated generic quote | No. Project pages use "Tell me about <project title>", which returns the honest "details not verified yet" answer with the page link |
| Which project uses multi-agent AI? / What makes MOViD different? | partial: project details await verification | No |
| Explain this project's architecture. | insufficient evidence | No |
| Summarize Islam's experience. / Which technologies… / What technologies does he specialize in? | partial: awaiting verification | No |

## 5. Keyboard shortcut

- **Ctrl + K** on Windows/Linux, **⌘ + K** on macOS. Never the other platform's chord: on a Mac, Ctrl + K deletes to the end of the line in text fields. The key is matched on the physical key as well, so it works with non-Latin layouts (Arabic: the K key types "ن").
- **Toggle:** it opens the drawer with the question field focused; pressing it again closes the drawer and returns focus.
- **Left alone** (the page or field keeps its own behaviour):
  - while typing in a field outside the drawer;
  - during IME composition;
  - on key repeat;
  - with Alt or Shift held;
  - while another modal (the intro reel) is open.
- **Hint:** on the orb's label and the hero button. `aria-keyshortcuts` names the platform's chord.
- **Browser conflict:** Chrome, Edge and Firefox use Ctrl + K to focus their search field. Pages may take it over, as many web apps' command palettes do. While the page has focus, the browser's own alternatives (Ctrl + L or ⌘ + L, Alt + D, F6) still reach the address bar.

## 6. Shared session

There is one conversation, used by the hero, the orb, the drawer and the Ask My AI section:

- Ask in the drawer, close it, and the answer is in the section. Ask in the section, open the drawer elsewhere, and the conversation is there.
- Client-side navigation keeps it.
- A full reload starts fresh. Nothing is stored, so there is no storage disclosure to make.
