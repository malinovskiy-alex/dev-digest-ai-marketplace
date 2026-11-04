# Plugin Guidelines

Requirements every plugin in this marketplace must meet. CI enforces part of this via `claude plugin validate --strict`; the rest is checked in review.

## 1. Structure

```
plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json          # manifest — the ONLY file in this folder
├── skills/<skill>/SKILL.md  # preferred way to add capabilities
├── agents/<agent>.md        # optional: subagents
├── hooks/hooks.json         # optional: see docs/SECURITY.md
├── .mcp.json                # optional: MCP servers
├── scripts/                 # optional: scripts used by hooks/MCP (not bin/)
├── README.md                # required
└── LICENSE                  # required
```

- Components placed inside `.claude-plugin/` do **not** load.
- `commands/` is the legacy format — write new capabilities as skills.
- `CLAUDE.md` in a plugin is **not** loaded as context — put instructions into a skill.
- Only the plugin folder is copied on install (`~/.claude/plugins/cache/...`). Never reference `../` or files elsewhere in the repo.
- No Git LFS files (they install as pointer files).
- Keep plugins small and focused; one plugin = one job. Combine plugins via `dependencies` instead of bundling.

## 2. Naming

- Plugin name: kebab-case, `^[a-z0-9][a-z0-9-]{1,63}$`.
- Must not start with `claude-`, `anthropic-`, `cc-plugin-`, and must not be `claude`, `claude-code`, etc. (reserved).
- **A plugin name is permanent** — renaming breaks every install. Use `displayName` for cosmetic changes; if a rename is unavoidable, add it to `renames` in `marketplace.json`.
- Skills/agents are namespaced: `/<plugin>:<skill>`, `<plugin>:<agent>`. Use the namespaced form in docs.

## 3. Manifest (`plugin.json`)

Required fields in this marketplace:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What it does, in one sentence (10–2000 chars)",
  "author": { "name": "Your Name" },
  "license": "MIT",
  "keywords": ["..."]
}
```

- `name` must equal the entry `name` in `.claude-plugin/marketplace.json`.
- `version` lives **only** here — never in the marketplace entry. See [RELEASES.md](RELEASES.md).
- Custom component paths must start with `./` and stay inside the plugin folder.
- Reference plugin files with `${CLAUDE_PLUGIN_ROOT}` (changes on every update — read-only).
- Persistent state goes to `${CLAUDE_PLUGIN_DATA}` (survives updates).

## 4. Marketplace entry

```json
{
  "name": "my-plugin",
  "source": "./plugins/my-plugin",
  "description": "Same description as plugin.json",
  "category": "productivity",
  "tags": ["..."]
}
```

- `source` must start with `./`, use forward slashes, no `..`.
- Keep `plugins` sorted by name; no duplicates.

## 5. Dependencies

- Declare plugin dependencies in `plugin.json` → `dependencies`: `"other-plugin"` (same marketplace) or `"name@marketplace"`.
- Cross-marketplace dependencies must be allow-listed in `allowCrossMarketplaceDependenciesOn` in `marketplace.json`.
- Dependencies on semver ranges require release tags (see [RELEASES.md](RELEASES.md)).
- Node.js dependencies: ship `package.json` **with a lockfile** (npm or bun). Install scripts never run. Anything else must be installed into `${CLAUDE_PLUGIN_DATA}` from a `SessionStart` hook.
- External tools (CLIs, runtimes) the plugin needs must be listed in the plugin README under "Requirements".

## 6. Plugin README

Must contain:

1. What the plugin does.
2. Install command: `/plugin install <name>@dev-digest-ai`.
3. Requirements (tools, env vars, `userConfig` options).
4. Components table with namespaced names.
5. **Hooks, network calls, telemetry** — explicit list, or "None".

## 7. Cross-platform

- Paths in manifests: forward slashes only.
- `bash` is often not on PATH on Windows — prefer Node scripts, or provide `"shell": "powershell"` variants.
- Quote plugin root in shell-form commands: `"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/x.sh"`, or use exec form with `args`.
- `.sh` files use LF (enforced by `.gitattributes`).

## 8. Checklist before PR

```
claude plugin validate . --strict
claude plugin validate plugins/<plugin-name> --strict
claude --plugin-dir ./plugins/<plugin-name>     # manual test
```
