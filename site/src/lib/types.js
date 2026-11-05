// Component types: CSS class and icon. Labels and plurals live in i18n (types.<type>.*).
import { t } from '../i18n/index.js';

export const TYPES = {
  plugin: { cls: 't-plugin', icon: 'plugin' },
  skill: { cls: 't-skill', icon: 'skill' },
  agent: { cls: 't-agent', icon: 'agent' },
  command: { cls: 't-command', icon: 'command' },
  hook: { cls: 't-hook', icon: 'hook' },
  mcp: { cls: 't-mcp', icon: 'plug' },
};
export const TYPE_ORDER = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'];

// Badge label (commands are shown as legacy), filter chip label, long name, "3 skills".
export const typeLabel = (type) => (type === 'command' ? t('types.legacyCommand') : t('types.' + type + '.label'));
export const typeChip = (type) => t('types.' + type + '.chip');
export const typeName = (type) => t('types.' + type + '.name');
export const typeCount = (type, count) => t('types.' + type + '.count', { count });
export const typeIcon = (type) => (type === 'command' ? 'legacy' : TYPES[type].icon);
