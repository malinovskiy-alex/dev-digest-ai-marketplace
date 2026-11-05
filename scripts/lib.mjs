// Shared helpers for the release scripts. Node >= 20, no dependencies.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export class UsageError extends Error {}

/** Run git in `cwd` and return trimmed stdout. Throws on non-zero exit. */
export function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Like git(), but returns null instead of throwing. */
export function gitTry(cwd, ...args) {
  try {
    return git(cwd, ...args);
  } catch {
    return null;
  }
}

export function repoRoot(cwd = process.cwd()) {
  const root = gitTry(cwd, 'rev-parse', '--show-toplevel');
  if (!root) throw new UsageError('Not inside a git repository.');
  return root;
}

// ---------- semver (MAJOR.MINOR.PATCH, optional -prerelease) ----------

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;

export function parseVersion(v) {
  const m = SEMVER.exec(String(v));
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null };
}

/** Compare two versions: negative if a < b, 0 if equal, positive if a > b. */
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) throw new Error(`Not a semver version: ${!x ? a : b}`);
  for (const k of ['major', 'minor', 'patch']) if (x[k] !== y[k]) return x[k] - y[k];
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1; // 1.0.0 > 1.0.0-beta
  if (y.pre === null) return -1;
  return x.pre < y.pre ? -1 : 1;
}

export function bumpVersion(current, kind) {
  const v = parseVersion(current);
  if (!v) throw new UsageError(`Current version "${current}" is not semver.`);
  switch (kind) {
    case 'major': return `${v.major + 1}.0.0`;
    case 'minor': return `${v.major}.${v.minor + 1}.0`;
    case 'patch': return `${v.major}.${v.minor}.${v.patch + 1}`;
    default:
      if (!parseVersion(kind)) throw new UsageError(`Expected major, minor, patch or an exact version, got "${kind}".`);
      return kind;
  }
}

// ---------- marketplace / plugins ----------

export const MARKETPLACE_PATH = '.claude-plugin/marketplace.json';

export function readMarketplace(root) {
  return JSON.parse(readFileSync(join(root, MARKETPLACE_PATH), 'utf8'));
}

/** Plugins whose source is a local `./` path, as { name, dir } with dir relative to root (forward slashes). */
export function localPlugins(root) {
  return readMarketplace(root)
    .plugins.filter((p) => typeof p.source === 'string' && p.source.startsWith('./'))
    .map((p) => ({ name: p.name, dir: p.source.replace(/^\.\//, '').replace(/\/$/, '') }));
}

export function findPlugin(root, name) {
  const plugin = localPlugins(root).find((p) => p.name === name);
  if (!plugin) {
    const names = localPlugins(root).map((p) => p.name).join(', ') || '(none)';
    throw new UsageError(`Plugin "${name}" is not a local plugin in ${MARKETPLACE_PATH}. Known: ${names}`);
  }
  if (!existsSync(join(root, plugin.dir, '.claude-plugin', 'plugin.json'))) {
    throw new UsageError(`${plugin.dir}/.claude-plugin/plugin.json does not exist.`);
  }
  return plugin;
}

export function manifestPath(root, plugin) {
  return join(root, plugin.dir, '.claude-plugin', 'plugin.json');
}

export function readManifest(root, plugin) {
  return JSON.parse(readFileSync(manifestPath(root, plugin), 'utf8'));
}

/**
 * Set the top-level "version" in plugin.json, editing the raw text so the
 * rest of the file keeps its formatting. Verifies the result by re-parsing.
 */
export function writeManifestVersion(root, plugin, newVersion) {
  const file = manifestPath(root, plugin);
  const raw = readFileSync(file, 'utf8');
  const before = JSON.parse(raw);
  if (typeof before.version !== 'string') {
    throw new UsageError(`${plugin.dir}/.claude-plugin/plugin.json has no "version". Add one first.`);
  }
  const escaped = before.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`("version"\\s*:\\s*")${escaped}(")`);
  const updated = raw.replace(re, `$1${newVersion}$2`);
  const after = JSON.parse(updated);
  if (after.version !== newVersion || JSON.stringify({ ...after, version: before.version }) !== JSON.stringify(before)) {
    throw new Error(`Could not safely update "version" in ${file}. Edit it by hand.`);
  }
  writeFileSync(file, updated);
}

// ---------- tags ----------

export const tagName = (plugin, version) => `${plugin}--v${version}`;

/** Versions that already have a release tag for this plugin, highest first. */
export function taggedVersions(root, pluginName) {
  const out = gitTry(root, 'tag', '--list', `${pluginName}--v*`) ?? '';
  return out
    .split('\n')
    .filter(Boolean)
    .map((t) => t.slice(pluginName.length + 3))
    .filter((v) => parseVersion(v))
    .sort((a, b) => compareVersions(b, a));
}

/** Throws unless `version` is greater than `current` and every tagged version. */
export function assertNewVersion(root, pluginName, current, version) {
  if (compareVersions(version, current) <= 0) {
    throw new UsageError(`New version ${version} must be greater than the current ${current}.`);
  }
  const [highestTag] = taggedVersions(root, pluginName);
  if (highestTag && compareVersions(version, highestTag) <= 0) {
    throw new UsageError(
      `Version ${version} is not greater than the highest released version ${highestTag} (tag ${tagName(pluginName, highestTag)}). Never reuse or go below a released version.`,
    );
  }
}

// ---------- changelog ----------

const CHANGELOG_HEADER =
  '# Changelog\n\nAll notable changes to this plugin. Versions follow [SemVer](https://semver.org/).\n';

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Insert a "## [version] - date" section above the newest entry. Creates the file if needed. */
export function prependChangelog(root, plugin, version, lines) {
  const file = join(root, plugin.dir, 'CHANGELOG.md');
  const raw = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : CHANGELOG_HEADER;
  if (new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm').test(raw)) {
    throw new UsageError(`CHANGELOG.md already has an entry for ${version}.`);
  }
  const entry = `## [${version}] - ${today()}\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
  const idx = raw.search(/^## /m);
  const updated =
    idx === -1 ? `${raw.trimEnd()}\n\n${entry}` : `${raw.slice(0, idx)}${entry}\n${raw.slice(idx)}`;
  writeFileSync(file, updated);
  return file;
}

// ---------- CLI ----------

/** Minimal flag parser: --flag value, --flag=value, repeated flags collect into arrays, booleans. */
export function parseArgs(argv, { booleans = [], multiple = [] } = {}) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    let [key, value] = arg.slice(2).split(/=(.*)/s, 2);
    if (booleans.includes(key)) {
      flags[key] = true;
      continue;
    }
    if (value === undefined) {
      value = argv[++i];
      if (value === undefined) throw new UsageError(`Missing value for --${key}`);
    }
    if (multiple.includes(key)) (flags[key] ??= []).push(value);
    else flags[key] = value;
  }
  return { positional, flags };
}

export function run(main, usage) {
  try {
    main();
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`error: ${err.message}\n\n${usage}`);
      process.exit(2);
    }
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
