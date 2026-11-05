---
name: run-plan
description: "Implements an approved implementation plan through the SDD agent chain: implementer (code and the plan's tests) → review/fix loop (architecture-reviewer + plan-verifier in parallel, then implementer fix rounds until nothing blocking is open) → final plan-verifier pass → hand-over to the user's own pre-PR review. Starts from a plan that already exists — spec-creator and implementation-planner are run before it. Keeps every review finding in one ledger with a status under .sdd/<slug>/, resumes from a phase with --from. Invoked by the user as /sdd-engineering:run-plan. Never commits, pushes or opens a PR."
argument-hint: "<plan.md | slug> [--specs-dir DIR] [--from implement|review] [--max-fix N] [extra instructions]"
disable-model-invocation: true
---

# /run-plan — approved plan to pre-PR hand-over

You are the **orchestrator**. You run in the main session, spawn the plugin
agents by their namespaced names, pass files between them by **path**, keep the
findings ledger, and talk to the user. You do not write code or tests yourself,
and you do not read the code the agents wrote — their reports and the files
below are what you work from. Reading code yourself is how this session's
context fills up before the work is done.

| Role | Spawn as (`subagent_type`) |
|---|---|
| writes code and the plan's tests, fixes findings | `sdd-engineering:implementer` |
| grades the code against the plan, item by item | `sdd-engineering:plan-verifier` |
| reviews boundaries (layers, import direction, module reach) | `architecture-review:architecture-reviewer` |

The agents never spawn agents of their own — every spawn below is yours.

The spec and the plan come **before** this command, and are run separately:
`sdd-engineering:spec-creator` → `<specs-dir>/<slug>.requirements.md`, then
`sdd-engineering:implementation-planner` → `<specs-dir>/<slug>.md`, then the
user approves the plan. This command starts where the plan ends.

## 0. Preflight

`$ARGUMENTS`, token by token:

| Token | Means |
|---|---|
| a path to `<dir>/<slug>.md` (not `*.requirements.md`, `*.decisions.md`, `*.verification.md`, `*.retro.md`) | the plan; `<specs-dir>` is its directory |
| a bare word | the slug → the plan is `<specs-dir>/<slug>.md` |
| `--specs-dir DIR` | where specs and plans live — default `specs/` at the project root. A bare slug not found there is also looked up in package-level `specs/` folders (`*/specs/<slug>.md`, `*/*/specs/<slug>.md`); more than one match → ask which |
| `--from implement\|review` | resume at that phase (§1, `state.md`) |
| `--max-fix N` | cap on fix rounds, default **3** |
| everything else | extra instructions — passed **verbatim** to `sdd-engineering:implementer`, never used to change the plan |

Stop, and say why, if:

- no argument, or no plan is found at the resolved path — *"no plan at
  `<path>`: run `sdd-engineering:implementation-planner` first, or pass the
  plan's path"*. Never write or guess a plan yourself;
- the plan is not approved: the plan or its `**Requirements:**` file says
  `Status: Draft` with a blocking open question, or the plan's
  `## Risks / open questions` has a row blocking a step. Running this command
  on a plan the user has reviewed is the approval; a blocking open question is
  not overridden by it — ask the user to resolve it in the file first;
- the current branch (`git branch --show-current`) is the repository's default
  branch (`main`, `master`, or what `origin/HEAD` points at) — feature work
  belongs on a feature branch. Creating the branch is the user's call;
- one of the three agents above is not available (its plugin is not installed or
  is disabled) — say which plugin to enable; do not substitute a general-purpose
  agent.

The plan is the input; you read only its header, `## Execution`,
`## Verification` and `## Risks / open questions`. The agents read the rest
themselves.

## 1. The run directory

`.sdd/<slug>/` at the project root. Tell the user once that `.sdd/` belongs in
their `.gitignore` if it is not there yet. You own it; the only file an agent
writes here is `baseline.md`:

| File | Written by | Holds |
|---|---|---|
| `state.md` | you | one line per finished phase: date, phase, agent, outcome. The resume point for `--from` |
| `findings.md` | you | the ledger — every finding from every reviewer, with a status (§4) |
| `baseline.md` | `sdd-engineering:implementer`, once, before its first edit | HEAD sha, and for each command in the **Baseline** column of the plan's `## Verification`: where it ran, its exit code and the names of the tests (or `file:line` of typecheck/lint errors) that already failed on the untouched tree |
| `plan-verifier-gap.md` | you | the gap-pass report of `sdd-engineering:plan-verifier`, verbatim — the final pass reads it by path |

## 2. Phases

```
implement ─▶ review ⇄ fix ─▶ final verify ─▶ wrap-up ─▶ hand-over
               (max N rounds)
```

### implement

Spawn `sdd-engineering:implementer`:

> Plan: `<plan path>`. Slug: `<slug>` (run folder `.sdd/<slug>/`). Record the
> baseline in `.sdd/<slug>/baseline.md` before your first edit — the
> **Baseline** commands of the plan's `## Verification`, once. Implement every step of the plan,
> **including its test steps** — this run has no separate test phase. Extra
> instructions from the user: <verbatim, or "none">.

If the plan's `## Execution` has a file-ownership table with disjoint paths
(e.g. an API stream and a web-app stream), spawn one implementer per row
**in one message**, each told which steps and paths it owns (see *Rules*).

**Keep the agent's ID** — fix rounds resume this same agent (§4, with the
exception for small late rounds there). Its `## Not done / blocked` lines
become findings (source `implementer`).

### review

Spawn **both in one message** — read-only, so they run in parallel:

- `architecture-review:architecture-reviewer` — the open change.
- `sdd-engineering:plan-verifier` — the plan path and the slug, **gap** pass.
  The implementer wrote the tests too, so every item is graded, test items
  included — except items the plan's `## Execution` defers to a later phase,
  which it lists as *not graded in this pass*.

Every reviewer prompt names `.sdd/<slug>/findings.md` and the plan's
`## Decisions` (and the requirements file's `## Decisions`) as inputs to read
**before** rating severity: a recorded user decision is not a defect, and a
finding that contradicts one is at most a question for the user.

Every reviewer prompt also says: **do not recommend an API of a dependency
without first confirming it exists in the version installed in this project** —
in the installed package itself (its type declarations or source under the
dependency folder), not in memory or online docs. A recommended API that does
not exist in the installed version can typecheck in one place and still crash at
runtime.

Save the plan-verifier report verbatim to `.sdd/<slug>/plan-verifier-gap.md`.
Merge both reports into `findings.md` (§4) and run the loop.

### final verify

After the loop exits, spawn `sdd-engineering:plan-verifier` once more, **final**
pass:

> Plan: `<plan path>`. Final pass. Gap-pass report: `.sdd/<slug>/plan-verifier-gap.md`.
> Findings ledger: `.sdd/<slug>/findings.md`. Grade the items that were not
> `done` in the gap pass; run the outcome checks in full.

Anything not `done` that is not already an `accepted` row → a new finding →
one more fix round, within the `--max-fix` cap.

### wrap-up

1. The report (§5) — write it to **`<specs-dir>/<slug>.verification.md`**, next
   to the plan, so it can be committed with the feature: the §5 report, then the
   last `sdd-engineering:plan-verifier` report **verbatim** (its per-item
   verdicts), then `findings.md` copied in as `## Findings ledger`. The `.sdd/`
   copies stay as the working files; this one is the record.
2. Offer `/sdd-engineering:workflow-retro <slug>` — the run's retrospective,
   written to `<specs-dir>/<slug>.retro.md`.
3. **Hand over** to the user's own pre-PR review — their code review, security
   review and CI. This command is not a merge gate. Never commit, push or open the
   PR unasked.

## 3. Questions from the agents

The implementer, the architecture reviewer and the plan verifier have no
`AskUserQuestion` by design — their questions arrive as report lines
(`## Deviations`, `## Cannot assess`, `cannot verify`). Each one becomes a
finding or goes into **one** batched `AskUserQuestion` at the end of the phase.
Never decide for the user.

## 4. The findings ledger and the fix loop

### `findings.md`

```markdown
# <slug> — findings

| ID | Iter | Source | Sev | Where | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| F-01 | 1 | architecture-reviewer | CRITICAL | `apps/api/src/modules/orders/routes.ts:41` | business rule in the route (rule X) | fixed | moved to `service.ts:88` |
| F-02 | 1 | plan-verifier | gap | step 4 | `partial` — empty state not rendered | open | |
| F-03 | 1 | architecture-reviewer | WARNING | `…` | … | disputed | implementer: "…" → user: keep as is |
```

- **Sev:** CRITICAL / WARNING / SUGGESTION from the architecture reviewer;
  `gap` for a plan-verifier verdict of `partial` / `not implemented` /
  `contradicted`; `test` for a new failure (not in `baseline.md`) in any
  verification output.
- **Status:** `open` · `fixed` · `disputed` · `accepted` (the user chose to leave
  it) · `wontfix` (a SUGGESTION not taken) · `reopened`.
- Dedupe on *where + rule*: one defect from two sources is one row naming both.
  IDs are never renumbered.
- `cannot verify` is not a finding — it goes to the final report.

### What blocks

| Kind | Default |
|---|---|
| CRITICAL, `gap`, `test` | must fix |
| WARNING | fix — unless the implementer disputes it; then the user decides |
| SUGGESTION | not fixed. All of them in **one** `AskUserQuestion` (multiSelect) after the first review; the chosen ones become must-fix, the rest `wontfix` |

### One round

1. **Fix.** Resume the implementer with `SendMessage`:
   > Fix round <i>. Findings: `.sdd/<slug>/findings.md` — fix F-01, F-02
   > (status `open` / `reopened`) and nothing else. For each: fix it and cite
   > `file:line`, or dispute it with a reason. Then run the plan's
   > `## Verification` commands for what you touched (after-each-step, then
   > Final for each package you changed) and label failures against
   > `.sdd/<slug>/baseline.md`. Do **not** redo the baseline.

   No live implementer (a new chat, `--from review`)? Spawn a fresh
   `sdd-engineering:implementer` with the plan path, the findings path and the
   same instructions — it reads the plan and the findings and fixes exactly the
   rows named, never re-running the baseline step.

   A **small late round** — round 2 or later with one or two findings to fix —
   also gets a fresh implementer with those paths instead of a resume: resuming
   re-pays the whole accumulated context for a one-line change.
2. **Ledger.** `fixed` with the resolution, or `disputed` with the reason. A new
   failure in its verification output that is not in `baseline.md` is a new
   `test` row.
3. **Disputes** → one `AskUserQuestion` for all of them: *keep the finding*
   (back to `open`) or *accept the reason* (`accepted`).
4. **Re-review**, scoped, in parallel:
   - `architecture-review:architecture-reviewer`: *"Re-review, iteration <i+1>.
     Confirm each finding marked `fixed` in `.sdd/<slug>/findings.md` is
     resolved, then review only the files this round changed: <list from the
     implementer's report>."* Still there → `reopened`. New → a new row with this
     iteration number.
   - `sdd-engineering:plan-verifier`: only if the round had a `gap` row —
     *"Re-grade items <n, m> only."* (a final pass limited to those items; its
     outcome checks still run in full).
5. **Exit** when no must-fix row is `open` or `reopened`.

### The cap

After `--max-fix` rounds with must-fix rows still open, stop and ask:
**one more round** · **accept the rest as known issues** (`accepted`, listed in
the report and later in the PR description) · **stop**. A row reopened twice
means the fix and the rule disagree — say so in the question instead of looping.

## 5. Final report

```markdown
## /run-plan <slug> — done | stopped at <phase>
Plan `<path>` · Branch `<branch>` · Fix rounds: <n>

## Findings
<n> total · fixed n · accepted n · wontfix n · open n — `.sdd/<slug>/findings.md`
<every `accepted` row, one line each — these go into the PR description>

## Verification
<the last verification output the implementer and the plan verifier reported, verbatim>
Baseline: `.sdd/<slug>/baseline.md`

## Not verified
<every `cannot verify`, and what would settle it — e.g. a manual check in a
running app that no agent could do>

## Next
your own pre-PR review, then commit — or what blocks it
```

## Rules

- **Writers run one at a time** — two agents writing in one checkout destroy
  each other's work. Only the read-only reviewers run in parallel. **The one
  exception:** the plan's `## Execution` has a file-ownership table whose paths
  are disjoint — then the writers it lists may run in parallel, each confined to
  its own paths, and none touches a file another owns (a shared file, e.g. a
  shared contracts package, belongs to exactly one row). No table, or
  overlapping paths → one at a time.
- **The baseline is written once.** Never ask for a new `baseline.md` once the
  `implement` phase has started — the tree is no longer clean, and that
  baseline would bless the failures you are looking for.
- **No git writes**: no commit, push, branch switch, stash, `gh pr create`.
- **Do not fix anything yourself**, however small. An unreviewed fix is the
  failure this chain exists to prevent — route it through a fix round.
- **Give agents paths, not retellings.** One sentence of phase, then paths.
- **Never read secrets** and never pass their contents to an agent.
- Talk to the user in their language; files under `<specs-dir>` and `.sdd/` are
  written in English; identifiers, paths and rule names stay as they are.
