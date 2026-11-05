import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, buildFeed } from './build/catalog.mjs';

const SITE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SITE_DIR, '..');
const BASE = '/dev-digest-ai-marketplace/';

// `import catalog from 'virtual:catalog'` → the catalog generated from the repository
// (plugins/ + .claude-plugin/marketplace.json). Real data only: there is no fallback.
function catalogPlugin() {
  const ID = 'virtual:catalog';
  const RID = '\0' + ID;
  const norm = (p) => { const r = resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; };
  const watched = [join(REPO_ROOT, 'plugins'), join(REPO_ROOT, '.claude-plugin'), join(SITE_DIR, 'course-map.json')];
  let catalog = null;
  return {
    name: 'dd-catalog',
    resolveId(id) { return id === ID ? RID : null; },
    load(id) {
      if (id !== RID) return null;
      catalog = buildCatalog(REPO_ROOT);
      return 'export default ' + JSON.stringify(catalog) + ';\n';
    },
    configureServer(server) {
      server.watcher.add(watched);
      const roots = watched.map(norm);
      const onFile = (file) => {
        const f = norm(file);
        if (!roots.some((r) => f === r || f.startsWith(r + sep))) return;
        const graph = (server.environments && server.environments.client && server.environments.client.moduleGraph) || server.moduleGraph;
        const mod = graph.getModuleById(RID);
        if (mod) graph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      ['add', 'change', 'unlink', 'addDir', 'unlinkDir'].forEach((ev) => server.watcher.on(ev, onFile));
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'feed.xml', source: buildFeed(catalog || buildCatalog(REPO_ROOT)) });
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), catalogPlugin()],
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    environment: 'node',
  },
});
