# Vercel deployment

How to deploy this repository (`Islam-hady9/islam-portfolio-universe`, branch `main`) with Vercel's GitHub integration. GitHub Actions only validates (`.github/workflows/ci.yml`); Vercel builds and deploys on its own. No `vercel.json` is needed: the defaults below are correct for this project.

## What Vercel will build

| Setting | Value |
| --- | --- |
| Framework preset | Next.js (auto-detected) |
| Root directory | `./` (repository root) |
| Install command | default (`npm install`, uses `package-lock.json`) |
| Build command | default (`npm run build` → `next build`) |
| Output | default (Next.js) |
| Node.js | 24.x, from `"engines"` in `package.json`, which overrides the dashboard setting |

The result:

- 17 prerendered routes, including `/ai/knowledge.json`, the Smart Mode index built from approved content.
- One function, `/api/assistant`, which always answers 503 "unavailable". No cloud assistant is wired in.

Smart Mode runs entirely in the visitor's browser. Local AI downloads its model from Hugging Face, and its WebGPU library from GitHub, in the visitor's browser and only after they consent; the site's Content-Security-Policy already allows exactly those hosts. No model weights are in the repository or the deployment, and nothing needs an API key.

## 1. Connect the repository

1. In Vercel: **Add New… → Project → Import Git Repository**, choose GitHub and authorise access to `islam-portfolio-universe` if asked.
2. Keep the framework preset (Next.js) and the root directory (`./`). Leave the build and install commands on their defaults.

## 2. Production branch

Vercel uses the repository's default branch for production. Confirm it is `main`: **Project → Settings → Environments → Production** (on older dashboards, **Settings → Git → Production Branch**).

## 3. Environment variables

**None are required.** Optional:

| Variable | When | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Once the production domain is confirmed (e.g. `https://example.com`), Production only | Emits canonical URLs and sitemap entries. Without it, OG/Twitter image URLs still resolve: Next.js falls back to the Vercel deployment URL |
| `NEXT_PUBLIC_CONTENT_MODE` | **Leave unset** until the content gate passes (below) | Unset = `DEMO_CONTENT`: pages are `noindex`, `robots.txt` disallows crawling, and the footer shows a preview indicator. `VERIFIED_PUBLIC` makes the site indexable, but the build fails while placeholder records remain |

`NEXT_PUBLIC_*` values are inlined at build time, so redeploy after changing one. `NEXT_PUBLIC_ASSISTANT_MODE` and `ASSISTANT_PROVIDER_API_KEY` in `.env.example` are not read by the current code: do not add secrets.

## 4. First deployment

Click **Deploy**. When it finishes, open the `*.vercel.app` URL and check:

- the home page and 3D world;
- the introduction reel plays;
- **Download CV** returns the PDF;
- Ask My AI answers in Smart Mode.

## 5. Automatic deployments

- Every push to `main` creates a **production** deployment.
- Other branches and pull requests get **preview** deployments with their own URLs.
- GitHub CI and the Vercel build start **independently** on the same push. A failing CI run does **not** stop the Vercel deployment unless you configure §7.

## 6. Logs and troubleshooting

- **Build failures:** **Deployments →** the deployment **→ Build Logs**. Function logs (`/api/assistant`) are under **Logs**. To reproduce a build locally, run `npm ci && npm run build` with Node 24.
- **`PublicationGateError: VERIFIED_PUBLIC build blocked: N placeholder record(s) remain`.** `NEXT_PUBLIC_CONTENT_MODE=VERIFIED_PUBLIC` is set before the content is verified. Remove the variable, or resolve the records (`npm run content:gate` lists them).
- **Node.js version rejected.** The pin is `"node": "24.x"`. If Vercel ever stops offering 24.x, `22.x` is the other version every dependency supports (Vitest 5 needs `^22.12 || ^24`).
- **"metadataBase property … is not set" warning.** Expected until `NEXT_PUBLIC_SITE_URL` is set; harmless.
- **Vercel Toolbar missing on preview deployments.** The site's Content-Security-Policy allows scripts only from its own origin, so the toolbar (served from `vercel.live`) is blocked. This is intentional; disable the toolbar in the project settings if the console messages bother you.

## 7. Make CI gate deployments (optional)

Creating the workflow does **not** make Vercel wait for it. To enforce "only green code reaches production":

1. **GitHub branch protection.** Repository **Settings → Branches → Add rule** (or a ruleset) for `main`:
   - require a pull request before merging;
   - require status checks to pass, and select **Typecheck, lint, unit tests, build**. The check appears after the workflow has run once.
   - Add **Do not allow bypassing** if direct pushes to `main` should be blocked too.
2. **Vercel deployment checks.** If your plan offers it (**Project → Settings → Deployment Checks**), add the same GitHub check. Vercel then waits for it before promoting a production deployment.

## Status

**Ready for Vercel configuration.** The default build succeeds locally with no variables. Verified locally (Windows, Node 24.12):

- type check, lint and 785/785 Vitest tests pass, the tests also in a clean export of the tracked files;
- the production build succeeds;
- every referenced public asset exists with exact casing;
- no secrets, local paths or model weights are in the repository or the client bundle.

Not tested: an actual Vercel deployment, and the workflow on GitHub (it runs on the first push).

**Not ready for public production.**
- **Content gate:** 41 records await verification:
  - assistant entries 10
  - career 8
  - principles 5
  - projects 4
  - case studies 4
  - capabilities 4
  - site pillars 3
  - intro reel 2
  - AI knowledge 1
- **Owner sign-offs:** visual sign-off and the AI knowledge approvals are still pending.
- **Performance:** mobile LCP was last measured at about 3.3 s; the performance comparisons for the latest work (Cinematic Fidelity V3, AI Presence) are still to run.
- **Devices and browsers:** no physical phone or tablet has been tested (emulation only), and the WebKit and real-GPU suites have not yet run on the final AI Presence build.
- **Domain:** not confirmed yet (`NEXT_PUBLIC_SITE_URL`).
