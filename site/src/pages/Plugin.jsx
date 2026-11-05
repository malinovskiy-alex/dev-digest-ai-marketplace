// Plugin page: install, security surface, metadata, components, dependencies, README, history.
import { Link, useParams } from 'react-router-dom';
import { CopyButton, Disclaimer, MetaList, Prose, SecRows, StackButton, Step } from '../components/bits.jsx';
import { Ext, Icon } from '../components/Icon.jsx';
import { LINKS, SITE } from '../config.js';
import { catalog } from '../data.js';
import { t } from '../i18n/index.js';
import { fmt, hostOf } from '../lib/format.js';
import { ADD_MKT, R, ghTree, installCmd, issueUrl } from '../lib/routes.js';
import { hookPlain } from '../lib/security.js';
import { TYPES, typeLabel } from '../lib/types.js';
import NotFoundPage from './NotFound.jsx';

export function InstallSteps({ name }) {
  return (
    <>
      <Step k="i1" text={ADD_MKT} label={t('common.step1')} />
      <Step k="i2" text={installCmd(name)} label={t('common.step2')} />
    </>
  );
}

export default function PluginPage() {
  const { p: name } = useParams();
  const p = catalog.pm[name];
  if (!p) return <NotFoundPage removed />;
  const hist = catalog.log.filter((e) => e.plugin === p.name).slice(0, 5);
  const meta = [
    { k: t('plugin.metaVersion'), v: p.version, cls: 'mono' },
    { k: t('plugin.metaCategory'), v: p.category },
    { k: t('plugin.metaAuthor'), v: p.author },
    { k: t('plugin.metaLicense'), v: p.license, cls: 'mono' },
    { k: t('plugin.metaUpdated'), v: fmt(p.updatedAt) },
    { k: t('plugin.metaSource'), v: 'plugins/' + p.name, cls: 'mono', href: ghTree(p.name) },
  ];
  return (
    <div className="wrap page">
      <nav className="crumbs" aria-label={t('common.breadcrumb')}><Link to={R.plugins()}>{t('common.plugins')}</Link><span aria-hidden="true">/</span><span className="mono" aria-current="page">{p.name}</span></nav>
      <section className="phead">
        <div className="titlerow"><span className="badge t-plugin"><Icon name="plugin" />{t('plugin.badge')}</span><h1 className="h1 mono break">{p.name}</h1><span className="mono subtle">{t('common.version', { version: p.version })}</span></div>
        <p className="lead">{p.description}</p>
        <div className="metaline"><span className="muted">{p.category}</span>{p.tags.map((tag) => <span className="tag" key={tag}>{t('card.tag', { tag })}</span>)}</div>
        <div className="muted sm">{t('plugin.byline', { author: p.author, license: p.license, date: fmt(p.updatedAt) })}</div>
        <div className="wrapc">
          <Ext className="btn sm" href={ghTree(p.name)}>{t('plugin.viewSource')}<Icon name="ext" /></Ext>
          <Ext className="btn sm" href={issueUrl(p)}>{t('common.reportIssue')}<Icon name="ext" /></Ext>
          <CopyButton k="share" text={SITE + 'plugins/' + p.name + '/'} msg={t('common.linkCopied')} icon="link" label={t('plugin.share')} />
          <Ext className="xs" href={LINKS.security}>{t('common.securityReport')}</Ext>
        </div>
      </section>
      <div className="cols">
        <aside className="colside">
          <section className="panel pad" aria-labelledby="inst-h">
            <h2 id="inst-h" className="h3">{t('common.install')}</h2>
            <InstallSteps name={p.name} />
            <div className="wrapc"><StackButton name={p.name} cls="btn" primary /><Link className="sm" to={R.start('s-update')}>{t('common.updating')}</Link></div>
          </section>
          <section className="panel pad" aria-labelledby="sec-h">
            <h2 id="sec-h" className="h3">{t('plugin.secTitle')}</h2>
            {p.sec.length === 0 && <div className="callout c-success"><Icon name="shield" /><span>{t('plugin.secNone')}</span></div>}
            <div><SecRows badges={p.sec} linkItems /></div>
            <Disclaimer />
          </section>
          <MetaList id="meta-h" rows={meta} />
        </aside>
        <div className="colmain">
          <section className="stackv">
            <h2 className="h2">{t('plugin.components')} <span className="mono subtle" style={{ fontSize: 14, fontWeight: 400 }}>{p.arts.length}</span></h2>
            <div className="panel list">
              {p.arts.map((a) => {
                const gen = a.type === 'hook' || a.type === 'mcp';
                const desc = a.type === 'hook' ? hookPlain(a.meta) : (a.type === 'mcp' ? hostOf(a.meta.url || a.meta.command) : a.description);
                return (
                  <Link className="lrow" to={R.artifact(a)} key={a.id}>
                    <span className="lbadge"><span className={'badge ' + TYPES[a.type].cls}>{typeLabel(a.type)}</span></span>
                    <span className="mono lname">{a.invocation}</span>
                    <span className="ldesc">{gen && <span className="sb s-info">{a.type === 'hook' ? t('plugin.hookBadge') : t('plugin.mcpBadge')}</span>}<span className="clamp1">{desc}</span></span>
                  </Link>
                );
              })}
            </div>
          </section>
          {p.deps.length > 0 && (
            <section className="stackv">
              <h2 className="h2">{t('plugin.deps')}</h2>
              <div className="wrapc">{p.deps.map((d) => (catalog.pm[d] ? <Link className="badge t-plugin" to={R.plugin(d)} key={d}>{d}</Link> : <span className="badge t-plugin" key={d}>{t('plugin.depExternal', { name: d })}</span>))}</div>
              <p className="subtle xs" style={{ margin: 0 }}>{t('plugin.depsNote')}</p>
            </section>
          )}
          <section className="stackv">
            <h2 className="h2">{t('plugin.readme')}</h2>
            {p.readme.length > 0 ? <Prose blocks={p.readme} /> : <p className="muted" style={{ margin: 0 }}>{t('plugin.noReadme')}</p>}
          </section>
          <section className="stackv">
            <div className="between"><h2 className="h2">{t('plugin.history')}</h2><Link className="sm" to={R.changelog(p.name)}>{t('plugin.allReleases')}</Link></div>
            <ol className="panel list plain">
              {hist.map((e) => <li className="hrow2" key={e.to}><span className="mono w64">{e.to}</span><span className={'bb ' + e.bcls}>{t('bump.' + e.bump)}</span><span className="muted grow">{e.summary}</span><span className="mono subtle xs">{e.date}</span></li>)}
            </ol>
          </section>
          <section className="stackv">
            <h2 className="h2">{t('plugin.discussion')}</h2>
            <p className="muted sm" style={{ margin: 0 }}>{t('plugin.discussionNote')}</p>
            <div className="panel pad"><span className="muted sm">{t('plugin.discussionPlaceholder')}</span><Ext className="sm" href={LINKS.discussions}>{t('plugin.discussionOpen')}</Ext></div>
          </section>
        </div>
      </div>
    </div>
  );
}
