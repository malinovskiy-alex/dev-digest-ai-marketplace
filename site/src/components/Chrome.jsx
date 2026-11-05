// Page chrome: header with nav / stack / theme / menu, footer, toast and dialogs.
import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GH, LINKS } from '../config.js';
import { catalog } from '../data.js';
import { t } from '../i18n/index.js';
import { R } from '../lib/routes.js';
import { useApp } from '../state/AppState.jsx';
import { Ext, Icon } from './Icon.jsx';

const NAV = [
  ['nav.plugins', R.plugins(), ['plugins']],
  ['nav.start', R.start(), ['start']],
  ['nav.changelog', R.changelog(), ['changelog']],
  ['nav.course', R.course(), ['course']],
  ['nav.newp', R.newp(), ['new']],
];

// First path segment → nav section ('plugins' covers plugin and component pages).
const section = (pathname) => pathname.split('/').filter(Boolean)[0] || '';

export function Header() {
  const { stack, theme, toggleTheme, menu, setMenu } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const sec = section(pathname);
  const isHome = pathname === '/';
  const n = stack.length;
  const items = NAV.map(([key, to, m]) => ({ label: t(key), to, on: m.includes(sec) }));
  const themeLabel = theme === 'dark' ? t('header.toLight') : t('header.toDark');
  return (
    <header className="hdr">
      <div className="wrap hrow">
        <Link className="logo mono" to={R.home()}><span className="logo-m" aria-hidden="true">{t('app.logoMark')}</span>{t('app.name')}</Link>
        <nav className="navd" aria-label={t('nav.main')}>
          {items.map((it) => <Link key={it.to} className={'navl' + (it.on ? ' on' : '')} to={it.to} aria-current={it.on ? 'page' : 'false'}>{it.label}</Link>)}
        </nav>
        <div className="hright">
          {!isHome && <button className="btn sm hsearch hide-m" onClick={() => navigate(R.home(), { state: { focus: true } })}><span className="wrapc"><Icon name="search" />{t('header.search')}</span><kbd>{t('keys.slash')}</kbd></button>}
          <button className={'btn sm ' + (n ? '' : 'hide-m') + (sec === 'stack' ? ' on' : '')} onClick={() => navigate(R.stack())} aria-label={t('header.stackAria', { count: n })}>
            <Icon name="stack" /><span className="hide-m">{t('header.stack')}</span><span className={'cnt' + (n ? '' : ' zero')}>{n}</span>
          </button>
          <button className="btn sm icon" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <Ext className="btn sm icon hide-m" href={GH} aria-label={t('header.github')} title={t('header.github')}><Icon name="repo" /></Ext>
          <button className="btn icon menub" onClick={() => setMenu(!menu)} aria-label={t('header.menu')} aria-expanded={menu}><Icon name={menu ? 'close' : 'menu'} cls="i20" /></button>
        </div>
      </div>
      {menu && (
        <nav className="sheet" aria-label={t('nav.menu')}>
          {items.map((it) => <Link key={it.to} className={'navl' + (it.on ? ' on' : '')} to={it.to} aria-current={it.on ? 'page' : undefined}>{it.label}</Link>)}
          <Ext className="navl" href={GH}>{t('nav.github')}</Ext>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { setDialog } = useApp();
  return (
    <footer className="ftr">
      <div className="wrap ftrin">
        <div className="stackv4 grow" style={{ flexBasis: 260 }}>
          <span className="mono strong">{t('app.name')}</span>
          <span className="muted">{t('footer.tagline')}</span>
          <span className="mono subtle xs">{t('footer.builtFrom', { build: catalog.build })}</span>
        </div>
        <nav className="fnav" aria-label={t('footer.aria')}>
          <Ext href={GH}>{t('footer.repo')}</Ext>
          <Ext href={LINKS.contrib}>{t('footer.contributing')}</Ext>
          <Ext href={LINKS.security}>{t('footer.security')}</Ext>
          <Ext href={LINKS.releases}>{t('footer.releases')}</Ext>
          <a href={LINKS.feed} className="wrapc" style={{ gap: 4 }}><Icon name="rss" cls="i12" />{t('footer.feed')}</a>
          <Ext href={LINKS.request}>{t('footer.request')}</Ext>
          <button className="linkbtn" style={{ fontSize: 13 }} onClick={() => setDialog('keys')}>{t('footer.shortcuts')}</button>
        </nav>
      </div>
    </footer>
  );
}

export function Toast() {
  const { toast, runUndo } = useApp();
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.msg}</span>
      {toast.undo && <button className="tundo" onClick={runUndo}>{t('toast.undo')}</button>}
    </div>
  );
}

function Dialog({ id, children }) {
  const { setDialog } = useApp();
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current && ref.current.querySelector('.dacts .btn');
    if (el) el.focus();
    const onKey = (e) => { if (e.key === 'Escape') setDialog(null); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); };
  }, [setDialog]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setDialog(null); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>{children}</div>
    </div>
  );
}

const SHORTCUTS = [
  ['keys.slash', 'keys.slashText'], ['keys.esc', 'keys.escText'], ['keys.arrows', 'keys.arrowsText'], ['keys.enter', 'keys.enterText'],
  ['keys.c', 'keys.cText'], ['keys.s', 'keys.sText'], ['keys.help', 'keys.helpText'],
];

export function Dialogs() {
  const { dialog, setDialog, startSmart, clearStack, stack } = useApp();
  const close = () => setDialog(null);
  if (dialog === 'smart') return (
    <Dialog id="dlg-smart">
      <div className="wrapc" style={{ gap: 10 }}><Icon name="sparkle" cls="i20" style={{ color: 'var(--accent)' }} /><h2 id="dlg-smart" className="h2">{t('dialog.smartTitle')}</h2></div>
      <p className="muted" style={{ lineHeight: '21px' }}>{t('dialog.smartBody')}</p>
      <div className="dacts"><button className="btn" onClick={close}>{t('dialog.smartNo')}</button><button className="btn primary" onClick={startSmart}>{t('dialog.smartYes')}</button></div>
    </Dialog>
  );
  if (dialog === 'clear') return (
    <Dialog id="dlg-clear">
      <h2 id="dlg-clear" className="h2">{t('dialog.clearTitle')}</h2>
      <p className="muted">{t('dialog.clearBody', { count: stack.length })}</p>
      <div className="dacts"><button className="btn" onClick={close}>{t('dialog.clearNo')}</button><button className="btn danger" onClick={clearStack}>{t('dialog.clearYes')}</button></div>
    </Dialog>
  );
  if (dialog === 'keys') return (
    <Dialog id="dlg-keys">
      <h2 id="dlg-keys" className="h2">{t('dialog.keysTitle')}</h2>
      <div className="keys">{SHORTCUTS.map(([k, text]) => [<kbd key={k}>{t(k)}</kbd>, <span key={text}>{t(text)}</span>])}</div>
      <div className="dacts"><button className="btn" onClick={close}>{t('dialog.close')}</button></div>
    </Dialog>
  );
  return null;
}
