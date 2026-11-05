#!/usr/bin/env node
// Local server that mimics GitHub Pages: serves site/ under /dev-digest-ai-marketplace/
// and falls back to index.html (served as 404.html on Pages) for unknown paths.
//
//   node site/serve.mjs          preview: exactly what Pages serves
//   node site/serve.mjs --dev    development: + live reload on any change in site/
//   PORT=3000 node site/serve.mjs --dev
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { extname, join, normalize, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = '/dev-digest-ai-marketplace/';
const PORT = Number(process.env.PORT) || 8080;
const DEV = process.argv.includes('--dev');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

// ---- live reload (dev only) ------------------------------------------------
const clients = new Set();
const RELOAD = `<script>(() => {
  const es = new EventSource('/__dev/events');
  es.onmessage = (e) => { console.info('[dev] ' + e.data + ' changed, reloading'); location.reload(); };
  es.onerror = () => { es.close(); setTimeout(() => location.reload(), 1000); }; // server restarted
})();</script>`;

if (DEV) {
  let timer = null;
  let changed = new Set();
  watch(ROOT, { recursive: true }, (_event, file) => {
    if (!file || file.split(sep).some((p) => p.startsWith('.') || p === 'node_modules')) return;
    changed.add(file.split(sep).join('/'));
    clearTimeout(timer);
    timer = setTimeout(() => {
      const list = [...changed].join(', ');
      changed = new Set();
      console.log(`changed: ${list} → reload ${clients.size} tab(s)`);
      for (const res of clients) res.write(`data: ${list}\n\n`);
    }, 100); // editors write files in several steps
  });
}

// ---- static files ----------------------------------------------------------
async function file(p) {
  try {
    const s = await stat(p);
    if (s.isDirectory()) p = join(p, 'index.html');
    return { body: await readFile(p), type: TYPES[extname(p)] || 'application/octet-stream', html: extname(p) === '.html' };
  } catch { return null; }
}

function send(res, status, hit) {
  let body = hit.body;
  if (DEV && hit.html) body = Buffer.from(body.toString('utf8').replace('</body>', RELOAD + '\n</body>'));
  res.writeHead(status, { 'Content-Type': hit.type, 'Cache-Control': DEV ? 'no-store' : 'no-cache' });
  res.end(body);
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  if (DEV && path === '/__dev/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (path === '/') { res.writeHead(302, { Location: BASE }); return res.end(); }

  const rel = path.startsWith(BASE) ? path.slice(BASE.length) : null;
  const abs = rel === null ? null : join(ROOT, normalize(rel));
  const inside = abs !== null && !relative(ROOT, abs).startsWith('..');
  const hit = inside ? await file(abs) : null;
  if (hit) return send(res, 200, hit);
  send(res, 404, await file(join(ROOT, 'index.html'))); // like 404.html on Pages
}).listen(PORT, () => {
  console.log(`${DEV ? 'dev (live reload)' : 'preview'}: http://localhost:${PORT}${BASE}`);
});
