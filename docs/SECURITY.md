# Security Policy

Plugins run with the **full privileges of the user** who installs them. Claude Code has no plugin signing; the only integrity controls are this repository's review process and pinning (see [RELEASES.md](RELEASES.md)).

## 1. Permissions

- **Least privilege.** A plugin requests only what its job needs.
- **Agents:** restrict `tools` in agent frontmatter to what the agent uses. `permissionMode`, `hooks` and `mcpServers` in plugin agent frontmatter are ignored — don't rely on them.
- **Skills:** use `allowed-tools` to limit tools where possible. Skills must not instruct Claude to bypass permission prompts, install packages, or "always run first".
- **Hooks** fire on every matching event as soon as the plugin is enabled — not only when its skill is used:
  - use the narrowest `matcher` possible;
  - `UserPromptSubmit`, `PreToolUse`, `PostToolUse` hooks must be gated on project relevance (e.g. exit early unless a specific config file exists);
  - hooks must be fast and must not block on network;
  - every hook must be listed in the plugin README.
- **Network:** any outbound call to a host other than the plugin's declared MCP server must be disclosed in the README and have an opt-out.
- **MCP servers:** prefer `https://` remote servers; never `http://` to non-local hosts.

## 2. Secrets policy

- **Never commit secrets** — no tokens, keys, passwords, internal URLs with credentials, in any file (including examples and tests).
- Plugins get secrets from:
  - `userConfig` with `"sensitive": true` (stored in OS keychain), referenced as `${user_config.KEY}` in MCP `env`/`headers` or `CLAUDE_PLUGIN_OPTION_<KEY>` in hooks;
  - or environment variables: `${VAR}` / `${VAR:-default}`.
- A plugin must never read a credential and send it to a different service than the one it belongs to.
- Secrets must not be logged or written to `${CLAUDE_PLUGIN_DATA}` in plain text.
- If a secret is committed: revoke/rotate it **immediately**, then remove it from history. Removing the commit alone is not enough.

## 3. Script review

Every PR that adds or changes executable content (`hooks/`, `scripts/`, `.mcp.json`, `package.json`, anything run by a hook or MCP server) requires review by a CODEOWNER.

Reviewer checklist:

- [ ] Read **every** file in the plugin folder, including dotfiles and `tests/`.
- [ ] Behaviour matches the plugin description and README.
- [ ] No `curl | sh`, `eval` of remote content, downloads of executables at runtime.
- [ ] No writes outside `${CLAUDE_PLUGIN_DATA}`, the project dir (when that is the plugin's job) or temp dirs.
- [ ] No reading of `~/.ssh`, `~/.aws`, browser profiles, `.env` files, or other credentials unless that is the documented purpose.
- [ ] No obfuscated code, minified bundles without source, or hidden Unicode characters.
- [ ] Hooks have narrow matchers and relevance gates.
- [ ] Network destinations are disclosed.
- [ ] Node dependencies are locked (lockfile present) and come from the public registry.
- [ ] Shell variables quoted; no injection from user/tool input into shell commands.

## 4. Third-party (external) plugins

- External entries (`github`, `url`, `git-subdir`) **must pin a full 40-char `sha`**.
- Every SHA bump is a new review — "reviewed once" does not cover future commits.
- Prefer vendoring small third-party plugins into `plugins/` over referencing a moving upstream.

## 5. Reporting a vulnerability

Do not open a public issue. Contact the repository owner via GitHub (private vulnerability reporting / direct message). The affected plugin is removed from `marketplace.json` or rolled back (see [RELEASES.md](RELEASES.md#rollback)) until fixed.
