// Client-side catalog search: tokenizer, typo-tolerant word scoring, synonyms, soft type detection,
// field-weighted document scoring, AND → OR fallback ("partial matches") and highlight segments.
import { TYPE_ORDER } from './types.js';

export const SYN = { tldr: ['summarize', 'summary', 'digest'], summary: ['summarize', 'digest', 'tldr'], changelog: ['release', 'notes', 'changes'], release: ['changelog', 'version'], pr: ['pull', 'request', 'review'] };
export const STOP = new Set('i me my we our you your need needs want wants looking look for a an the to that which can could help me something tool tools plugin plugins skill skills agent agents please is are was be of on in with and or it this that how do does find some any would like should will from by at as get make'.split(' '));
export const TYPEW = { skill: 'skill', skills: 'skill', agent: 'agent', agents: 'agent', hook: 'hook', hooks: 'hook', mcp: 'mcp', command: 'command', commands: 'command' };
// Smart search: words in other languages mapped to catalog vocabulary.
export const LEX = { 'резюме': 'summarize', 'підсумок': 'summarize', 'підсумуй': 'summarize', 'зведення': 'summarize', 'саммари': 'summarize', 'резюмировать': 'summarize', 'zusammenfassung': 'summarize', 'resumen': 'summarize', 'реліз': 'release', 'релізу': 'release', 'релиз': 'release', 'нотатки': 'notes', 'заметки': 'notes', 'нотаток': 'notes' };

export const toks = (s) => String(s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export const lev = (a, b) => {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = [];
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};

// How well a query term matches one word: exact 1, prefix .85, typo .6, typo in prefix .5.
export const wscore = (term, word) => {
  if (word === term) return 1;
  if (word.startsWith(term)) return 0.85;
  if (term.length >= 4) {
    const m = Math.max(1, Math.round(term.length * 0.2));
    if (Math.abs(word.length - term.length) <= m + 1 && lev(term, word) <= m) return 0.6;
    if (word.length > term.length && lev(term, word.slice(0, term.length)) <= m) return 0.5;
  }
  return 0;
};

export const analyze = (q, smart) => {
  const raw = toks(q);
  let soft = null;
  const terms = [];
  raw.forEach((w) => {
    if (TYPEW[w] && !soft) soft = TYPEW[w];
    if (STOP.has(w) || TYPEW[w]) return;
    const t = smart && LEX[w] ? LEX[w] : w;
    if (terms.indexOf(t) < 0) terms.push(t);
  });
  return { terms, soft };
};

// One searchable document per plugin and per component. Fields are weighted: name 4, tags 3, description 2, plugin 1.5, category 1, body 1.
export function buildDocs(plugins, arts, pm) {
  const docs = [];
  plugins.forEach((p) => docs.push({ id: 'plugin:' + p.name, type: 'plugin', name: p.name, plugin: p.name, description: p.description, tags: p.tags, category: p.category, text: (p.readme || []).map((b) => b[1]).join(' '), p, a: null, updatedAt: p.updatedAt }));
  arts.forEach((a) => {
    const p = pm[a.plugin];
    const gen = a.type === 'hook' || a.type === 'mcp';
    docs.push({ id: a.id, type: a.type, name: a.name, plugin: a.plugin, description: a.description + (gen ? ' ' + p.description : ''), tags: p.tags, category: p.category, text: (a.body || []).map((b) => b[1]).join(' ').slice(0, 2000), p, a, updatedAt: p.updatedAt });
  });
  docs.forEach((d) => { d.f = [[toks(d.name), 4], [toks(d.tags.join(' ')), 3], [toks(d.description), 2], [toks(d.plugin), 1.5], [toks(d.category), 1], [toks(d.text), 1]]; });
  return docs;
}

// groups: one group per query term = [[term, 1], [synonym, .5], ...]. mode 'and' needs every group to hit.
export const scoreDoc = (d, groups, mode) => {
  let total = 0, hit = 0;
  groups.forEach((g) => {
    let gs = 0;
    g.forEach(([term, gw]) => {
      let best = 0;
      d.f.forEach(([ws, fw]) => ws.forEach((w) => { const s = wscore(term, w); if (s * fw > best) best = s * fw; }));
      gs += best * gw;
    });
    if (gs > 0) hit++;
    total += gs;
  });
  if (mode === 'and' && hit < groups.length) return 0;
  return hit ? total : 0;
};

// Splits text into [{ t, m }] segments, m = true for words that match a term (rendered as <mark>).
export const seg = (text, terms) => {
  if (!terms.length) return [{ t: String(text), m: false }];
  const out = [];
  String(text).split(/([\p{L}\p{N}]+)/u).forEach((part) => {
    if (!part) return;
    const m = /[\p{L}\p{N}]/u.test(part) && terms.some((t) => wscore(t, part.toLowerCase()) > 0);
    const last = out[out.length - 1];
    if (!m && last && !last.m) last.t += part; else out.push({ t: part, m });
  });
  return out;
};

const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };

// The whole home-screen search as one pure function.
// st: { q, smart, type, cat, tag, softOff, sort }. Returns the sorted result list and the facet counts.
export function runSearch(docs, plugins, st) {
  const an = analyze(st.q, !!st.smart);
  const hasQ = an.terms.length > 0;
  const softType = (!st.type && an.soft && st.softOff !== st.q.trim()) ? an.soft : null;
  const effType = st.type || softType;
  const groups = an.terms.map((t) => [[t, 1]].concat((SYN[t] || []).map((s) => [s, 0.5])));
  const hlTerms = [];
  groups.forEach((g) => g.forEach(([t]) => { if (hlTerms.indexOf(t) < 0) hlTerms.push(t); }));
  let base, partial = false;
  if (hasQ) {
    base = docs.map((d) => ({ d, s: scoreDoc(d, groups, 'and') })).filter((x) => x.s > 0);
    if (!base.length) { base = docs.map((d) => ({ d, s: scoreDoc(d, groups, 'or') })).filter((x) => x.s > 0); partial = base.length > 0; }
  } else base = docs.map((d) => ({ d, s: 0 }));
  const fT = (x) => !effType || x.d.type === effType;
  const fC = (x) => !st.cat || x.d.category === st.cat;
  const fG = (x) => !st.tag || x.d.tags.indexOf(st.tag) >= 0;
  const anyFilter = !!(st.type || softType || st.cat || st.tag);
  let list = base.filter((x) => fT(x) && fC(x) && fG(x));
  if (!hasQ && !anyFilter) list = list.filter((x) => x.d.type === 'plugin');
  const sortKey = (!hasQ && st.sort === 'rel') ? 'upd' : st.sort;
  list.sort((a, b) => (sortKey === 'name' ? a.d.name.localeCompare(b.d.name)
    : sortKey === 'upd' ? (b.d.updatedAt.localeCompare(a.d.updatedAt) || a.d.name.localeCompare(b.d.name))
      : (b.s - a.s || a.d.name.localeCompare(b.d.name))));

  const typeCounts = {}; base.filter((x) => fC(x) && fG(x)).forEach((x) => inc(typeCounts, x.d.type));
  const catCounts = {}; base.filter((x) => fT(x) && fG(x)).forEach((x) => inc(catCounts, x.d.category));
  const tagCounts = {}; base.filter((x) => fT(x) && fC(x)).forEach((x) => x.d.tags.forEach((t) => inc(tagCounts, t)));
  const cats = categories(plugins);
  const tagFreq = {}; plugins.forEach((p) => p.tags.forEach((t) => inc(tagFreq, t)));
  const tags = Object.keys(tagFreq).sort((a, b) => (tagFreq[b] - tagFreq[a]) || a.localeCompare(b)).slice(0, 12);
  return { terms: an.terms, hasQ, softType, effType, hlTerms, partial, anyFilter, list, typeCounts, catCounts, tagCounts, cats, tags, types: TYPE_ORDER };
}

export const categories = (plugins) => [...new Set(plugins.map((p) => p.category))].sort();
