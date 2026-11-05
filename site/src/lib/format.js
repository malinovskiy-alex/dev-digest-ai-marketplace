import { messages, t } from '../i18n/index.js';

const day = (s) => new Date(s + 'T00:00:00Z');
const month = (d) => messages().months[d.getUTCMonth()];

export const fmt = (s) => { const d = day(s); return t('date.full', { mon: month(d).slice(0, 3), day: d.getUTCDate(), year: d.getUTCFullYear() }); };
export const fmtShort = (s) => { const d = day(s); return t('date.short', { mon: month(d).slice(0, 3), day: d.getUTCDate() }); };
export const monthOf = (s) => { const d = day(s); return t('date.month', { month: month(d), year: d.getUTCFullYear() }); };
export const hostOf = (u) => { try { return new URL(u).host; } catch { return u; } };
