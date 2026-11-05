// Smoke test: every route renders with the real generated catalog (virtual:catalog) without throwing.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';
import { catalog } from './data.js';
import { AppProvider } from './state/AppState.jsx';

const render = (url) => renderToString(
  <MemoryRouter initialEntries={[url]}>
    <AppProvider><App /></AppProvider>
  </MemoryRouter>,
);

const p = catalog.plugins[0];
const a = catalog.arts[0];

describe('routes', () => {
  it.each([
    ['/', 'Find skills, agents and plugins for Claude Code'],
    ['/plugins/', 'All plugins'],
    ['/stack/', 'Your stack'],
    ['/changelog/', 'What&#x27;s new'],
    ['/start/', 'Getting started'],
    ['/course/', 'Course map'],
    ['/new/', 'Build a plugin'],
    ['/nope/', 'This page doesn&#x27;t exist.'],
    ['/plugins/no-such-plugin/', 'This plugin was removed from the marketplace.'],
  ])('%s', (url, text) => {
    const html = render(url);
    expect(html).toContain(text);
    expect(html).toContain(catalog.build); // footer "Built from …"
  });

  it('renders the catalog\'s plugin and component pages', () => {
    expect(catalog.plugins.length).toBeGreaterThan(0);
    expect(render('/plugins/' + p.name + '/')).toContain(p.description);
    if (a) expect(render('/plugins/' + a.plugin + '/' + a.type + '/' + a.name + '/')).toContain(a.invocation);
    if (a) expect(render('/plugins/' + a.plugin + '/' + a.type + '/missing/')).toContain('This page doesn&#x27;t exist.');
  });
});
