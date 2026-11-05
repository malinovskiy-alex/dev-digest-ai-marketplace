# Catalog site (GitHub Pages)

Static site for the `dev-digest-ai` marketplace, published to
<https://malinovskiy-alex.github.io/dev-digest-ai-marketplace/>.

This folder is **separate from the marketplace**: nothing here is read by Claude Code, and nothing under `plugins/` or `.claude-plugin/` depends on it.

## Layout

```
site/
├── index.html              # app shell (also copied to 404.html at deploy, for deep links)
├── .nojekyll               # serve files as-is, no Jekyll
├── runtime/dc-lite.js      # renderer for .dc.html files (no dependencies)
└── design/                 # the Design canvas project, imported as-is
    ├── canvas.json         # canvas index (artboards, titles)
    ├── Main.dc.html        # prototype: all screens
    ├── Foundations.dc.html # tokens, type, space, icons
    ├── Components.dc.html  # components, dark/light
    ├── foundations.html    # viewer → /design/foundations.html
    └── components.html     # viewer → /design/components.html
```

## How it works

The `.dc.html` files are the design canvas's own sources (template + component logic). `runtime/dc-lite.js` fetches one, copies its `<helmet>` styles into the page and renders it, re-rendering on `setState`. For the main app it also maps the prototype's routes to real URLs (`/plugins/<name>/`, `/stack/`, `/changelog/`, …) so links can be shared and Back works.

GitHub Pages has no server-side routing, so the deploy workflow copies `index.html` to `404.html`: any deep link is served the app shell, which reads the URL and opens the right screen.

All paths are absolute under `/dev-digest-ai-marketplace/` — that is the Pages URL of this repository (`BASE` in `Main.dc.html`).

## Updating the design

1. Export the canvas files (`project/*.dc.html`, `project/canvas.json`) from the Design artifact.
2. Replace the files in `site/design/` — do not edit the runtime for design changes.
3. Preview locally (see below) and open a PR. `.github/workflows/pages.yml` deploys on merge to `main`.

## Preview locally

Pages serves this folder under `/dev-digest-ai-marketplace/`, so the local server must too:

```
node site/serve.mjs          # http://localhost:8080/dev-digest-ai-marketplace/
```

## Status

The catalog data (plugins, artifacts, changelog) is still the **prototype's sample data** inside `Main.dc.html` (`PLUGINS`, `ARTS`, `LOGRAW`). Generating it from the repository at build time is the next step — see [docs/SITE-SPEC.md](../docs/SITE-SPEC.md).
