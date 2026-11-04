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

| Plugin | Description |
|--------|-------------|
| [example-plugin](plugins/example-plugin) | Summarizes text into a short developer digest |

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

## Access (private repository)

Claude Code uses your existing git credentials and never prompts. Before adding the marketplace, make sure one of these works:

- SSH: `ssh -T git@github.com` succeeds without a passphrase prompt;
- HTTPS: `gh auth login && gh auth setup-git`, and set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`.

## License

MIT
