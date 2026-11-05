# architecture-review

A read-only architecture reviewer for the change you have open. One lens, in
depth: **boundaries only**.

`architecture-review:architecture-reviewer` checks which layer each changed file
belongs in, which way its imports point, whether a module reached into a
sibling's internals, whether a service could only be unit-tested against a real
database, and whether the frontend dependency direction still holds. It:

1. runs **your project's own architecture check** first, if it has one
   (dependency-cruiser, eslint-plugin-boundaries, Nx module boundaries,
   import-linter, ArchUnit, deptrac…) — a new violation is CRITICAL, a
   grandfathered one is not reported;
2. derives your project's **layer map** from its docs and check config (falling
   back to the preloaded architecture skills), and shows it in the report;
3. judges only what a dependency graph cannot see, against that map.

If the project has no architecture check, it reviews manually and says so in the
report. It writes nothing, fixes nothing, and leaves security, performance and
correctness to other reviews.

Use it after an implementation and before you open a PR — especially when a
change leans on a boundary.

## Install

```
/plugin marketplace add malinovskiy-alex/dev-digest-ai-marketplace
/plugin install architecture-review@dev-digest-ai
```

Installing it also installs its dependency, `engineering-paved-path`.

## Requirements

- **Plugin dependency:** `engineering-paved-path` `^1.0.0` (installed
  automatically). The agent preloads two of its skills — see below.
- `git` on `PATH` (the change is read with `git status` / `git diff` against the
  merge-base).
- Optional: your project's architecture check and its toolchain installed
  locally. The reviewer never installs anything; if the check cannot run, that
  is reported under *Cannot assess* and the review continues manually.

No environment variables, no `userConfig` options.

## Components

| Type | Name | Model | Description |
|---|---|---|---|
| Agent | `architecture-review:architecture-reviewer` | `sonnet` | Read-only boundary review of the open change. Findings as CRITICAL / WARNING / SUGGESTION with `file:line` and rule name, plus *Not flagged* and *Cannot assess*. |

**Preloaded skills** (frontmatter `skills:`, injected whole at startup):

- `engineering-paved-path:onion-architecture` — backend layering: imports point
  inward, ports at the edges, the decision procedure for where code goes.
- `engineering-paved-path:frontend-ui-architecture` — UI layering: one-way
  layer direction, private route/feature folders, imports through a folder's
  `index`.

Your project's own docs and check config **outrank** these skills wherever they
disagree; the skills fill in where the project is silent.

**Tools:** `Read`, `Glob`, `Grep`, `Bash`, `Skill`, `TodoWrite`. **Notably
absent:** `Write`, `Edit`, `Agent`, `AskUserQuestion`. `Bash` is restricted by
the agent's own rules to read-only use: running the architecture check (never a
baseline-writing or `--fix` variant) and reading git.

## Usage

Ask Claude in plain language, or mention the agent directly:

```
Use the architecture-reviewer on my current changes.
```

```
@agent-architecture-review:architecture-reviewer Review the working tree against
main. The plan is specs/order-refunds.md.
```

| Input | Output |
|---|---|
| The open change (default: working tree incl. untracked files vs the merge-base with the default branch), optionally a base ref, a path list, or a plan path | A report: **Verdict** (`request_changes` / `comment` / `approve`), **0 · Layer map** (with the source of each row), **1 · Machine-checked** (check result + counted baseline, or "No architecture check configured — manual review only"), **2 · Findings** (each with where, rule, ≤6 verbatim lines, why this severity, the fix), **3 · Not flagged, and why**, **4 · Cannot assess**, counts, and *Noticed, not my call* |

The verdict is mechanical: at least one CRITICAL → `request_changes`; only
WARNING / SUGGESTION → `comment`; nothing → `approve`. The report is returned to
the main session only; nothing is written to disk.

## How it fits with the other plugins

- **Depends on [`engineering-paved-path`](../engineering-paved-path/README.md)**
  for its two architecture skills.
- **Used by [`sdd-engineering`](../sdd-engineering/README.md)** —
  `/sdd-engineering:run-plan` spawns it as
  `architecture-review:architecture-reviewer` in the review/fix loop, in
  parallel with `sdd-engineering:plan-verifier`, and merges both reports into
  its findings ledger.
- **Works on its own** — call it directly on any change, with or without a plan.

## Hooks, network calls, telemetry

- **Hooks:** none.
- **Network calls:** none. The agent has no web tools. (Your project's own
  architecture check runs locally; whatever it does is up to that tool.)
- **Telemetry:** none.

## Versioning

See [CHANGELOG.md](CHANGELOG.md). Versions follow SemVer and are released as
`architecture-review--v<version>` tags.

## License

MIT — see [LICENSE](LICENSE). The preloaded skills belong to
`engineering-paved-path` and carry their own attribution there.
