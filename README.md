# dev-digest-ai marketplace

Claude Code plugin marketplace with AI plugins for developer digests.

> Plugins run with your user privileges. Review a plugin's README (hooks, network calls) before installing.

## Install

```
/plugin marketplace add malinovskiy-alex/dev-digest-ai-marketplace
/plugin install <plugin-name>@dev-digest-ai
```

## Update

Auto-update is off by default for third-party marketplaces. Update manually:

```
/plugin marketplace update dev-digest-ai
claude plugin update <plugin-name>@dev-digest-ai
```

Or enable auto-update: `/plugin` → Marketplaces → `dev-digest-ai` → Enable auto-update.

## Plugins

| Plugin | Description | Depends on |
|--------|-------------|------------|
| [sdd-engineering](plugins/sdd-engineering) | Spec Driven Development workflow: requirements → plan → implement → review/verify → retro | engineering-paved-path, research-tools, architecture-review |
| [architecture-review](plugins/architecture-review) | Read-only architecture reviewer agent | engineering-paved-path |
| [research-tools](plugins/research-tools) | Read-only researcher agent with cited evidence | — |
| [engineering-paved-path](plugins/engineering-paved-path) | Shared skills: React, Next.js, Fastify, architecture, testing, security, diagrams | — |

Installing a plugin installs its dependencies too. Start with `sdd-engineering` for the full workflow: see its [README](plugins/sdd-engineering/README.md).

```
sdd-engineering ──► research-tools
       │       └──► architecture-review ──► engineering-paved-path
       └──────────────────────────────────► engineering-paved-path
```

## Structure

```
.claude-plugin/marketplace.json   # marketplace catalog
plugins/<plugin-name>/
  .claude-plugin/plugin.json      # plugin manifest (only file in this folder)
  skills/<skill>/SKILL.md
  agents/  hooks/hooks.json  .mcp.json  scripts/   # optional
  README.md  LICENSE
```

## Local development

```
claude plugin validate . --strict
claude --plugin-dir ./plugins/<plugin-name>      # then /reload-plugins after edits
claude plugin marketplace add ./
claude plugin install <plugin-name>@dev-digest-ai
```

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to add or change a plugin
- [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md) — plugin structure, manifest, dependency requirements
- [docs/SECURITY.md](docs/SECURITY.md) — permissions, secrets policy, script review
- [docs/RELEASES.md](docs/RELEASES.md) — SemVer, tags, updates, rollback
- [docs/COST.md](docs/COST.md) — cost baseline: what we measure, quality gate, experiment protocol
- [docs/VERIFICATION.md](docs/VERIFICATION.md) — evidence that install, dependencies, cache and updates work
- [docs/SDD-PLUGINS-SPEC.md](docs/SDD-PLUGINS-SPEC.md) — design of the SDD plugin family

## Access (private repository)

Claude Code uses your existing git credentials and never prompts. Before adding the marketplace, make sure one of these works:

- SSH: `ssh -T git@github.com` succeeds without a passphrase prompt;
- HTTPS: `gh auth login && gh auth setup-git`, and set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`.

## License

MIT
