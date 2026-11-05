---
type: llm
focus: last_message
---
The reply shows a requirements table copied from `specs/cart-coupons.requirements.md`.

PASS only if ALL of these hold:
- Every requirement row has an ID of the form `R-01`, `R-02`, … (two digits, `R-` prefix).
- Every requirement uses an EARS form with "shall": ubiquitous ("The system shall …"), or an upper-case trigger WHEN / WHILE / IF … THEN / WHERE followed by "the system shall …".
- At least one requirement covers applying SAVE10 (10% off) and at least one is an IF … THEN (unwanted-behaviour) requirement for an expired code.
- No requirement uses "should", "may", "will" or "must" as its obligation.
- The reply says the file created is a `*.requirements.md` file under `specs/`.

FAIL if any requirement lacks an ID, any requirement is free prose without an EARS trigger or "shall", the table is missing, or the reply says source code or a plan file (`specs/cart-coupons.md`) was written.
