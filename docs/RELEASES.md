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
2. Bump the version and add a changelog entry in one step:

   ```
   node scripts/release.mjs <plugin-name> <major|minor|patch> --note "What changed"
   ```

   This updates `version` in `plugins/<plugin-name>/.claude-plugin/plugin.json` (keeping the file's formatting) and adds a `## [X.Y.Z] - YYYY-MM-DD` section to `plugins/<plugin-name>/CHANGELOG.md`. It refuses versions that are not greater than the current version or any released tag. Use `--dry-run` to preview, and repeat `--note` for several lines.
3. Open a PR; CI must pass; CODEOWNER approves. CI (`validate.yml` → `versions` job) fails if a changed plugin has no version bump or reuses a released version, and warns if `CHANGELOG.md` has no entry for the new version. Run the same check locally with:

   ```
   node scripts/check-versions.mjs --base origin/main --check-tags
   ```

4. After merge to `main`, `.github/workflows/release.yml` tags the release automatically: `<plugin-name>--v<version>` (e.g. `example-plugin--v0.2.0`), pointing at the merge commit on `main` (the plugin folder there is identical to the released code). It runs `scripts/tag-releases.mjs`, which skips existing tags. To tag by hand instead (same format, also checks that plugin.json and the marketplace entry agree):

   ```
   claude plugin tag plugins/<plugin-name> --push
   ```

Tags are required for plugins that other plugins depend on via semver ranges, and for pinning and rollback.

### Release scripts

| Script | Who runs it | What it does |
|---|---|---|
| `scripts/release.mjs` | Author, before the PR | Bump version + changelog entry |
| `scripts/rollback.mjs` | Maintainer, on a bad release | Restore an earlier release as a new version (see [Rollback](#rollback)) |
| `scripts/check-versions.mjs` | CI on every PR and push; author locally | Fail on changed plugins without a version bump or with a reused version |
| `scripts/tag-releases.mjs` | CI after every push to `main` | Create and push missing `<plugin>--v<version>` tags |

All scripts are plain Node (≥ 20, no dependencies) and work on Windows, macOS and Linux. Each accepts `--help`. Tests: `node --test "scripts/test/*.test.mjs"`.

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

Claude Code only installs a version that is **different** from the installed one, so a rollback is a **new forward release** (e.g. bad `1.3.0` → `1.3.1` containing the `1.2.0` code). Never reuse a version number.

1. Restore the last good release as a new version:

   ```
   node scripts/rollback.mjs <plugin-name> --to <good-version> --note "Why"
   ```

   `--to` takes a released version (uses the tag `<plugin-name>--v<good-version>`) or any git ref. The script restores `plugins/<plugin-name>/` exactly as it was at that point (files added since are removed), keeps the current `CHANGELOG.md`, sets the version to the next patch (override with `--version X.Y.Z`), adds a `Rollback: …` changelog entry and stages the changes. It refuses to run if the plugin folder has uncommitted changes. Use `--dry-run` to preview.

   For a small fix, `git revert <commit>` followed by `node scripts/release.mjs <plugin-name> patch --note "Revert …"` also works.
2. Review (`git diff --cached`), run `claude plugin validate plugins/<plugin-name> --strict`, commit on a branch and open a PR.
3. After merge the release workflow tags the new version.
4. Announce that users should run `/plugin marketplace update dev-digest-ai` and `claude plugin update <plugin-name>@dev-digest-ai`.

Emergency options:

- **Pin users back:** users re-add the marketplace pinned to the last good tag (`...#<plugin-name>--v<good-version>`).
- **Pull the plugin:** remove its entry from `marketplace.json`. Installed copies stay unless `"forceRemoveDeletedPlugins": true` is set in `marketplace.json`. Removing a plugin is permanent for its name — record it in `renames` as `"<plugin-name>": null`.
- **Security incident:** follow [SECURITY.md](SECURITY.md) first, then roll back.
