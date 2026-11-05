// 404: unknown URL, or a plugin that is not (or no longer) in the marketplace.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { BASE } from '../config.js';
import { t } from '../i18n/index.js';
import { R } from '../lib/routes.js';
import { useApp } from '../state/AppState.jsx';

export default function NotFoundPage({ removed = false }) {
  const { search, setSearch } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); navigate(R.home(), { state: { focus: true } }); } };
  return (
    <div className="wrap page nf">
      <span className="mono subtle sm break">{BASE.replace(/\/$/, '') + pathname}</span>
      <h1 className="h1">{removed ? t('nf.removed') : t('nf.missing')}</h1>
      <div className="sbox nfbox">
        <Icon name="search" cls="subtle" />
        <label htmlFor="q404" className="sr">{t('common.searchLabel')}</label>
        <input id="q404" type="search" placeholder={t('nf.placeholder')} value={search.q} onChange={(e) => setSearch({ q: e.target.value, sel: -1, limit: 20 })} onKeyDown={onKey} style={{ fontSize: 15 }} />
      </div>
      <div className="wrapc" style={{ justifyContent: 'center', gap: 20 }}>
        {removed && <Link to={R.changelog()}>{t('nf.whatsNew')}</Link>}
        <Link to={R.plugins()}>{t('nf.browse')}</Link>
      </div>
    </div>
  );
}
