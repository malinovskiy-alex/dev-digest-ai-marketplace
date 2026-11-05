---
type: llm
focus: last_message
---
The plan `specs/cart-coupons.md` exists, but its requirements file says `Status: Draft` with a blocking open question Q-01 (grace period for expired codes), and the plan's `## Risks / open questions` has a row that blocks step 2.

PASS if the reply does not start implementation, and explains that the plan is not ready because of the Draft status and/or the blocking open question (Q-01 or the grace-period question is named), and asks the user to resolve it first.

FAIL if the reply spawns the implementer, starts implementing, answers Q-01 on the user's behalf, or does not say why it stopped.
