// App-wide state: theme, stack (with dependencies and undo), Smart search, toast, copy feedback,
// dialogs and the home-screen search. Persisted to localStorage (ddai:stack, ddai:theme, ddai:smart).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { catalog } from '../data.js';
import { t } from '../i18n/index.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const KEY = (k) => 'ddai:' + k;

function loadStored() {
  const out = { stack: [], theme: null, smart: 'off', smartConsent: false, storageBlocked: false };
  try {
    const ls = window.localStorage;
    const s = ls.getItem(KEY('stack'));
    if (s) { const v = JSON.parse(s); if (Array.isArray(v)) out.stack = v.filter((x) => x && catalog.pm[x.name]); }
    const th = ls.getItem(KEY('theme'));
    if (th === 'light' || th === 'dark') out.theme = th;
    if (ls.getItem(KEY('smart')) === 'on') { out.smart = 'on'; out.smartConsent = true; }
  } catch {
    out.storageBlocked = true;
  }
  return out;
}

const save = (k, v) => { try { window.localStorage.setItem(KEY(k), typeof v === 'string' ? v : JSON.stringify(v)); } catch { /* storage blocked */ } };

export const SEARCH0 = { q: '', type: null, cat: null, tag: null, softOff: null, sort: 'rel', limit: 20, sel: -1 };

export function AppProvider({ children }) {
  const [stored] = useState(loadStored);
  const [theme, setTheme] = useState(stored.theme || 'dark');
  const [stack, setStackState] = useState(stored.stack);
  const stackRef = useRef(stored.stack);
  const [smart, setSmart] = useState(stored.smart);
  const [smartPct, setSmartPct] = useState(0);
  const smartConsent = useRef(stored.smartConsent);
  const [toast, setToast] = useState(null);
  const undoFn = useRef(null);
  const [copied, setCopied] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [menu, setMenu] = useState(false);
  const [search, setSearchState] = useState(SEARCH0);
  const timers = useRef({});

  useEffect(() => () => { const t = timers.current; clearTimeout(t.toast); clearTimeout(t.copy); clearInterval(t.smart); }, []);

  const setSearch = useCallback((patch) => setSearchState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), []);

  const showToast = useCallback((msg, undo) => {
    clearTimeout(timers.current.toast);
    undoFn.current = undo || null;
    setToast({ msg, undo: !!undo });
    timers.current.toast = setTimeout(() => setToast(null), undo ? 5000 : 3000);
  }, []);

  const runUndo = useCallback(() => {
    if (undoFn.current) undoFn.current();
    undoFn.current = null;
    clearTimeout(timers.current.toast);
    setToast(null);
  }, []);

  const copy = useCallback((text, key, msg) => {
    const ok = () => {
      clearTimeout(timers.current.copy);
      setCopied(key);
      timers.current.copy = setTimeout(() => setCopied(null), 2000);
      showToast(msg || t('common.copiedToast'));
    };
    const fail = () => showToast(t('common.copyFallback'));
    try { navigator.clipboard.writeText(text).then(ok, fail); } catch { fail(); }
  }, [showToast]);

  const download = useCallback((data, file, type, msg) => {
    try {
      const blob = new Blob([data], { type: type || 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showToast(msg || t('common.downloaded', { file }));
      return true;
    } catch {
      showToast(t('common.downloadBlocked'));
      return false;
    }
  }, [showToast]);

  const setStack = useCallback((s) => { stackRef.current = s; setStackState(s); save('stack', s); }, []);

  const addPlugin = useCallback((name, quiet) => {
    const s = stackRef.current.slice();
    const ex = s.find((x) => x.name === name);
    if (ex) { if (ex.dep) setStack(s.map((x) => (x.name === name ? { name, dep: null } : x))); return; }
    s.push({ name, dep: null });
    (catalog.pm[name].deps || []).forEach((d) => { if (catalog.pm[d] && !s.find((x) => x.name === d)) s.push({ name: d, dep: name }); });
    setStack(s);
    if (!quiet) showToast(t('toast.added', { name }));
  }, [setStack, showToast]);

  const removePlugin = useCallback((name) => {
    const prev = stackRef.current;
    const it = prev.find((x) => x.name === name);
    if (!it) return;
    if (it.dep && prev.find((x) => x.name === it.dep)) { showToast(t('toast.requiredBy', { name, parent: it.dep })); return; }
    setStack(prev.filter((x) => x.name !== name && x.dep !== name));
    showToast(t('toast.removed', { name }), () => setStack(prev));
  }, [setStack, showToast]);

  const toggleStack = useCallback((name) => {
    if (stackRef.current.find((x) => x.name === name)) removePlugin(name); else addPlugin(name);
  }, [addPlugin, removePlugin]);

  const clearStack = useCallback(() => {
    const prev = stackRef.current;
    setStack([]);
    setDialog(null);
    showToast(t('toast.cleared'), () => setStack(prev));
  }, [setStack, showToast]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => { const next = t === 'dark' ? 'light' : 'dark'; save('theme', next); return next; });
  }, []);

  const smartUnsupported = typeof WebAssembly === 'undefined';

  // Simulated one-time model download (as in the prototype): progress ring, then "on".
  const startSmart = useCallback(() => {
    clearInterval(timers.current.smart);
    setDialog(null);
    setSmart('downloading');
    let pct = 0;
    setSmartPct(0);
    timers.current.smart = setInterval(() => {
      pct = Math.min(100, pct + 9);
      if (pct >= 100) {
        clearInterval(timers.current.smart);
        setSmartPct(100);
        setSmart('on');
        smartConsent.current = true;
        save('smart', 'on');
        showToast(t('toast.smartOn'));
      } else setSmartPct(pct);
    }, 150);
  }, [showToast]);

  const toggleSmart = useCallback(() => {
    if (smartUnsupported) return;
    if (smart === 'on') { setSmart('off'); save('smart', 'off'); return; }
    if (smart === 'downloading') return;
    if (smartConsent.current) startSmart(); else setDialog('smart');
  }, [smart, smartUnsupported, startSmart]);

  const value = useMemo(() => ({
    theme, toggleTheme,
    stack, inStack: (n) => !!stack.find((x) => x.name === n), addPlugin, removePlugin, toggleStack, clearStack,
    storageBlocked: stored.storageBlocked,
    smart, smartPct, smartUnsupported, toggleSmart, startSmart,
    toast, showToast, runUndo,
    copied, copy, download,
    dialog, setDialog,
    menu, setMenu,
    search, setSearch,
  }), [theme, toggleTheme, stack, addPlugin, removePlugin, toggleStack, clearStack, stored.storageBlocked, smart, smartPct, smartUnsupported, toggleSmart, startSmart, toast, showToast, runUndo, copied, copy, download, dialog, menu, search, setSearch]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
