// Stack builder: chosen plugins (+ dependencies), combined security surface, settings.json export.
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CopyButton, Disclaimer } from '../components/bits.jsx';
import { Icon } from '../components/Icon.jsx';
import { SITE } from '../config.js';
import { catalog } from '../data.js';
import { t } from '../i18n/index.js';
import { R, settingsJson } from '../lib/routes.js';
import { useApp } from '../state/AppState.jsx';

// Parents first, each followed by its dependencies; orphaned dependencies last.
export function orderStack(stack) {
  const ordered = [];
  stack.filter((x) => !x.dep).forEach((x) => { ordered.push(x); stack.filter((y) => y.dep === x.name).forEach((y) => ordered.push(y)); });
  stack.filter((x) => x.dep && !stack.find((y) => y.name === x.dep)).forEach((x) => ordered.push(x));
  return ordered;
}

export default function StackPage() {
  const { stack, addPlugin, removePlugin, setDialog, download, storageBlocked, showToast } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // A shared link (/stack/?plugins=a,b) adds those plugins to this browser's stack.
  const shared = params.get('plugins');
  useEffect(() => {
    if (shared === null) return;
    const names = shared.split(',').map((s) => s.trim()).filter((n) => catalog.pm[n]);
    names.forEach((n) => addPlugin(n, true));
    if (names.length) showToast(t('toast.sharedAdded', { count: names.length }));
    navigate(R.stack(), { replace: true });
  }, [shared]); // eslint-disable-line react-hooks/exhaustive-deps

  const ordered = orderStack(stack);
  const names = ordered.map((x) => x.name);
  const json = settingsJson(names);
  const shareUrl = SITE + 'stack/?plugins=' + names.join(',');
  const agg = {}, aggOrder = [];
  ordered.forEach((x) => catalog.pm[x.name].sec.forEach((b) => {
    if (!agg[b.k]) { agg[b.k] = { ...b, count: 0, parts: [] }; aggOrder.push(b.k); }
    agg[b.k].count += b.items.length;
    agg[b.k].parts.push(t('stack.aggPart', { plugin: x.name, items: b.items.map((it) => it.t).join(', ') }));
  }));
  const has = names.length > 0;

  return (
    <div className="wrap page">
      <div className="between">
        <h1 className="h1">{t('stack.title')} <span className="mono subtle" style={{ fontWeight: 400 }}>{t('stack.titleCount', { count: names.length })}</span></h1>
        {has && <div className="wrapc"><CopyButton k="stackshare" text={shareUrl} msg={t('common.linkCopied')} icon="link" cls="btn" label={t('stack.share')} /><button className="btn danger" onClick={() => setDialog('clear')}>{t('stack.clear')}</button></div>}
      </div>
      {storageBlocked && <div className="callout c-info"><Icon name="info" /><span>{t('stack.storageBlocked')}</span></div>}
      {!has && <div className="empty"><Icon name="stack" cls="i24 subtle" /><p>{t('stack.empty')}</p><Link className="btn primary" to={R.plugins()}>{t('stack.browse')}</Link></div>}
      {has && (
        <div className="cols2">
          <section className="col-a stackv">
            <ul className="panel list plain">
              {ordered.map((x) => {
                const p = catalog.pm[x.name];
                const locked = !!x.dep && !!stack.find((y) => y.name === x.dep && !y.dep);
                return (
                  <li className={'sitem' + (x.dep ? ' dep' : '')} key={x.name}>
                    <div className="grow stackv4">
                      <div className="rowb">{x.dep && <span className="subtle mono" aria-hidden="true">└</span>}<Link className="mono strong" to={R.plugin(p.name)}>{p.name}</Link><span className="mono subtle xs">{t('common.version', { version: p.version })}</span></div>
                      <span className="muted sm">{p.description}</span>
                      {x.dep && <span className="subtle xs">{t('stack.depOf')}<span className="mono">{x.dep}</span></span>}
                    </div>
                    <button className="btn sm icon" onClick={() => removePlugin(p.name)} disabled={locked}
                      aria-label={locked ? t('stack.lockedAria', { name: p.name, parent: x.dep }) : t('stack.removeAria', { name: p.name })}
                      title={locked ? t('stack.lockedTip', { parent: x.dep }) : t('stack.remove')}><Icon name="minus" /></button>
                  </li>
                );
              })}
            </ul>
            <section className="panel pad">
              <h2 className="h3">{t('stack.secTitle')}</h2>
              {aggOrder.length === 0 && <div className="callout c-success"><Icon name="shield" /><span>{t('stack.secNone')}</span></div>}
              <div>
                {aggOrder.map((k) => (
                  <div className="agg" key={k}><span className={'sb ' + agg[k].tone} style={{ justifySelf: 'start' }}><Icon name={agg[k].icon} />{t('stack.aggLabel', { label: agg[k].label, count: agg[k].count })}</span><span className="mono xs muted break">{agg[k].parts.join(t('common.sep'))}</span></div>
                ))}
              </div>
              <Disclaimer />
            </section>
            <Link className="sm wrapc" to={R.home()} state={{ focus: true }}><Icon name="plus" />{t('stack.addMore')}</Link>
          </section>
          <section className="col-b stackv">
            <div className="cbox">
              <div className="cbar"><span className="mono xs subtle grow">.claude/settings.json</span><CopyButton k="settings" text={json} label={t('common.copy')} /><button className="btn sm primary" onClick={() => download(json, 'settings.json')}><Icon name="download" />{t('stack.download')}</button></div>
              <pre className="cb">{json}</pre>
            </div>
            <div className="callout c-info"><Icon name="info" /><div className="stackv4"><span className="strong">{t('stack.whereTitle')}<span className="mono">{t('stack.wherePath')}</span></span><span>{t('stack.whereBody')}</span></div></div>
          </section>
        </div>
      )}
    </div>
  );
}
