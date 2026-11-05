// All plugins, grouped by category, with a category filter.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card.jsx';
import { Ext, Icon } from '../components/Icon.jsx';
import { LINKS } from '../config.js';
import { catalog } from '../data.js';
import { t } from '../i18n/index.js';
import { R } from '../lib/routes.js';
import { categories } from '../lib/search.js';

export default function PluginsPage() {
  const [pcat, setPcat] = useState(null);
  const cats = categories(catalog.plugins);
  const groups = cats.filter((c) => !pcat || pcat === c).map((c) => ({
    cat: c,
    docs: catalog.docs.filter((d) => d.type === 'plugin' && d.category === c).sort((a, b) => a.name.localeCompare(b.name)),
  }));
  return (
    <div className="wrap page">
      <div className="between">
        <div className="stackv4">
          <h1 className="h1">{t('plugins.title')}</h1>
          <p className="muted" style={{ margin: 0 }}>{t('plugins.sub', { plugins: t('count.plugin', { count: catalog.plugins.length }), categories: t('count.category', { count: cats.length }) })}</p>
        </div>
        <Link className="btn" to={R.home()} state={{ focus: true }}><Icon name="search" />{t('plugins.searchInside')}</Link>
      </div>
      <div className="chipwrap" role="group" aria-label={t('plugins.categoryAria')}>
        {cats.map((c) => {
          const on = pcat === c;
          return <button key={c} className={'chip' + (on ? ' on' : '')} onClick={() => setPcat(on ? null : c)} aria-pressed={on}>{c}<span className="n">{catalog.plugins.filter((p) => p.category === c).length}</span></button>;
        })}
      </div>
      {groups.map((g) => (
        <section className="stackv" key={g.cat}>
          <h2 className="lbl">{g.cat}</h2>
          <div className="grid">{g.docs.map((d) => <Card key={d.id} d={d} terms={null} />)}</div>
        </section>
      ))}
      <div className="callout c-accent between"><span>{t('plugins.notFound')}</span><Ext className="btn sm" href={LINKS.request}>{t('common.requestPlugin')}<Icon name="ext" /></Ext></div>
    </div>
  );
}
