// Small shared pieces: highlight segments, copyable code lines, README/markdown blocks, metadata list,
// security rows and the stack toggle button.
import { Link } from 'react-router-dom';
import { LINKS } from '../config.js';
import { t } from '../i18n/index.js';
import { R } from '../lib/routes.js';
import { seg } from '../lib/search.js';
import { useApp } from '../state/AppState.jsx';
import { Ext, Icon } from './Icon.jsx';

export function Highlight({ text, terms }) {
  return seg(text, terms).map((s, i) => (s.m ? <mark key={i}>{s.t}</mark> : <span key={i}>{s.t}</span>));
}

// Icon-only copy button with ✓ state (key identifies which copy succeeded).
export function CopyIconButton({ k, text, cls = 'btn sm icon ghost' }) {
  const { copied, copy } = useApp();
  const on = copied === k;
  return (
    <button className={cls + (on ? ' ok' : '')} onClick={() => copy(text, k)} aria-label={t('common.copyCommand')} title={t('common.copy')}>
      <Icon name={on ? 'check' : 'copy'} />
    </button>
  );
}

export function Code({ k, text, style }) {
  return (
    <div className="code" style={style}><span className="c">{text}</span><CopyIconButton k={k} text={text} /></div>
  );
}

export function Step({ k, text, label, labelCls = 'muted xs' }) {
  return (
    <div className="stepc"><span className={labelCls}>{label}</span><Code k={k} text={text} /></div>
  );
}

// Text button with copy icon → ✓ (e.g. "Copy install", "Copy").
export function CopyButton({ k, text, msg, cls = 'btn sm', label, okLabel, icon = 'copy' }) {
  const { copied, copy } = useApp();
  const on = copied === k;
  return (
    <button className={cls + (on ? ' ok' : '')} onClick={() => copy(text, k, msg)}>
      <Icon name={on ? 'check' : icon} />{on && okLabel ? okLabel : label}
    </button>
  );
}

export function Prose({ blocks }) {
  return (
    <div className="prose">
      {(blocks || []).map(([kind, text], i) => {
        if (kind === 'h') return <h3 key={i}>{text}</h3>;
        if (kind === 'li') return <ul key={i}><li>{text}</li></ul>;
        if (kind === 'q') return <blockquote key={i}>{text}</blockquote>;
        if (kind === 'pre') return <pre key={i}>{text}</pre>;
        return <p key={i}>{text}</p>;
      })}
    </div>
  );
}

export function MetaList({ id, rows }) {
  return (
    <section className="panel padx" aria-labelledby={id}>
      <h2 id={id} className="lbl" style={{ marginTop: 8 }}>{t('common.metadata')}</h2>
      <dl className="kvl">
        {rows.map((m) => (
          <div className="kv" key={m.k}>
            <dt>{m.k}</dt>
            <dd className={m.cls || ''}>{m.href ? <Ext href={m.href}>{t('common.ext', { text: m.v })}</Ext> : <span>{m.v}</span>}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function SecRows({ badges, linkItems }) {
  return badges.map((b) => (
    <div className={'srow ' + (b.k === 'broad' ? 'hl-w' : b.k === 'insecure' ? 'hl-d' : '')} key={b.k}>
      <span className={'sicon ' + b.tone}><Icon name={b.icon} /></span>
      <div className="sbody">
        <span className="strong">{b.label}</span>
        <span className="muted sm">{b.expl}</span>
        {b.items.map((it, i) => {
          if (it.a && linkItems) return <Link key={i} className="mono xs break" to={R.artifact(it.a)}>{it.t}</Link>;
          if (it.href && linkItems) return <Ext key={i} className="mono xs break" href={it.href}>{t('common.ext', { text: it.t })}</Ext>;
          return <span key={i} className="mono xs break">{it.t}</span>;
        })}
      </div>
    </div>
  ));
}

export function Disclaimer() {
  return (
    <p className="disc">{t('common.disclaimer')} <Ext href={LINKS.security}>{t('common.securityDoc')}</Ext></p>
  );
}

// "Add to stack" / "In stack" for a plugin. `primary` styles the off state as the main action.
export function StackButton({ name, cls = 'btn sm', primary, labels }) {
  const { inStack, toggleStack } = useApp();
  const on = inStack(name);
  const state = on ? 'on' : primary ? 'primary' : '';
  const [off, onLabel] = labels || [t('common.addToStack'), t('common.inStack')];
  return (
    <button className={cls + (state ? ' ' + state : '')} onClick={() => toggleStack(name)} aria-pressed={on}>
      <Icon name={on ? 'check' : 'plus'} />{on ? onLabel : off}
    </button>
  );
}
