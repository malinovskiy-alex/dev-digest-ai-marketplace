// Tiny message lookup.
//
//   t('home.title')                       → plain string
//   t('footer.builtFrom', { build })      → "{build}" replaced by params.build
//   t('count.plugin', { count: 3 })       → uses the `plugin_one` / `plugin_other` keys (Intl.PluralRules),
//                                           "{count}" is replaced as well
//
// Keys are dotted paths into the locale object. A missing key returns the key itself (and the
// i18n test fails on it). To add a language: create e.g. uk.js with the same shape and register it in LOCALES.
import en from './en.js';

const LOCALES = { en };
let locale = 'en';
let rules = new Intl.PluralRules(locale);

export const setLocale = (l) => { if (LOCALES[l]) { locale = l; rules = new Intl.PluralRules(l); } };
export const messages = (l = locale) => LOCALES[l];

const lookup = (key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), LOCALES[locale]);

export function has(key) {
  return typeof lookup(key) === 'string' || typeof lookup(key + '_other') === 'string';
}

export function t(key, params) {
  let msg;
  if (params && typeof params.count === 'number') {
    const form = rules.select(params.count);
    msg = lookup(key + '_' + form);
    if (typeof msg !== 'string') msg = lookup(key + '_other');
  }
  if (typeof msg !== 'string') msg = lookup(key);
  if (typeof msg !== 'string') return key;
  return params ? msg.replace(/\{(\w+)\}/g, (m, p) => (p in params ? String(params[p]) : m)) : msg;
}
