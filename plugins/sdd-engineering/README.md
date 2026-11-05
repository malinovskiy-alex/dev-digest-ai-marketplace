# sdd-engineering

Spec Driven Development for Claude Code: **requirements → plan → implement →
review/verify → retro**, run by four agents and two skills that pass their work
to each other as files.

## What it does

You describe a feature. `spec-creator` turns it into testable EARS requirements
with stable IDs. `implementation-planner` turns those into a plan another agent
can execute cold. You approve the plan. `/sdd-engineering:run-plan` implements
it, runs an architecture review and a plan-by-plan verification in parallel,
loops fixes until nothing blocking is open, and hands the working tree back to
you, uncommitted. `/sdd-engineering:workflow-retro` then measures the run
(tokens, parallelism, tool errors) and proposes what to change next time.

Use it when a change is big enough that "just write the code" tends to go wrong:
a feature that touches several modules, a screen with states nobody listed, work
you want reviewed against what was actually asked for. For a one-line fix it is
overhead — skip it.

It works in any repository and any stack. Nothing is hardcoded: the planner
discovers the project's layout and its verification commands (package scripts,
Makefile, CI workflow) and writes them into the plan; every later agent runs
exactly those.

## Install

```
/plugin marketplace add malinovskiy-alex/dev-digest-ai-marketplace
/plugin install sdd-engineering@dev-digest-ai
```

The three plugins it depends on are installed with it (see
[How it fits](#how-it-fits-with-the-other-plugins)).

Then add the run folder to your project's `.gitignore`:

```gitignore
.sdd/
```

## Requirements

- Claude Code with plugin dependency support.
- **Node.js ≥ 20** on `PATH` — only for `/sdd-engineering:workflow-retro`
  (its `session-stats.mjs` script; no npm packages).
- `git` — the agents read the current branch and the open change.
- Your project's own toolchain (whatever its verification commands need).
- No environment variables, no API keys, no `userConfig` options.

## Components

| Component | Kind | Model | Input → Output |
|---|---|---|---|
| `sdd-engineering:spec-creator` | agent | opus | feature request (+ designs) → `<specs-dir>/<slug>.requirements.md`: EARS requirements with `R-NN` IDs, design gaps, module interaction, open questions. Blocking questions asked first. Never a plan, never code |
| `sdd-engineering:implementation-planner` | agent | opus | `<slug>.requirements.md` → `<specs-dir>/<slug>.md`: requirements check, decisions, skill map, constraints, steps, execution, verification commands, `Done when`. Asks single- vs multi-agent. Never code, never runs anything |
| `sdd-engineering:implementer` | agent | opus | approved plan → code + the plan's tests in the working tree, `.sdd/<slug>/baseline.md`, a report with verbatim verification output and `## Deviations`. Never commits or pushes |
| `sdd-engineering:plan-verifier` | agent | sonnet | plan + finished code → one verdict per plan item (`done` / `partial` / `not implemented` / `contradicted` / `cannot verify`) with `file:line`. Gaps only, no style advice. Writes nothing |
| `/sdd-engineering:run-plan` | skill, user-invoked only | — | `<plan.md \| slug> [--specs-dir DIR] [--from implement\|review] [--max-fix N] [extra instructions]` → orchestrates implement → review/fix loop → final verify, keeps `.sdd/<slug>/findings.md`, writes `<slug>.verification.md` |
| `/sdd-engineering:workflow-retro` | skill | — | `[slug \| workflow name] [session-id \| latest] [--specs-dir DIR]` → `<specs-dir>/<slug>.retro.md` or `.sdd/retro/<YYYY-MM-DD>-<workflow-slug>.md` |
| `evals/` | eval cases | — | six behaviour checks — see [Running the evals](#running-the-evals) |

Used from the dependencies:

| Component | From plugin | Used by |
|---|---|---|
| `architecture-review:architecture-reviewer` | `architecture-review` | `/sdd-engineering:run-plan` (review phase, in parallel with `plan-verifier`) |
| `research-tools:researcher` | `research-tools` | you / the main session, when a spec or plan lists a question as *needs researcher* |
| `engineering-paved-path:*` skills | `engineering-paved-path` | `implementation-planner` and `implementer` preload `onion-architecture` + `frontend-ui-architecture`, and load the stack skills (React, Next.js, Fastify, testing, security) per path; `spec-creator` preloads `mermaid-diagram` |

## How it works

### Why files, not conversation

A subagent starts with an **empty context window**. It does not see your
conversation, what the main session already read, or which skills it loaded.
That cuts both ways:

- **The win** — a long investigation or a wide implementation does not bloat
  the main session. Only the final report comes back.
- **The cost** — every rule has to be re-established inside the agent, and
  nothing can be "handed over" by being mentioned. So **state passes as files**,
  never as a retold summary: `<slug>.requirements.md` for intent, `<slug>.md`
  for the plan, the working tree for an implementation, `.sdd/<slug>/findings.md`
  for review results.

### Agents never spawn agents

Subagents cannot start other subagents, and none of these agents has the
`Agent` tool — on purpose. All sequencing happens in **your main session**:
either you call an agent directly ("use sdd-engineering:spec-creator to …"), or
`/sdd-engineering:run-plan` (a skill, so it runs in the main session) spawns
them. None of the agents commits, pushes or opens a PR; that stays with you.

### Dependency graph

```
                 ┌────────────────────────────┐
                 │      sdd-engineering       │
                 │ 4 agents · 2 skills · evals│
                 └─────┬──────────┬─────────┬─┘
             ^1.0.0    │   ^1.0.0 │  ^1.0.0 │
        ┌──────────────┘          │         └───────────────┐
        ▼                         ▼                         ▼
engineering-paved-path      research-tools          architecture-review
 (stack + quality skills)   (agent: researcher)     (agent: architecture-reviewer)
```

### The pipeline

```
 you ──► spec-creator ──► <specs-dir>/<slug>.requirements.md      (Status: Draft → Approved)
                                   │          (research-tools:researcher on demand)
                                   ▼
                        implementation-planner ──► <specs-dir>/<slug>.md
                                                          │
                                              you read and approve the plan
                                                          │
 /sdd-engineering:run-plan <slug> ◄───────────────────────┘
    1. implementer               → .sdd/<slug>/baseline.md, then code + tests
    2. review (parallel)         → architecture-reviewer + plan-verifier (gap pass)
                                   → merged into .sdd/<slug>/findings.md
    3. fix loop                  → implementer fixes must-fix rows → scoped re-review
                                   → repeat until nothing blocking or --max-fix reached
    4. final verify              → plan-verifier (final pass)
    5. wrap-up                   → <specs-dir>/<slug>.verification.md
                                   │
 /sdd-engineering:workflow-retro <slug> ──► <specs-dir>/<slug>.retro.md
                                   │
                        your own pre-PR review, then commit
```

| # | Step | Run by | Reads | Writes |
|---|---|---|---|---|
| 1 | Requirements | `sdd-engineering:spec-creator`, called by you | your request, designs you point at, the code of the touched modules, the project's instruction files (CLAUDE.md, AGENTS.md, CONTRIBUTING.md, package READMEs) when present | `<specs-dir>/<slug>.requirements.md` |
| 2 | Plan | `sdd-engineering:implementation-planner`, called by you | the requirements file, the code it plans to change, the project's instruction files, package manifests / Makefile / CI for the verification commands | `<specs-dir>/<slug>.md` (+ `<slug>.decisions.md` when the plan would grow too large) |
| 3 | Approve | you | the plan | — (edit the plan if needed; resolve every blocking open question) |
| 4 | Implement | `sdd-engineering:implementer`, spawned by `run-plan` | the plan | code + tests in the working tree, `.sdd/<slug>/baseline.md` |
| 5 | Review | `architecture-review:architecture-reviewer` ∥ `sdd-engineering:plan-verifier`, spawned by `run-plan` | the open change; the plan; `findings.md`; the `## Decisions` sections | reports only; `run-plan` writes them into `.sdd/<slug>/findings.md` |
| 6 | Fix loop | `implementer` (resumed) + scoped re-review | `findings.md` | code; ledger statuses |
| 7 | Final verify | `sdd-engineering:plan-verifier` (final pass) | plan, gap-pass report, ledger | report; `run-plan` writes `<specs-dir>/<slug>.verification.md` |
| 8 | Retro | `/sdd-engineering:workflow-retro` | session transcripts (via script), the run's files | `<specs-dir>/<slug>.retro.md` |

**Approval.** A requirements file is `Status: Draft` until you explicitly
approve it; `spec-creator` sets `Approved` only on your word and only when no
blocking question is open. A plan is approved by you reading it and running
`/sdd-engineering:run-plan` on it. `run-plan` refuses to start when the plan
does not exist, when the plan or its requirements still carry a blocking open
question, or when you are on the default branch.

### File names

| File | Written by | Committed? |
|---|---|---|
| `<specs-dir>/<slug>.requirements.md` | spec-creator | yes |
| `<specs-dir>/<slug>.md` | implementation-planner | yes |
| `<specs-dir>/<slug>.decisions.md` | implementation-planner (only for big plans) | yes |
| `<specs-dir>/<slug>.verification.md` | run-plan (final report + last verifier report + ledger) | yes |
| `<specs-dir>/<slug>.retro.md` | workflow-retro | yes (optional) |
| `.sdd/<slug>/state.md` | run-plan — one line per finished phase; the resume point | no |
| `.sdd/<slug>/findings.md` | run-plan — the findings ledger | no |
| `.sdd/<slug>/baseline.md` | implementer, once, before its first edit — HEAD sha, the plan's Baseline commands, exit codes and already-failing tests on the untouched tree; never rewritten by fix rounds | no |
| `.sdd/<slug>/plan-verifier-gap.md` | run-plan — the gap-pass report, read by the final pass | no |
| `.sdd/retro/<YYYY-MM-DD>-<workflow-slug>.md` | workflow-retro, when no spec slug applies | no |

### `<specs-dir>`

Where specs, plans, verification records and retros live. Default: `specs/` at
the project root. When a feature lives entirely in one package of a monorepo,
`spec-creator` may put it in that package's `specs/` (e.g. `apps/web/specs/`);
the plan always goes next to its requirements file. Override it explicitly:

- tell the agent: *"use sdd-engineering:spec-creator … write to `docs/specs/`"*;
- pass it to the skills: `/sdd-engineering:run-plan cart-coupons --specs-dir docs/specs`,
  `/sdd-engineering:workflow-retro cart-coupons --specs-dir docs/specs`;
- or simply pass the plan's path: `/sdd-engineering:run-plan docs/specs/cart-coupons.md`.

### The review/fix loop and the findings ledger

Both reviewers are read-only, so they run in parallel on the same tree, and they
run **before** anything is committed: a missing step or a file in the wrong
layer is cheapest to fix while the code is still fresh.

Every finding lands in one table, `.sdd/<slug>/findings.md`:

| ID | Iter | Source | Sev | Where | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| F-01 | 1 | architecture-reviewer | CRITICAL | `apps/api/src/modules/orders/routes.ts:41` | business rule in the route | fixed | moved to `service.ts:88` |
| F-02 | 1 | plan-verifier | gap | step 4 | `partial` — empty state not rendered | open | |

- **Severity:** `CRITICAL` / `WARNING` / `SUGGESTION` from the architecture
  reviewer; `gap` for a plan-verifier verdict of `partial`, `not implemented` or
  `contradicted`; `test` for a failure that is new against `baseline.md`.
- **What blocks:** CRITICAL, `gap` and `test` must be fixed. A WARNING is fixed
  unless the implementer disputes it — then you decide. SUGGESTIONs are offered
  to you once, as one multi-select question.
- **Status:** `open` · `fixed` · `disputed` · `accepted` (you chose to leave it)
  · `wontfix` · `reopened`. IDs are never renumbered; one defect from two
  reviewers is one row.
- **A round:** the implementer is resumed with the ledger path and the IDs to
  fix (a small late round gets a fresh implementer instead — cheaper than
  re-paying the accumulated context), disputes go to you in one question, then
  the reviewers re-check only what changed.
- **The cap:** after `--max-fix` rounds (default 3) with must-fix rows still
  open, `run-plan` asks: one more round, accept the rest as known issues, or
  stop. A row reopened twice means the fix and the rule disagree — it says so
  instead of looping.

**Failures are compared, not counted.** Before its first edit the implementer
runs the **Baseline** commands of the plan's `## Verification` on the untouched
tree and records the result in `baseline.md` (fix rounds never redo it). A test that already failed there is not a regression
and is not "fixed" by this run; only new failures become `test` findings.

**Resume.** `.sdd/<slug>/state.md` records each finished phase. After a crash, a
`/clear` or a new chat: `/sdd-engineering:run-plan <slug> --from review`.

## Usage

### Worked example: coupon codes in the cart

A web shop monorepo (`apps/api`, `apps/web`). You are on branch
`feat/cart-coupons`.

**1. Requirements.** In Claude Code:

```
Use sdd-engineering:spec-creator to write requirements for: customers can apply
one coupon code in the cart; the discount shows as a separate line; invalid or
expired codes show an error under the input. Design: designs/cart-coupon.png
```

The agent reads the cart code and the design, then asks only the blocking
questions (≤ 8, with a recommended option first) — e.g. *"Can a coupon be
combined with a sale price?"* — and writes `specs/cart-coupons.requirements.md`:

```markdown
| ID | Pattern | Requirement | Verified by |
|---|---|---|---|
| R-01 | Event-driven | WHEN the customer submits a valid coupon code, the system shall show the discount as a separate line in the cart total | web |
| R-02 | Unwanted | IF the submitted code is expired, THEN the system shall show "This code has expired" under the input and keep the total unchanged | web + api-unit |
| R-03 | Ubiquitous | The system shall apply at most one coupon per cart | api-unit |
```

Non-blocking questions and UX proposals stay in the file under
`## Open questions` / `## UX improvements` for you to answer. Read it, answer,
then: *"Approved."* — the agent sets `**Status:** Approved`.

**2. Plan.**

```
Use sdd-engineering:implementation-planner on specs/cart-coupons.requirements.md
```

It checks every `R-NN` against the code, asks you single- vs multi-agent
execution plus anything ambiguous, and writes `specs/cart-coupons.md` with
`## Requirements check`, `## Decisions`, `## Skill map`, `## Constraints`,
`## Steps` (each citing the IDs it covers), `## Execution`, `## Verification`
(the project's real commands, e.g. `npm run typecheck`, `npm test -w apps/api`)
and `## Done when`. If it lists something as *needs researcher*:

```
Use research-tools:researcher: does our payment provider's SDK v5 support
percentage discounts on line items? Cite the docs.
```

**3. Approve.** Read `specs/cart-coupons.md`. Edit anything you disagree with.

**4. Run.**

```
/sdd-engineering:run-plan cart-coupons
```

The implementer writes `.sdd/cart-coupons/baseline.md`, implements the steps and
their tests; the architecture reviewer and the plan verifier run in parallel;
`F-01 … F-0n` land in `.sdd/cart-coupons/findings.md`; fix rounds run until
nothing blocking is open; the final verifier pass grades what was left. You
answer at most a few batched questions (SUGGESTIONs to take, disputes). The run
ends with `specs/cart-coupons.verification.md` and a report like:

```markdown
## /run-plan cart-coupons — done
Plan `specs/cart-coupons.md` · Branch `feat/cart-coupons` · Fix rounds: 1
## Findings
4 total · fixed 3 · accepted 0 · wontfix 1 · open 0 — `.sdd/cart-coupons/findings.md`
## Next
your own pre-PR review, then commit
```

Extra instructions go after the slug and reach the implementer verbatim:
`/sdd-engineering:run-plan cart-coupons keep the old CartTotal props stable`.

**5. Retro.**

```
/sdd-engineering:workflow-retro cart-coupons
```

It runs `session-stats.mjs` on this session's transcripts, then writes
`specs/cart-coupons.retro.md`: numbers per agent, timeline, what each agent
found hard or easy, duplicated reads, misses, and a table of recommended
changes — which it **proposes, never applies**.

**6. Your pre-PR review.** Review the diff with your usual tools, run CI,
commit, open the PR. Paste any `accepted` findings into the PR description.

### Using the agents on their own

- `Use sdd-engineering:plan-verifier on specs/cart-coupons.md — full pass` — is
  the plan done, item by item?
- `Use sdd-engineering:implementer to rename OrderStatus.PENDING to AWAITING_PAYMENT across the API`
  — a concrete, bounded task without a plan; it restates the task as steps.
- `Use sdd-engineering:implementation-planner to plan: extract the email sender
  into a port with an SMTP adapter` — a bounded refactor can be planned without a
  requirements file; a vague request is sent back to `spec-creator`.

### Running the evals

Six cases in `evals/<case>/` (`prompt.md`, `graders/*.md`, `case.yaml` with a
`fixture.sh` that scaffolds a tiny Node project on a feature branch):

| Case | Checks |
|---|---|
| `spec-creator-ears` | requirements in EARS with `R-NN` IDs; no code, no plan |
| `implementation-planner-plan-only` | a plan with Steps / Verification / Done when traced to IDs; refuses to write code even when asked |
| `run-plan-missing-plan` | `/sdd-engineering:run-plan` stops when the plan does not exist; spawns no agent |
| `run-plan-unapproved-plan` | stops on a Draft requirements file with a blocking question |
| `plan-verifier-per-item` | one verdict per item with `file:line`; catches unimplemented steps; writes nothing |
| `workflow-retro-stats` | numbers come from `session-stats.mjs`, never estimated |

From the plugin folder (Claude Code with `claude plugin eval`, Git Bash on
Windows for the scaffold scripts):

```
claude plugin eval . --scaffold --allow-tools Bash Write Edit
```

Results land in `evals/results/` (gitignored). Each run loads only this plugin,
so the dependency plugins' agents and skills are absent there — the cases avoid
relying on them.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `run-plan` says an agent is not available, or a spawn of `architecture-review:architecture-reviewer` fails | the dependency plugin is disabled or was uninstalled | `/plugin` → enable `architecture-review` (and `research-tools`, `engineering-paved-path`), or reinstall `sdd-engineering@dev-digest-ai`, which pulls them back in |
| an agent says a skill like `engineering-paved-path:onion-architecture` is missing, or follows no stack rules | `engineering-paved-path` is disabled; a missing preloaded skill is skipped silently (debug warning only) | enable `engineering-paved-path`; check with `/plugin` |
| `run-plan`: *"no plan at specs/<slug>.md"* | the planner has not run, the slug is misspelled, or the plan lives elsewhere | run `sdd-engineering:implementation-planner` first, pass `--specs-dir DIR`, or pass the plan's path |
| `run-plan` stops before implementing | `Status: Draft` with a blocking question, a blocking row in `## Risks / open questions`, or you are on the default branch | answer the question in the file (or ask `spec-creator` to update it); create a feature branch |
| the planner refuses to plan and says *"Next: spec-creator"* | the request was vague and there is no requirements file | run `sdd-engineering:spec-creator` first |
| `workflow-retro`: *"no transcript folder for this project"* | Claude Code was started in a different folder than the one the script runs in | it prints the folders it tried; rerun with `--cwd <folder Claude Code was started in>` or `--project ~/.claude/projects/<folder>` |
| `workflow-retro`: `node` not found | Node.js not on `PATH` | install Node.js ≥ 20 |
| `/sdd-engineering:run-plan` is not suggested by Claude automatically | by design: it has `disable-model-invocation: true` | type it yourself |
| a fix loop keeps reopening the same finding | the fix and the rule disagree | `run-plan` stops and asks; accept it as a known issue or change the plan |

## How it fits with the other plugins

`sdd-engineering` is the workflow plugin; it composes three dependency plugins
from this marketplace, all declared in its `plugin.json` with range `^1.0.0` and
installed with it:

| Dependency | What `sdd-engineering` uses from it |
|---|---|
| [`engineering-paved-path`](../engineering-paved-path/README.md) | the architecture, stack, testing and security skills the planner names in its `## Skill map` and the implementer loads per path; `mermaid-diagram` for the spec's module-interaction diagram |
| [`architecture-review`](../architecture-review/README.md) | `architecture-review:architecture-reviewer`, the boundary lens in the review/fix loop |
| [`research-tools`](../research-tools/README.md) | `research-tools:researcher`, for facts the spec or plan must not guess (external APIs, git history) |

Each dependency also works alone. Nothing in this marketplace depends on
`sdd-engineering`.

### Intentionally not included

| Not shipped | Instead |
|---|---|
| a separate test-writer agent | the implementer writes the plan's tests in the same pass — one agent that already holds the code is cheaper than a second one re-reading it; the plan-verifier's final pass checks them |
| a doc-writer agent | out of scope for 1.0.0; write or ask for docs after the feature ships |
| a pr-self-review gate (and its security/lens routing) | `run-plan` ends by handing over to **your own** pre-PR review — your code review, security review and CI |

They may be added later as minor releases.

## Hooks, network calls, telemetry

- **Hooks:** none.
- **MCP servers:** none.
- **Network calls:** none from this plugin. (The `research-tools:researcher`
  dependency uses `WebSearch` / `WebFetch` when you ask it an external question.)
- **Telemetry:** none. `session-stats.mjs` reads your local Claude Code
  transcripts under `~/.claude/projects/` (or `$CLAUDE_CONFIG_DIR/projects/`),
  writes nothing, and sends nothing anywhere.
- **Files written in your project:** only those listed in
  [File names](#file-names) — plus the code the implementer changes. No git
  writes: nothing is committed, pushed or opened as a PR.

## Versioning

Semantic versioning; the version lives only in `.claude-plugin/plugin.json`.
Release history: [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE). Agent definitions and skills were adapted from the
author's own Spec Driven Development setup and generalized to be
project-agnostic.
