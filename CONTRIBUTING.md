# Contributing

Read first: [Plugin Guidelines](docs/PLUGIN-GUIDELINES.md) · [Security](docs/SECURITY.md) · [Releases](docs/RELEASES.md).

## Adding a plugin

1. Create `plugins/<plugin-name>/` (kebab-case; must not start with `claude-` or `anthropic-`).
2. Add `.claude-plugin/plugin.json` with `name`, `version`, `description`, `author`, `license`.
   Only `plugin.json` goes inside `.claude-plugin/` — components placed there do not load.
3. Add components at the plugin root: prefer `skills/<name>/SKILL.md` over `commands/`.
4. Add `README.md` (what it does, namespaced commands, hooks / network calls) and `LICENSE`.
5. Add an entry to `.claude-plugin/marketplace.json`:
   - `name` must equal `name` in `plugin.json`;
   - `source` must start with `./`;
   - do **not** set `version` here — it lives only in `plugin.json`.
6. Run `claude plugin validate . --strict` and `claude plugin validate plugins/<plugin-name> --strict`.

## Rules

- **Bump `version` in `plugin.json` on every change to a plugin** — otherwise users will not receive the update.
- Never rename a plugin; use `displayName` for cosmetic changes, or add the old name to `renames` in `marketplace.json`.
- Do not reference files outside the plugin folder (`../`) — only the plugin folder is copied on install.
- Reference plugin files via `${CLAUDE_PLUGIN_ROOT}`; store persistent state in `${CLAUDE_PLUGIN_DATA}`.
- No hardcoded secrets. Use `userConfig` with `"sensitive": true` or environment variables.
- Hooks: use narrow matchers and gate them on project relevance; prefer Node or PowerShell-compatible scripts (bash is often missing on Windows). Disclose every hook and outbound network call in the plugin README.
- Shell scripts must use LF line endings (enforced by `.gitattributes`).
