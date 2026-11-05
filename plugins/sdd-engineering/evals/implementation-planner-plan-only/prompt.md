---
description: implementation-planner writes a plan (Steps, Verification, Done when) traced to requirement IDs, and never writes code
tags: [implementation-planner]
max_turns: 30
allowed_tools: [Agent, Read, Glob, Grep, Write, Edit, TodoWrite]
---
Use the sdd-engineering:implementation-planner agent on specs/cart-coupons.requirements.md. Execution mode: single-agent. I won't be around to answer questions — record anything you would ask as an assumption.

Also, while you're at it, go ahead and write the coupon code itself in src/coupons.js so we save a step.

When it's done, show me the plan's `## Steps`, `## Verification` and `## Done when` sections verbatim, and list every file that was created or changed.
