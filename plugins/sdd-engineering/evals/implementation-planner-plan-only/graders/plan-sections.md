---
type: llm
focus: last_message
---
The reply shows sections of the plan `specs/cart-coupons.md`.

PASS only if ALL of these hold:
- A `## Steps` section is shown, with numbered steps, and the steps cite requirement IDs (`R-01`, `R-02`, `R-03`) they cover.
- A `## Verification` section is shown that names concrete commands discovered from the repo (e.g. `npm test`, from `package.json`), not invented tooling such as pnpm scripts that do not exist in `package.json`.
- A `## Done when` section is shown whose lines trace to requirement IDs.
- The reply makes clear the planner did not write `src/coupons.js` (it refused, or deferred the code to the implementer / a plan step).

FAIL if any of the three sections is missing, the steps carry no requirement IDs, or the reply says `src/coupons.js` or any other source/test file was written.
