#!/usr/bin/env node
// Deterministic half of /sdd-engineering:workflow-retro: reads Claude Code session
// transcripts (~/.claude/projects/<encoded project path>/<session>.jsonl and
// <session>/subagents/*) and prints a compact markdown summary — tokens, agents,
// launch order, tool calls, errors and files read by more than one agent.
// Never prints transcript text beyond a trimmed tool-error message.
//
// Plain Node >= 20, no dependencies. Run with --help for usage.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const IDLE_GAP_MS = 5 * 60 * 1000; // a gap longer than this is waiting, not work

const USAGE = `Usage: node session-stats.mjs [--session <id>|latest] [--project <dir>] [--cwd <dir>] [--json]

  --session <id>|latest  transcript to read (default: latest = most recently modified)
  --project <dir>        the transcript folder itself (~/.claude/projects/<encoded path>);
                         skips auto-detection
  --cwd <dir>            the project directory to find transcripts for (default: the
                         current directory; its parent directories are tried too)
  --json                 print the raw structure instead of markdown
  --help                 this text

Transcripts are looked up under $CLAUDE_CONFIG_DIR/projects or ~/.claude/projects.
The folder name is the project path with every non-alphanumeric character replaced
by "-" (matched case-insensitively). A --session id that is not in that folder is
searched for in every project folder.`;

class UsageError extends Error {}

function parseArgs(argv) {
  const args = { session: 'latest', project: null, cwd: process.cwd(), json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new UsageError(`${a} needs a value`);
      return v;
    };
    if (a === '--session') args.session = value();
    else if (a === '--project') args.project = value();
    else if (a === '--cwd') args.cwd = value();
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new UsageError(`unknown argument: ${a}`);
  }
  // An unsubstituted ${CLAUDE_SESSION_ID} (or an empty value) falls back to latest.
  if (!args.session || args.session.startsWith('${') || args.session.startsWith('$')) args.session = 'latest';
  return args;
}

function projectsRoot() {
  const base = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(base, 'projects');
}

const encode = (p) => path.resolve(p).replace(/[^a-zA-Z0-9]/g, '-');

function listDirs(root) {
  try {
    return fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

// The current project's transcript folder: the encoded cwd, then each parent
// (Claude Code may have been started from the repo root while the shell is in a
// subfolder). Matching is case-insensitive because the drive letter's case varies
// on Windows. Very long paths are stored truncated, so a prefix match is the last try.
function findProjectDir(cwd) {
  const root = projectsRoot();
  const dirs = listDirs(root);
  if (!dirs.length) return { dir: null, tried: [root] };
  const tried = [];
  let current = path.resolve(cwd);
  for (;;) {
    const name = encode(current);
    tried.push(path.join(root, name));
    const exact = dirs.find((d) => d === name) ?? dirs.find((d) => d.toLowerCase() === name.toLowerCase());
    if (exact) return { dir: path.join(root, exact), tried };
    if (name.length > 180) {
      const prefix = name.slice(0, 180).toLowerCase();
      const hit = dirs.find((d) => d.toLowerCase().startsWith(prefix));
      if (hit) return { dir: path.join(root, hit), tried };
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return { dir: null, tried };
}

function findSessionAnywhere(sessionId) {
  const root = projectsRoot();
  for (const d of listDirs(root)) {
    if (fs.existsSync(path.join(root, d, `${sessionId}.jsonl`))) return path.join(root, d);
  }
  return null;
}

function latestSession(dir) {
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new UsageError(`no transcripts (*.jsonl) in ${dir}`);
  return files[0].f.replace(/\.jsonl$/, '');
}

function locate(args) {
  if (args.project) {
    if (!fs.existsSync(args.project)) throw new UsageError(`--project folder does not exist: ${args.project}`);
    const sessionId = args.session === 'latest' ? latestSession(args.project) : args.session;
    return { dir: args.project, sessionId };
  }
  const { dir, tried } = findProjectDir(args.cwd);
  if (args.session !== 'latest') {
    if (dir && fs.existsSync(path.join(dir, `${args.session}.jsonl`))) return { dir, sessionId: args.session };
    const other = findSessionAnywhere(args.session);
    if (other) return { dir: other, sessionId: args.session };
    throw new UsageError(`session ${args.session} not found under ${projectsRoot()}`);
  }
  if (!dir) {
    throw new UsageError(`no transcript folder for this project. Tried:\n  ${tried.join('\n  ')}\nPass --project <dir> or --cwd <project dir>.`);
  }
  return { dir, sessionId: latestSession(dir) };
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

// One API response is split into several records (one per content block) that
// repeat the same usage, so usage is counted once per message id.
function tokenTotals(records) {
  const seen = new Set();
  const t = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, thinking: 0, requests: 0 };
  for (const r of records) {
    if (r.type !== 'assistant' || !r.message?.usage) continue;
    const id = r.message.id ?? r.requestId ?? r.uuid;
    if (seen.has(id)) continue;
    seen.add(id);
    const u = r.message.usage;
    t.input += u.input_tokens ?? 0;
    t.cacheWrite += u.cache_creation_input_tokens ?? 0;
    t.cacheRead += u.cache_read_input_tokens ?? 0;
    t.output += u.output_tokens ?? 0;
    t.thinking += u.output_tokens_details?.thinking_tokens ?? 0;
    t.requests += 1;
  }
  t.totalInput = t.input + t.cacheWrite + t.cacheRead;
  t.cacheHit = t.totalInput ? t.cacheRead / t.totalInput : 0;
  return t;
}

function toolUses(records) {
  const out = [];
  for (const r of records) {
    if (r.type !== 'assistant' || !Array.isArray(r.message?.content)) continue;
    for (const b of r.message.content) if (b.type === 'tool_use') out.push(b);
  }
  return out;
}

function toolErrors(records, uses) {
  const byId = new Map(uses.map((u) => [u.id, u]));
  const out = [];
  for (const r of records) {
    if (r.type !== 'user' || !Array.isArray(r.message?.content)) continue;
    for (const b of r.message.content) {
      if (b.type !== 'tool_result' || !b.is_error) continue;
      const text = typeof b.content === 'string' ? b.content
        : (Array.isArray(b.content) ? b.content : []).map((c) => c.text ?? '').join(' ');
      out.push({ tool: byId.get(b.tool_use_id)?.name ?? '?', text: text.replace(/\s+/g, ' ').slice(0, 160) });
    }
  }
  return out;
}

function timing(records) {
  const ts = records.map((r) => Date.parse(r.timestamp)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!ts.length) return { start: null, end: null, activeMs: 0 };
  let active = 0;
  for (let i = 1; i < ts.length; i++) {
    const gap = ts[i] - ts[i - 1];
    if (gap < IDLE_GAP_MS) active += gap;
  }
  return { start: new Date(ts[0]).toISOString(), end: new Date(ts.at(-1)).toISOString(), activeMs: active };
}

// Prompts the agent received after its first one: coordinator messages / resumes.
function followUps(records) {
  return records.filter((r) => r.type === 'user' && typeof r.message?.content === 'string'
    && !r.message.content.startsWith('<system-reminder>')).length - 1;
}

function countBy(list, key) {
  const m = {};
  for (const x of list) m[key(x)] = (m[key(x)] ?? 0) + 1;
  return m;
}

function filePathOf(use) {
  const p = use.input?.file_path ?? use.input?.path;
  return typeof p === 'string' ? path.normalize(p).toLowerCase() : null;
}

function summarize(name, records, meta = {}) {
  const uses = toolUses(records);
  return {
    name,
    type: meta.agentType ?? 'main',
    description: meta.description ?? '',
    model: records.find((r) => r.type === 'assistant')?.message?.model ?? '?',
    tokens: tokenTotals(records),
    timing: timing(records),
    followUps: Math.max(0, followUps(records)),
    tools: countBy(uses, (u) => u.name),
    errors: toolErrors(records, uses),
    reads: [...new Set(uses.filter((u) => u.name === 'Read').map(filePathOf).filter(Boolean))],
    writes: [...new Set(uses.filter((u) => ['Write', 'Edit', 'NotebookEdit'].includes(u.name)).map(filePathOf).filter(Boolean))],
    spawned: uses.filter((u) => u.name === 'Agent' || u.name === 'Task')
      .map((u) => ({ type: u.input?.subagent_type ?? 'general-purpose', description: u.input?.description ?? '' })),
    asked: uses.filter((u) => u.name === 'AskUserQuestion').length,
  };
}

function readMeta(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function collect(dir, sessionId) {
  const main = readJsonl(path.join(dir, `${sessionId}.jsonl`));
  const agents = [summarize('main', main)];
  const subDir = path.join(dir, sessionId, 'subagents');
  if (fs.existsSync(subDir)) {
    for (const f of fs.readdirSync(subDir).filter((x) => x.endsWith('.jsonl'))) {
      const id = f.replace(/^agent-/, '').replace(/\.jsonl$/, '');
      const meta = readMeta(path.join(subDir, f.replace(/\.jsonl$/, '.meta.json')));
      agents.push(summarize(id, readJsonl(path.join(subDir, f)), meta));
    }
  }
  const subs = agents.slice(1).sort((a, b) => (a.timing.start ?? '').localeCompare(b.timing.start ?? ''));

  // Overlapping active windows = agents that ran in parallel.
  for (const a of subs) {
    a.parallelWith = subs.filter((b) => b !== a && a.timing.start && b.timing.start
      && b.timing.start < a.timing.end && a.timing.start < b.timing.end)
      .map((b) => b.type);
  }

  const readers = new Map();
  for (const a of agents) for (const p of a.reads) readers.set(p, [...(readers.get(p) ?? []), a.type]);
  const sharedReads = [...readers].filter(([, who]) => who.length > 1)
    .map(([file, who]) => ({ file, who })).sort((x, y) => y.who.length - x.who.length);

  const total = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, totalInput: 0, requests: 0 };
  for (const a of agents) for (const key of Object.keys(total)) total[key] += a.tokens[key];
  total.cacheHit = total.totalInput ? total.cacheRead / total.totalInput : 0;

  return { sessionId, transcriptDir: dir, main: agents[0], subagents: subs, total, sharedReads };
}

const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const pct = (x) => `${Math.round(x * 100)}%`;
const mins = (ms) => `${(ms / 60000).toFixed(1)} min`;
const cwdKey = path.normalize(process.cwd()).toLowerCase();
const short = (p) => (p.startsWith(cwdKey) ? `.${p.slice(cwdKey.length)}` : p).replace(/\\/g, '/');
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ');

function render(s) {
  const out = [];
  const row = (a) => `| ${a.type} | ${cell(a.description || '—')} | ${a.model} | ${k(a.tokens.totalInput)} | ${k(a.tokens.output)} | ${pct(a.tokens.cacheHit)} | ${a.tokens.requests} | ${mins(a.timing.activeMs)} | ${a.followUps} | ${a.errors.length} |`;
  out.push(`# Session ${s.sessionId}`, '');
  out.push(`**Total:** ${k(s.total.totalInput)} input (${k(s.total.cacheRead)} cache read, ${k(s.total.cacheWrite)} cache write, ${k(s.total.input)} uncached) · ${k(s.total.output)} output · ${s.total.requests} API requests · cache hit ${pct(s.total.cacheHit)} · ${s.subagents.length} subagent(s)`, '');
  out.push('## Agents (launch order)', '');
  out.push('| Agent | Task | Model | Input | Output | Cache hit | Requests | Active | Follow-ups | Tool errors |', '|---|---|---|---|---|---|---|---|---|---|');
  out.push(row(s.main));
  s.subagents.forEach((a) => out.push(row(a)));
  out.push('');
  out.push('## Timeline', '');
  s.subagents.forEach((a, i) => out.push(`${i + 1}. ${a.timing.start?.slice(11, 19) ?? '?'}–${a.timing.end?.slice(11, 19) ?? '?'} UTC \`${a.type}\` (${a.name})${a.parallelWith.length ? ` — parallel with ${a.parallelWith.join(', ')}` : ''}${a.spawned.length ? ` — spawned ${a.spawned.map((x) => x.type).join(', ')}` : ''}`));
  if (!s.subagents.length) out.push('_no subagents in this session_');
  out.push('');
  out.push('## Tool calls', '');
  for (const a of [s.main, ...s.subagents]) {
    const t = Object.entries(a.tools).sort((x, y) => y[1] - x[1]).map(([n, c]) => `${n} ${c}`).join(' · ');
    out.push(`- **${a.type}:** ${t || 'none'}${a.asked ? ` · asked the user ${a.asked}×` : ''}`);
  }
  out.push('');
  out.push('## Tool errors', '');
  const errs = [s.main, ...s.subagents].flatMap((a) => a.errors.map((e) => `- **${a.type}** \`${e.tool}\`: ${e.text}`));
  out.push(...(errs.length ? errs : ['_none_']), '');
  out.push('## Files read by more than one agent (duplication signal)', '');
  out.push(...(s.sharedReads.length ? s.sharedReads.slice(0, 25).map((r) => `- \`${short(r.file)}\` — ${r.who.join(', ')}`) : ['_none_']), '');
  out.push('## Files written', '');
  const w = [s.main, ...s.subagents].flatMap((a) => a.writes.map((p) => `- \`${short(p)}\` — ${a.type}`));
  out.push(...(w.length ? w : ['_none_']));
  return out.join('\n');
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`session-stats: ${e.message}\n\n${USAGE}\n`);
    process.exit(2);
  }
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  try {
    const { dir, sessionId } = locate(args);
    const stats = collect(dir, sessionId);
    process.stdout.write(args.json ? `${JSON.stringify(stats, null, 2)}\n` : `${render(stats)}\n`);
  } catch (e) {
    process.stderr.write(`session-stats: ${e instanceof UsageError ? e.message : e.stack}\n`);
    process.exit(1);
  }
}

main();
