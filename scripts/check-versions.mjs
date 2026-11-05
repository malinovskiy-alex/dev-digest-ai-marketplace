#!/usr/bin/env node
// CI guard: every plugin changed since <base> must have a higher version than at <base>,
// and (with --check-tags) higher than every released version. Without a bump, users never
// receive the change (docs/RELEASES.md). Warns when CHANGELOG.md lacks the new version.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  compareVersions, git, gitTry, localPlugins, parseArgs, parseVersion, repoRoot, run,
  tagName, taggedVersions, UsageError,
} from './lib.mjs';

const USAGE = `Usage: node scripts/check-versions.mjs --base <git-ref> [--check-tags]

  --base        ref to compare with (PR base branch, or the previous commit on push)
  --check-tags  also require versions to be greater than every existing release tag

Example (locally, before opening a PR):
  node scripts/check-versions.mjs --base origin/main --check-tags`;

run(() => {
  const { flags } = parseArgs(process.argv.slice(2), { booleans: ['check-tags', 'help'] });
  if (flags.help) return console.log(USAGE);
  if (!flags.base) throw new UsageError('Missing --base.');

  const root = repoRoot();
  const baseCommit = gitTry(root, 'rev-parse', '--verify', '--quiet', `${flags.base}^{commit}`);
  if (!baseCommit) throw new UsageError(`Unknown ref "${flags.base}". Fetch it first (actions/checkout with fetch-depth: 0).`);
  const mergeBase = gitTry(root, 'merge-base', baseCommit, 'HEAD') ?? baseCommit;

  const errors = [];
  const warnings = [];
  let checked = 0;

  for (const plugin of localPlugins(root)) {
    // Only committed changes count; CI runs on a clean checkout.
    const changed = git(root, 'diff', '--name-only', mergeBase, 'HEAD', '--', plugin.dir);
    if (!changed) continue;
    checked++;

    const manifestRel = `${plugin.dir}/.claude-plugin/plugin.json`;
    const headPath = join(root, manifestRel);
    if (!existsSync(headPath)) continue; // plugin folder removed; validation catches dangling entries
    const head = JSON.parse(readFileSync(headPath, 'utf8')).version;
    if (!parseVersion(head)) {
      errors.push(`${plugin.name}: "version" in ${manifestRel} is missing or not semver (${head}).`);
      continue;
    }

    const baseRaw = gitTry(root, 'show', `${mergeBase}:${manifestRel}`);
    const base = baseRaw ? JSON.parse(baseRaw).version : null;

    if (base && parseVersion(base) && compareVersions(head, base) <= 0) {
      errors.push(
        `${plugin.name}: files changed but version is still ${head} (was ${base}). Bump it: node scripts/release.mjs ${plugin.name} <major|minor|patch> --note "..."`,
      );
      continue;
    }

    if (flags['check-tags']) {
      const [highest] = taggedVersions(root, plugin.name);
      if (highest && compareVersions(head, highest) <= 0) {
        errors.push(
          `${plugin.name}: version ${head} is not greater than the released ${highest} (tag ${tagName(plugin.name, highest)}). Never reuse a version.`,
        );
        continue;
      }
    }

    const changelog = join(root, plugin.dir, 'CHANGELOG.md');
    const hasEntry = existsSync(changelog) && readFileSync(changelog, 'utf8').includes(`## [${head}]`);
    if (!hasEntry) warnings.push(`${plugin.name}: CHANGELOG.md has no "## [${head}]" entry.`);

    console.log(`ok  ${plugin.name}: ${base ?? '(new)'} -> ${head}`);
  }

  for (const w of warnings) console.log(`::warning::${w}`);
  for (const e of errors) console.log(`::error::${e}`);
  console.log(`${checked} changed plugin(s) checked, ${errors.length} error(s), ${warnings.length} warning(s).`);
  if (errors.length) process.exit(1);
}, USAGE);
