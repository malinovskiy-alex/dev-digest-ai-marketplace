// Course map: plugins per lesson (site/course-map.json), then plugins not mapped to a lesson.
import { Link } from 'react-router-dom';
import { catalog } from '../data.js';
import { t } from '../i18n/index.js';
import { R } from '../lib/routes.js';

function Mini({ p }) {
  return (
    <Link className="card mini" to={R.plugin(p.name)}>
      <span className="wrapc"><span className="badge t-plugin">{t('course.badge')}</span><span className="mono strong clamp1">{p.name}</span></span>
      <span className="muted sm clamp1">{p.description}</span>
    </Link>
  );
}

export default function CoursePage() {
  const mapped = new Set(catalog.lessons.flatMap((l) => l.plugins));
  const other = catalog.plugins.filter((p) => !mapped.has(p.name));
  return (
    <div className="wrap page narrow">
      <div className="stackv4"><h1 className="h1">{t('course.title')}</h1><p className="muted" style={{ margin: 0 }}>{t('course.sub')}</p></div>
      <ol className="tl">
        {catalog.lessons.map((l) => (
          <li className={'tlnode' + (l.plugins.length ? '' : ' none')} key={l.n}>
            <span className="tldot" aria-hidden="true" />
            <div className="stackv">
              <div className="stackv4"><span className="mono subtle xs">{t('course.lesson', { n: l.n })}</span><h2 className="h3">{l.title}</h2><p className="muted sm" style={{ margin: 0 }}>{l.desc}</p></div>
              {l.plugins.length === 0 && <p className="subtle sm" style={{ margin: 0 }}>{t('course.noPlugin')}</p>}
              <div className="gridc">{l.plugins.filter((x) => catalog.pm[x]).map((x) => <Mini key={x} p={catalog.pm[x]} />)}</div>
            </div>
          </li>
        ))}
      </ol>
      {other.length > 0 && (
        <section className="stackv"><h2 className="h2">{t('course.other')}</h2><div className="gridc">{other.map((p) => <Mini key={p.name} p={p} />)}</div></section>
      )}
    </div>
  );
}
