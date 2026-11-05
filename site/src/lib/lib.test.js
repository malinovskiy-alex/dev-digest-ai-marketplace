import { describe, expect, it } from 'vitest';
import { bumpOf, prepareCatalog } from './catalog.js';
import { analyze, runSearch, seg, wscore } from './search.js';
import { security } from './security.js';
import { settingsJson } from './routes.js';
import { scaffold, validate, EMPTY_FORM } from './scaffold.js';
import { crc32, zip } from './zip.js';

// Small inline fixture in the shape build/catalog.mjs produces.
const RAW = {
  build: 'abc123 · 2026-11-04 · MIT',
  plugins: [
    { name: 'notes-digest', version: '1.2.0', description: 'Summarizes release notes into a short digest', category: 'productivity', tags: ['digest', 'release'], updatedAt: '2026-11-01', deps: ['helper'], scripts: [], readme: [['p', 'Turns long notes into a TLDR.']], author: 'A', license: 'MIT', source: 'plugins/notes-digest' },
    { name: 'helper', version: '0.1.0', description: 'Shared helpers', category: 'devtools', tags: ['util'], updatedAt: '2026-10-01', deps: [], scripts: ['scripts/run.mjs'], readme: [], author: 'B', license: 'MIT', source: 'plugins/helper' },
    { name: 'guard', version: '2.0.0', description: 'Checks tool calls', category: 'security', tags: ['review'], updatedAt: '2026-09-01', deps: [], scripts: [], readme: [], author: 'C', license: 'MIT', source: 'plugins/guard' },
  ],
  arts: [
    { plugin: 'notes-digest', type: 'skill', name: 'summarize', description: 'Summarize text into a digest', meta: { allowedTools: ['Read'] }, body: [['p', 'Write a summary.']] },
    { plugin: 'helper', type: 'mcp', name: 'svc', meta: { transport: 'http', url: 'http://api.example.com/mcp', envVars: ['SVC_TOKEN'] } },
    { plugin: 'guard', type: 'hook', name: 'pretooluse-all', meta: { event: 'PreToolUse', matcher: '*', command: 'node check.mjs --key ${API_KEY} ${CLAUDE_PLUGIN_ROOT}' } },
    { plugin: 'guard', type: 'agent', name: 'reviewer', description: 'Reviews pull requests', meta: { tools: ['Read'], model: 'sonnet' }, body: [] },
  ],
  log: [['notes-digest', '1.1.0', '1.2.0', '2026-11-01', 'Add skill'], ['guard', '1.0.0', '2.0.0', '2026-09-01', 'Rewrite']],
  lessons: [],
};
const C = prepareCatalog(RAW, 'https://github.com/o/r');
const search = (q, extra = {}) => runSearch(C.docs, C.plugins, { q, smart: false, type: null, cat: null, tag: null, softOff: null, sort: 'rel', ...extra });
const ids = (r) => r.list.map((x) => x.d.id);

describe('search', () => {
  it('scores exact, prefix and typo matches', () => {
    expect(wscore('digest', 'digest')).toBe(1);
    expect(wscore('dig', 'digest')).toBe(0.85);
    expect(wscore('sumarize', 'summarize')).toBeGreaterThan(0);
    expect(wscore('xyz', 'digest')).toBe(0);
  });

  it('drops stop words and detects a soft type from the query', () => {
    expect(analyze('I need a skill to summarize notes', false)).toEqual({ terms: ['summarize', 'notes'], soft: 'skill' });
  });

  it('finds by synonym (tldr → summarize/digest) and by typo', () => {
    expect(ids(search('tldr'))).toContain('notes-digest:summarize');
    expect(ids(search('sumarize'))[0]).toMatch(/notes-digest/);
  });

  it('maps other-language words only with Smart search on', () => {
    expect(search('резюме').list).toHaveLength(0);
    expect(ids(search('резюме', { smart: true }))).toContain('notes-digest:summarize');
  });

  it('falls back to partial (OR) matches when no doc has every term', () => {
    const r = search('digest zebra');
    expect(r.partial).toBe(true);
    expect(r.list.length).toBeGreaterThan(0);
  });

  it('applies the soft type chip unless it was dismissed', () => {
    const r = search('agents for review');
    expect(r.softType).toBe('agent');
    expect(r.list.every((x) => x.d.type === 'agent')).toBe(true);
    expect(search('agents for review', { softOff: 'agents for review' }).softType).toBe(null);
  });

  it('shows only plugins, newest first, with an empty query', () => {
    expect(ids(search(''))).toEqual(['plugin:notes-digest', 'plugin:helper', 'plugin:guard']);
  });

  it('splits text into highlight segments', () => {
    expect(seg('Summarize release notes', ['notes'])).toEqual([{ t: 'Summarize release ', m: false }, { t: 'notes', m: true }]);
    expect(seg('plain', [])).toEqual([{ t: 'plain', m: false }]);
  });
});

describe('security badges', () => {
  const keys = (name) => C.pm[name].sec.map((b) => b.k);
  it('flags broad hooks and secrets referenced by hooks, ignoring CLAUDE_* vars', () => {
    expect(keys('guard')).toEqual(['hooks', 'broad', 'secrets', 'restricted']);
    const secrets = C.pm.guard.sec.find((b) => b.k === 'secrets');
    expect(secrets.items.map((i) => i.t)).toEqual(['API_KEY']);
  });
  it('flags remote and insecure MCP servers, env secrets and scripts', () => {
    expect(keys('helper')).toEqual(['mcp', 'remote', 'insecure', 'secrets', 'scripts']);
    expect(C.pm.helper.sec.find((b) => b.k === 'scripts').items[0].href).toBe('https://github.com/o/r/blob/main/plugins/helper/scripts/run.mjs');
  });
  it('reports restricted tools for prompt-only plugins', () => {
    expect(keys('notes-digest')).toEqual(['restricted']);
    expect(security({ name: 'x', scripts: [], arts: [] })).toEqual([]);
  });
});

describe('catalog helpers', () => {
  it('derives bump types and invocations', () => {
    expect(bumpOf('1.0.0', '2.0.0', '')).toBe('Major');
    expect(bumpOf('1.0.0', '1.1.0', '')).toBe('Minor');
    expect(bumpOf('1.0.0', '1.0.1', 'Rollback: bad')).toBe('Rollback');
    expect(C.findArt('notes-digest', 'skill', 'summarize').invocation).toBe('/notes-digest:summarize');
    expect(C.findArt('notes-digest', 'skill', 'nope')).toBe(null);
  });
  it('writes settings.json with sorted enabled plugins', () => {
    const j = JSON.parse(settingsJson(['b', 'a']));
    expect(Object.keys(j.enabledPlugins)).toEqual(['a@dev-digest-ai', 'b@dev-digest-ai']);
  });
});

describe('build a plugin', () => {
  it('validates the form', () => {
    expect(Object.keys(validate(EMPTY_FORM))).toEqual(['name', 'description', 'skillName', 'skillDesc']);
    expect(validate({ ...EMPTY_FORM, name: 'claude-x', description: 'Long enough text', skillName: 'go', skillDesc: 'Does useful things' })).toEqual({ name: 'Names can\'t start with claude-, anthropic- or cc-plugin-.' });
  });
  it('zips the generated files', () => {
    const sc = scaffold({ ...EMPTY_FORM, name: 'demo', skillName: 'run' });
    const bytes = zip(sc.paths.map(([p, k]) => [p, sc.files[k]]));
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(0x04034b50);
    expect(new TextDecoder().decode(bytes)).toContain('plugins/demo/skills/run/SKILL.md');
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926);
  });
});
