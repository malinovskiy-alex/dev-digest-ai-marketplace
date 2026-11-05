# Verification log

Evidence for the end-of-lab checklist. Each item links to how it was checked. Re-run these checks after any change to the release flow.

Environment: Claude Code 2.1.318, Windows 11, Node 22. Every install test ran with an isolated `CLAUDE_CONFIG_DIR`, so the results do not depend on a developer's own plugins or settings.

## Checklist

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Marketplace lives separately from the source project | ✅ | This repository; plugins are self-contained under `plugins/` |
| 2 | Contribution, security, releases and cost baseline documented | ✅ | [CONTRIBUTING.md](../CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [RELEASES.md](RELEASES.md), [COST.md](COST.md) |
| 3 | Four plugins with their own boundaries, owners and versions | ✅ | One folder per plugin; per-plugin owners in [CODEOWNERS](../.github/CODEOWNERS); `version` in each `plugin.json`, tags `<plugin>--v<version>` |
| 4 | Dependencies resolve without errors | ✅ | [Install into another project](#install-into-another-project) |
| 5 | GitHub Pages shows the current catalog with dependencies and README | ✅ | The site build reads `dependencies` and `README.md` from each plugin; the deployed catalog lists `research-tools` 1.0.1 right after its merge |
| 6 | `architecture-reviewer` has no source-project paths | ✅ | grep for project names, paths and scripts is empty |
| 7 | `sdd-engineering` uses namespaced dependencies | ✅ | `engineering-paved-path:*` skills in agent `skills:`, `/run-plan` spawns `architecture-review:architecture-reviewer` |
| 8 | Validation, behavior evals and negative evals green | ⏳ | Validation green in CI. Evals: not run yet |
| 9 | 1.0.0 installs into another existing project | ✅ | [Install into another project](#install-into-another-project) |
| 10 | Supporting files and scripts are not lost in the plugin cache | ✅ | [Plugin cache contents](#plugin-cache-contents) |
| 11 | Cost experiment with baseline, quality gate and honest result | ⏳ | Method in [COST.md](COST.md); runs pending |
| 12 | Catalog update and plugin update checked separately | ✅ | [Update catalog vs update plugin](#update-catalog-vs-update-plugin) |
| 13 | New 1.1.0 behaviour confirmed by an eval | ⏳ | Pending |
| 14 | Stable channel returns 1.0.0 and a smoke eval passes | ⏳ | Pending |

## Install into another project

Target: a fresh clone of an existing application repository (a monorepo with its own `.claude/` agents and skills), installed at project scope.

```
claude plugin marketplace add malinovskiy-alex/dev-digest-ai-marketplace
claude plugin install sdd-engineering@dev-digest-ai --scope project
```

Result:

```
✔ Successfully installed plugin: sdd-engineering@dev-digest-ai (scope: project)
  (+ 3 dependencies: engineering-paved-path, research-tools, architecture-review)
```

| Plugin | Resolved version | Status |
|---|---|---|
| `sdd-engineering` | 1.0.0 | enabled |
| `architecture-review` | 1.0.0 (tag `architecture-review--v1.0.0`) | enabled |
| `engineering-paved-path` | 1.0.0 (tag `engineering-paved-path--v1.0.0`) | enabled |
| `research-tools` | **1.0.1** (tag `research-tools--v1.0.1`) | enabled |

`research-tools` resolved to 1.0.1, the highest tag that satisfies `^1.0.0`. The project's `.claude/settings.json` received the four `enabledPlugins` entries, and the project's own hooks and agents were left untouched.

## Plugin cache contents

- `sdd-engineering/1.0.0` in the cache holds 48 files, the same count as `plugins/sdd-engineering` in the repository, including `skills/workflow-retro/scripts/session-stats.mjs` and all `evals/`.
- `engineering-paved-path` keeps every `references/` and `rules/` file. The cache had two identical copies, `1.0.0` and `1.0.0-<sha>`, one being the copy resolved from the tag.
- The bundled script runs from the cache: `node <cache>/sdd-engineering/1.0.0/skills/workflow-retro/scripts/session-stats.mjs --help` works. Pointed at a real project's transcripts, it printed per-agent token tables.

## Update catalog vs update plugin

A local clone of this repository served as the marketplace. Its checkout was moved between refs to simulate a release.

| Step | Command | Catalog offers | Installed (`installed_plugins.json`) |
|---|---|---|---|
| 1 | catalog at `research-tools--v1.0.0`, `claude plugin install research-tools@dev-digest-ai` | 1.0.0 | 1.0.0 |
| 2 | catalog moved to `main`, `claude plugin marketplace update dev-digest-ai` | 1.0.1 | **1.0.0**, unchanged |
| 3 | `claude plugin update research-tools@dev-digest-ai` reports `updated from 1.0.0 to 1.0.1` | 1.0.1 | 1.0.1, new cache folder `research-tools/1.0.1` |

Finding: after step 2, `claude plugin list` already prints `Version: 1.0.1`, the catalog version, although the installed copy is still 1.0.0. This is documented in [RELEASES.md](RELEASES.md#updating-users).

## Infrastructure finding: Windows path length

Adding the marketplace failed with `Clone succeeded, but checkout failed` when `CLAUDE_CONFIG_DIR` pointed to a deeply nested folder. The longest path in this repository is 89 characters, which goes over the 260-character Windows limit under a long config path. The default `~/.claude` location is well within the limit. Contributors should keep new plugin paths short; a CI check could enforce this.
