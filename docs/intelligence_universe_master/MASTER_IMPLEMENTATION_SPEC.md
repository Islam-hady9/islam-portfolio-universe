# ISLAM ABD-ELHADY — THE INTELLIGENCE UNIVERSE
## Master Product, Creative, 3D/Motion & Engineering Implementation Specification

**Spec ID:** IU-MASTER-001  
**Version:** 1.0.0 — Implementation Baseline  
**Status:** APPROVED DIRECTION / BUILD AUTHORIZED / CONTENT POPULATION DEFERRED  
**Owner:** Islam Abd-Elhady  
**Product:** Personal cinematic interactive engineering portfolio  
**Primary language:** English (architecture should permit future i18n)  
**Canonical visual reference:** `APPROVED_HOMEPAGE_REFERENCE.png` (included next to this file)  
**Document purpose:** Read, audit, plan briefly, and **implement the complete site now**, with verified placeholder content. Do not wait for the actual CV.

> **NON-NEGOTIABLE:** This is an executable product specification, not a moodboard. Deliver a polished, functional, performant, responsive website. The screenshot is the visual baseline, NOT a flat background image to be placed on the page. Recreate the interface with real HTML, CSS, accessible components, real interactive 3D and functional navigation. Never fabricate career facts, employers' outcomes, testimonials, project metrics or live capabilities.

---

# 0. CLAUDE EXECUTION CONTRACT — START HERE

You are the autonomous lead creative developer, technical architect, motion engineer, quality engineer and implementation owner for this project. The user has authorized implementation without another round of routine design clarification.

### 0.1 Initial actions (mandatory, in order)
1. Read this **entire file** and inspect `APPROVED_HOMEPAGE_REFERENCE.png` visually. Treat the reference as a visual **composition and atmosphere** baseline, not as a literal text source: some small generated text may be incorrect.
2. Audit the working repository: files, git state, package manager, existing architecture, dependencies, asset inventory, tests, environment, commands, constraints. Preserve existing work; do not overwrite unrelated files or expose secrets.
3. Produce a short actionable implementation plan in `docs/implementation-plan.md`: phases, dependencies, technical choices, risks, checkpoints, and how each will be validated. **Then execute the plan immediately**; do not stop at the plan and ask the user to approve ordinary implementation details.
4. Create traceability in `docs/acceptance-matrix.md` using the requirements IDs in this spec, updated with evidence and status.
5. Implement foundation → UI fidelity → genuine 3D → orchestrated motion → internal pages → content/AI scaffolding → QA/polish. Use a working build at every gate.
6. Run relevant tests and inspect the site in a real browser (desktop and mobile). Fix defects. Report demonstrable results, limitations and any external blockers accurately.

### 0.2 Autonomy and boundaries
- Make reasonable implementation decisions consistent with this spec. Avoid needless clarification loops.
- Never pretend that code was run, browser-tested, deployed, integrated or validated if not actually done.
- Do not deploy, buy domains, spend on paid services, send emails, create accounts, merge remote branches or publish private client artifacts without explicit user authority.
- If a paid API key is unavailable, implement a clearly labeled local mock or a disabled feature with an honest UI. Never silently call paid APIs.
- Never invent factual CV details, dates, titles, numbers, clients, employment claims or case-study outcomes.
- Preserve project/client confidentiality; use only approved public information or clearly labeled sample content.
- Work until the engineering and design gates are satisfied as far as tools permit. Leave blockers explicit; don't declare complete on green build alone.
- Keep user-facing code and all design copy in English; code comments and developer docs also English.

### 0.3 Required final deliverables
- Complete runnable codebase with scripts for install, dev, build, test, lint, typecheck.
- Responsive homepage and project experience routes, all functional controls.
- Real interactive 3D scenes; integrated scroll, route and pointer-driven animation.
- Documentation, decision log, asset provenance and environment setup (`.env.example`).
- Automated tests, desktop/mobile screenshots, representative motion/video evidence where tooling supports it, and performance/a11y results.
- An **explicit deferred-content gate** so the owner's real CV can be ingested later without redesigning the site.
- A clear implementation report distinguishing completed, verified, mocked, blocked and deferred.

---

# 1. PRODUCT INTENT & POSITIONING

## 1.1 Brand
**Name:** Islam Abd-Elhady  
**Portfolio identity:** THE INTELLIGENCE UNIVERSE  
**Role label:** AI FULL-STACK ENGINEER  
**Hero headline:** ISLAM / ABD-ELHADY  
**Core proposition:** *Architecting AI Products, Systems, and Experiences.*  
**Extended statement:** *I design and build intelligent systems across AI, backend, product, and infrastructure — turning complex ideas into production-ready experiences.*

## 1.2 Objective
Build an award-caliber, cinematic **interactive portfolio with engineering credibility**. It must immediately impress visually, then prove practical technical depth through navigable case studies, real architecture explanations, implementation details, and contact options. The experience should feel like exploring one connected digital universe—not a set of unrelated website sections.

## 1.3 Audiences & jobs to be done
1. **CTO / engineering leader:** verify architecture, scale, reliability, technical choices, ownership and results.
2. **Recruiter / hiring manager:** understand role fit, relevant technologies and experience quickly; access CV/contact.
3. **Founder / client:** see end-to-end product capability and a clear collaboration path.
4. **Creative/technical peer:** appreciate design craft, interactions and technical execution.

**Critical UX constraint:** Within 10 seconds, the user's name, role, value proposition and Projects CTA must be understandable, even with animation off. Within 2 clicks, a visitor can reach a specific project and contact details.

## 1.4 Non-goals for initial release
- No authenticated user accounts or custom CMS admin UI.
- No unsupported personal statistics, fake testimonials or fabricated customer results.
- No fully operational AI assistant until approved knowledge and keys are provided.
- No gratuitous forced 3D navigation that prevents ordinary reading or keyboard use.
- No publishing a CV until owner provides and approves it.

---

# 2. SOURCE-OF-TRUTH PRIORITY & DESIGN PARITY

When information conflicts, use this order:
1. This specification's explicit functional, safety, accessibility and factual constraints.
2. The approved reference image for overall **composition, visual atmosphere, page structure, density, and spatial hierarchy**.
3. Concrete approved project and career information supplied later by the owner.
4. Creative discretion only for unspecified details; record important decisions.

### 2.1 Visual reference interpretation
The reference is a tall desktop webpage with: extremely dark cosmic environment; thin minimal navigation; left-aligned hero text; a massive right-side chrome gyroscope/energy core; distant planet and cinematic terrain; editorial identity statement; interactive galaxy navigation; four cinematic project tiles; philosophy cards; capability layers; horizontal career timeline; portal/assistant teaser; large planetary final CTA. Maintain this **narrative and section order**.

Do **not** hard-code screenshot as page background. Build genuine responsive layout. For large sections, design assets and 3D composition at appropriate resolutions. Screenshot's tiny labels and synthetic details are not authoritative.

### 2.2 Desired final feeling
Dark luxury + precision engineering + living intelligence + cinematic space exploration. High visual depth, sculptural metals, atmospheric rim-lighting, restrained energy effects, subtle violet and mint accents. Avoid standard blue AI templates, neon overload, generic robot heads, stock photos, childish icons, random floating cubes, uncontrolled parallax and repetitive glass-card grids.

---

# 3. DESIGN SYSTEM & VISUAL IDENTITY

## 3.1 Color tokens
| Token | Hex | Use |
|---|---|---|
| `--bg-void` | `#06070A` | dominant page background |
| `--bg-obsidian` | `#090C12` | section foundation |
| `--surface-1` | `#11141A` | base surfaces |
| `--surface-2` | `#171C24` | elevated glass/capability tiles |
| `--graphite` | `#242A33` | borders/divisions |
| `--text-primary` | `#F3F5F5` | primary readable text |
| `--text-secondary` | `#AAB4BC` | supporting copy |
| `--text-muted` | `#7D8993` | metadata, never primary info |
| `--silver` | `#C9D1D9` | metallic graphics, icon trim |
| `--mint` | `#7EF7C9` | primary emphasis and CTA |
| `--cyan` | `#52C7EA` | core energy / secondary lighting |
| `--violet` | `#8B7CFF` | distant nebula and select portals |
| `--danger` | `#E87E87` | errors only |

Color ratio: ~80% dark neutral, 15% white/silver neutrals, <5% colored accent in actual UI. Atmospheric art can have spatially localized glow; copy must remain legible against it.

## 3.2 Typography
Preferred art direction: modern editorial grotesk. Evaluate font licensing/download sources. Suggested pair: **Space Grotesk or Sora for display**, **Inter or Manrope for body**, **JetBrains Mono for technical eyebrow labels**. Do not bundle unlicensed font files. Use local/system fallbacks while preserving metrics. Suggested CSS fluid scales (adjust with QA):
- Hero display: `clamp(3.3rem, 6.8vw, 8.4rem)`, weight 550–700, tracking -0.045em, line height 0.91–0.98.
- Section title: `clamp(2.3rem, 4.1vw, 5.3rem)`, tracking -0.035em.
- Subheads: `clamp(1.15rem, 1.65vw, 1.7rem)`.
- Body: 16–18px desktop, 15–17px mobile, line-height 1.55–1.75.
- Eyebrows: 10–12px uppercase tracking ~0.22em; ensure readable.
- No oversized text overlapping CTAs at 320–390px widths.

## 3.3 Layout & spacing
- Design on 1440x900 and 1920x1080 first, then 1024x768, 768px tablet, 390x844 and 320x640 phones.
- Max content container: 1400px or equivalent, margin 5–7vw desktop; narrower at tablet/mobile.
- Grid: 12 desktop columns; 6 tablet, 4 mobile; use consistent 8px spacing rhythm and fluid gaps.
- Hero: near full-viewport with minimum safe height; ensure content remains above fold and accessible.
- Alternating intimate editorial sections and full-bleed cinematic stages. Keep negative space.
- Header fixed/sticky with gentle backdrop treatment, not a giant opaque bar.

## 3.4 UI primitives
- **Primary button:** muted mint fill, dark readable label, restrained animated edge/shear, clear keyboard focus.
- **Secondary button:** translucent dark glass, hairline border, slight brightening on hover.
- **Cards:** dark translucent surface, 1px low-contrast border, subtle rim and 12–24px corners; tilt only when pointer is fine, not on all cards.
- **Eyebrow labels:** monospace or spaced uppercase, fine divider line on right.
- **Icons:** clean outlined geometry; consistent stroke and size.
- **Dividers:** low-opacity luminous strokes or soft gradients.
- **Pointer:** optional premium cursor aura on desktop fine-pointer only; never hide OS cursor if it breaks usability.

## 3.5 Imagery & assets
Use original, commercially usable procedural/3D art, licensed assets or owner-approved media. The four project tiles need distinct visual languages: TIBYN aquaculture / teal water; MOViD cinematic multi-screen video studio; ATS layered matching/ranking UI / cyan; LifeAtlas personal journey constellation / violet-mint. **LifeAtlas is not a health-platform claim.** Avoid borrowing other websites' screenshots or public logos without rights. `APPROVED_HOMEPAGE_REFERENCE.png` is visual guidance, not a shippable foreground asset. Maintain asset manifest with source, license and optimization.

---

# 4. INFORMATION ARCHITECTURE, ROUTES & CONTENT

## 4.1 Navigation
Header brand left; center: Home, Projects, Experience, Stack, About; right CTA: Let's Talk. Mobile: accessible menu button + panel, close on navigation/escape, managed focus.

Routes (Next.js App Router suggested):
- `/` — cinematic home
- `/projects` — all projects with filter and accessible grid/list
- `/projects/[slug]` — immersive yet readable individual case study
- `/about` — journey, philosophy, experience and skills
- `/contact` — contact details and functional mailto/social links (optional form only with real backend/spam mitigation)
- `/resume` — deferred controlled redirect/download when real PDF available; until then clearly labeled unavailable, NOT a broken file
- `not-found` and error boundary.

Scroll anchors on home: `#identity`, `#universe`, `#projects`, `#philosophy`, `#capabilities`, `#experience`, `#ask-ai`, `#contact`. Anchor navigation must land reliably with sticky-header offset and work with motion disabled.

## 4.2 Content contracts & factual boundaries
Create typed content models for `SiteIdentity`, `ProjectSummary`, `CaseStudy`, `CareerEntry`, `CapabilityGroup`, `SocialLink`, `ContactConfig`, `AIKnowledgeEntry`, `AssetAttribution`. Types must distinguish `placeholder | owner_verified | public_verified`, and display a clearly non-factual placeholder where verification is pending.

Initial confirmed-for-design project identifiers (names may be shown; details must be conservative until approved):
- `tibyn`: TIBYN — Aquaculture Management SaaS / Aquaculture Intelligence.
- `movid`: MOViD Studio — Multi-Agent Video Production Studio.
- `ats-matching`: ATS Matching — AI Candidate Matching & Observability.
- `lifeatlas`: LifeAtlas — AI Product Concept / In Development.

Use the neutral tag `Concept / In development` for LifeAtlas. **Do not misrepresent it as a deployed product or a health platform.** Do not display invented impact metrics.

For career timeline, use semantic sample milestone cards or explicitly labeled placeholders until owner supplies CV; do not imply exact chronology is authoritative. Social URLs can be configured as known owner-provided links or placeholders to be verified; never invent email or phone.

## 4.3 Case-study schema (mandatory)
- title, slug, public/placeholder status, ownership role, date (optional), industry
- challenge/problem context (approved only)
- goals and constraints
- system diagram (editable vector/HTML, not screenshot only)
- architecture and tech choices with tradeoffs
- user/product workflow
- implementation highlights
- reliability, observability, deployment
- measurable outcomes *only if evidenced*
- gallery/demo/video if authorized
- lessons learned and next steps
- calls to action + related projects

Case-study UI must remain valuable with incomplete data: hide missing fields or show a discreet `Details being prepared` label, never `Lorem ipsum` or false achievements.

---

# 5. COMPLETE HOMEPAGE STORYBOARD

All scenes must exist in a coherent scroll-and-route narrative. Content overlays are real DOM. Treat camera motion as a supporting visual story, never as the sole navigation mechanic. Header and primary nav remain usable throughout.

## SCENE S0 — PRELUDE / BOOT (OPTIONAL NON-BLOCKING)
**Intent:** suggest a system awakening, not waste visitor time.  
**Visual:** near-black stage, tiny cyan pulse, concentric engineering lines assemble a luminous point; minimalist wordmark and discreet loading state.  
**Behavior:** run only as long as assets actually load, with hard maximum ~2.5s on fast desktop; reveal page immediately if assets ready or when loading budget elapses; content cannot be withheld indefinitely. `Skip intro` button keyboard-accessible; repeated visit avoids full intro (session setting). Reduced-motion users skip entirely. On slow devices show content first with canvas progressive enhancement. No fake 0–100% progress.

## SCENE S1 — HERO / THE AWAKENING
**Composition:** desktop split: typography and CTA cluster left ~45%; giant luminous chromium orbital core dominating right ~55%, stars/deep nebula, far planet at right edge, silhouetted rocky ground at bottom. Layering from far to near: starfield > nebula/planet > orbit geometry > fragments/sparks > foreground terrain > DOM heading/navigation.  
**Copy:**
- Eyebrow: `THE INTELLIGENCE UNIVERSE`
- Headline: `ISLAM` newline `ABD-ELHADY`
- Role: `AI FULL-STACK ENGINEER`
- Lead: `Architecting AI Products, Systems, and Experiences.`
- Body: `I build intelligent systems across AI, backend, product, and infrastructure — transforming complex ideas into production-ready experiences.`
- CTAs: `Explore My Universe` (scroll #universe), `View Projects` (#projects or `/projects`), `Download CV` (gated/deferred; explicit label if unavailable), `Talk to Me` (#contact).
**3D:** nested gyroscopic polished silver rings (3–5 unequal-axis torus/mesh paths), layered fractured metallic core + luminous inner emitter with custom emissive shader, sparse procedural fragments and subtle dust, physically credible rim lights. Rings rotate at distinct slow rates and phases; core light pulses irregularly but not strobing. Mouse moves camera rig by at most ~2–4° parallax; gently returns with damping.  
**Motion:** initial distant camera/pull focus to stable composition (1.2–2.0s), heading reveals by masked line segments/stagger, CTAs arrive last. During first 15–25% scroll, core scales in perspective and camera dollies slightly through an orbital arc; DOM title fades/moves modestly; no motion sickness-inducing spins.
**Exit:** preserve lighting motif into S2, core recedes to ambient background.

## SCENE S2 — IDENTITY / THREE PILLARS
**Composition:** dark editorial band: left 45% dramatic multi-line statement, right 55% three evenly sized icon/copy columns with fine vertical rules.  
**Exact statement:** `I don't just work with AI. I build intelligent products, engineer scalable systems, and ship production-grade experiences.` Highlight intelligent products, scalable systems, production-grade experiences in restrained mint.  
**Pillars:** AI Systems / Product Engineering / Production Delivery.  
**Motion:** split mask reveal, lines draw, icons gently form from minimal wireframe; avoid gimmicky per-letter animation on body text. On exit data filaments flow into constellation.

## SCENE S3 — THE UNIVERSE / INTERACTIVE CONSTELLATION
**Composition:** left title + microcopy, right/center oversized tilted orbital galaxy/elliptical constellation with luminous core, 6 interactive nodes.  
**Text:** `The Intelligence Universe`; description: `A connected space of my work, experience, projects, and capabilities. Explore the worlds behind what I build.`  
**Nodes:** AI Systems → #capabilities; Products → #projects; Case Studies → /projects; Experience → #experience; Stack → #capabilities; Contact → #contact.  
**3D:** star cluster and orbital tracks are actual geometry or shader-based, with 3D node markers. Projected node labels are accessible DOM elements pinned to 3D screen coordinates or semantically equivalent positioned controls.  
**Interaction:** hover/focus brightens node, draws related orbit arc, reveals concise teaser; click/Enter triggers controlled camera approach and navigates to appropriate anchor/route. Drag-to-orbit on desktop is optional, constrained, non-blocking; touch offers taps/swipes without hijacking vertical scrolling. Provide DOM link list fallback, with equivalent pathways.
**Motion:** long shallow dolly / orbit controlled by scroll progression; subtle starfield parallax, not aggressive rotation.  
**No fake features:** every visible node must route somewhere real.

## SCENE S4 — FEATURED WORK / PROJECT PORTALS
**Title:** `Selected Works from My Universe`; eyebrow `FEATURED PROJECTS`; link `View All Projects`.  
**Desktop:** four premium cinematic project tiles in a 4-column or deliberate 2+2 editorial configuration depending on width; reference favors four across desktop. Each distinct visual, category, readable title, one-sentence verified/neutral summary and directional icon.  
**Cards:**
1. TIBYN — Aquaculture Intelligence Platform. Visual: moonlit high-end aquaculture water structures, subtle cyan reflections.
2. MOViD Studio — Agentic Video Production Studio. Visual: cinematic editing theater with several video portals/screens and violet lighting.
3. ATS Matching — AI Matching & Observability. Visual: layered candidate/system graph and flowing data threads (avoid identifiable real candidate data).
4. LifeAtlas — AI Product Concept. Visual: abstract constellation/memory timeline landscape; clearly `In development`.
**Motion:** 3D tilt ≤4–6° with spring damping desktop; image depth parallax and specular border under hover; keyboard focus gets visible equivalent; optional short ambient motion preview, muted by default and lazy-loaded. On click, project artwork expands or becomes portal transition to corresponding case study, with route instantly available if WebGL absent. Avoid content layout shift.

## SCENE S5 — ENGINEERING PHILOSOPHY
**Title:** `The Principles Behind What I Build` and eyebrow `ENGINEERING PHILOSOPHY`.  
**Five principles:** Build with Purpose; Architect for Scale; Ship to Production; Blend AI with Product Thinking; Design the Whole Experience.  
**Visual:** 5 minimal glass tiles; use subtle technical line art and highly restrained hover glow. Each contains a 1–2 sentence supporting explanation.  
**Motion:** staggered reveal on scroll once, 40–80ms between cards, gentle depth shift; reduced-motion gets simple visible static cards.

## SCENE S6 — CAPABILITIES / TECH STACK
**Title:** `A Full-Stack AI Product Builder`; eyebrow `MY CAPABILITIES`.  
**Four domains:** Intelligence Layer (LLMs, Agents, RAG, Prompting, Evaluation); Engineering Layer (Python, FastAPI, Next.js, Databases, System Design); Operations Layer (Docker, CI/CD, Cloud, Monitoring, DevOps); Experience Layer (Product Thinking, UX Flow, Prototyping, User-Centered Design).  
**UI:** four premium band/panel clusters, each with custom line-icon and nested skill chips. Support click/expand into concise verified examples later, but no empty dummy accordion.  
**3D:** ultra-subtle data streams behind panels, visible only in high quality tier. Mobile layout stacks; tags wrap without truncation.

## SCENE S7 — EXPERIENCE / JOURNEY
**Title:** `My Journey in Technology & AI`; eyebrow `EXPERIENCE JOURNEY`; subtitle `From foundations to building real-world intelligent systems.`  
**Composition:** cinematic low-horizon star landscape and horizontally connected luminous timeline. Desktop can scroll within section / use animated focus but must never lock scrolling or trap keyboard. On mobile render a clean vertical timeline with cards.  
**Data:** before CV handoff use expressly labeled sample timeline content or section intro; actual entries, dates and employers are to be populated from owner-approved data. Do not infer timeline accuracy from the reference screenshot.  
**Interaction:** focus on milestone reveals concise description, expandable detail link if real; timeline progress line follows scroll position; all milestone cards keyboard-accessible.

## SCENE S8 — ASK MY AI / INTERACTIVE PREVIEW
**Composition:** left: distant human-scale explorer standing before abstract monumental portal; right: refined chat-style glass panel.  
**Heading:** `Ask My AI`; body: `Explore my projects, experience, and technical work through a future intelligent portfolio assistant.`  
**Initial status:** `Concept Preview — AI assistant not yet connected` or equivalent, visibly not live.  
**UI:** 3 sample prompt chips (`What projects have you built?`, `What's your tech stack?`, `Tell me about your experience.`). Clicking demonstrates predefined **clearly labeled sample response** from fixture content, or opens an informative assistant-preview dialog. Do not display a real send button if it doesn't work; never simulate live LLM output without marking it a demo.  
**Later:** connect to approved knowledge through the separate content/AI activation gate.

## SCENE S9 — FINAL CTA / THE INVITATION
**Composition:** calming return to cinematic universe; massive celestial horizon / atmosphere on right, left-aligned clear invitation, low mountain silhouette, quiet atmospheric light.  
**Eyebrow:** `GET IN TOUCH`  
**Title:** `Let's Build Something Intelligent.`  
**Body:** `Whether it's an AI product, a technical collaboration, or a new idea — I'm always open to building meaningful, real-world solutions.`  
**Actions:** Contact Me, LinkedIn, GitHub, Resume (resume gated until provided). All actions real and audited.  
**Motion:** camera eases out of portal into horizon; slow ambiance only, never distracting.  
**Footer:** brand, navigation, social links, dynamically current copyright year, accessibility/privacy links if applicable.

---

# 6. SHARED 3D WORLD / TECHNICAL MOTION BIBLE

## 6.1 Engine architecture
Default: **Next.js + TypeScript + React Three Fiber (Three.js) + Drei + GSAP/ScrollTrigger**, with accessible DOM overlays, Tailwind or token-based CSS. **One persistent 3D canvas across home scenes** where technically beneficial; avoid separate heavyweight WebGL contexts per section. Use route scene lifecycle for project case studies. Framer Motion/Motion optional for lightweight UI, with explicit ownership to avoid conflicting transforms. Do not combine several independent smooth-scroll drivers. Prefer native browser scroll with GSAP ScrollTrigger integration; introduce a smooth-scroller only if demonstrated to be stable and accessible.

Suggested conceptual modules:
```text
src/
  app/                         # App Router pages, layout, metadata, error routes
  components/
    layout/                    # Header, Footer, ScrollProgress, MobileMenu
    ui/                        # Button, SectionHeading, Card, FocusRing, etc.
    scenes/                    # DOM overlays for homepage scenes
    case-study/                # Reusable technical storytelling components
  experience/
    canvas/                    # persistent Canvas, renderer and context recovery
    scenes/                    # hero, constellation, portals, horizon, transitions
    objects/                   # OrbitalCore, Galaxy, Planet, Stars, Terrain, etc.
    shaders/                   # custom shader code and materials
    rigs/                      # camera rig, pointer rig, transition rig
    orchestrator/              # scroll->timeline scene state, transitions, priorities
    quality/                   # capability detection, tiers, adaptive fidelity
    assets/                    # geometry/textures/LOD loading and disposal
  content/                     # typed fixtures, later CV-verified content
  lib/                         # routing, analytics, SEO, validation
  tests/                       # unit, component, e2e, visual
public/
  assets/                      # optimized approved static assets
  images/                      # authorized project thumbnails and fallback poster
  fonts/                       # only properly licensed fonts if self-hosted
 docs/
  implementation-plan.md
  acceptance-matrix.md
  decisions.md
  asset-manifest.md
  test-report.md
  release-readiness.md
```

## 6.2 Scene state model
Each scene has states `UNLOADED → PRELOADING → READY → ENTERING → ACTIVE → EXITING → SUSPENDED` and error/fallback path `FALLBACK`. Keep camera, scroll, hover, route transitions and quality changes centrally coordinated; never let simultaneous tweens fight over the same property. Route transitions cancel stale animations; cleanup all listeners and GPU resources.

Each scene declares:
- scene ID and normalized scroll interval
- 3D object registry, scene graph, material/texture dependencies
- camera entry/active/exit targets (position, target, FOV, roll = 0 unless justified)
- timeline/keyframes/easings; masks; text sequence
- pointer and touch response bounds; keyboard focus semantics
- quality tier overrides; reduced-motion overrides
- idle/pause/unmount behavior and test hooks.

## 6.3 Camera grammar
- Hero: slow establishing dolly toward energy core, gentle orbital parallax, central composition never obscures left text.
- Identity: controlled lateral drift with core fading into negative space.
- Constellation: wide camera orbit/dolly revealing accessible active nodes; no free camera disorientation.
- Projects: camera aligns with selected tile/portal; transition ties to route state.
- Timeline: lateral shallow parallax over planetary horizon.
- Final CTA: broad serene pullback establishing distant planet atmosphere.

Use world units consistent across scenes; write a shared camera configuration. Example starting values may be tuned by screenshot comparison; do not present guessed coordinates as approved values. Avoid abrupt cuts when transitioning between sections. **No immersive motion should block reading**.

## 6.4 Motion scale & timing guidelines
| Event | Baseline duration | Easing / notes |
|---|---:|---|
| UI hover | 160–260ms | ease-out, reversible |
| Small card focus | 220–380ms | spring-like, restrained |
| Heading reveal | 500–900ms | masked translation, stagger |
| Scene entrance | 700–1600ms | cinematic but cancellable |
| Large camera transition | 1000–2200ms | bezier / smoothstep; no sudden FOV snap |
| Intro | 0–2500ms | skip, progress truthful |
| Continuous ambient animation | ongoing | low velocity, amplitude, pause offscreen |

Scroll animation must be direction-independent and scrubbable; rapid scroll and jumping anchors must land in a valid state. Debounce nothing that would lag user input. Respect document visibility to reduce GPU utilization.

## 6.5 Shader, lighting and atmosphere
- Orbital core: layered physically based silver/brushed metal, meaningful specularity, glow via selective bloom; do not bloom all text/UI.
- Galaxy: procedural shader or optimized points with physically plausible sparse distribution, orbit ellipses, gentle violet/cyan dust.
- Space atmosphere: background gradient and optional planet limb with distance fog; no over-saturated primary blue wash.
- Shadowed terrain: silhouette/low-poly optimized geometry or original raster background fallback, never an unlicensed image.
- Avoid fullscreen grain that harms text sharpness; keep text in DOM above effects.
- Use tone mapping and mobile-friendly bloom strategy; bound shader complexity and texture size.

## 6.6 Interaction matrix
| Element | Mouse | Touch | Keyboard | Reduced motion |
|---|---|---|---|---|
| Orbital core | gentle pointer parallax | tiny/no tilt | nonessential | static pose |
| Universe node | hover teaser + click | tap + navigate | Tab, Enter/Space | no travel tween |
| Project portal | tilt + image depth + click | tap | Tab/Enter | instant route |
| Section nav | smooth anchor scroll | tap | standard links | jump without smooth animation |
| Timeline | hover/select milestone | tap/select | Tab/Enter | static accessible list |
| Chat preview | sample prompt action | tap | Enter/Space | static response |

## 6.7 Fallback hierarchy
- **Ultra:** full 3D + particles + controlled bloom, capped DPR.
- **Balanced:** fewer particles, simplified geometry/postprocessing, reduced pixel ratio.
- **Lite:** low-poly 3D or prerendered motion/static original art, standard DOM transitions.
- **Accessible/static:** no WebGL required; functional content and all CTAs remain accessible and readable, with reduced/zero animation.

Tier selection must use device/runtime capability and user choice, **not UA string alone**. Offer a visible `Motion / Quality` setting when it materially benefits users; persist preference locally if appropriate. Show static fallback on WebGL fail, context loss or JS loading interruption. Cap frame delta; dispose materials, render targets, geometries, listeners.

---

# 7. RESPONSIVE, ACCESSIBILITY & UX STANDARDS

- Layout must work at 320, 390, 768, 1024, 1440 and 1920px widths; portrait/landscape and zoom to 200% without loss of content.
- At <=767px, avoid horizontal overflow, reduce heavy effects, adapt hero to stacked copy+core illustration, convert constellation to vertically navigable interactive nodes, convert project cards to 1-column or compact 2-column as appropriate, render career journey vertically.
- Touch targets >=44x44 CSS pixels where practical; adequate spacing and contrast.
- Comply with **WCAG 2.2 AA** where feasible: semantic headings, labels, focus styles, skip-to-content, keyboard operation, visible focus, proper color contrast, accessible reduced-motion experience, no focus traps in route transitions.
- Honor `prefers-reduced-motion` with static scenes and minimal essential fades; do not play fast-moving cosmos behind reading text.
- Add ARIA only where needed, never replace native links/buttons with divs. 3D graphics get concise accessible description but not dozens of decorative scene nodes in tab order.
- Ensure screen readers can traverse meaningful DOM independent of WebGL.
- No autoplay audio. Do not add sound unless owner explicitly requests it; any eventual audio requires opt-in and mute controls.

---

# 8. PERFORMANCE, SEO & ENGINEERING REQUIREMENTS

## 8.1 Quality targets (to validate on actual hardware)
Initial launch performance budgets, not claims of achieved results:
- Core Web Vitals: LCP <=2.5s on representative mobile test, CLS <=0.1, INP <=200ms, measured under documented test conditions.
- Desktop 3D animation: target stable 60fps on representative midrange machine; balanced/lite tiers for lower-end hardware; mobile target responsive interaction and sustainable smoothness, typically 30–60fps depending on device.
- Avoid >150ms long tasks attributable to continuous 3D work in normal interaction.
- Main thread not monopolized by WebGL setup; code split and defer art/scene assets.
- Track GPU memory/texture dimensions and avoid excessive render-target allocations; profile and document actual budget after a baseline run.
- No heavyweight scene bundle is a requirement to read basic content and reach CTAs.

## 8.2 Web foundations
- Framework: Next.js App Router with TypeScript strict mode (unless existing repo architecture warrants preserving equivalent stack).
- Install pinned, compatible stable versions after checking active dependencies; do not blindly assume future major version compatibility.
- Server-render semantic page content and metadata; progressively hydrate dynamic experience.
- Lazy-load Canvas and case-study details; use image formats AVIF/WebP where supported, suitable responsive sizes.
- Metadata: title, description, OG/Twitter image, canonical URLs once domain known, robots/sitemap, meaningful alt text, schema.org Person/CreativeWork based only on verified facts.
- Semantic project pages must remain crawlable; do not hide all critical content inside Canvas.
- No unbounded third-party scripts, privacy-invasive tracking or hidden analytics.

## 8.3 Analytics & observability
Optional privacy-aware tracking for high-level events: hero CTA click, project open, resume request, contact click, universe node selection, fallback tier, WebGL context failures, scene load error. Never store chat inputs or personal identifiers without approved privacy basis. Add safe error boundaries and diagnostic instrumentation.

---

# 9. BACKEND & AI DIGITAL TWIN — PHASED DELIVERY

## 9.1 Current gate (implement now)
Build an honest assistant preview and extensible integration contracts; **do not claim the AI is live**. Provide types for `AskRequest`, `GroundedAnswer`, `SourceReference`, `ResponseStatus`, `SafetyPolicy`; mock responses must have `mode: demo`, clear demo badge, and be sourced only from explicitly sample/verified content. Optional FastAPI skeleton only if justified by current architecture; don't run a costly backend for an offline preview.

## 9.2 Later activation gate (after owner sends CV and approves knowledge)
Potential implementation: FastAPI + LangGraph or equivalent orchestration, owner-approved document ingestion, chunking and retrieval, source citations, refusal/uncertainty for unknown questions, privacy policy, rate limiting, abuse protection, prompt-injection defenses, moderation where needed, API spend controls and observability (e.g. Langfuse). Keep secrets server-side. No proprietary employer code/docs ingested without explicit clearance.

## 9.3 Success conditions for live AI (future)
- All biographical answers grounded in versioned verified knowledge, with source IDs.
- No invented experience, skills or numbers.
- Public/private source segregation.
- Regression evaluation set for accuracy and hallucination resistance.
- User-visible error and fallback behavior.
- Test cost, latency, abuse controls and deployment configuration before launch.

---

# 10. CONTENT-FIRST-LATER CONTRACT — CRITICAL

**The user will send real CV/project details only after the website design and technical implementation are finished.** All builds before then use safe, labeled fixtures.

## 10.1 Content modes
`DEMO_CONTENT` (default, no unsourced personal assertions) → `OWNER_REVIEW` (real CV imported but not published) → `VERIFIED_PUBLIC` (owner-approved publication). Support content update without altering scene code or layout architecture.

## 10.2 Placeholders
- For projects, titles and short neutral conceptual blurbs may display; mark incomplete case studies `Detailed case study coming after content review`.
- For experience, avoid invented precise dates or job titles; use an explicitly labeled sample journey or a composition preserving visual timeline without personal detail.
- For CV button, link to `/resume` with `Resume will be available after final profile review` or disable visually with explanatory tooltip. Do not create fake PDF.
- For testimonials/metrics, omit until evidenced.
- For assistant, label demo. For contact, use owner-approved public links only.

## 10.3 Later CV ingestion workflow
1. Parse owner-provided CV, portfolio files and project materials.
2. Generate structured proposed content + evidence/source mapping for each claim.
3. Identify missing details/questions; do not manufacture values.
4. Owner verifies sensitive/confidential text, dates, metrics, claims and media permissions.
5. Swap typed content fixtures to verified entries; update SEO/schema and AI knowledge if authorized.
6. Run snapshot/regression/accessibility/mobile checks and ensure text length doesn't break layouts.
7. Publish only after explicit approval.

---

# 11. PAGE DETAIL: PROJECT CASE STUDY TEMPLATE

The case-study page should feel like entering an object/world from the constellation. Hero scene uses project-specific procedural visual and metadata. Use scroll-linked visual sequences only when they illuminate real information. Sections:
1. Project hero: title, category, short pitch, status/role (verified), back to universe.
2. Problem & context: constraints and user need.
3. System at a glance: navigable architecture diagram with legend; diagram also available as readable DOM text.
4. How it works: input → processing → output with genuine, approved workflow.
5. Key engineering decisions: tradeoffs, technical depth and architecture notes.
6. Challenges & solutions: factual and anonymized as needed.
7. Reliability and operations: deployment, testing, observability as approved.
8. Results and media: verified only; hide section if missing.
9. Next project / back to projects / contact CTA.

Project transition should visually connect from tile to page hero, but route must work on refresh, back/forward, no JS motion and accessible link navigation. Use distinct environmental accent per project without breaking shared identity.

---

# 12. IMPLEMENTATION GATES & DEFINITION OF DONE

## G0 — Audit, repo setup, design tokens
**Deliver:** repo audit notes, stable toolchain, scripts, types, structure, global typography/colors, route skeleton and first CI checks.  
**Pass:** clean install, typecheck, lint, build; no unrelated destructive modifications.

## G1 — Pixel-oriented semantic UI
**Deliver:** responsive HTML/CSS for all homepage sections and basic internal routes with static/procedural placeholders; accurate visual hierarchy versus reference.  
**Pass:** screenshot review at desktop/tablet/mobile, no broken navigation, correct headlines/sections, no unreadable text, no horizontal overflow.

## G2 — WebGL cinematic foundation
**Deliver:** one real shared Canvas, orbital core, galaxy, portal/depth environment, adaptive quality/fallback, documented materials and assets.  
**Pass:** true scene objects/renderer (not static composition); context recovery/failure fallback, acceptable memory baseline, works on tested target devices.

## G3 — Motion choreography & interactions
**Deliver:** camera choreography, scroll integration, project portal transitions, node selection, pointer/touch/keyboard adaptations, reduced-motion handling.  
**Pass:** deterministic state, no transition conflicts, repeatable back/forward navigation, all interactions and anchors work.

## G4 — Routes, case studies and data contracts
**Deliver:** polished `/projects`, `/projects/[slug]`, `/about`, `/contact`, typed fixtures, content verification markers, accurate SEO scaffolding.  
**Pass:** route smoke tests, projects accessible from cards, no invented claims, dynamic slugs and 404 behavior correct.

## G5 — AI preview + optional API integration skeleton
**Deliver:** truthful preview UI with sample prompts/responses, clean backend contracts if warranted, no false live claims.  
**Pass:** demo clearly identified, no paid calls, unit tests for demo states, privacy-safe handling.

## G6 — QA, optimization & release readiness
**Deliver:** unit/integration/E2E suite, screenshots/videos, visual comparisons, accessibility audits, performance profile, security scan and release report.  
**Pass:** all critical acceptance requirements verified or clearly enumerated as blockers; no known P0/P1 defects; functional CTA/links; acceptable tested performance; device tier fallback works.

## G7 — Owner CV & real content population (EXPLICITLY DEFERRED)
**Not part of first implementation.** Only after user gives material and approves publishing. Never make G6 conditional on receiving the CV; instead G6 is the production-quality technical experience with transparent demo content, not public-ready final personal facts.

---

# 13. TESTING & EVIDENCE REQUIREMENTS

## 13.1 Automated tests
- Unit tests: content type guards/fixtures, tier selection, timeline interpolation, pure scene mappings, routing/helpers.
- Component tests: nav, CTA, project cards, mobile menu, a11y labels, AI preview, missing data states.
- E2E Playwright: homepage load, anchors, projects, case-study pages, 404, contact, header menu, back/forward, direct URLs, keyboard, reduced motion, no-WebGL fallback.
- Visual regression screenshots at 1440x900, 1920x1080, 1024x768, 768x1024, 390x844, 320x640; include meaningful crop of hero, universe, cards, full page.
- If available, capture 5–15s screen recordings of hero gyro, scroll journey, constellation interaction and project portal.
- Check Chromium; Safari/WebKit and Firefox where environment supports.

## 13.2 Real world inspection
Run dev and production builds. Inspect the rendered browser, not code alone. Review:
- Visual fidelity to approved image without treating mockup as literal responsive screenshot.
- Font loaded, no clipping/overflow, correct stacking/contrast.
- DOM remains interactive while 3D scene loads or fails.
- No dead CTAs, fake links, accidental autoplay sound.
- Smooth transitions without ghost geometry or lingering canvas layers.
- Stable GPU utilization and context lifecycle.
- Reduced-motion behavior and keyboard navigation.

## 13.3 Audit artifacts
Record in `docs/test-report.md`: exact commands, environment, build/commit, browser versions, viewport, screenshots/video references, outcome and failures. Record actual performance metrics and methodology, not invented scores. Add acceptance matrix per IDs below.

---

# 14. REQUIREMENT TRACEABILITY MATRIX

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| IU-001 | P0 | Homepage visually reflects approved cinematic reference | screenshot comparison |
| IU-002 | P0 | Site renders real semantic HTML rather than baked screenshot | DOM inspection |
| IU-003 | P0 | Hero energy core is real 3D geometry/shader | canvas inspection/video |
| IU-004 | P0 | Shared universe is genuinely interactive and navigable | e2e + interaction capture |
| IU-005 | P0 | All project cards route to working case studies | e2e |
| IU-006 | P0 | Every CTA behaves truthfully | link inventory/e2e |
| IU-007 | P0 | Real CV facts are not invented or published | content audit |
| IU-008 | P0 | AI preview cannot masquerade as live grounded assistant | component/e2e |
| IU-009 | P0 | Mobile and touch UX work | mobile e2e/screenshots |
| IU-010 | P0 | Reduced-motion and keyboard navigation work | a11y/e2e |
| IU-011 | P0 | WebGL fallback preserves full site use | forced fallback test |
| IU-012 | P0 | Stable build, lint, typecheck, tests | CI logs |
| IU-013 | P1 | Scene transitions match motion grammar | interaction video |
| IU-014 | P1 | Site has adaptive 3D quality | tier profile evidence |
| IU-015 | P1 | Core Web Vitals targets profiled | documented metrics |
| IU-016 | P1 | SEO metadata and indexable case-study content | meta and crawler inspection |
| IU-017 | P1 | Resource disposal, route cleanup, failures handled | devtool test |
| IU-018 | P1 | Asset provenance/license documented | manifest |
| IU-019 | P1 | Assistant architecture ready for CV later | schema/tests |
| IU-020 | P1 | Screenshots and release report show actual proof | docs artifacts |
| IU-021 | P2 | Optional pointer aura and premium microinteractions | manual QA |
| IU-022 | P2 | Scene quality selector UI | manual QA |

P0 failures block completion. P1 failures require repair or explicit documented accepted exception; P2 may be deferred only with transparent report.

---

# 15. RISKS & MITIGATIONS

| Risk | Mitigation |
|---|---|
| Art looks polished but becomes a static gimmick | real geometry for core/universe and actual pointer/scroll behavior |
| Massive bundle / poor mobile performance | split chunks, tiered fidelity, LOD, lazy assets, constrained postprocessing |
| Over-engineered 3D hijacks user tasks | always accessible DOM routes and navigation, no scroll trap |
| Unclear owner data / fake claims | content modes, strict verification, defer CV |
| WebGL browser/context failure | static visual fallback and retained DOM functionality |
| Scroll and camera systems fight | centralized orchestration and one scroll source |
| Unlicensed stock visuals | original/procedural/approved media only, asset manifest |
| Prompt bloat or lost context in Claude | this file is canonical; maintain plan + traceability + decisions |
| AI demo appears live | conspicuous concept/demo labeling and deterministic fixture responses |
| Big visual changes without evidence | fixed viewport screenshot reviews + motion clips + acceptance gates |

---

# 16. ACCEPTED TECHNICAL DECISIONS & AREAS OF DISCRETION

**Fixed decisions:** Next.js/React/TypeScript-first approach unless an existing repo requires justified alternative; actual Three.js/R3F interactive scenes; one cohesive world where viable; semantic overlay; animated galaxy navigator; four distinct cinematic featured projects; case-study routes; quality adaptation; CV after build; no fake achievements or live AI.

**Claude may decide:** exact supported library versions, CSS methodology, specific shader implementation, camera coordinates, texture generation technique, content validation library, animation helper, test organization and performance thresholds refinements based on instrumented measurements. Document nontrivial deviations in `docs/decisions.md`.

**Do not substitute:** screenshot-as-background, CSS-only fake gyroscope, stock template, generic neon dashboard, a static landing with no navigation, pretend live AI, hidden missing portfolio pages, or invented CV.

---

# 17. FINAL USER-FACING EXPERIENCE & RELEASE CHECKLIST

A first-time visitor sees the atmospheric hero and understands Islam's role without waiting for 3D. They can explore a coherent universe, open a project, inspect real engineering content structures, find core capabilities/experience, and contact him. On a fast desktop the 3D scene and transitions are premium, tactile and coherent; on weaker phones it is simpler but still elegant, usable and accessible. The site is fully engineered with placeholder content while the owner prepares his CV. The future content swap and AI activation require no rebuild of core animation architecture.

Before claiming completion, answer **all** of the following with evidence:
- [ ] Does the implementation visually resemble the reference in composition, atmosphere, contrast and typography?
- [ ] Is the 3D real and visibly interactive, not a flattened image?
- [ ] Are scene transitions controlled, repeatable and scroll-safe?
- [ ] Do projects open working accessible pages?
- [ ] Do all visible links and actions work or honestly explain deferred status?
- [ ] Is every unverified personal claim excluded or explicitly marked as placeholder?
- [ ] Do 320–1920px layouts read beautifully without horizontal overflow?
- [ ] Is the experience usable with reduced motion, keyboard, touch and no WebGL?
- [ ] Are performance, accessibility, security and browser tests actually run and recorded?
- [ ] Are all major known limitations reported, with no false 'done' claims?
- [ ] Is the CV-population stage clearly deferred and technically supported?

---

# 18. IMMEDIATE COMMAND TO CLAUDE

**Read this full specification and inspect `APPROVED_HOMEPAGE_REFERENCE.png`. Audit the repo, write a concise working execution plan, then immediately implement the whole cinematic portfolio in gates G0–G6 without requesting routine additional authorization. The design reference is accepted; prioritize fidelity, genuine high-quality 3D and motion, responsive UI, architecture quality, test evidence, and honest placeholder data. Do not insert or invent real CV information yet. When technically finished, present verified evidence and exactly what remains for G7 (owner-provided CV/content).**

**END OF MASTER SPECIFICATION — v1.0.0**
