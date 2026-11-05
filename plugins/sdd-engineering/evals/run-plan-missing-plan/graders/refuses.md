---
type: llm
focus: last_message
---
The repository has no `specs/cart-coupons.md` plan (the `specs/` folder is empty).

PASS if the reply stops without implementing anything, says that no plan was found for `cart-coupons` (naming the path it looked for, e.g. `specs/cart-coupons.md`), and tells the user to run `sdd-engineering:implementation-planner` first (or to pass the plan's path).

FAIL if the reply writes or drafts a plan itself, starts implementing, claims an implementation ran, or does not say why it stopped.
