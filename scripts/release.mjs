#!/usr/bin/env node
// Prepare a plugin release: bump the version in plugin.json and add a CHANGELOG.md entry.
// The release tag is created automatically after merge to main (.github/workflows/release.yml).
import {
  assertNewVersion, bumpVersion, findPlugin, parseArgs, prependChangelog,
  readManifest, repoRoot, run, tagName, UsageError, writeManifestVersion,
} from './lib.mjs';

const USAGE = `Usage: node scripts/release.mjs <plugin> <major|minor|patch|X.Y.Z> --note "<change>" [--note ...] [--dry-run]

  Bumps "version" in plugins/<plugin>/.claude-plugin/plugin.json and adds a
  "## [X.Y.Z] - YYYY-MM-DD" section to plugins/<plugin>/CHANGELOG.md.

  major  breaking change (removed/renamed skill or agent, changed config keys, ...)
  minor  new backward-compatible functionality (new skill, agent, hook, option)
  patch  fixes and wording

Example:
  node scripts/release.mjs sdd-engineering minor --note "Add the spec-review skill"`;

run(() => {
  const { positional, flags } = parseArgs(process.argv.slice(2), { booleans: ['dry-run', 'help'], multiple: ['note'] });
  if (flags.help) return console.log(USAGE);
  const [name, kind] = positional;
  if (!name || !kind || positional.length > 2) throw new UsageError('Expected <plugin> and <bump>.');
  const notes = flags.note ?? [];
  if (notes.length === 0) throw new UsageError('Describe the change with at least one --note.');

  const root = repoRoot();
  const plugin = findPlugin(root, name);
  const current = readManifest(root, plugin).version;
  const next = bumpVersion(current, kind);
  assertNewVersion(root, name, current, next);

  console.log(`${name}: ${current} -> ${next}`);
  if (flags['dry-run']) {
    console.log('(dry run, nothing written)');
    return;
  }

  writeManifestVersion(root, plugin, next);
  prependChangelog(root, plugin, next, notes);

  console.log(`
Updated:
  ${plugin.dir}/.claude-plugin/plugin.json
  ${plugin.dir}/CHANGELOG.md

Next steps:
  1. Review the diff, then commit on a branch and open a PR.
  2. After the PR is merged to main, the release workflow creates and pushes
     the tag ${tagName(name, next)}.
  3. Users get the update with:
       /plugin marketplace update dev-digest-ai
       claude plugin update ${name}@dev-digest-ai`);
}, USAGE);
