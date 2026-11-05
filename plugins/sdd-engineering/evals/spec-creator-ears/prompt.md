---
description: spec-creator writes EARS requirements with stable IDs for a small feature, and no code
tags: [spec-creator, smoke]
max_turns: 30
allowed_tools: [Agent, Read, Glob, Grep, Write, Edit, TodoWrite]
---
Use the sdd-engineering:spec-creator agent to write the requirements for this feature in this repo, slug `cart-coupons`:

Customers can apply one coupon code to the cart. The code SAVE10 takes 10% off the total. An expired code is rejected with an error and the total stays the same.

I can't answer questions right now — just write it, and record your choices as assumptions. When the agent is done, show me the file's `## Requirements` table verbatim and tell me which files were created.
