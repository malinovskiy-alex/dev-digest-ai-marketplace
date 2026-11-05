// Home: hero search, filters (type / category / tags), results with keyboard navigation, recently updated.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, cardHref } from '../components/Card.jsx';
import { Ext, Icon } from '../components/Icon.jsx';
import { LINKS } from '../config.js';
import { catalog } from '../data.js';
import { t } from '../i18n/index.js';
import { isEditable } from '../lib/dom.js';
import { R, installText } from '../lib/routes.js';
import { runSearch } from '../lib/search.js';
import { typeChip } from '../lib/types.js';
import { useApp } from '../state/AppState.jsx';

function SmartButton() {
  const { smart, smartPct, smartUnsupported, toggleSmart } = useApp();
  const tip = smartUnsupported ? t('home.smartUnsupported') : smart === 'on' ? t('home.smartOn') : smart === 'downloading' ? t('home.smartDownloading') : t('home.smartOff');
  return (
    <button className={'btn sm' + (smart === 'on' ? ' on' : '')} onClick={toggleSmart} aria-pressed={smart === 'on'} disabled={smartUnsupported} title={tip}>
      {smart === 'downloading' ? (
        <>
          <svg className="ring" viewBox="0 0 20 20" aria-hidden="true"><circle className="ring-bg" cx="10" cy="10" r="7" /><circle className="ring-fg" cx="10" cy="10" r="7" strokeDasharray="44" strokeDashoffset={String(44 * (1 - smartPct / 100))} transform="rotate(-90 10 10)" /></svg>
          <span className="mono">{t('home.smartPct', { pct: smartPct })}</span>
        </>
      ) : (
        <><Icon name="sparkle" /><span>{t('home.smart')}</span></>
      )}
    </button>
  );
}

function Chip({ on, disabled, onClick, cls = 'chip', title, children }) {
  return <button className={cls + (on ? ' on' : '')} onClick={onClick} disabled={disabled} aria-pressed={on} title={title || undefined}>{children}</button>;
}

export default function HomePage() {
  const { search: st, setSearch, smart, smartUnsupported, toggleSmart, copy, toggleStack, dialog, setDialog } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const qRef = useRef(null);

  const res = useMemo(() => runSearch(catalog.docs, catalog.plugins, { ...st, smart: smart === 'on' }), [st.q, st.type, st.cat, st.tag, st.softOff, st.sort, smart]); // eslint-disable-line react-hooks/exhaustive-deps
  const { hasQ, softType, effType, partial, anyFilter, list } = res;
  const shown = list.slice(0, st.limit).map((x) => x.d);
  const n = list.length;

  // Arrived via "Search" / "/" from another page: focus the box.
  useEffect(() => {
    if (location.state && location.state.focus && qRef.current) qRef.current.focus();
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the selected card visible.
  useEffect(() => {
    if (st.sel < 0) return;
    const el = document.querySelector('.results .card.sel');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [st.sel]);

  // c / s act on the selected result when focus is outside a text field.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || dialog || isEditable(e.target)) return;
      const d = shown[st.sel];
      if (!d) return;
      if (e.key === 'c') { e.preventDefault(); copy(installText(d.p.name), 'card:' + d.id); }
      else if (e.key === 's') { e.preventDefault(); toggleStack(d.p.name); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onQKey = (e) => {
    const len = shown.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSearch((s) => ({ sel: Math.min(s.sel + 1, len - 1) })); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSearch((s) => ({ sel: Math.max(s.sel - 1, -1) })); }
    else if (e.key === 'Enter') { const d = shown[Math.max(st.sel, 0)]; if (d) { e.preventDefault(); navigate(cardHref(d)); } }
    else if (e.key === 'Escape') { if (st.q) setSearch({ q: '', sel: -1 }); else e.target.blur(); }
  };

  const qTrim = st.q.trim();
  const countText = hasQ
    ? t('home.countQuery', { results: t('count.result', { count: n }), query: res.terms.join(' ') })
    : (anyFilter ? t('count.item', { count: n }) : t('home.countAll', { count: n }));
  const requestHref = LINKS.request + '&title=' + encodeURIComponent(t('home.requestTitle', { query: qTrim }));
  const showRecent = !hasQ && !anyFilter;
  const recent = catalog.log.slice(0, 5);
  const clearFilters = () => setSearch({ type: null, cat: null, tag: null, softOff: qTrim, sel: -1 });

  return (
    <>
      <section className="wrap hero">
        <h1 className="display">{t('home.title')}</h1>
        <div className="sbox">
          <Icon name="search" cls="i20 subtle" />
          <label htmlFor="q" className="sr">{t('common.searchLabel')}</label>
          <input id="q" ref={qRef} type="search" autoComplete="off" spellCheck="false" placeholder={t('home.placeholder')} value={st.q} onChange={(e) => setSearch({ q: e.target.value, sel: -1, limit: 20 })} onKeyDown={onQKey} aria-describedby="rcount" />
          {st.q.length > 0 && <button className="btn ghost icon" onClick={() => { setSearch({ q: '', sel: -1 }); if (qRef.current) qRef.current.focus(); }} aria-label={t('home.clear')}><Icon name="close" /></button>}
          {st.q.length === 0 && <kbd className="hide-m">{t('keys.slash')}</kbd>}
          <SmartButton />
        </div>
        <div className="herosub">
          <Link to={R.start()}>{t('home.newHere')}</Link>
          <span className="mono subtle">{t('home.totals', { plugins: t('count.plugin', { count: catalog.plugins.length }), components: t('count.component', { count: catalog.arts.length }) })}</span>
        </div>
      </section>

      <div className="wrap layout">
        <aside className="filters" aria-label={t('home.filters')}>
          <div className="fgrp">
            <div className="fhead"><h2 className="lbl">{t('home.type')}</h2>{anyFilter && <button className="linkbtn" onClick={clearFilters}>{t('home.clearAll')}</button>}</div>
            <div className="chipcol">
              {res.types.map((type) => {
                const on = effType === type;
                const auto = on && !st.type && softType === type;
                const count = res.typeCounts[type] || 0;
                const toggle = () => (auto ? setSearch({ softOff: qTrim, sel: -1 }) : setSearch({ type: st.type === type ? null : type, softOff: qTrim, sel: -1, limit: 20 }));
                return (
                  <Chip key={type} on={on} disabled={count === 0 && !on} onClick={toggle} title={auto ? t('home.autoTip') : ''}>
                    <span className="chl">{typeChip(type)}{auto && <span className="auto">{t('home.auto')}</span>}</span><span className="n">{count}</span>
                  </Chip>
                );
              })}
            </div>
          </div>
          <button className="btn sm fbtn" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}><Icon name="filter" />{t('home.moreFilters')}</button>
          <div className={'fmore' + (filtersOpen ? ' open' : '')}>
            <div className="fgrp">
              <h2 className="lbl">{t('home.category')}</h2>
              <div className="chipcol">
                {res.cats.map((c) => {
                  const on = st.cat === c, count = res.catCounts[c] || 0;
                  return <Chip key={c} on={on} disabled={count === 0 && !on} onClick={() => setSearch({ cat: on ? null : c, sel: -1, limit: 20 })}>{c}<span className="n">{count}</span></Chip>;
                })}
              </div>
            </div>
            <div className="fgrp">
              <h2 className="lbl">{t('home.tags')}</h2>
              <div className="chipwrap">
                {res.tags.map((tag) => {
                  const on = st.tag === tag, count = res.tagCounts[tag] || 0;
                  return <Chip key={tag} cls="chip sm mono" on={on} disabled={count === 0 && !on} onClick={() => setSearch({ tag: on ? null : tag, sel: -1, limit: 20 })}>{t('home.tag', { tag })}<span className="n">{count}</span></Chip>;
                })}
              </div>
            </div>
          </div>
        </aside>

        <section className="results" aria-label={t('home.results')}>
          <div className="rhead">
            <p id="rcount" className="rcount" aria-live="polite">{countText}</p>
            {softType && <button className="chip sm on" onClick={() => setSearch({ softOff: qTrim })} title={t('home.autoTip')}><span className="chl"><span className="auto">{t('home.auto')}</span>{typeChip(softType)}</span><Icon name="close" cls="i12" /></button>}
            {smart === 'on' && <span className="smartm mono">{t('home.smart')}</span>}
            <div className="sort">
              <label htmlFor="sort" className="subtle">{t('home.sort')}</label>
              <select id="sort" className="btn sm" value={st.sort} onChange={(e) => setSearch({ sort: e.target.value })}>
                <option value="rel">{t('home.sortRel')}</option><option value="upd">{t('home.sortUpd')}</option><option value="name">{t('home.sortName')}</option>
              </select>
            </div>
          </div>
          {partial && <div className="callout c-info" role="status"><Icon name="info" /><span>{t('home.partial')}</span></div>}
          {n > 0 && (
            <>
              <div className="grid">
                {shown.map((d, i) => <Card key={d.id} d={d} terms={res.hlTerms} selected={i === st.sel} />)}
              </div>
              {n > st.limit && <div className="center"><button className="btn" onClick={() => setSearch({ limit: st.limit + 20 })}>{t('home.showMore')}</button></div>}
              <p className="khint hide-m">
                <span><kbd>{t('keys.up')}</kbd> <kbd>{t('keys.down')}</kbd> {t('home.hintMove')}</span>
                <span><kbd>{t('keys.enter')}</kbd> {t('home.hintOpen')}</span>
                <span><kbd>{t('keys.esc')}</kbd> {t('home.hintClear')}</span>
                <button className="linkbtn" onClick={() => setDialog('keys')}>{t('home.allShortcuts')}</button>
              </p>
            </>
          )}
          {n === 0 && (
            <div className="empty">
              <Icon name="search" cls="i24 subtle" />
              <h2 className="h2">{t('home.emptyTitle', { query: qTrim })}</h2>
              <p className="muted">{t('home.emptyBody')}</p>
              <div className="wrapc" style={{ justifyContent: 'center' }}>
                {anyFilter && <button className="btn" onClick={clearFilters}>{t('home.clearFilters')}</button>}
                {smart === 'off' && !smartUnsupported && <button className="btn" onClick={toggleSmart}><Icon name="sparkle" />{t('home.trySmart')}</button>}
                <Ext className="btn primary" href={requestHref}>{t('common.requestPlugin')}<Icon name="ext" /></Ext>
              </div>
            </div>
          )}
        </section>
      </div>

      {showRecent && (
        <section className="band" aria-labelledby="recent-h">
          <div className="wrap bandin">
            <div className="between"><h2 id="recent-h" className="h2">{t('home.recent')}</h2><Link className="sm" to={R.changelog()}>{t('home.whatsNew')}</Link></div>
            <div className="gridc">
              {recent.map((e) => (
                <Link className="card mini" to={R.plugin(e.plugin)} key={e.plugin + e.to}>
                  <span className="between"><span className="mono strong clamp1">{e.plugin}</span><span className={'bb ' + e.bcls}>{t('bump.' + e.bump)}</span></span>
                  <span className="mono muted sm">{t('home.versions', { from: e.from, to: e.to })}</span>
                  <span className="subtle xs clamp1">{t('home.recentLine', { date: e.date, summary: e.summary })}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
