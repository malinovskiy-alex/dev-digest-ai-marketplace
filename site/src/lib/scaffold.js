// "Build a plugin": form validation and the generated plugin files.
import { MKT, REPO } from '../config.js';
import { t } from '../i18n/index.js';

export const EMPTY_FORM = { name: '', displayName: '', description: '', category: 'productivity', catOther: '', tags: [], tagDraft: '', authorName: '', authorUrl: '', skillName: '', skillDesc: '' };

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validate(f) {
  const errs = {};
  const e = (k) => t('newp.err.' + k);
  if (!f.name) errs.name = e('nameRequired');
  else if (!KEBAB.test(f.name)) errs.name = e('nameKebab');
  else if (f.name.length < 2 || f.name.length > 64) errs.name = e('nameLength');
  else if (/^(claude-|anthropic-|cc-plugin-)/.test(f.name)) errs.name = e('namePrefix');
  const dl = f.description.trim().length;
  if (dl < 10 || f.description.length > 2000) errs.description = e('description');
  if (f.category === '__other' && !KEBAB.test(f.catOther)) errs.category = e('category');
  if (f.authorUrl && !/^https?:\/\//.test(f.authorUrl)) errs.authorUrl = e('authorUrl');
  if (!f.skillName) errs.skillName = e('skillRequired');
  else if (!KEBAB.test(f.skillName)) errs.skillName = e('skillKebab');
  if (f.skillDesc.trim().length < 10) errs.skillDesc = e('skillDesc');
  return errs;
}

const MIT = (year, holder) => `MIT License

Copyright (c) ${year} ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

// Returns { nm, sk, files: { tabName: text }, paths: [[zipPath, tabName]], tree }.
export function scaffold(f, year = new Date().getFullYear()) {
  const nm = f.name || 'your-plugin', sk = f.skillName || 'your-skill';
  const catVal = f.category === '__other' ? (f.catOther || 'other') : f.category;
  const descV = f.description.trim() || '[What the plugin does]';
  const pluginJson = { name: nm };
  if (f.displayName) pluginJson.displayName = f.displayName;
  pluginJson.version = '0.1.0';
  pluginJson.description = descV;
  pluginJson.author = f.authorUrl ? { name: f.authorName || '[Author]', url: f.authorUrl } : { name: f.authorName || '[Author]' };
  pluginJson.license = 'MIT';
  pluginJson.keywords = f.tags;
  const entry = { name: nm, source: './plugins/' + nm, description: descV, version: '0.1.0', category: catVal, tags: f.tags };
  const files = {
    'plugin.json': JSON.stringify(pluginJson, null, 2) + '\n',
    'SKILL.md': '---\nname: ' + sk + '\ndescription: ' + (f.skillDesc.trim() || '[What it does and when Claude should use it]') + '\n---\n\n# ' + sk + '\n\n[Instructions Claude follows when this skill runs.]\n',
    'README.md': '# ' + (f.displayName || nm) + '\n\n' + descV + '\n\n## Install\n\n/plugin marketplace add ' + REPO + '\n/plugin install ' + nm + '@' + MKT + '\n\n## Components\n\n- /' + nm + ':' + sk + ' — ' + (f.skillDesc.trim() || '[skill description]') + '\n\n## Security\n\nNo hooks, MCP servers or scripts.\n\n## Changelog\n\n- 0.1.0 — First release\n\n## License\n\nMIT\n',
    'LICENSE': MIT(year, f.authorName || '[Author]'),
    'marketplace-entry.json': JSON.stringify(entry, null, 2) + '\n',
  };
  const paths = [
    ['plugins/' + nm + '/.claude-plugin/plugin.json', 'plugin.json'],
    ['plugins/' + nm + '/skills/' + sk + '/SKILL.md', 'SKILL.md'],
    ['plugins/' + nm + '/README.md', 'README.md'],
    ['plugins/' + nm + '/LICENSE', 'LICENSE'],
    ['marketplace-entry.json', 'marketplace-entry.json'],
  ];
  const tree = 'plugins/' + nm + '/\n├── .claude-plugin/plugin.json\n├── skills/' + sk + '/SKILL.md\n├── README.md\n└── LICENSE\nmarketplace-entry.json';
  return { nm, sk, files, paths, tree };
}
