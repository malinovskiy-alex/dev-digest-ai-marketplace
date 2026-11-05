// Run: node --test scripts/test/
// Each test builds a throwaway git repo with a minimal marketplace and runs the real scripts in it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bumpVersion, compareVersions } from '../lib.mjs';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');

function sh(cwd, cmd, ...args) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function script(cwd, name, ...args) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, name), ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

function write(root, rel, content) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

const read = (root, rel) => readFileSync(join(root, rel), 'utf8');
const version = (root) => JSON.parse(read(root, 'plugins/demo/.claude-plugin/plugin.json')).version;

function makeRepo(t) {
  const root = mkdtempSync(join(tmpdir(), 'mkt-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  sh(root, 'git', 'init', '-q', '-b', 'main');
  sh(root, 'git', 'config', 'user.email', 'test@example.com');
  sh(root, 'git', 'config', 'user.name', 'Test');
  sh(root, 'git', 'config', 'commit.gpgsign', 'false');
  sh(root, 'git', 'config', 'tag.gpgsign', 'false');
  sh(root, 'git', 'config', 'core.autocrlf', 'false');
  write(root, '.claude-plugin/marketplace.json', JSON.stringify({
    name: 'test', owner: { name: 'T' },
    plugins: [{ name: 'demo', source: './plugins/demo', description: 'Demo plugin' }],
  }, null, 2));
  write(root, 'plugins/demo/.claude-plugin/plugin.json',
    '{\n  "name": "demo",\n  "version": "1.0.0",\n  "keywords": ["a", "b"]\n}\n');
  write(root, 'plugins/demo/skills/s/SKILL.md', 'v1\n');
  commit(root, 'initial');
  return root;
}

function commit(root, msg) {
  sh(root, 'git', 'add', '-A');
  sh(root, 'git', 'commit', '-q', '-m', msg);
}

test('semver helpers', () => {
  assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(bumpVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0');
  assert.equal(bumpVersion('1.2.3', '5.0.0'), '5.0.0');
  assert.ok(compareVersions('1.10.0', '1.9.0') > 0);
  assert.ok(compareVersions('1.0.0', '1.0.0-beta') > 0);
});

test('release bumps version, keeps formatting and writes changelog', (t) => {
  const root = makeRepo(t);
  const r = script(root, 'release.mjs', 'demo', 'minor', '--note', 'Add things');
  assert.equal(r.code, 0, r.out);
  assert.equal(read(root, 'plugins/demo/.claude-plugin/plugin.json'),
    '{\n  "name": "demo",\n  "version": "1.1.0",\n  "keywords": ["a", "b"]\n}\n');
  const log = read(root, 'plugins/demo/CHANGELOG.md');
  assert.match(log, /^# Changelog/);
  assert.match(log, /## \[1\.1\.0\] - \d{4}-\d{2}-\d{2}\n\n- Add things\n/);

  commit(root, 'release 1.1.0');
  assert.equal(script(root, 'release.mjs', 'demo', 'patch', '--note', 'Fix').code, 0);
  const log2 = read(root, 'plugins/demo/CHANGELOG.md');
  assert.ok(log2.indexOf('[1.1.1]') < log2.indexOf('[1.1.0]'), 'newest entry first');
});

test('release rejects bad input', (t) => {
  const root = makeRepo(t);
  assert.equal(script(root, 'release.mjs', 'demo', 'minor').code, 2, 'note required');
  assert.equal(script(root, 'release.mjs', 'nope', 'minor', '--note', 'x').code, 2, 'unknown plugin');
  assert.equal(script(root, 'release.mjs', 'demo', '0.9.0', '--note', 'x').code, 2, 'downgrade');
  sh(root, 'git', 'tag', 'demo--v1.5.0');
  assert.equal(script(root, 'release.mjs', 'demo', '1.2.0', '--note', 'x').code, 2, 'below a released tag');
  assert.equal(version(root), '1.0.0', 'nothing written');
});

test('check-versions fails on changes without a bump and passes after release', (t) => {
  const root = makeRepo(t);
  const base = sh(root, 'git', 'rev-parse', 'HEAD');
  write(root, 'plugins/demo/skills/s/SKILL.md', 'v2\n');
  commit(root, 'change without bump');
  let r = script(root, 'check-versions.mjs', '--base', base);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /version is still 1\.0\.0/);

  script(root, 'release.mjs', 'demo', 'patch', '--note', 'Fix');
  commit(root, 'bump');
  r = script(root, 'check-versions.mjs', '--base', base, '--check-tags');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /ok {2}demo: 1\.0\.0 -> 1\.0\.1/);
});

test('check-versions --check-tags rejects reusing a released version', (t) => {
  const root = makeRepo(t);
  sh(root, 'git', 'tag', 'demo--v1.0.1');
  const base = sh(root, 'git', 'rev-parse', 'HEAD');
  write(root, 'plugins/demo/.claude-plugin/plugin.json', '{ "name": "demo", "version": "1.0.1" }\n');
  commit(root, 'reuse version');
  const r = script(root, 'check-versions.mjs', '--base', base, '--check-tags');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /not greater than the released 1\.0\.1/);
});

test('tag-releases tags the last commit touching the plugin, idempotently', (t) => {
  const root = makeRepo(t);
  const pluginCommit = sh(root, 'git', 'rev-parse', 'HEAD');
  write(root, 'README.md', 'unrelated\n');
  commit(root, 'docs');
  let r = script(root, 'tag-releases.mjs');
  assert.equal(r.code, 0, r.out);
  assert.equal(sh(root, 'git', 'rev-list', '-n', '1', 'demo--v1.0.0'), pluginCommit);
  r = script(root, 'tag-releases.mjs');
  assert.match(r.out, /skip demo--v1\.0\.0 \(exists\)/);
  assert.match(r.out, /0 tag\(s\) created/);
});

test('rollback restores the old tree as a new version and keeps the changelog', (t) => {
  const root = makeRepo(t);
  script(root, 'tag-releases.mjs'); // demo--v1.0.0

  script(root, 'release.mjs', 'demo', 'minor', '--note', 'Add extra skill');
  write(root, 'plugins/demo/skills/s/SKILL.md', 'v2 broken\n');
  write(root, 'plugins/demo/skills/extra/SKILL.md', 'new\n');
  commit(root, 'release 1.1.0');
  script(root, 'tag-releases.mjs'); // demo--v1.1.0

  const r = script(root, 'rollback.mjs', 'demo', '--to', '1.0.0', '--note', 'Broken on Windows');
  assert.equal(r.code, 0, r.out);
  assert.equal(version(root), '1.1.1');
  assert.equal(read(root, 'plugins/demo/skills/s/SKILL.md'), 'v1\n');
  assert.ok(!existsSync(join(root, 'plugins/demo/skills/extra')), 'files added after 1.0.0 are removed');
  const log = read(root, 'plugins/demo/CHANGELOG.md');
  assert.match(log, /## \[1\.1\.1\][^\n]*\n\n- Rollback: restores the plugin as released in v1\.0\.0/);
  assert.match(log, /- Broken on Windows/);
  assert.match(log, /## \[1\.1\.0\]/, 'previous entries kept');
  assert.equal(sh(root, 'git', 'diff', '--name-only'), '', 'everything staged');
});

test('rollback refuses unknown versions and dirty plugin folders', (t) => {
  const root = makeRepo(t);
  assert.equal(script(root, 'rollback.mjs', 'demo', '--to', '0.5.0').code, 2);
  script(root, 'tag-releases.mjs');
  write(root, 'plugins/demo/skills/s/SKILL.md', 'local edit\n');
  const r = script(root, 'rollback.mjs', 'demo', '--to', '1.0.0');
  assert.equal(r.code, 2);
  assert.match(r.out, /uncommitted changes/);
});
