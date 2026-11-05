// Result card for a plugin or a component (search results and the All plugins page).
import { Link } from 'react-router-dom';
import { t } from '../i18n/index.js';
import { countLine } from '../lib/catalog.js';
import { R, installText } from '../lib/routes.js';
import { TYPES, typeIcon, typeLabel } from '../lib/types.js';
import { useApp } from '../state/AppState.jsx';
import { CopyButton, Highlight, StackButton } from './bits.jsx';
import { Icon } from './Icon.jsx';

export const cardHref = (d) => (d.type === 'plugin' ? R.plugin(d.p.name) : R.artifact(d.a));

// d: a search doc ({ type, name, p, a, id }). terms: highlight terms, or null for plain text (plugins page).
export function Card({ d, terms, selected }) {
  const { inStack } = useApp();
  const p = d.p, a = d.a;
  const gen = !!a && (a.type === 'hook' || a.type === 'mcp');
  const to = cardHref(d);
  const name = gen ? a.label : d.name;
  const desc = d.type === 'plugin' ? p.description : (gen ? p.description : a.description);
  const tags = p.tags.slice(0, 4).map((x) => t('card.tag', { tag: x }));
  if (p.tags.length > 4) tags.push(t('card.more', { count: p.tags.length - 4 }));
  const badges = p.sec.slice(0, 3);
  const plain = !terms;
  const hl = gen || plain ? [] : terms;
  const cls = 'card ' + (inStack(p.name) ? 'instack ' : '') + (selected ? 'sel' : '');
  return (
    <article className={cls.trim()}>
      <div className="ctop">
        <span className={'badge ' + TYPES[d.type].cls}><Icon name={typeIcon(d.type)} />{typeLabel(d.type)}</span>
        <Link className="cname mono" to={to}>{plain ? name : <Highlight text={name} terms={hl} />}</Link>
        <span className="ver mono">{t('common.version', { version: p.version })}</span>
      </div>
      <div className="cparent">{d.type === 'plugin' ? t('card.parentPlugin', { category: p.category, counts: countLine(p) }) : t('card.parentArt', { plugin: p.name, category: p.category })}</div>
      <p className={'cdesc clamp3' + (gen && !plain ? ' gen' : '')}>{plain ? desc : <Highlight text={desc} terms={hl} />}</p>
      {tags.length > 0 && <div className="ctags">{tags.map((x) => <span className="tag" key={x}>{x}</span>)}</div>}
      {badges.length > 0 && (
        <div className="cbadges">
          {badges.map((b) => <span className={'sb ' + b.tone} title={b.tip} key={b.k}><Icon name={b.icon} />{b.label}</span>)}
          {p.sec.length > 3 && <span className="sb s-more" title={p.sec.slice(3).map((b) => b.label).join(', ')}>{t('card.more', { count: p.sec.length - 3 })}</span>}
        </div>
      )}
      <div className="cact">
        <CopyButton k={'card:' + d.id} text={installText(p.name)} label={t('card.copyInstall')} okLabel={t('common.copied')} />
        <StackButton name={p.name} />
        <Link className="btn sm ghost cdet" to={to} aria-label={t('card.detailsAria', { name })}>{t('card.details')}</Link>
      </div>
    </article>
  );
}
