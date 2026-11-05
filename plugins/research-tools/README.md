# research-tools

A read-only research subagent that looks things up and proves them, instead of
answering from memory.

`research-tools:researcher` does two jobs:

- **Repo research** — answers a concrete question about the current codebase
  from its files, tests, config, lockfiles and git history (*"where is X
  handled?"*, *"why does Y behave this way?"*, *"when did Z change?"*).
- **External research** — answers a concrete question from official docs,
  specs, RFCs, changelogs, release notes and upstream source, pinned to the
  version your project actually uses (*"what do the docs actually say?"*,
  *"which version introduced this option?"*).

Every answer comes back as a structured report: findings with verbatim evidence
(`file:line` or a quoted, linked source), confidence per finding, where it
looked, and an explicit **Could not establish** section that turns gaps into
known gaps. It never edits anything.

Use it when a fact has to be looked up and cited — before writing a spec or a
plan, when a review hinges on what a library really does, or when you want a
long investigation kept out of your main session.

## Why a subagent

A subagent starts with an **empty context window**. It does not see your
conversation, the files the main session already read, or the skills it loaded.
That cuts both ways:

- **The win** — a long investigation does not bloat the main session. Dozens of
  greps, file reads and web pages stay inside the researcher; only the final
  report comes back.
- **The cost** — nothing can be handed over by being mentioned. Give the
  researcher **one concrete question**, and pass anything it needs as a path
  (a spec, a plan, a file) rather than a retold summary. State passes as files.

If the question is vague (*"look into caching"*), the researcher asks up to
three clarifying questions with concrete options before it starts.

## Install

```
/plugin marketplace add malinovskiy-alex/dev-digest-ai-marketplace
/plugin install research-tools@dev-digest-ai
```

## Requirements

- `git` on `PATH` for history questions (`git log`, `git blame`, `git show`).
- Web access for external research (`WebSearch`, `WebFetch` must be allowed in
  your Claude Code setup). Without it, repo research still works and the
  external part lands in *Could not establish*.

No environment variables, no `userConfig` options.

## Components

| Type | Name | Model | Description |
|---|---|---|---|
| Agent | `research-tools:researcher` | `sonnet` | Read-only repo and external research. Returns Report A (repo) and/or Report B (external) with evidence, sources and a *Could not establish* section. |

**Tools:** `Read`, `Glob`, `Grep`, `Bash`, `WebSearch`, `WebFetch`,
`AskUserQuestion`, `TodoWrite`. **Notably absent:** `Write`, `Edit` (read-only
by construction) and `Agent` (it never spawns helpers). `Bash` is restricted by
the agent's own rules to read-only commands such as `git log`, `git blame`,
`git show`, `git diff`, `ls`, `cat`; it never installs, checks out, stashes or
writes files.

## Usage

Ask Claude in plain language, or mention the agent directly:

```
Use the researcher to find where order totals are recalculated and why the
discount is applied twice.
```

```
@agent-research-tools:researcher Which Fastify version do we use, and what do
its docs say about the order of onRequest and preHandler hooks?
```

| Input | Output |
|---|---|
| A concrete question about this repo | **Report A** — Question, Scope, Answer, Findings (`file:line` + ≤6 verbatim lines + confidence), Where I looked, Could not establish, Next steps |
| A concrete question about a library, spec or service | **Report B** — Question, Scope, Answer with `[n]` markers, Findings (source section + quote + version it applies to), Sources table with retrieval dates, Conflicting or weak sources, Could not establish |
| A question that needs both (*"does our setup match what the docs recommend?"*) | Both reports plus a `## Cross-check` section listing every disagreement between the repo and the source |

The report is returned to the main session only; nothing is written to disk. If
a follow-up needs a file changed, the report says so under *Next steps* and the
main session (or you) does it.

## How it fits with the other plugins

- **Used by [`sdd-engineering`](../sdd-engineering/README.md)** — the
  spec-driven workflow declares `research-tools` as a dependency, and the main
  session calls `research-tools:researcher` for facts before
  `sdd-engineering:spec-creator` or `sdd-engineering:implementation-planner`
  write requirements or a plan. Those agents have no web tools and no `Bash`;
  external facts and git history come from the researcher.
- **Works standalone.** It has no dependencies of its own; install it on its own
  for any research question.

## Hooks, network calls, telemetry

- **Hooks:** none.
- **Network calls:** only through Claude Code's built-in `WebSearch` and
  `WebFetch` tools, and only for external research questions. The plugin ships
  no scripts and contacts nothing on its own.
- **Telemetry:** none.

## Updating

Auto-update is off by default for third-party marketplaces. Update by hand:

```
/plugin marketplace update dev-digest-ai
/plugin update research-tools@dev-digest-ai
```

Or turn on auto-update once: `/plugin` → **Marketplaces** → `dev-digest-ai` →
**Enable auto-update**. Claude Code then checks for new versions at startup.
After an update inside a running session, run `/reload-plugins`.

## Versioning

See [CHANGELOG.md](CHANGELOG.md). Versions follow SemVer and are released as
`research-tools--v<version>` tags.

## License

MIT — see [LICENSE](LICENSE).
