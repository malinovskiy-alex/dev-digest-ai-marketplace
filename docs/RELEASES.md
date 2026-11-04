# Releases

## How Claude Code decides there is an update

Version is resolved in this order:

1. `version` in the plugin's `plugin.json`;
2. `version` in the marketplace entry;
3. fallback: git SHA of the source.

Users receive a new copy **only when the resolved version changes**. If `plugin.json` says `1.0.0` and you push new commits without bumping it — nobody gets them.

**Rule in this repo:** `version` is set **only** in `plugin.json` and is bumped on **every** change to a plugin. Never set `version` in `marketplace.json` entries (plugin.json silently wins and validation warns).

## SemVer

Format `MAJOR.MINOR.PATCH`:

| Bump  | When | Examples |
|-------|------|----------|
| MAJOR | Breaking change for users | removed/renamed skill or agent, changed `userConfig` keys, changed required env vars, hook behaviour change that blocks something previously allowed |
| MINOR | New backward-compatible functionality | new skill/agent/hook, new optional config |
| PATCH | Fixes and wording | prompt fixes, bug fixes in scripts, docs |

Pre-1.0 (`0.x.y`) plugins may break in MINOR bumps.

## Release process

1. Make the change in `plugins/<plugin-name>/`.
2. Bump `version` in `plugins/<plugin-name>/.claude-plugin/plugin.json`.
3. Add an entry to `plugins/<plugin-name>/CHANGELOG.md` (optional but recommended).
4. Open a PR; CI must pass; CODEOWNER approves.
5. After merge to `main`, tag the release:

   ```
   claude plugin tag plugins/<plugin-name> --push
   ```

   This creates the tag `<plugin-name>--v<version>` (e.g. `example-plugin--v0.2.0`) after checking that plugin.json and the marketplace entry agree.

Tags are required for plugins that other plugins depend on via semver ranges, and are useful for pinning and rollback.

## Updating (users)

Auto-update is **off by default** for third-party marketplaces.

```
/plugin marketplace update dev-digest-ai          # refresh the catalog
claude plugin update <plugin-name>@dev-digest-ai  # update an installed plugin
```

Or enable auto-update: `/plugin` → Marketplaces → `dev-digest-ai` → Enable auto-update.

After an update in a running session, run `/reload-plugins` (hooks and MCP servers keep the old path until then).

If an update does not arrive: check that `version` was bumped, run `/plugin marketplace update dev-digest-ai`, and as a last resort remove `~/.claude/plugins/cache/dev-digest-ai/<plugin-name>/`.

## Pinning

Teams that need stability can pin the whole marketplace to a ref:

```
/plugin marketplace add malinovskiy-alex/dev-digest-ai-marketplace#<tag-or-branch>
```

For release channels (stable / beta) use two marketplaces with different `name`s pointing to different refs — Claude Code has no built-in channels.

## Rollback

Claude Code only installs a version that is **different** from the installed one, so a rollback is a **new forward release**:

1. Revert the faulty change: `git revert <commit>`.
2. Bump `version` to a **new** number (e.g. bad `1.3.0` → `1.3.1` containing the `1.2.x` code). Never reuse a version number.
3. Release as usual (PR → merge → tag).
4. Announce that users should run `claude plugin update <plugin-name>@dev-digest-ai`.

Emergency options:

- **Pin users back:** users re-add the marketplace pinned to the last good tag (`...#<plugin-name>--v<good-version>`).
- **Pull the plugin:** remove its entry from `marketplace.json`. Installed copies stay unless `"forceRemoveDeletedPlugins": true` is set in `marketplace.json`. Removing a plugin is permanent for its name — record it in `renames` as `"<plugin-name>": null`.
- **Security incident:** follow [SECURITY.md](SECURITY.md) first, then roll back.
