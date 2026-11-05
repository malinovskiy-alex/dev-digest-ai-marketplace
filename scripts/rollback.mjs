#!/usr/bin/env node
// Roll a plugin back to a previous release as a NEW forward version (see docs/RELEASES.md#rollback).
// Restores the plugin folder from a release tag (or any git ref), keeps the current CHANGELOG.md,
// bumps the version above the current one and records the rollback in the changelog.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertNewVersion, bumpVersion, findPlugin, git, gitTry, parseArgs, parseVersion,
  prependChangelog, readManifest, repoRoot, run, tagName, taggedVersions, UsageError,
  writeManifestVersion,
} from './lib.mjs';

const USAGE = `Usage: node scripts/rollback.mjs <plugin> --to <version|git-ref> [--version X.Y.Z] [--note "<reason>"] [--dry-run]

  --to       a released version (uses the tag <plugin>--v<version>) or any git ref
  --version  version for the rollback release (default: next patch after the current version)
  --note     why the rollback happened (recommended)

Restores plugins/<plugin>/ exactly as it was at --to (files added since are removed),
keeps the current CHANGELOG.md, sets the new version and adds a "Rollback" changelog entry.
Changes are staged, not committed.

Example:
  node scripts/rollback.mjs example-plugin --to 1.2.0 --note "1.3.0 broke summarize on Windows"`;

run(() => {
  const { positional, flags } = parseArgs(process.argv.slice(2), { booleans: ['dry-run', 'help'] });
  if (flags.help) return console.log(USAGE);
  const [name] = positional;
  if (!name || positional.length > 1) throw new UsageError('Expected exactly one <plugin>.');
  if (!flags.to) throw new UsageError('Missing --to <version|git-ref>.');

  const root = repoRoot();
  const plugin = findPlugin(root, name);

  // Resolve the target ref.
  let ref = flags.to;
  let targetLabel = ref;
  if (parseVersion(flags.to)) {
    ref = tagName(name, flags.to);
    targetLabel = `v${flags.to}`;
    if (!gitTry(root, 'rev-parse', '--verify', '--quiet', `refs/tags/${ref}`)) {
      const known = taggedVersions(root, name);
      throw new UsageError(
        `Tag ${ref} not found. Released versions: ${known.join(', ') || '(none)'}. Run "git fetch --tags" or pass a commit with --to.`,
      );
    }
  }
  const commit = gitTry(root, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
  if (!commit) throw new UsageError(`"${flags.to}" is not a known version tag or git ref.`);
  if (gitTry(root, 'cat-file', '-e', `${commit}:${plugin.dir}/.claude-plugin/plugin.json`) === null) {
    throw new UsageError(`${plugin.dir} does not exist at ${flags.to}.`);
  }

  // Refuse to overwrite uncommitted work in the plugin folder.
  if (git(root, 'status', '--porcelain', '--', plugin.dir)) {
    throw new UsageError(`${plugin.dir} has uncommitted changes. Commit or stash them first.`);
  }

  const current = readManifest(root, plugin).version;
  const next = flags.version ? bumpVersion(current, flags.version) : bumpVersion(current, 'patch');
  assertNewVersion(root, name, current, next);
  const short = commit.slice(0, 7);

  console.log(`${name}: rolling back to ${targetLabel} (${short}) as new version ${next} (current ${current})`);
  if (flags['dry-run']) {
    console.log('Files that would change:');
    console.log(git(root, 'diff', '--stat', commit, 'HEAD', '--', plugin.dir) || '  (none besides version and changelog)');
    console.log('(dry run, nothing written)');
    return;
  }

  // Keep the current changelog: the history of what was released must not be lost.
  const changelogFile = join(root, plugin.dir, 'CHANGELOG.md');
  const changelog = existsSync(changelogFile) ? readFileSync(changelogFile, 'utf8') : null;

  rmSync(join(root, plugin.dir), { recursive: true, force: true });
  git(root, 'checkout', commit, '--', plugin.dir);
  if (changelog !== null) writeFileSync(changelogFile, changelog);
  else rmSync(changelogFile, { force: true });

  writeManifestVersion(root, plugin, next);
  const lines = [`Rollback: restores the plugin as released in ${targetLabel} (${short}), replacing ${current}.`];
  if (flags.note) lines.push(flags.note);
  prependChangelog(root, plugin, next, lines);
  git(root, 'add', '-A', '--', plugin.dir);

  console.log(`
Staged changes in ${plugin.dir}/ (not committed):
${git(root, 'diff', '--cached', '--stat', '--', plugin.dir)}

Next steps:
  1. Review with "git diff --cached", then commit on a branch and open a PR.
     Run: claude plugin validate ${plugin.dir} --strict
  2. After merge to main the release workflow tags ${tagName(name, next)}.
  3. Tell users to run:
       /plugin marketplace update dev-digest-ai
       claude plugin update ${name}@dev-digest-ai
     Emergency: users can pin the marketplace to the last good tag:
       /plugin marketplace add malinovskiy-alex/dev-digest-ai-marketplace#${parseVersion(flags.to) ? ref : '<tag>'}`);
}, USAGE);
