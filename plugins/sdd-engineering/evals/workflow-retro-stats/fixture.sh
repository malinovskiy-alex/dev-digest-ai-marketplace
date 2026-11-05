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

git init -q -b main
git -c user.email=eval@example.com -c user.name=eval add -A
git -c user.email=eval@example.com -c user.name=eval commit -q -m "initial"
git checkout -q -b feat/cart-coupons
