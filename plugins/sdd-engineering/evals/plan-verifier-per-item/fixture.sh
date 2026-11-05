#!/usr/bin/env bash
# Scaffold: a tiny Node project with a cart module, on a feature branch.
set -euo pipefail

mkdir -p src test specs

cat > package.json <<'JSON'
{
  "name": "tiny-shop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
JSON

cat > src/cart.js <<'JS'
// Sum of item prices in cents.
export function cartTotal(items) {
  return items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
}
JS

cat > test/cart.test.js <<'JS'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartTotal } from '../src/cart.js';

test('sums price times quantity', () => {
  assert.equal(cartTotal([{ priceCents: 250, qty: 2 }, { priceCents: 100, qty: 1 }]), 600);
});
JS

cat > specs/cart-coupons.requirements.md <<'MD'
# Cart coupons · requirements

**Status:** Approved
**Goal:** a customer can apply one coupon code to the cart total.

## Context
`src/cart.js:2` computes the cart total; there is no discount logic today.

## Out of scope
- coupons stacking; admin UI for creating coupons.

## Requirements
| ID | Pattern | Requirement | Verified by |
|---|---|---|---|
| R-01 | Event-driven | WHEN the customer applies the code `SAVE10`, the system shall reduce the cart total by 10%, rounded down to whole cents | unit |
| R-02 | Unwanted | IF the applied code is expired, THEN the system shall reject it with the message "This code has expired" and leave the total unchanged | unit |
| R-03 | Ubiquitous | The system shall apply at most one coupon per cart | unit |

## Open questions
none

## Decisions
| Question | Decision | Source |
|---|---|---|
| Rounding | down to whole cents | user |
MD

cat > specs/cart-coupons.md <<'MD'
# Cart coupons · implementation plan

**Requirements:** `specs/cart-coupons.requirements.md` (Status: Approved)
**Execution:** single-agent — chosen by the user
**Branch:** `feat/cart-coupons`

## Requirements check
| Req | Verdict | Note | → |
|---|---|---|---|
| R-01 | ok | | step 1 |
| R-02 | ok | | step 2 |
| R-03 | ok | | step 3 |

## Decisions
| ID | Question | Answer | Source |
|---|---|---|---|
| D-1 | where does coupon logic live? | new module `src/coupons.js` | user |

## Constraints
| Constraint | Source |
|---|---|
| `src/cart.js` keeps its `cartTotal(items)` signature | D-1 |

## Steps
1. `src/coupons.js` · covers: R-01 — export `applyCoupon(totalCents, code)`; for `SAVE10` return `Math.floor(totalCents * 0.9)`.
2. `src/coupons.js` · covers: R-02 — export `CouponExpiredError`; `applyCoupon(totalCents, code, { now })` throws it with message "This code has expired" when the code's `expiresAt` is before `now`.
3. `src/coupons.js` · covers: R-03 — `applyCoupons(totalCents, codes)` throws when `codes.length > 1`.
4. `test/coupons.test.js` · covers: R-01, R-02, R-03 — one `node:test` case per requirement.

## Verification
| When | Command |
|---|---|
| baseline, after each step, final | `npm test` |

## Done when
- [ ] R-01: `applyCoupon(1000, 'SAVE10')` returns `900`
- [ ] R-02: an expired code throws `CouponExpiredError` with "This code has expired"
- [ ] R-03: two codes are rejected
- [ ] R-01, R-02, R-03: tests in `test/coupons.test.js` pass with `npm test`

## Left to reviewers
- architecture: none beyond the new module

## Risks / open questions
none
MD

# Partial implementation: step 1 done, step 2 and 3 missing, test covers R-01 only.
cat > src/coupons.js <<'JS'
const CODES = { SAVE10: 0.1 };

export function applyCoupon(totalCents, code) {
  const rate = CODES[code];
  if (rate === undefined) return totalCents;
  return Math.floor(totalCents * (1 - rate));
}
JS

cat > test/coupons.test.js <<'JS'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCoupon } from '../src/coupons.js';

test('R-01: SAVE10 takes 10% off, rounded down', () => {
  assert.equal(applyCoupon(1000, 'SAVE10'), 900);
  assert.equal(applyCoupon(999, 'SAVE10'), 899);
});
JS

git init -q -b main
git -c user.email=eval@example.com -c user.name=eval add -A
git -c user.email=eval@example.com -c user.name=eval commit -q -m "initial"
git checkout -q -b feat/cart-coupons
