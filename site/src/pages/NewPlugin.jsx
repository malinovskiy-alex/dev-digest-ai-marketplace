// Build a plugin: form with validation, live preview of the generated files, ZIP download.
import { useState } from 'react';
import { Code, CopyButton } from '../components/bits.jsx';
import { Ext, Icon } from '../components/Icon.jsx';
import { LINKS } from '../config.js';
import { catalog } from '../data.js';
import { t } from '../i18n/index.js';
import { EMPTY_FORM, scaffold, validate } from '../lib/scaffold.js';
import { categories } from '../lib/search.js';
import { zip } from '../lib/zip.js';
import { useApp } from '../state/AppState.jsx';

export default function NewPluginPage() {
  const { download } = useApp();
  const cats = categories(catalog.plugins);
  const [f, setFState] = useState(() => ({ ...EMPTY_FORM, category: cats.includes(EMPTY_FORM.category) ? EMPTY_FORM.category : (cats[0] || '__other') }));
  const [submitted, setSubmitted] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [tab, setTab] = useState('plugin.json');

  const errs = validate(f);
  const errKeys = Object.keys(errs);
  const valid = errKeys.length === 0;
  const fld = (k, help, okMsg, count) => {
    const show = !!errs[k] && (submitted || (typeof f[k] === 'string' && f[k].length > 0));
    return { bad: show, cls: show ? 'err' : '', msg: show ? errs[k] : (okMsg && !errs[k] ? okMsg : help), msgCls: show ? 'm-err' : (okMsg && !errs[k] ? 'm-ok' : ''), count: count || '' };
  };
  const counter = (s, max) => t('newp.counter', { n: s.length, max });
  const nameF = fld('name', t('newp.nameHelp'), t('newp.nameOk'), counter(f.name, 64));
  if (!errs.name && f.name && catalog.pm[f.name]) { nameF.msg = t('newp.nameExists'); nameF.msgCls = 'm-warn'; }
  const descF = fld('description', t('newp.descHelp'), '', counter(f.description, 2000));
  const urlF = fld('authorUrl', '', '');
  const skillF = fld('skillName', t('newp.skillHelp'), t('newp.nameOk'));
  const skillDescF = fld('skillDesc', t('newp.skillDescHelp'), '', counter(f.skillDesc, 1024));
  const catBad = !!errs.category && (submitted || !!f.catOther);

  const update = (patch) => setFState((s) => ({ ...s, ...patch }));
  const set = (k) => (e) => { update({ [k]: e.target.value }); setDownloaded(false); };
  const addTag = (raw) => setFState((s) => {
    const cur = s.tags.slice();
    raw.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).forEach((p) => { if (!cur.includes(p)) cur.push(p); });
    return { ...s, tags: cur, tagDraft: '' };
  });
  const onTagChange = (e) => { const v = e.target.value; if (v.includes(',')) addTag(v); else update({ tagDraft: v }); };
  const onTagKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(f.tagDraft); }
    else if (e.key === 'Backspace' && !f.tagDraft && f.tags.length) update({ tags: f.tags.slice(0, -1) });
  };

  const sc = scaffold(f);
  const zipName = t('newp.zipName', { name: sc.nm });
  const after = catalog.plugins.map((p) => p.name).sort().find((x) => x.localeCompare(sc.nm) > 0);
  const insertAt = after ? t('newp.insertBefore', { name: after }) : t('newp.insertEnd');
  const cur = sc.files[tab] ? tab : 'plugin.json';

  const submit = (e) => {
    e.preventDefault();
    if (!valid) { setSubmitted(true); return; }
    const bytes = zip(sc.paths.map(([path, key]) => [path, sc.files[key]]));
    if (download(bytes, zipName, 'application/zip', t('toast.zipDownloaded', { file: zipName }))) { setDownloaded(true); setSubmitted(false); }
  };

  return (
    <div className="wrap page">
      <div className="stackv4"><h1 className="h1">{t('newp.title')}</h1><p className="lead muted">{t('newp.lead')}</p></div>
      <div className="cols2">
        <form className="col-a stackv" style={{ gap: 20 }} onSubmit={submit} noValidate>
          {submitted && !valid && (
            <div className="callout c-danger" role="alert"><Icon name="warning" /><div className="stackv4"><span className="strong">{t('newp.summary', { count: errKeys.length })}</span>{errKeys.map((k) => <span key={k}>{errs[k]}</span>)}</div></div>
          )}
          <div className="f">
            <label htmlFor="fn">{t('newp.name')}</label>
            <input id="fn" className={'in mono ' + nameF.cls} value={f.name} onChange={set('name')} placeholder={t('newp.namePlaceholder')} aria-invalid={nameF.bad} aria-describedby="fn-h" />
            <div id="fn-h" className="help"><span className={nameF.msgCls}>{nameF.msg}</span><span className="mono">{nameF.count}</span></div>
            <span className="help">{t('newp.namePermanent')}</span>
          </div>
          <div className="f"><label htmlFor="fdn">{t('newp.displayName')} <span className="subtle" style={{ fontWeight: 400 }}>{t('newp.optional')}</span></label><input id="fdn" className="in" value={f.displayName} onChange={set('displayName')} /></div>
          <div className="f">
            <label htmlFor="fd">{t('newp.description')}</label>
            <textarea id="fd" className={'in ' + descF.cls} rows={3} value={f.description} onChange={set('description')} aria-invalid={descF.bad} />
            <div className="help"><span className={descF.msgCls}>{descF.msg}</span><span className="mono">{descF.count}</span></div>
          </div>
          <div className="grid2">
            <div className="f">
              <label htmlFor="fc">{t('newp.category')}</label>
              <select id="fc" className="in" value={f.category} onChange={set('category')}>
                {cats.map((c) => <option value={c} key={c}>{c}</option>)}
                <option value="__other">{t('newp.categoryOther')}</option>
              </select>
              {f.category === '__other' && <input className={'in ' + (catBad ? 'err' : '')} aria-label={t('newp.categoryNew')} placeholder={t('newp.categoryPlaceholder')} value={f.catOther} onChange={set('catOther')} aria-invalid={catBad} />}
              {catBad && <span className="help m-err">{errs.category}</span>}
            </div>
            <div className="f">
              <label htmlFor="ft">{t('newp.tags')}</label>
              <div className="in tagin">
                {f.tags.map((tag) => <span className="tchip mono" key={tag}>{tag}<button type="button" className="tx" onClick={() => update({ tags: f.tags.filter((x) => x !== tag) })} aria-label={t('newp.tagRemove', { tag })}>{t('newp.tagX')}</button></span>)}
                <input id="ft" className="tagfield" value={f.tagDraft} onChange={onTagChange} onKeyDown={onTagKey} placeholder={t('newp.tagPlaceholder')} />
              </div>
              <span className="help">{t('newp.tagHelp')}</span>
            </div>
          </div>
          <div className="grid2">
            <div className="f"><label htmlFor="fa">{t('newp.authorName')}</label><input id="fa" className="in" value={f.authorName} onChange={set('authorName')} /></div>
            <div className="f">
              <label htmlFor="fu">{t('newp.authorUrl')}</label>
              <input id="fu" className={'in ' + urlF.cls} placeholder={t('newp.urlPlaceholder')} value={f.authorUrl} onChange={set('authorUrl')} aria-invalid={urlF.bad} />
              {urlF.bad && <span className="help m-err">{urlF.msg}</span>}
            </div>
          </div>
          <div className="hr" />
          <div className="f">
            <label htmlFor="fsn">{t('newp.skillName')}</label>
            <input id="fsn" className={'in mono ' + skillF.cls} placeholder={t('newp.skillPlaceholder')} value={f.skillName} onChange={set('skillName')} aria-invalid={skillF.bad} />
            <div className="help"><span className={skillF.msgCls}>{skillF.msg}</span><span className="mono">{'/' + sc.nm + ':' + sc.sk}</span></div>
          </div>
          <div className="f">
            <label htmlFor="fsd">{t('newp.skillDesc')}</label>
            <textarea id="fsd" className={'in ' + skillDescF.cls} rows={3} value={f.skillDesc} onChange={set('skillDesc')} aria-invalid={skillDescF.bad} />
            <div className="help"><span className={skillDescF.msgCls}>{skillDescF.msg}</span><span className="mono">{skillDescF.count}</span></div>
          </div>
          <div className="wrapc">
            <button type="submit" className={'btn primary' + (valid ? '' : ' dim')}><Icon name="download" />{t('newp.download')}</button>
            <CopyButton k="entry" text={sc.files['marketplace-entry.json']} cls="btn" label={t('newp.copyEntry')} />
          </div>
        </form>
        <section className="col-b stackv" aria-label={t('newp.preview')}>
          <div className="panel pad"><h2 className="lbl">{zipName}</h2><pre className="mono muted" style={{ margin: 0, fontSize: 12.5, lineHeight: '21px', overflowX: 'auto' }}>{sc.tree}</pre></div>
          <div className="cbox">
            <div className="tabs" role="tablist">
              {Object.keys(sc.files).map((k) => <button type="button" role="tab" key={k} className={'tab' + (k === cur ? ' on' : '')} aria-selected={k === cur} onClick={() => setTab(k)}>{k}</button>)}
            </div>
            <pre className="cb" style={{ minHeight: 240 }}>{sc.files[cur]}</pre>
          </div>
          {downloaded && (
            <div className="panel pad" style={{ background: 'var(--success-s)', borderColor: 'transparent' }}>
              <h2 className="h3" style={{ color: 'var(--success)' }}>{t('newp.nextTitle')}</h2>
              <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>{t('newp.next1')}</li>
                <li>{t('newp.next2Before')}<span className="mono">.claude-plugin/marketplace.json</span>{t('newp.next2After', { where: insertAt })}</li>
                <li>{t('newp.next3Before')}<Ext href={LINKS.contrib}>{t('newp.next3Link')}</Ext>{t('newp.next3After')}</li>
              </ol>
              <Code k="v1" text="claude plugin validate . --strict" style={{ background: 'var(--surface)' }} />
              <Code k="v2" text={'claude plugin validate plugins/' + sc.nm + ' --strict'} style={{ background: 'var(--surface)' }} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
