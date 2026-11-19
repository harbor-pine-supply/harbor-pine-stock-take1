---
description: Get a second opinion from Codex on the current change, then decide what to do with each finding. Only when asked with /second-opinion.
disable-model-invocation: true
---

# Second opinion, then decide

1. Run `node scripts/second-opinion.mjs`. If Codex couldn't run, stop and say so.
2. Read `.scratch/second-opinion.md`.
3. For each finding, check it against the code and the work package before you decide. Then choose one:
   - **Accept:** it's right and in scope. Make the change.
   - **Accept in part:** part of it is right. Say which part you're taking and why not the rest.
   - **Decline:** it's wrong, already handled, or outside the work package. Say why, with the evidence (a line of code, a test, the work package). If it's a good idea that's out of scope, note it as a follow-up instead.
   Don't accept a finding just because a reviewer said it, and don't decline one just to save work.
4. Make the changes you accepted now, without asking: the work package already approves changes inside its scope. Ask first only if a fix would go outside it. For every change, add or update a test that would fail without it.
5. Run `node scripts/check.mjs`.
6. Write `.scratch/review-decisions.md`: a table with each finding, your decision, and the reason in one line, then the check line.
7. Don't commit or open the pull request yet.
