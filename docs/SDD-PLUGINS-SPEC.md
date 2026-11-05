# Spec: SDD Engineering plugins

| | |
|---|---|
| Status | Approved, in implementation |
| Author | Oleksandr Malinovskyi |
| Date | 2026-11-04 |
| Course | GoIT, "Steps 1–5" (repository marketplace → components → dependency graph → packaging → registration) |
| Source repo | [malinovskiy-alex/dev-digest](https://github.com/malinovskiy-alex/dev-digest), `.claude/agents/` and `.claude/skills/` |

## 1. Goal

Port the Spec Driven Development workflow from `dev-digest` into the `dev-digest-ai` marketplace as four plugins:

- three **reusable dependency plugins** that are useful on their own;
- one **workflow plugin**, `sdd-engineering`, that composes them: requirements → plan → implement → review/verify → retro.

**Not carried over** (course, step 2): product specs (`specs/*.md` of DevDigest), secrets, caches (`.devdigest/cache/`), DevDigest-specific instructions (rings of this repo, `pnpm arch`, `server/` / `client/` paths, `AGENTS.md` / `INSIGHTS.md` references).

## 2. Plugins and dependency graph

```
                        ┌────────────────────────────┐
                        │      sdd-engineering       │
                        │ 4 agents · 2 skills · evals│
                        └──┬───────────┬──────────┬──┘
                  ^1.0.0   │    ^1.0.0 │   ^1.0.0 │
                           │           ▼          ▼
                           │   research-tools   architecture-review
                           │   (researcher)     (architecture-reviewer)
                           │                          │ ^1.0.0
                           ▼                          │
                  engineering-paved-path ◄────────────┘
                  (8 shared skills)
```

Dependency edges (plugin → what it needs):

| Plugin | Depends on | Why |
|---|---|---|
| `architecture-review` | `engineering-paved-path` ^1.0.0 | `architecture-reviewer` preloads `onion-architecture` and `frontend-ui-architecture` |
| `sdd-engineering` | `engineering-paved-path`, `research-tools`, `architecture-review` ^1.0.0 | its agents preload paved-path skills; `/run-plan` spawns `architecture-reviewer`; the main session calls `researcher` |
| `research-tools` | — | the researcher preloads no skills |
| `engineering-paved-path` | — | leaf: skills only |

| Plugin | Kind | Provides | Depends on |
|---|---|---|---|
| `engineering-paved-path` | dependency | React, Next.js, Fastify, architecture, testing, security skills (§3) | — |
| `research-tools` | dependency | Agent `researcher` (read-only) | — |
| `architecture-review` | dependency | Agent `architecture-reviewer` (generalized, project-agnostic) | `engineering-paved-path` ^1.0.0 |
| `sdd-engineering` | workflow | Agents `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`; skills `run-plan`, `workflow-retro`; evals | all three, range `^1.0.0` |

`engineering-paved-path` and `research-tools` have no dependencies. `architecture-review` pulls in `engineering-paved-path` automatically, so each plugin still installs alone with one command. All four start at `1.0.0` so the `^1.0.0` ranges resolve on the first release.

## 3. Shared skills

Every skill used by more than one agent, or useful outside SDD, goes to **`engineering-paved-path`**. Other plugins reference them by namespace: `engineering-paved-path:<skill>`.

| Skill (`engineering-paved-path:…`) | Source in `dev-digest` | Preloaded / used by |
|---|---|---|
| `onion-architecture` | `.claude/skills/onion-architecture` | implementation-planner, implementer, architecture-reviewer |
| `frontend-ui-architecture` | `.claude/skills/frontend-ui-architecture` | implementation-planner, implementer, architecture-reviewer |
| `react-best-practices` | `.claude/skills/react-best-practices` | implementer (loaded per path) |
| `next-best-practices` | `.claude/skills/next-best-practices` | implementer |
| `fastify-best-practices` | `.claude/skills/fastify-best-practices` | implementer |
| `react-testing-library` | `.claude/skills/react-testing-library` | implementer |
| `security` | `.claude/skills/security` | implementer, plan reviews |
| `mermaid-diagram` | `.claude/skills/mermaid-diagram` | spec-creator |

\* `architecture-review` declares `engineering-paved-path` as a dependency, so `architecture-reviewer` preloads both architecture skills via `skills:` in its frontmatter.

Skills that only make sense inside the pipeline (`run-plan`, `workflow-retro`) stay in `sdd-engineering`.

**Out of scope for this release** (exist in `dev-digest`, not in the course list): `drizzle-orm-patterns`, `postgresql-table-design`, `zod`, `typescript-expert`, `engineering-insights`, `pr-self-review`, agents `test-writer`, `doc-writer`. They can be added later as MINOR releases.

## 4. Components

### 4.1 `research-tools`

| Component | Description |
|---|---|
| `research-tools:researcher` | Read-only. (1) Repo research: answers a concrete question from files, tests and git history. (2) External research: answers from docs, specs, changelogs on the web. Returns findings with evidence and links, plus what it could not establish. Tools: `Read`, `Glob`, `Grep`, `Bash` (read-only git), `WebSearch`, `WebFetch`, `AskUserQuestion`, `TodoWrite`. |

### 4.2 `architecture-review`

| Component | Description |
|---|---|
| `architecture-review:architecture-reviewer` | Read-only review of the open change, **boundaries only**: which layer a file belongs to, imports pointing outward, modules reaching into siblings, code that can only be tested with a real DB. Findings as `CRITICAL / WARNING / SUGGESTION` with `file:line` and rule name, plus a "not flagged and why" list. Runs the project's architecture check **if the user's project has one** (input, not hardcoded `pnpm arch`). Does not review security, performance or correctness. |

Generalization work: remove DevDigest rings, `client/` rules, `specs/onion-debt.md`, links to `docs/agent-prompts/*` and `pr-self-review` references; inline the severity map and "do not flag" list that it currently reads from `pr-self-review`.

### 4.3 `sdd-engineering`

| Component | Kind | Input → Output |
|---|---|---|
| `sdd-engineering:spec-creator` | agent | Feature request (+ designs) → `specs/<slug>.requirements.md`: EARS requirements with IDs, blocking questions asked first, other gaps listed for the user. Never a plan, never code. |
| `sdd-engineering:implementation-planner` | agent | `<slug>.requirements.md` → `specs/<slug>.md`: checks requirements against the code, asks about ambiguities, asks single- vs multi-agent execution, names skills the implementer loads, verification command per step, constraints, `Done when`. |
| `sdd-engineering:implementer` | agent | Approved `specs/<slug>.md` → code + the plan's tests. Loads stack skills per path, runs the project's typecheck/test commands, compares failures against a baseline, records `## Deviations`. Never commits or pushes. |
| `sdd-engineering:plan-verifier` | agent | Plan + finished code → one verdict per plan item (`done` / `partial` / `not implemented` / `contradicted` / `cannot verify`) with `file:line`. Gaps only, no style advice. Writes nothing. |
| `/sdd-engineering:run-plan` | skill (user-invoked) | `<plan.md \| slug> [--from implement\|review] [--max-fix N]` → orchestrates the chain (§5), keeps one findings ledger, resumable. Never commits/pushes/opens a PR. |
| `/sdd-engineering:workflow-retro` | skill | `[slug] [session-id \| latest]` → `specs/<slug>.retro.md`: numbers from `scripts/session-stats.mjs` (tokens per agent, cache hits, parallelism, tool errors) + evidence-based judgement. Proposes, never applies, changes. |
| `evals/` | evals | New: cases for each agent and skill (none exist in `dev-digest`). |

## 5. How it works together

```
 user ──► spec-creator ──► <slug>.requirements.md
                                   │       (researcher on demand)
                                   ▼
                        implementation-planner ──► <slug>.md  ──► user approves
                                                                     │
  /run-plan <slug> ◄──────────────────────────────────────────────────┘
     1. implementer          → code + tests
     2. review/fix loop      → architecture-reviewer + plan-verifier (parallel)
                               → implementer fixes blocking findings
                               → repeat until nothing blocking or --max-fix reached
     3. report               → ledger of findings and statuses
                                   │
  /workflow-retro <slug> ──► <slug>.retro.md
```

1. **Requirements.** `spec-creator` writes the requirements spec. Blocking questions are answered before planning.
2. **Plan.** `implementation-planner` writes the plan. The main session may call `researcher` for facts first.
3. **Approve.** The user approves the plan. `run-plan` starts only from an existing, approved plan.
4. **Run.** `run-plan` runs in the main session and spawns `implementer`, `architecture-reviewer`, `plan-verifier`, passing files **by path**.
5. **Retro.** `workflow-retro` measures and judges the finished run.

**Constraint:** subagents cannot start other subagents. All orchestration happens in the main session or in `run-plan`; agents never call each other.

## 6. Packaging rules (course, step 4)

- **No project-specific content in any agent or skill.** The plugins are public and work in any repository. Forbidden: project names, its package names and folder layout as fixed facts, its scripts (`verify.mjs`, `pnpm arch`), lesson IDs, `.claude/agents/` or `.claude/skills/` paths, stories from specific runs. Examples use neutral paths (`apps/api/src/modules/orders/…`, `@acme/shared`).
- **Every path is an explicit input.** Specs, plans and retros go to `<specs-dir>` (default `specs/` in the user's project). Run state goes to `.sdd/<slug>/` in the user's project (`baseline.md`, `findings.md`); retros without a spec to `.sdd/retro/`. Users add `.sdd/` to `.gitignore`.
- **Verification commands are discovered, not hardcoded.** The planner reads the project's own scripts (package.json, Makefile, CI) and writes them into the plan's `Verification` section; the implementer and plan-verifier run exactly those.
- **Namespaced references everywhere:**
  - agent frontmatter: `skills: [engineering-paved-path:onion-architecture, engineering-paved-path:frontend-ui-architecture]`;
  - `run-plan` spawns `sdd-engineering:implementer`, `architecture-review:architecture-reviewer`, `sdd-engineering:plan-verifier` instead of "agents in `.claude/agents/`".
- **Supporting scripts via `${CLAUDE_SKILL_DIR}`**: `node "${CLAUDE_SKILL_DIR}/scripts/session-stats.mjs"`, never `.claude/skills/workflow-retro/scripts/…`. It must find session transcripts without assuming the `dev-digest` project path.
- Scripts are Node, not bash (Windows, see [PLUGIN-GUIDELINES.md](PLUGIN-GUIDELINES.md) §7).
- `run-plan`: remove `--from pr`, `--test-writer`, `--docs` and the `/pr-self-review` step (those components are out of scope, §3). The implementer writes the plan's tests.
- `architecture-reviewer`: the severity map and "do not flag" rules it read from `pr-self-review` are inlined into the agent.
- No hooks, no MCP servers. Network: only `researcher` (`WebSearch`, `WebFetch`).
- Keep `model:` from the source (`opus` for spec-creator/planner/implementer, `sonnet` for reviewers/researcher).

## 7. Repository layout

```
plugins/
├── engineering-paved-path/
│   ├── .claude-plugin/plugin.json
│   ├── skills/<8 skills from §3>/SKILL.md (+ references/, rules/, examples.md as in source)
│   └── README.md · CHANGELOG.md · LICENSE · NOTICE (third-party skill attributions)
├── research-tools/
│   ├── .claude-plugin/plugin.json
│   ├── agents/researcher.md
│   └── README.md · CHANGELOG.md · LICENSE
├── architecture-review/
│   ├── .claude-plugin/plugin.json          # depends on engineering-paved-path
│   ├── agents/architecture-reviewer.md
│   └── README.md · CHANGELOG.md · LICENSE
└── sdd-engineering/
    ├── .claude-plugin/plugin.json          # declares 3 dependencies
    ├── agents/{spec-creator,implementation-planner,implementer,plan-verifier}.md
    ├── skills/run-plan/SKILL.md
    ├── skills/workflow-retro/{SKILL.md,scripts/session-stats.mjs}
    ├── evals/
    ├── README.md                           # the whole workflow (§5) with a worked example
    ├── CHANGELOG.md                        # release history
    └── LICENSE
```

`sdd-engineering/.claude-plugin/plugin.json`:

```json
{
  "name": "sdd-engineering",
  "version": "1.0.0",
  "description": "Spec Driven Development workflow: requirements, plan, implement, review, retro",
  "author": { "name": "Oleksandr Malinovskyi", "url": "https://github.com/malinovskiy-alex" },
  "repository": "https://github.com/malinovskiy-alex/dev-digest-ai-marketplace",
  "license": "MIT",
  "keywords": ["sdd", "spec", "planning", "workflow"],
  "dependencies": [
    { "name": "engineering-paved-path", "version": "^1.0.0" },
    { "name": "research-tools", "version": "^1.0.0" },
    { "name": "architecture-review", "version": "^1.0.0" }
  ]
}
```

## 8. Registration and release (course, step 5)

- Four entries in `.claude-plugin/marketplace.json`, sorted by name, `source: ./plugins/<name>`, no `version`.
- Each plugin has its own `name`, `version`, `author`, `source`.
- `CHANGELOG.md` per plugin, first entry `## [1.0.0] - <date>` via `scripts/release.mjs`.
- After merge, `release.yml` tags `architecture-review--v1.0.0`, `engineering-paved-path--v1.0.0`, `research-tools--v1.0.0`, `sdd-engineering--v1.0.0`. The `^1.0.0` ranges resolve against these tags, so dependencies must be tagged no later than `sdd-engineering` (one merge is fine).
- `sdd-engineering/README.md` follows [PLUGIN-GUIDELINES.md](PLUGIN-GUIDELINES.md) §6 and also documents the pipeline, inputs/outputs of each step and file naming.
- Verify locally: `claude plugin validate . --strict`, then install `sdd-engineering` from a local marketplace and check that all three dependencies are installed with it.

## 9. Open questions

1. **Third-party skill licenses.** `fastify-best-practices` (has `tile.json`), `next-best-practices`, `react-best-practices`, `react-testing-library` look imported from other authors. The repo is public: confirm each license and record attribution in `NOTICE`, or drop the skill.
2. **`example-plugin`.** Keep it as a sample or remove it now that the real plugins have landed?

Resolved: `mermaid-diagram` goes to `engineering-paved-path`; evals use `evals/<case>/prompt.md` + `graders/*.md` (`claude plugin eval`); running `/run-plan` on a plan counts as approving it, as in the source.
