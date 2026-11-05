import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { Dialogs, Footer, Header, Toast } from './components/Chrome.jsx';
import { isEditable } from './lib/dom.js';
import { R } from './lib/routes.js';
import ArtifactPage from './pages/Artifact.jsx';
import ChangelogPage from './pages/Changelog.jsx';
import CoursePage from './pages/Course.jsx';
import HomePage from './pages/Home.jsx';
import NewPluginPage from './pages/NewPlugin.jsx';
import NotFoundPage from './pages/NotFound.jsx';
import PluginPage from './pages/Plugin.jsx';
import PluginsPage from './pages/Plugins.jsx';
import StackPage from './pages/Stack.jsx';
import StartPage from './pages/Start.jsx';
import { useApp } from './state/AppState.jsx';

// On navigation: close the menu and dialogs, reset the result selection, scroll to the top or to #hash.
function NavEffects() {
  const { pathname, search, hash } = useLocation();
  const navType = useNavigationType();
  const { setMenu, setDialog, setSearch } = useApp();
  useEffect(() => {
    setMenu(false);
    setDialog(null);
    setSearch({ sel: -1 });
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      const t = setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView(); }, 0);
      return () => clearTimeout(t);
    }
    if (navType !== 'POP') window.scrollTo(0, 0);
    return undefined;
  }, [pathname, search, hash, navType, setMenu, setDialog, setSearch]);
  return null;
}

// "/" focuses search from any page, "?" shows the shortcuts.
function GlobalKeys() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { dialog, setDialog } = useApp();
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || dialog || isEditable(e.target)) return;
      if (e.key === '/') {
        e.preventDefault();
        const q = document.getElementById('q');
        if (pathname === '/' && q) q.focus(); else navigate(R.home(), { state: { focus: true } });
      } else if (e.key === '?') {
        e.preventDefault();
        setDialog('keys');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pathname, navigate, dialog, setDialog]);
  return null;
}

export default function App() {
  const { theme } = useApp();
  useEffect(() => {
    document.body.style.background = theme === 'light' ? '#F7F7F5' : '#0E0F11';
  }, [theme]);
  return (
    <div className={'app' + (theme === 'light' ? ' light' : '')}>
      <NavEffects />
      <GlobalKeys />
      <Header />
      <main id="main" className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="/plugins/" element={<PluginsPage />} />
          <Route path="/plugins/:p/" element={<PluginPage />} />
          <Route path="/plugins/:p/:type/:name/" element={<ArtifactPage />} />
          <Route path="/stack/" element={<StackPage />} />
          <Route path="/changelog/" element={<ChangelogPage />} />
          <Route path="/start/" element={<StartPage />} />
          <Route path="/course/" element={<CoursePage />} />
          <Route path="/new/" element={<NewPluginPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      <Toast />
      <Dialogs />
    </div>
  );
}
