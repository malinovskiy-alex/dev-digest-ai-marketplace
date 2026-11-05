// Component page (skill / agent / command / hook / MCP server).
import { Link, useParams } from 'react-router-dom';
import { CopyIconButton, Disclaimer, MetaList, Prose, SecRows, StackButton, Step } from '../components/bits.jsx';
import { Ext, Icon } from '../components/Icon.jsx';
import { LINKS } from '../config.js';
import { catalog } from '../data.js';
import { t } from '../i18n/index.js';
import { fmt } from '../lib/format.js';
import { R, ghFile, issueUrl } from '../lib/routes.js';
import { hookPlain, security } from '../lib/security.js';
import { TYPES, typeIcon, typeLabel, typeName } from '../lib/types.js';
import NotFoundPage from './NotFound.jsx';
import { InstallSteps } from './Plugin.jsx';

const Pills = ({ title, items }) => (
  <section className="stackv"><h2 className="h2">{title}</h2><div className="wrapc">{items.map((x) => <span className="pill mono" key={x}>{x}</span>)}</div></section>
);
const Text = ({ title, text, textCls = '', sub }) => (
  <section className="stackv">
    <h2 className="h2">{title}</h2>
    <p className={'body15' + (textCls ? ' ' + textCls : '')}>{text}</p>
    {sub && <p className="mono xs subtle break" style={{ margin: 0 }}>{sub}</p>}
  </section>
);
const Callout = ({ title, text, cls, note }) => (
  <section className={'activ ' + cls}><h2 className="lbl">{title}</h2><p className="lead">{text}</p>{note && <p className="xs muted" style={{ margin: 0 }}>{note}</p>}</section>
);
const ProseSection = ({ title, blocks, a }) => (
  <section className="stackv">
    <div className="between"><h2 className="h2">{title}</h2><Ext className="mono xs" href={ghFile(a.plugin, a.file)}>{t('common.ext', { text: a.file })}</Ext></div>
    <Prose blocks={blocks} />
  </section>
);
const Security = ({ p, a }) => (
  <section className="panel pad">
    <h2 className="h3">{t('artifact.secTitle')}</h2>
    <div><SecRows badges={security({ name: p.name, scripts: [], arts: [a] })} linkItems={false} /></div>
    <Disclaimer />
  </section>
);

function Sections({ a, p }) {
  const m = a.meta;
  if (a.type === 'skill') return (
    <>
      <Callout title={t('artifact.skillWhen')} text={a.description} cls="act-skill" note={t('artifact.skillNote')} />
      {m.allowedTools ? <Pills title={t('artifact.allowedTools')} items={m.allowedTools} /> : <Text title={t('artifact.allowedTools')} text={t('artifact.notRestricted')} textCls="muted" />}
      <ProseSection title={t('artifact.instructions')} blocks={a.body} a={a} />
    </>
  );
  if (a.type === 'agent') return (
    <>
      <Callout title={t('artifact.agentWhen')} text={a.description} cls="act-agent" />
      <Pills title={t('artifact.tools')} items={m.tools || []} />
      <Text title={t('artifact.model')} text={m.model || t('artifact.modelInherit')} textCls="mono" />
      <ProseSection title={t('artifact.systemPrompt')} blocks={a.body} a={a} />
    </>
  );
  if (a.type === 'command') return (
    <>
      <div className="callout c-warning"><Icon name="legacy" /><span>{t('artifact.legacy')}</span></div>
      <Text title={t('artifact.description')} text={a.description} />
      <ProseSection title={t('artifact.body')} blocks={a.body} a={a} />
    </>
  );
  if (a.type === 'hook') return (
    <>
      <Text title={t('artifact.runsOn')} text={hookPlain(m)} sub={t('artifact.runsOnSub', { event: m.event, matcher: m.matcher || '*' })} />
      <section className="stackv">
        <h2 className="h2">{t('artifact.command')}</h2>
        <div className="cbox"><div className="cbar"><span className="mono xs subtle grow">hooks/hooks.json</span><CopyIconButton k="hookcmd" text={m.command} cls="btn sm ghost icon" /></div><pre className="cb">{m.command}</pre></div>
      </section>
      <Security p={p} a={a} />
    </>
  );
  const env = m.envVars || [];
  return (
    <>
      <Text title={t('artifact.connection')} text={m.transport === 'stdio' ? t('artifact.local', { transport: m.transport }) : t('artifact.remote', { transport: m.transport })} sub={m.url || m.command} />
      {env.length ? <Pills title={t('artifact.needs')} items={env} /> : <Text title={t('artifact.needs')} text={t('artifact.needsNone')} textCls="muted" />}
      <Security p={p} a={a} />
    </>
  );
}

export default function ArtifactPage() {
  const { p: pname, type, name } = useParams();
  const p = catalog.pm[pname];
  if (!p) return <NotFoundPage removed />;
  const a = catalog.findArt(pname, type, name);
  if (!a) return <NotFoundPage />;
  const m = a.meta;
  const useNote = a.type === 'agent' ? t('artifact.useAgent', { id: a.id }) : ((a.type === 'hook' || a.type === 'mcp') ? t('artifact.useAuto') : '');
  const meta = [{ k: t('artifact.metaType'), v: typeName(a.type) }, { k: t('artifact.metaPlugin'), v: p.name, cls: 'mono' }, { k: t('plugin.metaVersion'), v: p.version, cls: 'mono' }];
  if (a.type === 'skill') meta.push({ k: t('artifact.allowedTools'), v: m.allowedTools ? m.allowedTools.join(', ') : t('artifact.notRestrictedShort'), cls: 'mono' });
  if (a.type === 'agent') { meta.push({ k: t('artifact.tools'), v: (m.tools || []).join(', '), cls: 'mono' }); meta.push({ k: t('artifact.model'), v: m.model, cls: 'mono' }); }
  if (a.type === 'hook') { meta.push({ k: t('artifact.metaEvent'), v: m.event, cls: 'mono' }); meta.push({ k: t('artifact.metaMatcher'), v: m.matcher || '*', cls: 'mono' }); }
  if (a.type === 'mcp') {
    meta.push({ k: t('artifact.metaTransport'), v: m.transport, cls: 'mono' });
    meta.push({ k: m.url ? t('artifact.metaUrl') : t('artifact.metaCommand'), v: m.url || m.command, cls: 'mono' });
    meta.push({ k: t('artifact.metaEnv'), v: (m.envVars || []).join(', ') || t('artifact.none'), cls: 'mono' });
  }
  meta.push({ k: t('plugin.metaUpdated'), v: fmt(p.updatedAt) });
  meta.push({ k: t('plugin.metaSource'), v: a.file, cls: 'mono', href: ghFile(p.name, a.file) });
  const others = p.arts.filter((x) => x !== a).slice(0, 6);
  return (
    <div className="wrap page">
      <nav className="crumbs" aria-label={t('common.breadcrumb')}><Link to={R.plugins()}>{t('common.plugins')}</Link><span aria-hidden="true">/</span><Link className="mono" to={R.plugin(p.name)}>{p.name}</Link><span aria-hidden="true">/</span><span className="mono" aria-current="page">{a.name}</span></nav>
      <section className="phead">
        <span className={'badge ' + TYPES[a.type].cls + ' self-start'}><Icon name={typeIcon(a.type)} />{typeLabel(a.type)}</span>
        <h1 className="h1 mono break">{a.invocation}</h1>
        <div className="metaline muted">{t('artifact.in')} <Link className="mono" to={R.plugin(p.name)}>{p.name}</Link><span className="subtle">·</span><span className="mono">{t('common.version', { version: p.version })}</span><span className="subtle">·</span><span>{p.category}</span></div>
      </section>
      <div className="cols">
        <aside className="colside">
          <section className="panel pad" aria-labelledby="ainst-h">
            <h2 id="ainst-h" className="h3">{t('common.install')}</h2>
            <InstallSteps name={p.name} />
            {(a.type === 'skill' || a.type === 'command') && <Step k="i3" text={a.invocation} label={t('common.step3')} />}
            {useNote && <div className="stepc"><span className="muted xs">{t('common.step3')}</span><p className="sm" style={{ margin: 0 }}>{useNote}</p></div>}
            <div className="wrapc"><StackButton name={p.name} cls="btn" primary labels={[t('artifact.addPlugin'), t('artifact.pluginInStack')]} /><Link className="sm" to={R.start('s-update')}>{t('common.updating')}</Link></div>
          </section>
          <MetaList id="ameta-h" rows={meta} />
        </aside>
        <div className="colmain">
          <Sections a={a} p={p} />
          <section className="stackv" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <h2 className="h2">{t('artifact.others')}</h2>
            {others.length > 0 ? (
              <div className="panel list">
                {others.map((x) => (
                  <Link className="lrow" to={R.artifact(x)} key={x.type + ':' + x.id}>
                    <span className="lbadge"><span className={'badge ' + TYPES[x.type].cls}>{typeLabel(x.type)}</span></span>
                    <span className="mono lname">{x.invocation}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="muted" style={{ margin: 0 }}>{t('artifact.onlyBefore')}<span className="mono">{p.name}</span>{t('artifact.onlyAfter')}</p>}
            <div className="wrapc"><Ext className="btn sm" href={issueUrl(p)}>{t('common.reportIssue')}<Icon name="ext" /></Ext><Ext className="xs" href={LINKS.security}>{t('common.securityReport')}</Ext></div>
          </section>
        </div>
      </div>
    </div>
  );
}
