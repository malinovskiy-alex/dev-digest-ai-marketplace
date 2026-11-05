// Every literal key passed to t('…') in src/ must exist in en.js (plain or as `_one`/`_other` plural keys),
// and the keys built dynamically in code (types, bumps, security badges, form errors, start steps) must too.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { has, t } from './index.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : [p]; })
  .filter((p) => /\.(js|jsx)$/.test(p) && !/\.test\.(js|jsx)$/.test(p));

describe('i18n', () => {
  it('has every key referenced with t(\'…\') in src/', () => {
    const missing = [];
    let found = 0;
    for (const file of files(SRC)) {
      const text = readFileSync(file, 'utf8');
      // Only complete string literals: t('a.b') or t('a.b', {...}). Concatenated keys are checked below.
      for (const m of text.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'\s*[,)]/g)) {
        found++;
        if (!has(m[1])) missing.push(m[1] + '  (' + file.slice(SRC.length + 1) + ')');
      }
    }
    expect(found).toBeGreaterThan(100);
    expect(missing).toEqual([]);
  });

  it('has the keys built dynamically', () => {
    const keys = [
      ...['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'].flatMap((x) => ['label', 'chip', 'name', 'count'].map((f) => 'types.' + x + '.' + f)),
      ...['All', 'Major', 'Minor', 'Patch', 'Rollback'].map((b) => 'bump.' + b),
      ...['hooks', 'broad', 'mcp', 'remote', 'insecure', 'secrets', 'scripts', 'restricted'].flatMap((k) => ['label', 'tip', 'expl'].map((f) => 'security.' + k + '.' + f)),
      ...['nameRequired', 'nameKebab', 'nameLength', 'namePrefix', 'description', 'category', 'authorUrl', 'skillRequired', 'skillKebab', 'skillDesc'].map((k) => 'newp.err.' + k),
      ...['add', 'install', 'use', 'update', 'remove', 'team', 'contribute'].flatMap((s) => ['title', 'text'].map((f) => 'start.steps.' + s + '.' + f)),
      'start.steps.add.g1', 'start.steps.install.g2', 'start.steps.install.link', 'start.steps.use.g3', 'start.steps.update.g4', 'start.steps.update.g5', 'start.steps.update.g6',
      'start.steps.remove.g7', 'start.steps.team.link', 'start.steps.contribute.link',
    ];
    expect(keys.filter((k) => !has(k))).toEqual([]);
  });

  it('interpolates and pluralises', () => {
    expect(t('footer.builtFrom', { build: 'abc' })).toBe('Built from abc');
    expect(t('count.plugin', { count: 1 })).toBe('1 plugin');
    expect(t('count.plugin', { count: 3 })).toBe('3 plugins');
    expect(t('types.mcp.count', { count: 2 })).toBe('2 MCP servers');
    expect(t('no.such.key')).toBe('no.such.key');
  });
});
