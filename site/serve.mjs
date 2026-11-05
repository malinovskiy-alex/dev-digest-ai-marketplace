#!/usr/bin/env node
// Local preview that mimics GitHub Pages: serves site/ under /dev-digest-ai-marketplace/
// and falls back to index.html (served as 404.html on Pages) for unknown paths.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = '/dev-digest-ai-marketplace/';
const PORT = Number(process.env.PORT) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

async function file(p) {
  try { const s = await stat(p); if (s.isDirectory()) p = join(p, 'index.html'); return { body: await readFile(p), type: TYPES[extname(p)] || 'application/octet-stream' }; } catch { return null; }
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') { res.writeHead(302, { Location: BASE }); return res.end(); }
  const rel = path.startsWith(BASE) ? path.slice(BASE.length) : null;
  const safe = rel === null ? null : normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const hit = safe === null ? null : await file(join(ROOT, safe));
  if (hit) { res.writeHead(200, { 'Content-Type': hit.type }); return res.end(hit.body); }
  const shell = await file(join(ROOT, 'index.html'));
  res.writeHead(404, { 'Content-Type': shell.type });
  res.end(shell.body);
}).listen(PORT, () => console.log(`http://localhost:${PORT}${BASE}`));
