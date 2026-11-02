# Motion recordings (local only)

WebM clips recorded on the real GPU by `scripts/qa/record.mjs` (1280×800):

| File | Shows |
|---|---|
| `01-hero-gyroscope.webm` | first visit: prelude, intro dolly, orbital core, pointer parallax |
| `02-scroll-journey.webm` | scroll through all home stations, including the ground-crossing veils |
| `03-universe-node-approach.webm` | node hover highlight, approach dive, travel to the destination |
| `04-project-portal-transition.webm` | project card goes live on hover, then expands into its case study |

The clips (≈15 MB) are git-ignored to keep the repository small (decision D-26). Regenerate against any running production server:

```bash
npm run qa:record -- http://localhost:3300
```
