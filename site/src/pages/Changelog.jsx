// What's new: every release, newest first, filterable by plugin (?plugin=) and bump type.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Ext, Icon } from '../components/Icon.jsx';
import { LINKS } from '../config.js';
import { catalog } from '../data.js';
import { t } from '../i18n/index.js';
import { R, releaseUrl } from '../lib/routes.js';
import { useApp } from '../state/AppState.jsx';

const KINDS = ['All', 'Major', 'Minor', 'Patch', 'Rollback'];

export default function ChangelogPage() {
  const { copied, copy } = useApp();
  const [params, setParams] = useSearchParams();
  const [bump, setBump] = useState('All');
  const plugin = params.get('plugin') || 'all';
  const logPlugins = [...new Set(catalog.log.map((e) => e.plugin))].sort();
  const options = [{ v: 'all', label: t('changelog.allPlugins') }].concat(logPlugins.map((p) => ({ v: p, label: p })));
  if (plugin !== 'all' && !logPlugins.includes(plugin)) options.push({ v: plugin, label: plugin });
  const list = catalog.log.filter((e) => (plugin === 'all' || e.plugin === plugin) && (bump === 'All' || e.bump === bump));
  const months = [];
  list.forEach((e) => { let g = months.find((m) => m.label === e.month); if (!g) { g = { label: e.month, items: [] }; months.push(g); } g.items.push(e); });
  const onPlugin = (e) => setParams(e.target.value === 'all' ? {} : { plugin: e.target.value });

  return (
    <div className="wrap page narrow">
      <div className="between">
        <div className="stackv4"><h1 className="h1">{t('changelog.title')}</h1><p className="muted" style={{ margin: 0 }}>{t('changelog.sub')}</p></div>
        <div className="feed">
          <button className={'btn' + (copied === 'feed' ? ' ok' : '')} onClick={() => copy(LINKS.feedAbs, 'feed', t('toast.feedCopied'))}><Icon name="rss" />{t('changelog.subscribe')}</button>
          <span className="mono subtle xs break">{LINKS.feedAbs}</span>
        </div>
      </div>
      <div className="fbar">
        <label htmlFor="clp" className="subtle sm">{t('changelog.plugin')}</label>
        <select id="clp" className="btn sm" value={plugin} onChange={onPlugin}>{options.map((o) => <option value={o.v} key={o.v}>{o.label}</option>)}</select>
        <span className="vsep hide-m" aria-hidden="true" />
        <div className="wrapc" role="group" aria-label={t('changelog.bumpAria')}>
          {KINDS.map((k) => <button key={k} className={'btn sm' + (bump === k ? ' on' : '')} aria-pressed={bump === k} onClick={() => setBump(k)}>{t('bump.' + k)}</button>)}
        </div>
      </div>
      {list.length === 0 && <p className="muted" style={{ margin: 0 }}>{t('changelog.empty')}</p>}
      {months.map((m) => (
        <section className="stackv" key={m.label}>
          <h2 className="lbl" style={{ marginTop: 8 }}>{m.label}</h2>
          {m.items.map((e) => (
            <article className={'entry' + (e.rail ? ' ' + e.rail : '')} key={e.plugin + '@' + e.to}>
              <span className="mono subtle xs">{e.date}</span>
              <div className="stackv4 min0">
                <div className="wrapc"><Link className="mono strong" to={R.plugin(e.plugin)}>{e.plugin}</Link><span className="mono muted sm">{t('home.versions', { from: e.from, to: e.to })}</span><span className={'bb ' + e.bcls}>{t('bump.' + e.bump)}</span></div>
                <span className="muted">{e.summary}</span>
              </div>
              <Ext className="sm nowrap" href={releaseUrl(e.plugin, e.to)}>{t('changelog.viewRelease')}</Ext>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
