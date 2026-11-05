// URLs of the screens (relative to the router basename, i.e. BASE) and install / settings text.
import { GH, MKT, REPO } from '../config.js';

export const R = {
  home: () => '/',
  plugins: () => '/plugins/',
  plugin: (p) => '/plugins/' + p + '/',
  artifact: (a) => '/plugins/' + a.plugin + '/' + a.type + '/' + a.name + '/',
  stack: () => '/stack/',
  changelog: (plugin) => '/changelog/' + (plugin ? '?plugin=' + encodeURIComponent(plugin) : ''),
  start: (hash) => '/start/' + (hash ? '#' + hash : ''),
  course: () => '/course/',
  newp: () => '/new/',
};

export const ADD_MKT = '/plugin marketplace add ' + REPO;
export const installCmd = (name) => '/plugin install ' + name + '@' + MKT;
export const installText = (name) => ADD_MKT + '\n' + installCmd(name);

export const settingsJson = (names) => {
  const enabled = {};
  names.slice().sort().forEach((n) => { enabled[n + '@' + MKT] = true; });
  return JSON.stringify({ extraKnownMarketplaces: { [MKT]: { source: { source: 'github', repo: REPO } } }, enabledPlugins: enabled }, null, 2);
};

export const ghFile = (plugin, file) => GH + '/blob/main/plugins/' + plugin + '/' + file;
export const ghTree = (plugin) => GH + '/tree/main/plugins/' + plugin;
export const issueUrl = (p) => GH + '/issues/new?template=plugin-bug.yml&title=' + encodeURIComponent('[' + p.name + '@' + p.version + '] ');
// Release tags are `<plugin>--v<version>` (docs/RELEASES.md).
export const releaseUrl = (plugin, version) => GH + '/releases/tag/' + plugin + '--v' + version;
