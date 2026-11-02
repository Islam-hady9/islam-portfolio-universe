# Claim review procedure (Local AI)

Used for EVALUATION-RESULTS.md. For every answer shown as **Generated Locally** (after the
verifier), split the text into atomic claims and mark each:

- **S — supported**: the claim is stated in the evidence given to the model (paraphrase allowed
  if the meaning is unchanged).
- **W — weakly supported**: true to the evidence but reframed (e.g. areas of work called a
  "tech stack"); counted as supported, listed separately.
- **U — unsupported**: not in the evidence, changes the meaning (wrong actor, wrong pronoun,
  added qualifier such as "extensive"), or misquotes contact data.

Claim support = (S + W) / (S + W + U). Gate (spec §11): ≥ 85 %.

Reviewer in this session: Claude (the implementing agent) — **not a human**. The owner (or
another human) should repeat the review on the same answers before treating the gate as met.
Raw answers: `.evidence-tmp/ai/local-eval-*.rescored.json` (git-ignored) — the reviewed answers
are copied into EVALUATION-RESULTS.md.
