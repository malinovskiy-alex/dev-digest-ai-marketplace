# Cost baseline

How we measure what a plugin costs to run, and how we decide whether a change that saves tokens is acceptable. This applies to every plugin, but in practice it matters for `sdd-engineering`, whose pipeline runs several `opus` agents.

## 1. What we measure

Numbers come from the session transcripts, never from estimates. The tool is the stats script that ships with `sdd-engineering`:

```
node "<plugin cache>/sdd-engineering/<version>/skills/workflow-retro/scripts/session-stats.mjs" --session <id|latest> --json
```

Inside Claude Code, `/sdd-engineering:workflow-retro` runs the same script via `${CLAUDE_SKILL_DIR}`.

| Metric | Source | Why |
|---|---|---|
| Input tokens: uncached, cache write, cache read | per agent | the main cost driver; cache reads are billed far below fresh input |
| Output tokens | per agent | priced highest per token |
| Model per agent | per agent | `opus` vs `sonnet` vs `haiku` changes the unit price |
| API requests, active minutes | per agent | latency and retries |
| Tool errors, follow-ups | per agent | waste: work that had to be redone |

**Cost in USD** = Σ over agents (tokens of each kind × the model's price for that kind). Take prices from the official pricing page on the day of the run ([anthropic.com/pricing](https://www.anthropic.com/pricing)) and write the price table into the results, so old results stay comparable after a price change.

## 2. Fixed scenario

A baseline is only comparable if the task is the same. The benchmark is the `sdd-engineering` eval fixture: a tiny Node "cart" repository on the branch `feat/cart-coupons`, built by `plugins/sdd-engineering/evals/*/fixture.sh`.

Benchmark run = the full pipeline on that fixture:

1. `sdd-engineering:spec-creator`: "Add percentage and fixed-amount coupons to the cart total". Answers to blocking questions are fixed in advance and pasted verbatim.
2. `sdd-engineering:implementation-planner` on the resulting requirements. Single-agent mode.
3. `/sdd-engineering:run-plan <slug> --max-fix 2`.
4. `/sdd-engineering:workflow-retro <slug>`, which records the numbers.

Same Claude Code version, same plugin versions and same models within one experiment. Record all three next to the results.

## 3. Quality gate

A cheaper run that is worse is not a saving. A run **passes** only if all of these hold:

| Gate | Check |
|---|---|
| Plan done | final `sdd-engineering:plan-verifier` pass: every item `done`, none `partial` / `not implemented` / `contradicted` |
| Tests | the plan's final verification commands exit 0; no failure labelled `new` against `.sdd/<slug>/baseline.md` |
| Architecture | `architecture-review:architecture-reviewer`: 0 CRITICAL findings open at the end |
| No human rescue | no manual edits to the code during the run; answers to agent questions only from the fixed script |

## 4. Experiment protocol

1. **Baseline.** Run the scenario 3 times with the current configuration. Report the median and the spread of cost, plus the gate result of each run.
2. **One change.** Change exactly one variable. Example: `model: sonnet` instead of `opus` for `sdd-engineering:implementer`, published as a pre-release or tested with `claude --plugin-dir`.
3. **Candidate.** Run 3 times again, same scenario and same gate.
4. **Decision.** Accept only if every candidate run passes the gate **and** the median cost is lower. Otherwise reject, and keep the numbers.
5. **Honest result.** Publish both tables in §5, including failed runs, retries and anything that did not go to plan. A rejected experiment is a valid result.

## 5. Results

| Date | Experiment | Config | Runs | Gate passed | Median cost (USD) | Median tokens in / out | Notes |
|---|---|---|---|---|---|---|---|
| — | baseline | `sdd-engineering` 1.0.0, all defaults | not run yet | — | — | — | |

Price table used: _fill in at run time_.
