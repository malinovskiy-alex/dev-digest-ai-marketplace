// node --test site/build/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blocks, buildCatalog, buildFeed, frontmatter } from './catalog.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'catalog-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const w = (p, s) => { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), typeof s === 'string' ? s : JSON.stringify(s)); };
  w('.claude-plugin/marketplace.json', { name: 'm', owner: { name: 'Owner' }, plugins: [
    { name: 'demo', source: './plugins/demo', description: 'Demo plugin', category: 'testing', tags: ['x'] },
  ] });
  w('plugins/demo/.claude-plugin/plugin.json', { name: 'demo', version: '1.2.0', author: { name: 'Dev' }, license: 'MIT', dependencies: ['other'] });
  w('plugins/demo/README.md', '# demo\n\nDoes **things**.\n\n## Usage\n\n- run `it`\n');
  w('plugins/demo/skills/sum/SKILL.md', '---\nname: sum\ndescription: "Sums things"\nallowed-tools: Read, Grep\n---\n\nBody text.\n');
  w('plugins/demo/agents/rev.md', '---\nname: rev\ndescription: Reviews\ntools:\n  - Read\n  - Bash\nmodel: sonnet\n---\nYou review.\n');
  w('plugins/demo/hooks/hooks.json', { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/g.mjs --key ${API_KEY}' }] }] } });
  w('plugins/demo/.mcp.json', { mcpServers: { svc: { type: 'http', url: 'https://svc.example.com/mcp', headers: { Authorization: 'Bearer ${SVC_TOKEN}' }, env: { LITERAL_SECRET: 'sk-live-DO-NOT-LEAK' } } } });
  w('plugins/demo/scripts/g.mjs', '');
  w('plugins/demo/skills/sum/scripts/stats.mjs', '');
  w('plugins/demo/CHANGELOG.md', '# Changelog\n\n## [1.2.0] - 2026-11-03\n\n- Add sum skill\n\n## [1.0.0] - 2026-10-01\n\n- First\n');
  return root;
}

test('builds plugins, components and history from the repo files only', (t) => {
  const c = buildCatalog(fixture(t));
  assert.deepEqual(c.plugins.map((p) => p.name), ['demo']);
  const p = c.plugins[0];
  assert.equal(p.version, '1.2.0');
  assert.equal(p.author, 'Dev');
  assert.deepEqual(p.deps, ['other']);
  assert.deepEqual(p.scripts, ['scripts/g.mjs', 'skills/sum/scripts/stats.mjs'], 'skill-bundled scripts are part of the security surface');
  assert.deepEqual(p.readme[0], ['p', 'Does things.'], 'H1 title skipped, inline markdown stripped');
  const by = (type) => c.arts.filter((a) => a.type === type);
  assert.deepEqual(by('skill')[0].meta.allowedTools, ['Read', 'Grep']);
  assert.deepEqual(by('agent')[0].meta, { tools: ['Read', 'Bash'], model: 'sonnet' });
  assert.deepEqual(by('hook')[0].meta, { event: 'PreToolUse', matcher: 'Bash', command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/g.mjs --key ${API_KEY}' });
  assert.equal(by('hook')[0].name, 'pretooluse-bash');
  assert.deepEqual(by('mcp')[0].meta.envVars.sort(), ['LITERAL_SECRET', 'SVC_TOKEN']);
  assert.deepEqual(c.log, [['demo', '1.0.0', '1.2.0', '2026-11-03', 'Add sum skill'], ['demo', '0.0.0', '1.0.0', '2026-10-01', 'First']]);
  assert.deepEqual(c.lessons, []);
});

test('never copies env or header values', (t) => {
  const json = JSON.stringify(buildCatalog(fixture(t)));
  assert.ok(!json.includes('sk-live-DO-NOT-LEAK'));
  assert.ok(!json.includes('Bearer'));
});

test('frontmatter and markdown helpers', () => {
  assert.deepEqual(frontmatter('---\na: [x, "y"]\nb: |\n  one\n  two\n---\nbody').data, { a: ['x', 'y'], b: 'one\ntwo' });
  assert.deepEqual(blocks('```\ncode\n```\n> quote\n1. item'), [['pre', 'code'], ['q', 'quote'], ['li', 'item']]);
});

test('feed escapes and links releases', () => {
  const xml = buildFeed({ log: [['a&b', '0.0.0', '1.0.0', '2026-01-02', '<x>']] }, 'https://s/');
  assert.match(xml, /<title>a&amp;b 1\.0\.0<\/title>/);
  assert.match(xml, /&lt;x&gt;/);
});
