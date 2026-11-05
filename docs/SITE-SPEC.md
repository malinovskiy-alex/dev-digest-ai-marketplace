# Site spec: Marketplace catalog on GitHub Pages

This document has two parts. **Part I** defines behaviour and data. **Part II** is the design brief: screens, components and states. References like `§7.4` point to Part I, `D§6.4` to Part II.

| | |
|---|---|
| Status | Draft, ready for design |
| UI language | English only |
| Author | Oleksandr Malinovskyi |
| Date | 2026-11-04 |
| Site URL | `https://malinovskiy-alex.github.io/dev-digest-ai-marketplace/` |

# Part I. Functional spec

## 1. Problem

The `dev-digest-ai` marketplace will grow lesson by lesson, and every plugin ships several artifacts: skills, agents, hooks, MCP servers. The only way to find something today is to browse the repository folders or run `/plugin` inside Claude Code, where you can see plugin names but can't search inside them. Users need to answer three questions quickly:

1. *Is there something here for my task?*: "I need a skill that summarizes a changelog".
2. *What exactly will it do on my machine?*: hooks, network calls, required secrets.
3. *How do I install it, for me or for my whole team?*

## 2. Goals and non-goals

**Goals**

- G1. Full-text search over **every artifact** in the repository (plugins, skills, agents, commands, hooks, MCP servers), with results shown as cards.
- G2. One page per plugin and per artifact, generated from the files in the repo. Nothing is written by hand twice.
- G3. Install with one click: copyable commands and a generated team `settings.json`.
- G4. A visible security surface for each plugin: hooks, MCP servers, secrets, tool restrictions.
- G5. Zero runtime backend. Everything is computed at build time in GitHub Actions and served as static files.

**Non-goals**

- Install counters, ratings, user accounts, analytics. These need a backend.
- Editing plugins from the site.
- Hosting plugins from other repositories.
- UI localization. The UI is **English only**. Queries in other languages are handled by Smart search (§7.11), not by translating the UI.

## 3. Users and key scenarios

| # | User | Scenario |
|---|---|---|
| S1 | Developer | Types `I need a skill to summarize release notes`. Sees the `summarize` skill card at the top, clicks Copy install. |
| S2 | Developer | Opens a plugin page, reads which hooks run and which env vars are needed, then decides whether to install it. |
| S3 | Team lead | Picks 3 plugins with "Add to stack", downloads `settings.json`, commits it to the team project. Every teammate gets the same plugins. |
| S4 | Contributor | Adds a plugin in a PR. After merge the site shows it within minutes, with no extra work. |
| S5 | Anyone | Shares a search link (`?q=digest&type=skill`) in chat. The recipient sees the same results. |

## 4. Architecture

```
push to main / PR
      │
      ▼
.github/workflows/pages.yml
  1. checkout (fetch-depth: 0, needed for git dates)
  2. site/scripts/build-index.mjs
       reads: .claude-plugin/marketplace.json
              plugins/<p>/.claude-plugin/plugin.json
              plugins/<p>/README.md
              plugins/<p>/skills/*/SKILL.md
              plugins/<p>/agents/*.md
              plugins/<p>/commands/*.md      (legacy)
              plugins/<p>/hooks/hooks.json
              plugins/<p>/.mcp.json
       writes: site/src/data/catalog.json  (full model, build-time only)
               site/public/search-index.json (search docs, shipped to browser)
  3. astro build  → site/dist
  4. (main only) actions/upload-pages-artifact + actions/deploy-pages
```

- **Single source of truth.** The catalog is derived only from files that `validate.yml` already validates. The site never stores plugin metadata of its own. The one exception is the search synonyms file (§6.3).
- **On PRs** the workflow runs steps 1–3 without deploying. A plugin change that breaks the index builder fails the PR.
- **Pages source** is set to "GitHub Actions" (one-time: `gh api -X POST repos/malinovskiy-alex/dev-digest-ai-marketplace/pages -f build_type=workflow`).
- **Base path** is `/dev-digest-ai-marketplace/` (Astro `base`). All internal links must respect it.

### 4.1 Stack

| Concern | Choice | Reason |
|---|---|---|
| Site generator | **Astro** (static output) | Content-first, pre-renders one HTML page per artifact (shareable URLs, SEO), ships no JS by default |
| Interactive parts | Astro islands in plain TypeScript (no UI framework) | Search box, stack builder and copy buttons are small |
| Search | **MiniSearch** | Small (~7 KB gz), fuzzy + prefix + field boosting, indexes JSON in the browser |
| Markdown | Astro's built-in Markdown pipeline + `rehype-sanitize` | Plugin content is reviewed but still treated as untrusted. No raw HTML or scripts end up on the page |
| Frontmatter | `gray-matter` | Same YAML parsing Claude Code users expect |
| Tests | Vitest | Index builder and search relevance |
| Runtime | Node 22 LTS | Versions pinned in `site/package-lock.json` |

The site lives in `site/` with its own `package.json`. It is not a plugin, and nothing in `site/` is shipped on plugin install, because only `plugins/<name>/` is copied.

## 5. Data model

### 5.1 `catalog.json` (build time)

```jsonc
{
  "marketplace": { "name": "dev-digest-ai", "repo": "malinovskiy-alex/dev-digest-ai-marketplace", "builtAt": "2026-11-04T12:00:00Z", "commit": "ddfc467" },
  "plugins": [
    {
      "name": "example-plugin",
      "displayName": null,
      "version": "0.1.0",
      "description": "…",
      "category": "productivity",
      "tags": ["digest", "summary"],          // marketplace.json tags ∪ plugin.json keywords
      "author": { "name": "…", "url": "…" },
      "license": "MIT",
      "dependencies": [],
      "readmeHtml": "…",                       // sanitized
      "updatedAt": "2026-11-04",               // last commit touching plugins/<name>/
      "sourceUrl": "https://github.com/…/tree/main/plugins/example-plugin",
      "security": { /* §8 */ },
      "artifacts": ["example-plugin:summarize"]
    }
  ],
  "artifacts": [
    {
      "id": "example-plugin:summarize",
      "type": "skill",                         // skill | agent | command | hook | mcp
      "plugin": "example-plugin",
      "name": "summarize",
      "invocation": "/example-plugin:summarize",
      "description": "Summarizes articles, changelogs or notes…",
      "bodyHtml": "…",                          // sanitized SKILL.md / agent body
      "bodyText": "…",                          // plain text for search
      "meta": { "allowedTools": null },         // type-specific, see below
      "sourceUrl": "https://github.com/…/blob/main/plugins/example-plugin/skills/summarize/SKILL.md"
    }
  ]
}
```

Type-specific `meta`:

| Type | Source | `meta` fields |
|---|---|---|
| skill | `skills/<s>/SKILL.md` frontmatter | `allowedTools` |
| agent | `agents/<a>.md` frontmatter | `tools`, `model` |
| command | `commands/<c>.md` | `legacy: true` |
| hook | each entry in `hooks/hooks.json` | `event`, `matcher`, `commandPreview` (first 200 chars) |
| mcp | each server in `.mcp.json` | `transport` (`stdio`/`http`/`sse`), `url` or `command`, `envVars` (names only, never values) |

Hooks and MCP servers have no `description` of their own. The builder uses `"<event> hook (matcher: <matcher>)"` or `"MCP server <name> (<transport>)"` and the plugin description as context.

### 5.2 `search-index.json` (shipped to the browser)

A flat array, one document per plugin and per artifact: `id, type, plugin, name, description, tags, category, text`. `text` is `bodyText` truncated to 2,000 characters. The full HTML bodies stay on the detail pages and are not loaded during search.

### 5.3 Builder rules

- Fail the build (non-zero exit) when a required field is missing (`name`, `description`) or YAML/JSON doesn't parse. The error names the file.
- Never copy secret values. For `env`/`headers`, only the variable **names** referenced as `${VAR}` or `${user_config.KEY}` are extracted.
- The output is deterministic: sorted by plugin name, then type, then artifact name. Running the builder twice gives the same output, apart from `builtAt`.

## 6. Search

### 6.1 Behaviour

- The search box is on the home page, auto-focused. `/` focuses it from any page.
- Search runs as you type (debounced 100 ms). The index loads on first focus.
- Fields and boosts: `name ×4`, `tags ×3`, `description ×2`, `plugin ×1.5`, `category ×1`, `text ×1`.
- Options: `prefix: true`, `fuzzy: 0.2`. Terms are combined with **AND** first. If that returns nothing, the query is retried with **OR** and a note: "No exact matches — showing partial matches."
- Filter chips: type (`skill`, `agent`, `command`, `hook`, `mcp`, `plugin`), category, tag. Chips show result counts.
- State lives in the URL: `?q=<query>&type=<t>&category=<c>&tag=<t>`. Back/forward work.
- Empty query: all plugins, sorted by most recently updated.
- No results: tips plus a "Request a plugin" link (§7.6).

### 6.2 Query normalization

Before searching, the query is lower-cased and these are removed:

1. **Stop words.** A standard English list, plus intent filler such as `i, need, want, looking, for, a, an, the, to, that, which, can, help, me, something, tool, plugin, skill, agent, please`.
2. **Type words become filters.** If the query contains `skill(s)`, `agent(s)`, `hook(s)`, `mcp` or `command(s)` and no type filter is set, that type is pre-selected as a *soft* filter. The chip is shown and the user can clear it.

Example: `I need a skill to summarize release notes` → terms `summarize release notes`, soft filter `type=skill`.

### 6.3 Synonyms

`site/search/synonyms.json` maps each term to extra terms added to the query with half weight:

```json
{
  "tldr": ["summarize", "summary", "digest"],
  "summary": ["summarize", "digest", "tldr"],
  "changelog": ["release", "notes", "changes"],
  "pr": ["pull", "request", "review"]
}
```

This is the only hand-maintained search data. CONTRIBUTING.md gets one line asking authors to add synonyms when their plugin introduces new vocabulary.

### 6.4 Result card

```
┌──────────────────────────────────────────────┐
│ [SKILL]  summarize                 v0.1.0    │
│ example-plugin · productivity                │
│ Summarizes articles, changelogs or notes     │
│ into a short developer digest…               │
│ #digest #summary            ⚠ hooks  🔌 MCP  │
│ [Copy install]  [Add to stack]  [Details →]  │
└──────────────────────────────────────────────┘
```

- Matched terms are highlighted in the name and description.
- Security badges (§8) appear when they apply.
- **Copy install** copies the two commands from §7.2.

## 7. Features

All features in this section are in scope. §11 sets only the delivery order. The visual and interaction design is in Part II.

#### 7.1 Plugin page: `/plugins/<name>/`

- Header: name, version, category, tags, author, license, "Updated <date>", link to source.
- Install block (§7.2).
- Security panel (§8).
- Components table: every artifact, with type, namespaced name and description, each linking to its page.
- Dependencies, linked when they're in this marketplace.
- Rendered README.

#### 7.2 Artifact page: `/plugins/<name>/<type>/<artifact>/`

- Header: type badge, namespaced invocation (`/example-plugin:summarize`), the parent plugin.
- The full description. For skills this text decides *when Claude triggers it*, so it is shown prominently under the heading "When it activates".
- Type-specific metadata (`allowed-tools`, agent `tools` and `model`, hook event and matcher, MCP transport and env vars).
- Rendered body (SKILL.md / agent prompt). Hooks show the full command in a code block.
- Link to the source file on GitHub.

#### 7.3 Install commands

Shown on cards, plugin pages and artifact pages, each line with its own copy button:

```
/plugin marketplace add malinovskiy-alex/dev-digest-ai-marketplace
/plugin install <plugin>@dev-digest-ai
```

Artifact pages also show how to use it (`/example-plugin:summarize`) and the update command from RELEASES.md.

#### 7.4 Stack builder: `/stack/`

- "Add to stack" on any card or plugin page adds the **plugin** (artifacts can't be installed on their own). The header shows a counter.
- The stack is kept in `localStorage`. All access is wrapped in try/catch, and the page works without it.
- The `/stack/` page lists the selected plugins, their combined security surface (§8), and the generated file:

```json
{
  "extraKnownMarketplaces": {
    "dev-digest-ai": {
      "source": { "source": "github", "repo": "malinovskiy-alex/dev-digest-ai-marketplace" }
    }
  },
  "enabledPlugins": {
    "example-plugin@dev-digest-ai": true
  }
}
```

- Actions: Copy, Download `settings.json`, and Share stack (URL `?plugins=a,b,c` that restores the selection).
- A hint explains where to put the file (`<project>/.claude/settings.json`) and that teammates are prompted to trust the marketplace on first use.
- Plugin dependencies are added automatically and marked "added as dependency of X".

#### 7.5 Security badges

See §8.

#### 7.6 Request a plugin / Report an issue

Buttons open `https://github.com/<repo>/issues/new?template=…&title=…`, pre-filled with the plugin name or search query. This needs two issue templates in `.github/ISSUE_TEMPLATE/` (`plugin-request.yml`, `plugin-bug.yml`). Security problems link to SECURITY.md §5 instead of a public issue.

#### 7.7 What's new + feed

- `/changelog/`: one entry per plugin version change, built from git history of each `plugin.json` (version, date, commit subject) and from `CHANGELOG.md` when present. The bump type (major/minor/patch) is derived by comparing with the previous version. An entry whose first changelog line starts with `Rollback:` (written by `scripts/rollback.mjs`, see RELEASES.md) is shown as a **Rollback**.
- `/feed.xml`: Atom feed of the same entries.
- Home page: a "Recently updated" strip.

#### 7.8 Course map

`/course/`: a timeline of GoIT course lessons, each linked to the plugins built in it. The mapping comes from an optional `site/course-map.json` (`{ "lesson": "…", "plugins": ["…"] }[]`), because plugin manifests have no field for this and `--strict` validation rejects unknown fields.

#### 7.9 Plugin scaffold generator

`/new/`: a form (name, description, category, tags, first skill name and description) that validates the name against PLUGIN-GUIDELINES §2 (pattern, reserved prefixes) and produces a ZIP (JSZip) containing:

```
plugins/<name>/.claude-plugin/plugin.json
plugins/<name>/skills/<skill>/SKILL.md
plugins/<name>/README.md        (all sections from PLUGIN-GUIDELINES §6)
plugins/<name>/LICENSE
marketplace-entry.json          (snippet to paste, sorted position noted)
```

#### 7.10 Discussions via giscus

A comment thread on each plugin page, backed by GitHub Discussions (category "Plugins", mapping by pathname). This requires Discussions to be enabled and the giscus app installed. The repo is public, so this works.

#### 7.11 Semantic and multilingual search

Embeddings for every search document are computed at build time. The query is embedded in the browser with a multilingual model (transformers.js), and results combine keyword and vector scores. The model is downloaded on demand (about 100 MB), behind an explicit "Smart search" toggle. This makes non-English queries work. Keyword search stays the default; Smart search is opt-in per visitor and remembered in `localStorage`.

#### 7.12 Getting started: `/start/`

A short static page for first-time visitors: what a Claude Code marketplace is, how to add `dev-digest-ai`, how to install, use, update and remove a plugin (commands from RELEASES.md), and how to use the stack builder for a team. Linked from the header and the home page hero.

## 8. Security surface

Computed per plugin by the builder and shown as badges on cards and a panel on the plugin page:

| Badge | Rule | Panel details |
|---|---|---|
| ⚠ Runs hooks | `hooks/hooks.json` has ≥1 hook | Event, matcher, command for each hook. Note: "Hooks run on every matching event once the plugin is enabled." |
| ⚠ Broad hook | A hook on `UserPromptSubmit`, `PreToolUse` or `PostToolUse` with matcher empty or `*` | Same, highlighted |
| 🔌 MCP | `.mcp.json` has ≥1 server | Name, transport, URL/command |
| 🌐 Remote MCP | MCP transport is `http`/`sse` | Host name. Flagged red if the URL is `http://` to a non-local host |
| 🔑 Needs secrets | MCP/hook references `${VAR}` or a `userConfig` option with `sensitive: true` | Variable/option names |
| 🛡 Restricted tools | Every skill has `allowed-tools` and every agent has `tools` | Lists them |
| 📜 Scripts | `scripts/` folder or `package.json` exists | File list linking to GitHub |

The panel always ends with: "Badges are derived automatically from the plugin files and are not a security guarantee. Review the source before installing." and links to SECURITY.md.

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Home page JS ≤ 50 KB gz before search is focused. `search-index.json` ≤ 200 KB gz. Search under 50 ms for 500 documents on a mid-range laptop. Lighthouse Performance ≥ 90 |
| Accessibility | WCAG 2.1 AA. Fully keyboard-operable (`/` focus, arrows through results, Enter opens). Visible focus. Results count announced via `aria-live` |
| Theming | Light and dark, following `prefers-color-scheme`, with a manual toggle stored in `localStorage` |
| Responsive | Usable at 360 px width, no horizontal scrolling |
| Without JS | All plugin and artifact pages, and the plugin list, work. Search and the stack builder need JS |
| Security | No third-party scripts except giscus (plugin pages only, loaded lazily) and the Smart search model files (loaded only after opt-in). Strict CSP via `<meta>`. Rendered Markdown sanitized |
| Freshness | The site reflects `main` within 5 minutes of a merge |
| SEO | Per-page `<title>` and description, `sitemap.xml`, canonical URLs |

## 10. Repository changes

```
.github/workflows/pages.yml          new: build on PR, build + deploy on main
site/                                new
├── package.json, package-lock.json, astro.config.mjs, tsconfig.json
├── scripts/build-index.mjs
├── search/synonyms.json, search/stopwords.json
├── src/pages/ (index, plugins/[name], plugins/[name]/[type]/[artifact], stack, 404)
├── src/components/ …
└── test/ (fixtures/, build-index.test.ts, relevance.test.ts)
README.md                            link to the catalog site + badge
CONTRIBUTING.md                      "your plugin appears on the site automatically"; synonyms note
.gitignore                           site/node_modules, site/dist, site/src/data/catalog.json
```

`validate.yml` stays unchanged. `claude plugin validate . --strict` ignores `site/` because it isn't listed in `marketplace.json`. Implementation must confirm this.

## 11. Delivery order

Every feature in §7 is in scope for the first release. The order below only reflects dependencies: later steps reuse what earlier ones build.

| Step | Scope | Depends on |
|---|---|---|
| 1 | Index builder, `pages.yml`, base layout, theme | none |
| 2 | Search + result cards (§6), plugin and artifact pages (§7.1–7.3), security surface (§8) | 1 |
| 3 | Stack builder (§7.4), issue templates + request/report links (§7.6) | 2 |
| 4 | What's new + feed (§7.7), course map (§7.8), getting started page | 1 |
| 5 | Scaffold generator (§7.9), giscus discussions (§7.10) | 2 |
| 6 | Smart search (§7.11) | 2, relevance test set |

## 12. Acceptance criteria

1. Merging a PR that adds a plugin with one skill and one agent makes both appear in search and get their own pages, with no changes in `site/`.
2. A PR with a SKILL.md whose frontmatter has no `description` fails the `pages.yml` build, and the error names the file.
3. Query `I need a skill to summarize release notes` returns `example-plugin:summarize` as the first result, with the `skill` chip active.
4. Query `sumarize` (typo) returns `example-plugin:summarize` in the top 3.
5. Query `tldr` returns `example-plugin:summarize` (via synonyms).
6. Opening `?q=digest&type=skill` directly shows the same results as typing it.
7. A plugin with a `PreToolUse` hook and matcher `*` shows "⚠ Runs hooks" and "⚠ Broad hook" on its card. Covered by a test fixture.
8. MCP `env` values never appear in `catalog.json` or `search-index.json`. Covered by a fixture that contains a fake secret value.
9. Adding two plugins to the stack and downloading gives a `settings.json` that, placed in a fresh project, makes Claude Code offer to install exactly those plugins. Checked manually once.
10. All plugin and artifact pages render with JS disabled.
11. Lighthouse: Performance ≥ 90, Accessibility ≥ 95 on the home page and one plugin page.

### Relevance test set

`site/test/relevance.test.ts` keeps a table of `query → expected id in top N`. Every new plugin PR adds at least one row. This is the regression guard for search quality and the baseline for Smart search.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Users search for intent words the artifacts don't contain | Stop words, synonyms, relevance test set, Smart search (§7.11) |
| Badges create false confidence | Disclaimer on every panel. Badges describe what's present, never "safe" |
| Malicious Markdown/HTML in plugin content | `rehype-sanitize`, CSP, CODEOWNER review already required for plugins |
| `settings.json` schema changes in Claude Code | Generator isolated in one module. Acceptance check #9 rerun on Claude Code upgrades |
| Site build blocks plugin PRs | Builder errors only on files Claude Code itself requires to be valid |

## 14. Decisions

| # | Question | Decision (2026-11-04) |
|---|---|---|
| D1 | Custom domain or `*.github.io`? | Keep `malinovskiy-alex.github.io/dev-digest-ai-marketplace/`. No custom domain |
| D2 | Index legacy `commands/` artifacts? | Yes. Indexed and shown with a **Legacy** badge and a note that new capabilities should be skills |
| D3 | Who moderates giscus discussions? | Any GitHub user can comment in the Discussions category "Plugins". Only CODEOWNERS moderate (hide, lock, delete) |
| D4 | Scope | All features in §7 ship in the first release (order in §11) |

# Part II. Design spec

The brief for visual and interaction design. It lists every screen, component and state the site needs. Behaviour and data rules are in Part I.

## D1. Design principles

1. **Search first.** The home page is a search box. Every other page is reachable in one click from a result card.
2. **Show what runs.** Hooks, MCP servers, secrets and scripts are always visible before the install button, never hidden behind a click.
3. **Copy-paste ready.** Every command and config the user needs is in a code block with its own copy button. The user never retypes anything.
4. **No dead ends.** Empty states and errors always offer a next action: clear filters, request a plugin, go to Getting started.
5. **Developer-tool calm.** Dense but readable, neutral surfaces, colour used for meaning (artifact type, risk), not decoration. Commands and names in monospace.

## D2. Audience

| Persona | Goal | Most-used screens |
|---|---|---|
| Developer | Find and install a skill/agent for a task | Home/search, artifact page, plugin page |
| Team lead | Assemble a standard plugin set for a project | Plugin page, Stack |
| Contributor (course student) | Publish a new plugin correctly | Build a plugin, plugin page (to check the result), Course map |
| Newcomer | Understand what a marketplace is and how to start | Getting started |

## D3. Information architecture

```
/                              Home + search (results inline)
/start/                        Getting started
/plugins/                      All plugins (browse grid, no-JS fallback for search)
/plugins/<name>/               Plugin page
/plugins/<name>/<type>/<id>/   Artifact page (type: skill | agent | command | hook | mcp)
/stack/                        Stack builder
/changelog/                    What's new
/feed.xml                      Atom feed (no design, linked with an RSS icon)
/course/                       Course map
/new/                          Build a plugin (scaffold generator)
/404                           Not found
```

Header navigation, in order: **Plugins · Getting started · What's new · Course · Build a plugin**. Right side: search shortcut (on pages other than Home), **Stack (n)**, theme toggle, GitHub icon link.

Footer: marketplace name and short description, links to the repository, CONTRIBUTING, SECURITY, RELEASES, the feed, "Request a plugin", the build commit and date (`Built from ddfc467 · 2026-11-04`), licence.

## D4. Foundations (deliverables: design tokens)

Deliver every token for **light and dark** themes. Token names are semantic, so implementation can map them to CSS custom properties 1:1.

### D4.1 Colour roles

| Group | Tokens |
|---|---|
| Surfaces | `bg`, `surface`, `surface-raised`, `surface-sunken` (code blocks), `overlay` (dialog scrim) |
| Text | `text`, `text-muted`, `text-subtle`, `text-on-accent`, `link`, `link-visited` |
| Lines | `border`, `border-strong`, `focus-ring` |
| Accent | `accent`, `accent-hover`, `accent-subtle` (selected chip, highlight background) |
| Search highlight | `mark-bg`, `mark-text` |
| Status | `info`, `success`, `warning`, `danger`, each with a `-subtle` background variant |
| Artifact types | `type-plugin`, `type-skill`, `type-agent`, `type-command`, `type-hook`, `type-mcp`, each with a `-subtle` variant |

Constraints:
- All text/background pairs meet WCAG 2.1 AA (4.5:1 body, 3:1 large text and UI boundaries).
- Type and status colours are never the only signal. Each badge also carries a label or icon.
- `type-hook` must not look like `warning`, because hooks are not bad by default. The risk is expressed by the separate security badges (D§6.6).

### D4.2 Typography

- UI typeface: a sans-serif with good small sizes, self-hosted or a system stack. No third-party font CDN at runtime, because of the CSP (§9).
- Monospace for: commands, artifact invocations (`/example-plugin:summarize`), versions, file paths, code blocks.
- Scale: `display` (home hero), `h1`, `h2`, `h3`, `body`, `body-sm`, `caption`, `mono`, `mono-sm`. Define size, line height and weight for each.
- Prose (rendered README / SKILL.md): style headings, lists, tables, inline code, blockquotes, links. Maximum line length about 75 characters.

### D4.3 Space, shape, depth, motion

- Spacing on a 4 px grid: 4, 8, 12, 16, 24, 32, 48, 64.
- Radii: `sm` (chips, badges), `md` (cards, inputs), `lg` (dialogs).
- Elevation: flat cards with a border by default, one raised level for hover, toasts and dialogs.
- Motion: 150 ms ease-out for hover and focus, 200 ms for dialog and toast. All motion off under `prefers-reduced-motion`.

### D4.4 Icons

One outline icon set. Required icons: search, close, copy, check, external link, GitHub, sun/moon, stack (layers), plus, minus, download, share/link, warning, shield, plug (MCP), globe (remote), key (secrets), script/file-code, terminal, sparkle (Smart search), RSS, chevrons, filter, info, legacy (archive).

### D4.5 Breakpoints and grid

| Name | Width | Layout |
|---|---|---|
| Mobile | 360–599 | 1 column, 16 px gutters, nav in a menu sheet |
| Tablet | 600–1023 | 2-column result grid, filters in a collapsible bar |
| Desktop | ≥ 1024 | Filters sidebar + 2–3-column results, content max-width 1200 px |

No horizontal page scroll at any width. Code blocks scroll horizontally inside themselves.

## D5. Global elements

### D5.1 Header

- Desktop: logo/wordmark `dev-digest-ai` left, nav centre-left, utilities right.
- Mobile: logo, Stack counter, menu button. The menu opens a full-height sheet with nav and the theme toggle.
- On every page except Home a compact search field (or a button showing `Search  /` hint) opens the search on Home with focus.
- **Stack counter**: icon + number. Hidden when the stack is empty on mobile, shows `0` muted on desktop. Animates (respecting reduced motion) when a plugin is added.

### D5.2 Footer

See D§3. One row on desktop, stacked on mobile.

### D5.3 Toast

Bottom centre, auto-dismiss after 3 s, `aria-live="polite"`. Used for "Copied", "Added to stack", "Removed from stack" (with **Undo**), "Link copied".

### D5.4 Theme toggle

Three states: System (default), Light, Dark. Icon button with a menu, or a cycling button with a tooltip naming the current state.

## D6. Components

Each component must be designed with all listed states, in both themes.

### D6.1 Search box

- Large on Home, compact in the header.
- Placeholder: `Describe what you need — e.g. "summarize release notes"`.
- Left: search icon. Right: clear button (when not empty), keyboard hint `/` (when empty and not focused), **Smart search** toggle (D§6.12).
- States: default, hover, focus, filled, loading index (thin progress line under the field), index failed (inline error under the field, see D§7.1).

### D6.2 Filter chips

- Groups: **Type** (Plugin, Skill, Agent, Command, Hook, MCP), **Category**, **Tags**.
- Each chip shows a count: `Skill 4`. Zero-count chips are shown disabled, not hidden, so the layout doesn't jump.
- States: default, hover, selected, disabled, focus.
- **Soft filter** variant: a chip selected automatically from the query (§6.2) has a small "auto" marker and a tooltip: `Selected from your query. Click to remove.`
- "Clear all" text button when any filter is active.
- Desktop: vertical sidebar with group headings. Tablet/mobile: a horizontal scroll row for Type, plus a **Filters** button opening a sheet for Category and Tags.

### D6.3 Type badge

Pill with icon + label, coloured with `type-*`: `PLUGIN`, `SKILL`, `AGENT`, `COMMAND`, `HOOK`, `MCP`. A Legacy variant for commands adds an archive icon and the label `LEGACY COMMAND` (decision D2).

### D6.4 Result card

Anatomy, top to bottom:

1. Type badge · name (mono, bold) · version (mono, muted, right-aligned).
2. Parent line: `in example-plugin · productivity`. Plugin cards show category only.
3. Description, clamped to 3 lines, matched terms highlighted with `mark-*`.
4. Tags (max 4, then `+n`).
5. Security badges (D§6.6), only those that apply, max 3 then `+n`.
6. Actions: **Copy install** (secondary), **Add to stack** / **In stack ✓** (toggle), whole card links to the detail page.

States: default, hover (raised), focus (whole-card focus ring; inner buttons remain separately focusable), in-stack (subtle accent border + `In stack ✓`), keyboard-selected via arrow keys.

Variants:
- **Plugin card** shows the number of artifacts per type: `2 skills · 1 agent · 1 hook`.
- **Hook / MCP card** has no own description. Show the generated label (`PreToolUse hook · matcher: Bash`) in mono and the plugin description muted below.

Edge cases to design: a 64-character name, a 2,000-character description, no tags, all 7 security badges.

### D6.5 Copy command / code block

- Single-line variant: `$`-less command in mono, copy button at the right. Long lines scroll inside the block.
- Multi-line variant (settings.json, hook command): header bar with a filename or language label, copy and (where relevant) download buttons.
- Copy states: idle → copied (check icon + "Copied", 2 s) → idle. Failure (clipboard blocked): select the text and show `Press Ctrl+C to copy`.

### D6.6 Security badges and panel

Badges (§8): **Runs hooks**, **Broad hook**, **MCP**, **Remote MCP**, **Insecure MCP (http)**, **Needs secrets**, **Scripts**, **Restricted tools**.

| Badge | Tone |
|---|---|
| Runs hooks, MCP, Scripts, Needs secrets | `info`: present, worth knowing |
| Broad hook, Remote MCP | `warning` |
| Insecure MCP (http) | `danger` |
| Restricted tools | `success` |

**Security panel** (plugin page, artifact pages for hooks/MCP, stack page):
- Title "What this plugin can do on your machine".
- One row per badge that applies: icon, title, one-line plain-English explanation, details (event + matcher, MCP host, variable names, file list), linked to the artifact page.
- If nothing applies: "No hooks, MCP servers or scripts. This plugin only adds prompts (skills/agents)." in a `success-subtle` callout.
- Fixed footer text: "Badges are derived automatically from the plugin files and are not a security guarantee. Review the source before installing." + link to SECURITY.md.

### D6.7 Install block

- Title "Install".
- Step 1 `Add the marketplace (once)`: copy command.
- Step 2 `Install the plugin`: copy command.
- Step 3 (artifact pages only) `Use it`: the invocation, e.g. `/example-plugin:summarize`, or for agents "Claude delegates to `example-plugin:<agent>` automatically, or ask for it by name".
- Secondary row: **Add to stack**, link "Updating and removing →" (to `/start/#update`).

### D6.8 Metadata list

Key/value list for plugin and artifact headers: Version, Category, Author, License, Updated, Source (GitHub link), Dependencies, Allowed tools, Model, Event, Matcher, Transport, Env vars. Values in mono where they are identifiers.

### D6.9 Prose

Container for rendered README and SKILL.md / agent body. Needs styles for all Markdown elements, including tables wider than the column (scroll inside), and long code lines.

### D6.10 Components table

Plugin page list of artifacts: type badge, namespaced name (link), description (1 line, truncated), security badge if the artifact itself is a hook/MCP. Becomes stacked rows on mobile.

### D6.11 Empty, loading, error

- **Skeleton** cards for result loading (only shown if loading exceeds 300 ms).
- **Empty state**: illustration-free, icon + title + text + actions.
- **Inline error**: `danger-subtle` callout with icon, message and a retry action.

### D6.12 Smart search toggle and dialog

Toggle in the search box: sparkle icon + `Smart`. States: off, downloading (circular progress with %), on, unavailable (disabled with tooltip).

Opt-in dialog, shown the first time the toggle is turned on:
- Title: "Turn on Smart search?"
- Body: "Smart search understands what you mean, not just the words you type, and works with questions in other languages. It downloads a language model (about 100 MB) once and runs entirely in your browser. Nothing you type leaves your device."
- Actions: **Download and turn on** (primary), **Not now**.
- After confirm: the dialog closes, the toggle shows download progress, results keep updating from keyword search meanwhile. When ready, a toast says "Smart search is on" and results refresh.
- Failure: toast "Couldn't load Smart search. Using keyword search." and the toggle returns to off.
- Unsupported (no WebAssembly / low memory): toggle disabled, tooltip "Smart search isn't supported in this browser."
- When on, results show a small `Smart` marker next to the result count.

### D6.13 Buttons, links, inputs

Buttons: primary, secondary, ghost, danger (only for "Clear stack"), icon-only (with tooltip and `aria-label`). Sizes: sm, md. States: default, hover, active, focus, disabled, loading.

Form inputs for `/new/`: text, textarea, select, tag input (comma or Enter to add), with label, help text, error text, character counter where limits apply.

### D6.14 Dialog and sheet

Dialog (Smart search opt-in, Clear stack confirmation), bottom sheet on mobile (filters, nav). Focus trapped, Esc closes, scrim click closes (except while downloading).

## D7. Screens

For each screen deliver desktop and mobile in both themes, plus every listed state.

### D7.1 Home + search: `/`

```
┌───────────────────────────────────────────────────────────────────────┐
│ dev-digest-ai   Plugins  Getting started  What's new  Course  Build   │
│                                                   Stack 2  ◐  GitHub  │
├───────────────────────────────────────────────────────────────────────┤
│        Find skills, agents and plugins for Claude Code                │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ 🔍  Describe what you need — e.g. "summarize release notes"  ✨ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│   New here? Getting started →                    12 plugins · 41 items│
├──────────────┬────────────────────────────────────────────────────────┤
│ TYPE         │ 4 results for "summarize release notes"   [auto: Skill]│
│ ☐ Plugin  3  │ ┌──────────────────────┐ ┌──────────────────────┐      │
│ ☑ Skill   4  │ │ SKILL summarize  0.1 │ │ SKILL changelog  1.2 │      │
│ ☐ Agent   1  │ │ in example-plugin    │ │ in release-tools     │      │
│ ☐ Hook    2  │ │ Summarizes articles… │ │ …                    │      │
│ CATEGORY     │ │ #digest #summary     │ │ ⚠ Runs hooks         │      │
│ …            │ │ [Copy install][+Stack]│ │ [Copy install][+Stack]│     │
│ TAGS         │ └──────────────────────┘ └──────────────────────┘      │
│ …            │                       [Show more]                      │
├──────────────┴────────────────────────────────────────────────────────┤
│ Recently updated  ▸ card ▸ card ▸ card              What's new →       │
├───────────────────────────────────────────────────────────────────────┤
│ footer                                                                │
└───────────────────────────────────────────────────────────────────────┘
```

Content:
- Hero: title, search box, "New here? Getting started →", totals (`12 plugins · 41 items`).
- With an empty query, the results area shows **All plugins** sorted by last update, then a **Recently updated** strip (last 5 version changes, linking to `/changelog/`).
- Results: 20 at a time, then **Show more**.
- Result header: count, query echo, active soft filter chip, sort (Relevance, default · Recently updated · Name).

States to design:
| State | Content |
|---|---|
| Initial (empty query) | All plugins + Recently updated |
| Typing / loading index | Progress line under search box. Skeletons only after 300 ms |
| Results | As above |
| Partial matches | Info callout above results: "No exact matches — showing partial matches." |
| No results | "Nothing matches "<query>"." Actions: **Clear filters** (if any), **Try Smart search** (if off), **Request a plugin** (opens GitHub issue pre-filled with the query) |
| Index failed to load | Inline error under the search box: "Search is unavailable right now." **Retry** · "Browse all plugins →" |
| No JS | Search box replaced by a link list: "Browse all plugins →". The plugin grid is server-rendered |
| Smart search on | `Smart` marker next to result count |

### D7.2 All plugins: `/plugins/`

A server-rendered grid of plugin cards with category sections. It is the no-JS fallback and the target of the "Plugins" nav item. With JS, it offers the same filter chips as Home, without the search box (a link "Search inside plugins →" goes to Home).

### D7.3 Plugin page: `/plugins/<name>/`

```
Plugins / example-plugin
┌─────────────────────────────────────────────┬──────────────────────┐
│ PLUGIN  example-plugin              v0.1.0  │ Install              │
│ Summarizes text into a short developer      │ 1 Add marketplace [⧉]│
│ digest                                      │ 2 Install plugin  [⧉]│
│ productivity · #digest #summary             │ [+ Add to stack]     │
│ Oleksandr Malinovskyi · MIT · Updated Nov 4 │                      │
│ View source on GitHub ↗   Report an issue ↗ │ What it can do       │
├─────────────────────────────────────────────┤ ✓ Prompts only       │
│ Components (1)                              │ (security panel)     │
│ SKILL /example-plugin:summarize  Summarizes…│                      │
├─────────────────────────────────────────────┤ Metadata             │
│ README (prose)                              │ Version, deps, …     │
├─────────────────────────────────────────────┤                      │
│ Version history (last 5) → What's new       │                      │
├─────────────────────────────────────────────┤                      │
│ Discussion (giscus)                         │                      │
└─────────────────────────────────────────────┴──────────────────────┘
```

- Desktop: main column + sticky right sidebar (Install, Security panel, Metadata). Mobile order: header → Install → Security → Components → README → Version history → Discussion.
- Header actions: **View source on GitHub**, **Report an issue** (opens the bug template pre-filled with the plugin name and version), **Share** (copy link).
- **Version history**: last 5 entries (version, date, summary), link to `/changelog/?plugin=<name>`.
- **Discussion** (decision D3): section title "Discussion", note "Comments use GitHub Discussions. Sign in with GitHub to comment." The embed loads only when scrolled near (lazy). Placeholder state while loading. If blocked or failed: "Discussion couldn't load. Open it on GitHub ↗".
- States: plugin with no README (message "This plugin has no README yet."), plugin with 30+ components (table grouped by type with counts), plugin with dependencies (dependency chips linking to their pages; external ones show `name@marketplace` unlinked).

### D7.4 Artifact page: `/plugins/<name>/<type>/<id>/`

Shared layout: breadcrumbs (`Plugins / example-plugin / summarize`), header (type badge, invocation in mono, parent plugin link, version), main column, sidebar with Install block (D§6.7) and Metadata.

Per-type main content:

| Type | Main column sections |
|---|---|
| Skill | **When it activates** (description, prominent callout) · **Allowed tools** (or "Not restricted — can use any tool you allow") · **Instructions** (prose of SKILL.md body) |
| Agent | **When Claude uses it** (description) · **Tools** · **Model** · **System prompt** (prose) |
| Command (legacy) | Legacy callout: "This is a legacy command. New capabilities are written as skills." · Description · Body |
| Hook | Generated title (`PreToolUse hook`) · **Runs on** (event + matcher, explained in plain English, e.g. "Before every Bash tool call") · **Command** (full code block) · security panel for this hook |
| MCP | Server name · **Connection** (transport, host or command) · **Needs** (env vars / user config) · security panel for this server |

Also: "Other components in this plugin" list (max 6) at the bottom. Then **Report an issue**.

### D7.5 Stack: `/stack/`

```
Your stack (2)                                   [Share stack] [Clear]
┌──────────────────────────────────┬────────────────────────────────┐
│ example-plugin   v0.1.0     [–]  │ settings.json                  │
│ release-tools    v1.2.0     [–]  │ ┌────────────────────────────┐ │
│   └ added as dependency of …     │ │ { "extraKnownMarketplaces" │ │
│                                  │ │   …                        │ │
│ Combined security surface        │ └────────────────────────────┘ │
│ ⚠ Runs hooks (1) · 🔌 MCP (1)    │ [Copy] [Download settings.json]│
│                                  │ Where to put it: <project>/    │
│ + Add more plugins → Home        │ .claude/settings.json …        │
└──────────────────────────────────┴────────────────────────────────┘
```

- Left: selected plugins (name, version, description, remove button). Dependency-added plugins are indented with "added as dependency of X" and their remove button is disabled while the parent is in the stack (tooltip explains why).
- Combined security surface: the security panel aggregated over the stack.
- Right: generated `settings.json` (live), Copy, Download, and a "How it works" note: "Commit this file to your project. When teammates open the project in Claude Code, they're asked to trust the marketplace and install these plugins."
- **Share stack** copies `/stack/?plugins=a,b`. Opening such a link shows a banner: "You opened a shared stack (2 plugins)." with **Replace my stack** / **Merge** / **Dismiss**, if the visitor already has a stack. Otherwise it loads directly.
- **Clear** asks for confirmation in a dialog.
- States: empty ("Your stack is empty. Add plugins from search or any plugin page." + **Browse plugins**), storage unavailable (info callout: "Your browser blocks local storage, so the stack won't be remembered after you leave. Use Share stack to keep a link.").

### D7.6 Getting started: `/start/`

A single long-form page with an in-page table of contents (sticky on desktop):

1. What is a plugin marketplace? (2–3 sentences, plus what skills, agents, hooks and MCP servers are, each with its type badge)
2. Add the marketplace (copy command)
3. Find and install a plugin (link to search, install command)
4. Use it (`/plugin:skill` invocation, agents)
5. Update (`#update`): marketplace update, plugin update, auto-update toggle, `/reload-plugins`
6. Remove a plugin
7. Set up your team (link to Stack)
8. Contribute a plugin (link to Build a plugin, CONTRIBUTING)

Every command uses the Copy command component.

### D7.7 What's new: `/changelog/`

- Reverse-chronological feed grouped by month. Each entry: date, plugin name (link), version transition `0.1.0 → 0.2.0`, bump-type badge (Major / Minor / Patch / **Rollback**), summary (from CHANGELOG.md or the commit subject), "View release" (tag on GitHub).
- Filters: plugin (select), bump type (chips). `?plugin=<name>` pre-selects.
- RSS button: "Subscribe (Atom feed)" with the copyable feed URL.
- Major and Rollback entries are visually emphasised (`warning-subtle` / `danger-subtle` rail).
- Empty: "No releases yet."

### D7.8 Course map: `/course/`

- Vertical timeline. Each node: lesson number and title, short description, and plugin cards (compact variant: badge, name, description 1 line) built in that lesson.
- Lessons without plugins are shown muted with "No plugin in this lesson".
- A "You are here" marker is **not** needed (no user state).
- Plugins not mapped to any lesson are listed at the end under "Other plugins".
- Empty (no `course-map.json`): "The course map isn't available yet."

### D7.9 Build a plugin: `/new/`

Two-column on desktop (form left, live preview right), stacked on mobile (form, then a **Preview** tab).

Form fields:
| Field | Rules shown to the user |
|---|---|
| Plugin name | kebab-case, 2–64 chars, must not start with `claude-`, `anthropic-`, `cc-plugin-`. Live validation. Warns if the name already exists in the marketplace. Help text: "Permanent. You can't rename a plugin later." |
| Display name (optional) | Free text |
| Description | 10–2000 chars, counter |
| Category | Select from existing categories + "Other…" |
| Tags | Tag input |
| Author name, URL | Pre-filled empty |
| First skill name | kebab-case |
| First skill description | Counter. Help text: "Say what it does and when Claude should use it. This text decides when the skill triggers." |

Preview: a file tree of the ZIP and a tabbed code view of each generated file (`plugin.json`, `SKILL.md`, `README.md`, `marketplace-entry.json`).

Actions: **Download ZIP** (primary, disabled until valid), **Copy marketplace entry**.

After download: a "Next steps" panel: unzip into the repo root, paste the marketplace entry in alphabetical order, run the two `claude plugin validate … --strict` commands (copy blocks), open a PR, link to CONTRIBUTING.

States: pristine, invalid (inline field errors + error summary at top on submit attempt), valid, downloaded.

### D7.10 Request a plugin / Report an issue

There's no dedicated screen. These are buttons that open GitHub in a new tab:
- **Request a plugin**: Home no-results state, footer, `/plugins/` page bottom ("Didn't find what you need?" banner).
- **Report an issue**: plugin and artifact pages.
- Security issues: the Report an issue button has a secondary text link "Security problem? Report it privately →" (SECURITY.md).
All open with an external-link icon.

### D7.11 404

"This page doesn't exist." Search box + "Browse all plugins". If the URL looks like `/plugins/<name>/…` and that plugin no longer exists: "This plugin was removed from the marketplace." + link to What's new.

## D8. Interactions

### D8.1 Keyboard

| Key | Where | Action |
|---|---|---|
| `/` | Anywhere (not in an input) | Focus search (navigates to Home if elsewhere) |
| `Esc` | Search | Clear query, then blur |
| `↓` / `↑` | Search focused, results shown | Move through result cards |
| `Enter` | Card selected | Open detail page |
| `c` | Card selected | Copy install |
| `s` | Card selected | Toggle in stack |
| `?` | Anywhere | Keyboard shortcuts dialog |

### D8.2 URL and history

- Query and filters update the URL with `replaceState` while typing, and `pushState` when the user pauses for more than 1 s or changes a filter, so Back steps through meaningful states.
- Returning to Home via Back restores the query, filters, scroll position and loaded result count.

### D8.3 Focus and announcements

- Result count changes are announced: "4 results".
- Copy, stack and download actions announce through the toast live region.
- Opening a dialog moves focus to its title. Closing returns focus to the trigger.

## D9. Content and microcopy

Tone: short, direct, second person, no exclamation marks. Sentence case for all headings and buttons.

Key strings (final copy can be adjusted in design, keep meaning):

| Key | Text |
|---|---|
| hero.title | Find skills, agents and plugins for Claude Code |
| search.placeholder | Describe what you need — e.g. "summarize release notes" |
| results.count | {n} results for "{query}" |
| results.partial | No exact matches — showing partial matches. |
| results.none | Nothing matches "{query}". |
| card.copyInstall | Copy install |
| card.addStack / card.inStack | Add to stack / In stack |
| toast.copied | Copied to clipboard |
| toast.added | Added {plugin} to your stack |
| toast.removed | Removed {plugin} · Undo |
| security.title | What this plugin can do on your machine |
| security.none | No hooks, MCP servers or scripts. This plugin only adds prompts (skills/agents). |
| security.disclaimer | Badges are derived automatically from the plugin files and are not a security guarantee. Review the source before installing. |
| skill.whenActivates | When it activates |
| legacy.note | This is a legacy command. New capabilities are written as skills. |
| stack.empty | Your stack is empty. Add plugins from search or any plugin page. |
| stack.howItWorks | Commit this file to your project. When teammates open the project in Claude Code, they're asked to trust the marketplace and install these plugins. |
| request.cta | Didn't find what you need? Request a plugin |

Security badge tooltips (one sentence each):
- Runs hooks: "Runs commands automatically on Claude Code events once the plugin is enabled."
- Broad hook: "A hook runs on every prompt or tool call, not only in specific cases."
- MCP: "Connects Claude to an external tool server."
- Remote MCP: "Connects to a server on the internet: {host}."
- Insecure MCP (http): "Connects to a remote server without encryption."
- Needs secrets: "Needs API keys or credentials: {names}."
- Scripts: "Ships scripts that hooks or MCP servers run."
- Restricted tools: "Every skill and agent limits which tools it can use."

## D10. Mock data for designs

Use `example-plugin` (real) plus these **placeholder** plugins. They exist only in mockups and must not be added to the repository.

| Plugin | Purpose in mockups |
|---|---|
| `release-tools` v1.2.0 | 2 skills, 1 agent, 1 `PostToolUse` hook with matcher `Bash`: Runs hooks |
| `jira-digest` v0.3.1 | 1 skill, 1 remote MCP over https, needs `JIRA_TOKEN`: MCP, Remote MCP, Needs secrets |
| `legacy-notes` v2.0.0 | 2 legacy commands, long description (500+ chars), 9 tags |
| `guarded-review` v1.0.0 | 1 `PreToolUse` hook with matcher `*`, 1 `http://` MCP: Broad hook, Insecure MCP, every badge |
| `a-plugin-with-a-deliberately-long-name-to-test-wrapping-x` v10.12.3 | Long name and version |

## D11. Accessibility checklist for design

- Contrast per D§4.1 in both themes, including chips, badges, focus ring and disabled states (disabled text ≥ 3:1 where it carries meaning, like zero-count chips).
- Focus ring visible on every interactive element and on cards.
- Touch targets ≥ 44 × 44 px on mobile.
- Icon-only buttons have visible tooltips on desktop.
- No information conveyed by colour alone.
- Headings form a logical outline on every page.

## D12. Design deliverables

1. Token sheet (light + dark) per D§4.
2. Component library with all states from D§6.
3. Screens D§7.1–7.11 at mobile (390) and desktop (1440), both themes. Tablet (768) for Home, Plugin page and Stack.
4. Clickable prototype of the main flow: Home → type query → filter → open artifact → Add to stack → Stack → Download.
5. Prototype of the Smart search opt-in flow (D§6.12).
6. Annotations for anything that differs from this spec, fed back into it.
