// The catalog, generated at dev/build time from the repository by build/catalog.mjs (see vite.config.js).
// Real plugins only: there is no sample or fallback data.
import raw from 'virtual:catalog';
import { GH } from './config.js';
import { prepareCatalog } from './lib/catalog.js';

export const catalog = prepareCatalog(raw, GH);
