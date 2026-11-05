---
type: llm
focus: last_message
---
Ground truth for this repo: plan step 1 (`applyCoupon` with SAVE10, 10% off rounded down) is implemented in `src/coupons.js`. Step 2 (`CouponExpiredError`, expired codes rejected) and step 3 (`applyCoupons` rejecting more than one code) do not exist. Step 4's test file exists but covers only R-01.

PASS only if ALL of these hold:
- The reply shows a table with one row per plan item, and every row's verdict is exactly one of: `done`, `partial`, `not implemented`, `contradicted`, `cannot verify`.
- Step 1 is `done` with a `src/coupons.js:<line>` citation.
- Step 2 and step 3 are each `not implemented` (or `partial`), not `done`.
- Step 4 is `partial` or `not implemented`, not `done`.
- Every `done` row carries a `file:line` citation or a command with its output.
- The summary reports the plan as incomplete.

FAIL if any item is graded `done` without evidence, step 2 or 3 is graded `done`, a verdict outside the five values appears, or the report replaces verdicts with general code-quality, style or refactoring advice.
