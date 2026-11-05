#!/usr/bin/env node
// Builds the site catalog from the repository — the ONLY data source of the site.
// Reads .claude-plugin/marketplace.json and every local plugin (plugin.json, skills, agents,
// commands, hooks, MCP servers, README, CHANGELOG, release tags) and writes catalog.json.
//
//   node site/build/catalog.mjs [--out site/data/catalog.json]
//
// Security: values of env vars and headers are never copied — only variable NAMES.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = join(ROOT, 'site');

// ---- helpers ---------------------------------------------------------------
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readText = (p) => (existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null);
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const list = (p) => (isDir(p) ? readdirSync(p).sort() : []);
const posix = (p) => p.split('\\').join('/');
function git(...args) {
  try { return execFileSync('git', args, { cwd: git.cwd || ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}
const today = () => new Date().toISOString().slice(0, 10);
const cmpVer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

// Minimal YAML frontmatter: `key: value`, quoted values, `[a, b]`, `- item` lists, `|`/`>` blocks.
export function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text || '');
  if (!m) return { data: {}, body: text || '' };
  const data = {};
  const lines = m[1].split('\n');
  const unq = (v) => v.replace(/^(['"])([\s\S]*)\1$/, '$2');
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    const [, key, raw] = kv;
    let v = raw.trim();
    if (v === '|' || v === '>' || v === '|-' || v === '>-') {
      const buf = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) buf.push(lines[++i].trim());
      v = buf.join(v[0] === '|' ? '\n' : ' ');
    } else if (v === '') {
      const items = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) items.push(unq(lines[++i].replace(/^\s*-\s+/, '').trim()));
      v = items.length ? items : '';
    } else if (/^\[.*\]$/.test(v)) {
      v = v.slice(1, -1).split(',').map((s) => unq(s.trim())).filter(Boolean);
    } else v = unq(v);
    data[key] = v;
  }
  return { data, body: m[2] };
}
const toList = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => s.trim()).filter(Boolean);

// Markdown → the prototype's blocks: ['h'|'p'|'li'|'q'|'pre', text]
const inline = (s) => s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/`([^`]+)`/g, '$1').trim();
export function blocks(md, { skipTitle = false } = {}) {
  const out = [];
  const lines = String(md || '').split('\n');
  let para = [];
  const flush = () => { if (para.length) { out.push(['p', inline(para.join(' '))]); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush();
      const code = [];
      while (i + 1 < lines.length && !/^```/.test(lines[i + 1])) code.push(lines[++i]);
      i++;
      out.push(['pre', code.join('\n')]);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); if (!(skipTitle && h[1].length === 1 && !out.length)) out.push(['h', inline(h[2])]); continue; }
    const li = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) { flush(); out.push(['li', inline(li[1].replace(/^\[[ xX]\]\s+/, ''))]); continue; }
    if (/^\s*\|/.test(line)) {
      flush();
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue; // table separator
      out.push(['li', inline(line.split('|').map((c) => c.trim()).filter(Boolean).join(' — '))]);
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) { flush(); out.push(['q', inline(q[1])]); continue; }
    if (!line.trim()) { flush(); continue; }
    para.push(line.trim());
  }
  flush();
  return out.filter(([, t]) => t !== '');
}

// ${VAR} / ${user_config.KEY} names referenced in a string (CLAUDE_* are provided by Claude Code).
const varNames = (s) => [...String(s || '').matchAll(/\$\{([A-Za-z0-9_.]+)(?::-[^}]*)?\}/g)]
  .map((m) => m[1].replace(/^user_config\./, ''))
  .filter((n) => !/^CLAUDE_/.test(n));
const uniq = (a) => a.filter((v, i) => a.indexOf(v) === i);

// ---- components ------------------------------------------------------------
function readSkills(dir, plugin) {
  return list(join(dir, 'skills')).flatMap((name) => {
    const fm = frontmatter(readText(join(dir, 'skills', name, 'SKILL.md')));
    if (!fm.body && !Object.keys(fm.data).length) return [];
    const tools = fm.data['allowed-tools'];
    return [{ plugin, type: 'skill', name: fm.data.name || name, description: fm.data.description || '', meta: { allowedTools: tools ? toList(tools) : null }, body: blocks(fm.body) }];
  });
}
function readAgents(dir, plugin) {
  return list(join(dir, 'agents')).filter((f) => f.endsWith('.md')).map((f) => {
    const fm = frontmatter(readText(join(dir, 'agents', f)));
    return { plugin, type: 'agent', name: fm.data.name || f.slice(0, -3), description: fm.data.description || '', meta: { tools: fm.data.tools ? toList(fm.data.tools) : [], model: fm.data.model || 'inherit' }, body: blocks(fm.body) };
  });
}
function readCommands(dir, plugin) {
  return list(join(dir, 'commands')).filter((f) => f.endsWith('.md')).map((f) => {
    const fm = frontmatter(readText(join(dir, 'commands', f)));
    return { plugin, type: 'command', name: f.slice(0, -3), description: fm.data.description || '', meta: { legacy: true }, body: blocks(fm.body) };
  });
}
function hookSources(dir, manifest) {
  const srcs = [];
  const file = join(dir, 'hooks', 'hooks.json');
  if (existsSync(file)) srcs.push(readJson(file));
  const extra = manifest.hooks;
  for (const h of Array.isArray(extra) ? extra : extra ? [extra] : []) {
    if (typeof h === 'string') { const p = join(dir, h); if (existsSync(p)) srcs.push(readJson(p)); } else srcs.push(h);
  }
  return srcs;
}
function readHooks(dir, plugin, manifest) {
  const out = [];
  for (const src of hookSources(dir, manifest)) {
    const events = src.hooks || src;
    for (const [event, groups] of Object.entries(events || {})) {
      for (const g of Array.isArray(groups) ? groups : []) {
        for (const h of g.hooks || []) {
          const command = [h.command, ...(h.args || [])].filter(Boolean).join(' ') || h.type || '';
          const base = event.toLowerCase() + '-' + (g.matcher && g.matcher !== '*' ? g.matcher.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'all');
          let name = base, n = 2;
          while (out.some((a) => a.name === name)) name = base + '-' + n++;
          out.push({ plugin, type: 'hook', name, meta: { event, matcher: g.matcher || '*', command } });
        }
      }
    }
  }
  return out;
}
function readMcp(dir, plugin, manifest) {
  const maps = [];
  const file = join(dir, '.mcp.json');
  if (existsSync(file)) { const j = readJson(file); maps.push(j.mcpServers || j); }
  const extra = manifest.mcpServers;
  for (const m of Array.isArray(extra) ? extra : extra ? [extra] : []) {
    if (typeof m === 'string') { const p = join(dir, m); if (existsSync(p)) { const j = readJson(p); maps.push(j.mcpServers || j); } } else maps.push(m);
  }
  const out = [];
  for (const map of maps) {
    for (const [name, s] of Object.entries(map || {})) {
      if (!s || typeof s !== 'object') continue;
      const transport = s.type || (s.url ? 'http' : 'stdio');
      const envVars = uniq([
        ...Object.keys(s.env || {}),
        ...Object.values(s.env || {}).flatMap(varNames),
        ...Object.values(s.headers || {}).flatMap(varNames),
        ...varNames(s.url), ...(s.args || []).flatMap(varNames),
      ]).filter((n) => !/^CLAUDE_/.test(n));
      const meta = { transport, envVars };
      if (s.url) meta.url = s.url; else meta.command = [s.command, ...(s.args || [])].filter(Boolean).join(' ');
      out.push({ plugin, type: 'mcp', name, meta });
    }
  }
  return out;
}
function scriptFiles(dir) {
  const found = [];
  const walk = (d) => list(d).forEach((f) => { const p = join(d, f); if (isDir(p)) walk(p); else found.push(posix(relative(dir, p))); });
  walk(join(dir, 'scripts'));
  if (existsSync(join(dir, 'package.json'))) found.push('package.json');
  return found;
}

// ---- release history ---------------------------------------------------------
function history(dir, name, version, updatedAt) {
  const md = readText(join(dir, 'CHANGELOG.md'));
  const rel = [];
  if (md) {
    const re = /^##\s*\[?v?(\d+\.\d+\.\d+)\]?\s*[-–—]\s*(\d{4}-\d{2}-\d{2})\s*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/gm;
    for (const m of md.matchAll(re)) {
      const first = m[3].split('\n').map((l) => l.replace(/^\s*[-*+]\s+/, '').trim()).find(Boolean) || '';
      rel.push({ to: m[1], date: m[2], summary: inline(first) });
    }
  }
  if (!rel.length) {
    for (const line of git('for-each-ref', '--format=%(refname:short) %(creatordate:short) %(contents:subject)', `refs/tags/${name}--v*`).split('\n').filter(Boolean)) {
      const [tag, date, ...subj] = line.split(' ');
      rel.push({ to: tag.slice(name.length + 3), date, summary: subj.join(' ') === `${name} v${tag.slice(name.length + 3)}` ? '' : subj.join(' ') });
    }
  }
  if (!rel.length && version) rel.push({ to: version, date: updatedAt, summary: '' });
  rel.sort((a, b) => cmpVer(b.to, a.to));
  return rel.map((r, i) => {
    const from = rel[i + 1] ? rel[i + 1].to : '0.0.0';
    return [name, from, r.to, r.date, r.summary || (from === '0.0.0' ? 'Initial release' : 'Release v' + r.to)];
  });
}

// ---- main --------------------------------------------------------------------
export function buildCatalog(root = ROOT) {
  git.cwd = root;
  const mkt = readJson(join(root, '.claude-plugin', 'marketplace.json'));
  const pluginRoot = mkt.metadata && mkt.metadata.pluginRoot;
  const plugins = [], arts = [], log = [];
  for (const entry of mkt.plugins || []) {
    let src = entry.source;
    if (typeof src === 'string' && !src.startsWith('./') && pluginRoot) src = posix(join(pluginRoot, src));
    if (typeof src !== 'string') { console.warn(`skip ${entry.name}: external source is not rendered yet`); continue; }
    const dir = join(root, src);
    const mf = existsSync(join(dir, '.claude-plugin', 'plugin.json')) ? readJson(join(dir, '.claude-plugin', 'plugin.json')) : {};
    const name = entry.name;
    const updatedAt = git('log', '-1', '--format=%cs', '--', posix(relative(root, dir))) || today();
    const version = mf.version || entry.version || '0.0.0';
    const deps = (mf.dependencies || entry.dependencies || []).map((d) => (typeof d === 'string' ? d : d.name)).filter(Boolean);
    plugins.push({
      name, version,
      description: entry.description || mf.description || '',
      category: entry.category || 'other',
      tags: entry.tags || mf.keywords || [],
      updatedAt, deps,
      scripts: scriptFiles(dir),
      readme: blocks(readText(join(dir, 'README.md')), { skipTitle: true }),
      author: (mf.author && mf.author.name) || (mkt.owner && mkt.owner.name) || '',
      license: mf.license || '',
      source: posix(relative(root, dir)),
    });
    arts.push(...readSkills(dir, name), ...readAgents(dir, name), ...readCommands(dir, name), ...readHooks(dir, name, mf), ...readMcp(dir, name, mf));
    log.push(...history(dir, name, version, updatedAt));
  }
  plugins.sort((a, b) => a.name.localeCompare(b.name));
  log.sort((a, b) => b[3].localeCompare(a[3]) || a[0].localeCompare(b[0]));

  const courseFile = join(root, 'site', 'course-map.json');
  const lessons = existsSync(courseFile)
    ? readJson(courseFile).map((l, i) => ({ n: l.n || i + 1, title: l.lesson || l.title || 'Lesson ' + (i + 1), desc: l.description || l.desc || '', plugins: (l.plugins || []).filter((p) => plugins.some((x) => x.name === p)) }))
    : [];

  const sha = git('rev-parse', '--short', 'HEAD') || 'local';
  const date = git('log', '-1', '--format=%cs') || today();
  const license = (readText(join(root, 'LICENSE')) || '').startsWith('MIT') ? 'MIT' : '';
  return {
    generatedAt: new Date().toISOString(),
    build: [sha, date, license].filter(Boolean).join(' · '),
    plugins, arts, log, lessons,
  };
}

// RSS 2.0 feed of releases, linked from the site as <BASE>feed.xml.
export function buildFeed(catalog, siteUrl = 'https://malinovskiy-alex.github.io/dev-digest-ai-marketplace/') {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const items = catalog.log.slice(0, 50).map(([plugin, from, to, date, summary]) => {
    const link = siteUrl + 'plugins/' + plugin + '/';
    return `    <item>\n      <title>${esc(plugin + ' ' + to)}</title>\n      <link>${esc(link)}</link>\n      <guid isPermaLink="false">${esc(plugin + '@' + to)}</guid>\n      <pubDate>${new Date(date + 'T00:00:00Z').toUTCString()}</pubDate>\n      <description>${esc(from + ' → ' + to + ': ' + summary)}</description>\n    </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>dev-digest-ai: plugin releases</title>\n    <link>${esc(siteUrl)}</link>\n    <description>New versions of plugins in the dev-digest-ai Claude Code marketplace.</description>\n${items.join('\n')}\n  </channel>\n</rss>\n`;
}

// Writes <dir>/data/catalog.json and <dir>/feed.xml (dir defaults to site/; both are generated, not committed).
export function writeSiteData(dir = SITE) {
  const catalog = buildCatalog();
  mkdirSync(join(dir, 'data'), { recursive: true });
  writeFileSync(join(dir, 'data', 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  writeFileSync(join(dir, 'feed.xml'), buildFeed(catalog));
  return catalog;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--dir');
  const dir = resolve(i > 0 ? process.argv[i + 1] : SITE);
  const c = writeSiteData(dir);
  console.log(`catalog: ${c.plugins.length} plugin(s), ${c.arts.length} component(s), ${c.log.length} release(s) → ${posix(relative(process.cwd(), join(dir, 'data', 'catalog.json')))} + feed.xml`);
}
