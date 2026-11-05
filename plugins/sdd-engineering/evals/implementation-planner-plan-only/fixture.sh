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

git init -q -b main
git -c user.email=eval@example.com -c user.name=eval add -A
git -c user.email=eval@example.com -c user.name=eval commit -q -m "initial"
git checkout -q -b feat/cart-coupons
