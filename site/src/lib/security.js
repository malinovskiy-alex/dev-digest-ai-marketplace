// "What this plugin can do on your machine": badges derived from the plugin's files.
// Badge copy (label / tip / expl) comes from i18n: security.<k>.*
import { t } from '../i18n/index.js';
import { hostOf } from './format.js';

const BROAD_EVENTS = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse'];

export const hookPlain = (m) => {
  const any = !m.matcher || m.matcher === '*';
  if (m.event === 'PreToolUse') return any ? t('hookPlain.pre') : t('hookPlain.preMatcher', { matcher: m.matcher });
  if (m.event === 'PostToolUse') return any ? t('hookPlain.post') : t('hookPlain.postMatcher', { matcher: m.matcher });
  if (m.event === 'UserPromptSubmit') return t('hookPlain.prompt');
  return m.event;
};

const badge = (k, tone, icon, items, tipParams) => ({
  k, tone, icon, items,
  label: t('security.' + k + '.label'),
  tip: t('security.' + k + '.tip', tipParams),
  expl: t('security.' + k + '.expl'),
});

// p: { name, scripts, arts } with arts enriched by prepareCatalog (label, name, meta). gh: repository URL for script links.
export function security(p, gh = '') {
  const arts = p.arts;
  const hooks = arts.filter((a) => a.type === 'hook'), mcps = arts.filter((a) => a.type === 'mcp');
  const skills = arts.filter((a) => a.type === 'skill'), agents = arts.filter((a) => a.type === 'agent');
  const broad = hooks.filter((h) => BROAD_EVENTS.includes(h.meta.event) && (!h.meta.matcher || h.meta.matcher === '*'));
  const remote = mcps.filter((m) => m.meta.transport === 'http' || m.meta.transport === 'sse');
  const insecure = remote.filter((m) => /^http:\/\//.test(m.meta.url) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(m.meta.url));
  const sec = [];
  mcps.forEach((m) => (m.meta.envVars || []).forEach((v) => sec.push(v)));
  hooks.forEach((h) => (String(h.meta.command || '').match(/\$\{([A-Z0-9_]+)\}/g) || []).forEach((x) => { const n = x.slice(2, -1); if (n.indexOf('CLAUDE_') !== 0) sec.push(n); }));
  const secrets = sec.filter((v, i) => sec.indexOf(v) === i);
  const restricted = (skills.length + agents.length) > 0 && skills.every((s) => s.meta.allowedTools && s.meta.allowedTools.length) && agents.every((a) => a.meta.tools && a.meta.tools.length);
  const b = [];
  if (hooks.length) b.push(badge('hooks', 's-info', 'hook', hooks.map((h) => ({ t: h.label, a: h }))));
  if (broad.length) b.push(badge('broad', 's-warning', 'warning', broad.map((h) => ({ t: h.label, a: h }))));
  if (mcps.length) b.push(badge('mcp', 's-info', 'plug', mcps.map((m) => ({ t: t('art.mcpItem', { name: m.name, transport: m.meta.transport, target: m.meta.url || m.meta.command }), a: m }))));
  if (remote.length) b.push(badge('remote', 's-warning', 'globe', remote.map((m) => ({ t: hostOf(m.meta.url), a: m })), { hosts: remote.map((m) => hostOf(m.meta.url)).join(', ') }));
  if (insecure.length) b.push(badge('insecure', 's-danger', 'insecure', insecure.map((m) => ({ t: m.meta.url, a: m }))));
  if (secrets.length) b.push(badge('secrets', 's-info', 'key', secrets.map((v) => ({ t: v })), { names: secrets.join(', ') }));
  if (p.scripts && p.scripts.length) b.push(badge('scripts', 's-info', 'script', p.scripts.map((s) => ({ t: s, href: gh + '/blob/main/plugins/' + p.name + '/' + s }))));
  if (restricted) {
    b.push(badge('restricted', 's-success', 'shield', skills.map((s) => ({ t: t('art.restrictedItem', { name: s.name, tools: s.meta.allowedTools.join(', ') }), a: s }))
      .concat(agents.map((a) => ({ t: t('art.restrictedItem', { name: a.name, tools: a.meta.tools.join(', ') }), a })))));
  }
  return b;
}
