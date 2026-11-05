// Getting started: what a marketplace is, then numbered steps with copyable commands.
// Copy lives in i18n (start.steps.<key>.*); commands are code and stay here.
import { Link } from 'react-router-dom';
import { Step } from '../components/bits.jsx';
import { MKT, REPO } from '../config.js';
import { t } from '../i18n/index.js';
import { R } from '../lib/routes.js';
import { typeLabel } from '../lib/types.js';

const STEPS = [
  { key: 'add', id: 's-add', cmds: [['g1', '/plugin marketplace add ' + REPO]] },
  { key: 'install', id: 's-install', cmds: [['g2', '/plugin install <plugin>@' + MKT]], to: R.home() },
  { key: 'use', id: 's-use', cmds: [['g3', '/<plugin>:<skill>']] },
  // Update command as documented in docs/RELEASES.md.
  { key: 'update', id: 's-update', cmds: [['g4', '/plugin marketplace update ' + MKT], ['g5', 'claude plugin update <plugin>@' + MKT], ['g6', '/reload-plugins']] },
  { key: 'remove', id: 's-remove', cmds: [['g7', '/plugin uninstall <plugin>@' + MKT]] },
  { key: 'team', id: 's-team', cmds: [], to: R.stack() },
  { key: 'contribute', id: 's-contribute', cmds: [], to: R.newp() },
].map((s, i) => ({ ...s, n: i + 2 }));

const WHAT = [['skill', 'start.whatSkill'], ['agent', 'start.whatAgent'], ['hook', 'start.whatHook'], ['mcp', 'start.whatMcp']];

export default function StartPage() {
  const msg = (s, f) => t('start.steps.' + s.key + '.' + f);
  const toc = [{ id: 's-what', n: 1, title: t('start.whatToc') }].concat(STEPS.map((s) => ({ id: s.id, n: s.n, title: msg(s, 'title') })));
  return (
    <div className="wrap page">
      <div className="startl">
        <nav className="toc" aria-label={t('start.tocAria')}>
          <span className="lbl" style={{ padding: '0 10px 8px' }}>{t('start.toc')}</span>
          {toc.map((x) => <a href={'#' + x.id} key={x.id}>{t('start.numbered', { n: x.n, title: x.title })}</a>)}
        </nav>
        <div className="startm">
          <div className="stackv4"><h1 className="h1">{t('start.title')}</h1><p className="lead muted">{t('start.lead')}</p></div>
          <section id="s-what" className="stackv">
            <h2 className="h2">{t('start.numbered', { n: 1, title: t('start.whatTitle') })}</h2>
            <p className="body15">{t('start.whatBody')}</p>
            <dl className="types">
              {WHAT.map(([type, key]) => [<dt key={type}><span className={'badge t-' + type}>{typeLabel(type)}</span></dt>, <dd key={key}>{t(key)}</dd>])}
            </dl>
          </section>
          {STEPS.map((s) => (
            <section id={s.id} className="stackv" key={s.id}>
              <h2 className="h2">{t('start.numbered', { n: s.n, title: msg(s, 'title') })}</h2>
              <p className="body15">{msg(s, 'text')}</p>
              {s.cmds.map(([k, text]) => <Step key={k} k={k} text={text} label={msg(s, k)} labelCls="subtle xs" />)}
              {s.to && <Link to={s.to}>{msg(s, 'link')}</Link>}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
