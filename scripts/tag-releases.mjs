#!/usr/bin/env node
// Create the missing release tags <plugin>--v<version> for every local plugin.
// Idempotent: plugins whose current version is already tagged are skipped.
// Each tag points at the last commit that touched the plugin folder, i.e. the released code.
// Same tag format as `claude plugin tag`. Runs in CI after every push to main.
import {
  git, gitTry, localPlugins, parseArgs, readManifest, repoRoot, run, tagName, UsageError,
} from './lib.mjs';

const USAGE = `Usage: node scripts/tag-releases.mjs [--push] [--remote origin] [--dry-run]

  --push     push created tags to the remote
  --remote   remote name (default: origin)
  --dry-run  print what would be tagged`;

run(() => {
  const { positional, flags } = parseArgs(process.argv.slice(2), { booleans: ['push', 'dry-run', 'help'] });
  if (flags.help) return console.log(USAGE);
  if (positional.length) throw new UsageError(`Unexpected argument "${positional[0]}".`);
  const remote = flags.remote ?? 'origin';

  const root = repoRoot();
  if (git(root, 'status', '--porcelain', '--untracked-files=no')) throw new UsageError('Working tree has uncommitted changes.');

  const created = [];
  for (const plugin of localPlugins(root)) {
    const { version } = readManifest(root, plugin);
    const tag = tagName(plugin.name, version);
    if (gitTry(root, 'rev-parse', '--verify', '--quiet', `refs/tags/${tag}`)) {
      console.log(`skip ${tag} (exists)`);
      continue;
    }
    const commit = git(root, 'log', '-1', '--format=%H', 'HEAD', '--', plugin.dir);
    if (!commit) {
      console.log(`skip ${plugin.name} (no commits touch ${plugin.dir})`);
      continue;
    }
    console.log(`tag  ${tag} -> ${commit.slice(0, 7)}`);
    if (flags['dry-run']) continue;
    git(root, 'tag', '-a', tag, commit, '-m', `${plugin.name} v${version}`);
    created.push(tag);
  }

  if (flags.push && created.length) {
    git(root, 'push', remote, ...created.map((t) => `refs/tags/${t}`));
    console.log(`pushed ${created.length} tag(s) to ${remote}`);
  }
  console.log(`${created.length} tag(s) created.`);
}, USAGE);
