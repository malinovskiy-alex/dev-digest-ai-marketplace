# Marketplace research (temporary)

> Temporary notes collected 2026-11-02 while setting up this repo. Delete `docs/temp/` once the marketplace is set up.

Sources:
- Official docs: https://code.claude.com/docs/en/plugins/ — `create-marketplace.md`, `marketplace-reference.md`, `manifest-reference.md`, `create.md`, `install.md`, `host-marketplace.md`, `loading.md`, `org.md`, `cli-reference.md`, `components.md`, `publish.md`
- https://github.com/anthropics/claude-plugins-official
- https://github.com/anthropics/claude-plugins-community/tree/main/.github/actions/validate-plugins
- https://github.com/wshobson/agents
- https://github.com/obra/superpowers-marketplace

---

## Part 1. Official Claude Code documentation

### 1.1 Directory layout

A marketplace is a directory with `.claude-plugin/marketplace.json` plus the plugins it lists. Relative sources resolve from the marketplace root (the folder containing `.claude-plugin/`).

```
my-marketplace/
├── .claude-plugin/
│   └── marketplace.json
└── plugins/
    └── my-first-plugin/
        ├── .claude-plugin/
        │   └── plugin.json
        └── skills/
            └── hello/
                └── SKILL.md
```

Plugin standard layout (everything except the manifest is at the plugin root):

| Component | Default location |
|---|---|
| Manifest | `.claude-plugin/plugin.json` (optional for marketplace plugins) |
| Skills | `skills/<name>/SKILL.md` |
| Commands (legacy) | `commands/*.md` |
| Agents | `agents/` |
| Hooks | `hooks/hooks.json` |
| MCP servers | `.mcp.json` |
| LSP servers | `.lsp.json` |
| Output styles | `output-styles/` |
| Executables on PATH | `bin/` (rejected by claude.ai org sync) |
| Settings | `settings.json` (only `agent`, `subagentStatusLine`) |

- Only `plugin.json` goes inside `.claude-plugin/` — components there don't load.
- `CLAUDE.md` at plugin root is not loaded as context.

### 1.2 marketplace.json

Required: `name`, `owner` (`name` required; `email`, `url` optional), `plugins`.

Optional top-level: `$schema`, `description`, `version`, `metadata.{description,version,pluginRoot}`, `forceRemoveDeletedPlugins`, `allowCrossMarketplaceDependenciesOn`, `renames`.

```json
{
  "name": "my-marketplace",
  "description": "Plugins for my team",
  "owner": { "name": "Your Name" },
  "plugins": [
    {
      "name": "my-first-plugin",
      "source": "./plugins/my-first-plugin",
      "description": "A greeting plugin to learn the basics"
    }
  ]
}
```

Plugin entry fields: `name` (required), `source` (required), `description`, `version`, `category`, `tags`, `strict` (default true), `relevance`, `dependencies`, `defaultEnabled`, `displayName`, `metadata`, `headers`, `headersHelper`; plus any `plugin.json` field.

Unknown keys are ignored at load; `validate` warns.

**Strict mode:** without `plugin.json` the entry is the manifest. With `plugin.json` and `strict: true`, entry components are appended. With `strict: false` and components in both → load error "conflicting manifests".

**Source types:**

| Type | Shape |
|---|---|
| relative | `"./plugins/x"` — must start with `./`, no `..`; not usable with url-hosted marketplaces |
| github | `{"source":"github","repo":"org/repo","ref":"v2.0.0","sha":"<40 hex>"}` |
| url | `{"source":"url","url":"https://.../x.git","ref":"main"}` |
| git-subdir | `{"source":"git-subdir","url":"...","path":"tools/x"}` |
| npm | `{"source":"npm","package":"@org/x","version":"^2.0.0","registry":"https://..."}` |
| archive | `{"source":"archive","url":"https://.../x.zip","sha256":"..."}` |
| command | `{"source":"command","command":"my-tool path","timeout":120}` |

If both `ref` and `sha` are set, `sha` wins.

**Reserved marketplace names** (examples): `claude-plugins-official`, `claude-code-plugins`, `claude-code-marketplace`, `anthropic-*` official names, `claude-community`, `npm`, `github`, names starting with `claudeai-`, impersonations like `official-claude-plugins`.

**Reserved plugin names:** starting with `claude-`, `anthropic-`, `anthropics-`, `cc-plugin-` (error); `claude`, `claude-code`, etc. (error); "claude" as a whole word elsewhere (warning).

### 1.3 plugin.json

Only `name` is required (kebab-case, no spaces/`@`/`:`/slashes).

Fields: `$schema`, `name`, `displayName`, `version`, `description`, `author{name,email,url}`, `homepage` (must parse as URL), `repository`, `license` (SPDX), `keywords`, `metadata`, `defaultEnabled`, `dependencies`, `settings`, `userConfig`, `skills` (adds), `commands` (replaces), `agents` (replaces), `hooks` (merges), `mcpServers` (merges), `lspServers` (merges), `outputStyles` (replaces), `workflows` (replaces), `experimental`.

- Component paths must start with `./` and stay inside the plugin root.
- `${CLAUDE_PLUGIN_ROOT}` — installed version path, changes on update, don't write state there.
- `${CLAUDE_PLUGIN_DATA}` — `~/.claude/plugins/data/<id>/`, persists across updates.
- `${CLAUDE_PROJECT_DIR}`, `${user_config.KEY}`, `CLAUDE_PLUGIN_OPTION_<KEY>`.
- Hook shell form: `"command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/process.sh"`; exec form with `args` needs no quoting.

### 1.4 Add / install / update / team config

```
/plugin marketplace add owner/repo            # or URL, ./path, owner/repo#ref
/plugin install name@marketplace
claude plugin marketplace add <src> --scope user|project|local
claude plugin install name@marketplace --scope project
/plugin marketplace update <name>
claude plugin update name@marketplace
```

- Install id is `<entry name>@<marketplace name>` (from marketplace.json, not the repo name).
- Auto-update is ON for official marketplaces and OFF for third-party ones.
- Team config in `.claude/settings.json`: `extraKnownMarketplaces` + `enabledPlugins` (`"plugin@marketplace": true`). Applies after workspace trust. Plugins with external sources are not auto-installed from project settings; relative-path ones are.

**Private repos:** no token field. Claude Code uses existing git credentials non-interactively: SSH (key without passphrase prompt) or HTTPS via credential helper (`gh auth login && gh auth setup-git`). `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` skips the SSH probe. A `GITHUB_TOKEN` env var alone does not authenticate.

### 1.5 Validation and local testing

```
claude plugin validate <path> [--strict] [--json]   # exit 0 ok, 1 fail, 2 error
claude plugin marketplace add ./my-marketplace
claude plugin install my-first-plugin@my-marketplace
claude --plugin-dir ./my-plugin                      # dev mode, then /reload-plugins
```

`validate` does NOT catch: reserved marketplace name, non-existent relative source dir, wrong github repo, entry hooks as file path.

### 1.6 Gotchas

- Versioning: `plugin.json` version → entry version → source SHA. Users get updates only when the resolved version changes. Don't set version in both places.
- Only the plugin dir is copied to cache — `../shared` breaks. Symlinks inside the marketplace are dereferenced; outside are skipped.
- Entry `name` must match `plugin.json` `name`.
- Renaming breaks installs — use `renames`. Deleted plugins stay installed unless `forceRemoveDeletedPlugins: true`.
- No Git LFS (pointer files). Submodules fetched only if they contain plugin files.
- Old cache versions removed 14 days after update.

---

## Part 2. Best practices from the community

### 2.1 Repo structure
- **Monorepo** (`wshobson/agents`): all plugins in `./plugins/<name>`, `CONTRIBUTING.md`, `Makefile` with `validate`, dependabot.
- **Catalog-only** (`obra/superpowers-marketplace`): each entry `{"source":"url","url":"https://github.com/obra/<x>.git"}`; per-plugin issues and release cadence.
- **Hybrid** (`claude-plugins-official`): `plugins/` (vendored), `external_plugins/` (pinned by `sha`), LICENSE + README per plugin.
- Avoid top-level `bin/` in plugins (use `scripts/` + `${CLAUDE_PLUGIN_ROOT}`).

### 2.2 Naming
- Plugin names are permanent; use `displayName` for labels; `renames` for unavoidable changes.
- Anthropic CI regex: `^[a-z0-9][a-z0-9-]{1,63}$`; no hidden Unicode.

### 2.3 Versioning
- Either bump `version` on every release, or omit it everywhere (every commit = release).
- Enforce version bump in CI when `plugins/<name>/` changes (wshobson `make check-version-bumps`).
- `claude plugin tag [path] --push` creates `<name>--v<version>`.
- Release channels = two marketplaces with different names and refs.
- Known stale-cache bug reports (#36938, #76882, #32983): bump version, `marketplace update`, or delete cache.

### 2.4 CI
- Run `validate` on the marketplace AND on each plugin dir (marketplace validation doesn't check skill/agent/hook files).
- Reusable action: `anthropics/claude-plugins-community/.github/actions/validate-plugins@<SHA>` (invariants: sorted/unique names, description 10–2000 chars, https sources, required sha, no hidden Unicode).
- Official workflows: frontmatter validation, LICENSE per plugin, MCP URL liveness, Claude-based policy scan, workflow hardening.
- Pin actions and CLI version; `permissions: contents: read`.
- Required checks with path filters can hang PRs at "Expected – waiting" — run on every PR, skip inside steps.
- `$schema`: `https://json.schemastore.org/claude-code-marketplace.json` (community-maintained, may lag).

### 2.5 Components
- Prefer skills over commands. Skill = guidance; hook = must-always-happen rule.
- Keep plugins small; use `dependencies`.
- Document namespaced names: `/plugin:skill`, `mcp__plugin_<plugin>_<server>__<tool>`.

### 2.6 Hooks and Windows
- Hooks fire as soon as the plugin is enabled — narrow matchers, project-relevance gate.
- Official review fails plugins with undisclosed outbound calls, description/behaviour mismatch, credential exfiltration.
- Windows: bash often not on PATH → hooks fail silently; prefer Node or `"shell": "powershell"`.
- `.gitattributes` with `*.sh text eol=lf` (community advice).

### 2.7 Secrets and MCP
- `userConfig` with `"sensitive": true` → keychain; or `${VAR}` / `${VAR:-default}`.
- `validate` (v2.1.281+) warns on literal-looking credentials and `http://` non-local URLs.
- Prefer remote `https://` MCP servers.
- Node deps auto-install only with lockfile, `--ignore-scripts`.

### 2.8 Docs and governance
- LICENSE at root and per plugin; `license` field in `plugin.json`.
- README: trust warning, install/update commands, structure; per-plugin disclosure of hooks/network/telemetry.
- CONTRIBUTING (wshobson model): mandatory version bump, disclose external services.
- CODEOWNERS: no sourced convention; suggested for `marketplace.json`, hooks, `.mcp.json`, workflows.

### 2.9 Security
- No plugin signing (feature request #29729 closed). Pin `sha` / `sha256`.
- Re-review on every SHA bump.
- Watch for skills hijacking package installs, coercive skill text, prompt injection in READMEs.
- Org controls: `strictKnownMarketplaces`, `blockedMarketplaces`, managed `enabledPlugins`, `allowManagedHooksOnly`.
