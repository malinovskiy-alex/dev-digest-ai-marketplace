// Turns the generated catalog ({ build, plugins, arts, log, lessons } from build/catalog.mjs)
// into the view model the screens use. Pure: does not mutate the input.
import { t } from '../i18n/index.js';
import { fmtShort, monthOf } from './format.js';
import { security } from './security.js';
import { buildDocs } from './search.js';
import { TYPE_ORDER, typeCount } from './types.js';

export const bumpOf = (from, to, sum) => {
  if (/^Rollback:/.test(sum)) return 'Rollback';
  const a = from.split('.').map(Number), b = to.split('.').map(Number);
  if (b[0] !== a[0]) return 'Major';
  if (b[1] !== a[1]) return 'Minor';
  return 'Patch';
};

export function enrichArt(src) {
  const a = { ...src, meta: src.meta || {} };
  a.id = a.plugin + ':' + a.name;
  if (a.type === 'hook') { const mt = a.meta.matcher || '*'; a.label = t('art.hookLabel', { event: a.meta.event, matcher: mt }); a.description = t('art.hookDescription', { event: a.meta.event, matcher: mt }); a.file = 'hooks/hooks.json'; }
  else if (a.type === 'mcp') { a.label = t('art.mcpLabel', { name: a.name, transport: a.meta.transport }); a.description = t('art.mcpDescription', { name: a.name, transport: a.meta.transport }); a.file = '.mcp.json'; }
  else if (a.type === 'skill') a.file = 'skills/' + a.name + '/SKILL.md';
  else if (a.type === 'agent') a.file = 'agents/' + a.name + '.md';
  else a.file = 'commands/' + a.name + '.md';
  a.description = a.description || '';
  a.invocation = (a.type === 'skill' || a.type === 'command') ? '/' + a.id : (a.type === 'agent' ? a.id : a.label);
  return a;
}

export const countLine = (p) => TYPE_ORDER.slice(1).map((type) => {
  const n = p.arts.filter((a) => a.type === type).length;
  return n ? typeCount(type, n) : '';
}).filter(Boolean).join(t('common.sep'));

export function prepareCatalog(raw, gh = '') {
  const arts = (raw.arts || []).map(enrichArt);
  const plugins = (raw.plugins || []).map((src) => {
    const p = { ...src, author: src.author || '', license: src.license || '', tags: src.tags || [], deps: src.deps || [], readme: src.readme || [], scripts: src.scripts || [] };
    p.arts = arts.filter((a) => a.plugin === p.name);
    p.sec = security(p, gh);
    return p;
  });
  const pm = {};
  plugins.forEach((p) => { pm[p.name] = p; });
  const knownArts = arts.filter((a) => pm[a.plugin]);
  const log = (raw.log || []).map(([plugin, from, to, date, summary]) => {
    const bump = bumpOf(from, to, summary);
    return { plugin, from, to, dateIso: date, date: fmtShort(date), month: monthOf(date), summary, bump, bcls: 'b-' + bump, rail: (bump === 'Major' || bump === 'Rollback') ? 'rail-' + bump : '' };
  });
  return {
    build: raw.build || '',
    plugins,
    arts: knownArts,
    pm,
    log,
    lessons: raw.lessons || [],
    docs: buildDocs(plugins, knownArts, pm),
    findArt: (plugin, type, name) => knownArts.find((a) => a.plugin === plugin && a.type === type && a.name === name) || null,
  };
}
