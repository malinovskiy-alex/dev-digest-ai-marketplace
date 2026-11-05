# Catalog site (GitHub Pages)

The catalog website for the `dev-digest-ai` marketplace, published to
<https://malinovskiy-alex.github.io/dev-digest-ai-marketplace/>.

This folder is **separate from the marketplace**: Claude Code never reads it, and nothing under `plugins/` or `.claude-plugin/` depends on it.

## Stack

React + Vite (JavaScript/JSX), `react-router-dom` for real URLs, Vitest for unit tests. Node ≥ 20.

## Layout

```
site/
├── index.html            # Vite entry (fonts, app shell)
├── vite.config.js        # base path + the `virtual:catalog` plugin (see "Data")
├── package.json, package-lock.json
├── public/.nojekyll      # copied to dist/: serve files as-is, no Jekyll
├── build/
│   ├── catalog.mjs       # builds the catalog + feed from the repository
│   └── catalog.test.mjs  # node --test
├── src/
│   ├── main.jsx, App.jsx # router (basename = base path), layout, routes, global keys
│   ├── config.js         # BASE (from Vite), SITE, REPO, GH, MKT, links
│   ├── data.js           # the generated catalog → view model
│   ├── styles.css        # the prototype's styles, verbatim
│   ├── i18n/             # en.js (all UI copy) + index.js (t helper) + key test
│   ├── lib/              # pure logic: search, security badges, catalog prep, routes,
│   │                     #   install/settings text, plugin scaffold, ZIP writer (+ tests)
│   ├── state/            # AppState: stack, theme, Smart search, toast, copy, dialogs
│   ├── components/       # Header/Footer/Toast/Dialogs, Card, Icon, shared bits
│   └── pages/            # Home, Plugins, Plugin, Artifact, Stack, Changelog, Start, Course, NewPlugin, NotFound
└── design/               # Design canvas sources: reference only, not built or deployed
    ├── Main.dc.html      # the prototype (source of truth for UI and behaviour)
    ├── Foundations.dc.html, Components.dc.html, canvas.json
```

## Data: real plugins only

The site shows **only the plugins that are in this repository**. There is no sample, placeholder or fallback data.

`vite.config.js` defines a virtual module, `virtual:catalog`, whose content is `buildCatalog(<repo root>)` from `build/catalog.mjs`: it reads `.claude-plugin/marketplace.json` and every local plugin (plugin.json, skills, agents, commands, hooks, MCP servers, README, CHANGELOG, release tags) and, if present, `site/course-map.json`. Env var and header *values* are never copied, only names.

- `npm run dev` watches `plugins/`, `.claude-plugin/` and `site/course-map.json`; any change regenerates the catalog and reloads the page.
- `npm run build` bundles the catalog into the JS and writes `dist/feed.xml` (RSS of releases). Nothing generated is committed.

## UI text (i18n)

Components contain no user-facing copy. Every label, heading, button, placeholder, aria-label, tooltip, toast, dialog, empty state, error message, type label and month name lives in **`src/i18n/en.js`**, one nested object. Read it with `t()` from `src/i18n/index.js`:

```js
t('home.title')                          // plain string
t('footer.builtFrom', { build })         // "{build}" placeholders
t('count.plugin', { count: n })          // plurals: picks `plugin_one` / `plugin_other` (Intl.PluralRules)
```

Not in i18n (they are data or code): catalog content, CSS classes, URLs, generated commands and files (install commands, `settings.json`, plugin templates), icon paths, and the search vocabulary (synonyms, stop words, cross-language words in `src/lib/search.js`).

To add a language, create e.g. `src/i18n/uk.js` with the same shape, register it in `LOCALES` in `src/i18n/index.js` and call `setLocale('uk')`. `src/i18n/i18n.test.js` fails if any `t('…')` key used in `src/` is missing from `en.js`.

## Local development

```
cd site
npm ci
npm run dev        # http://localhost:5173/dev-digest-ai-marketplace/
```

Other commands:

```
npm test           # vitest (src/**/*.test.*) + node --test build/catalog.test.mjs
npm run build      # → dist/
npm run preview    # serve dist/ at http://localhost:4173/dev-digest-ai-marketplace/
```

## Deploy

`.github/workflows/pages.yml` runs on pushes to `main` that touch `site/`, `plugins/` or `.claude-plugin/`: `npm ci`, `npm test`, `npm run build`, then publishes `site/dist` to GitHub Pages.

GitHub Pages has no server-side routing, so the workflow copies `dist/index.html` to `dist/404.html`: every deep link (`/plugins/<name>/`, `/stack/`, …) gets the app shell, and the router opens the right screen. Asset URLs are absolute under `/dev-digest-ai-marketplace/` (Vite `base`), so this works at any depth. If the repository is renamed, change `base` in `vite.config.js`.

## Updating the design

The `.dc.html` files in `design/` are the Design canvas sources. To change the UI, update them (export from the canvas), then port the change into `src/`: class names and markup in `src/` follow `Main.dc.html`, and `src/styles.css` is its `<helmet>` style block.
