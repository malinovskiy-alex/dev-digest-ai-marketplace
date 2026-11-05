---
name: frontend-ui-architecture
description: "UI architecture and code organization for React frontends (Next.js App Router or a Vite/React SPA) — where a new file belongs, how to split a component, and where business logic, data fetching, constants, types, helpers and styles live, plus module boundaries, import direction and the server/client split. Use this whenever adding, moving or splitting frontend code, when a page or component file is growing, when deciding whether code is route-local, feature-local or shared, when reviewing frontend structure, or whenever the question is 'where should this code go?' — including when the user only says 'add a screen', 'extract this', or 'refactor this component'. Not for React API mechanics (use react-best-practices) or Next.js feature mechanics (use next-best-practices)."
---

# Frontend UI Architecture

This skill answers one question: **where does this code go?**

It applies to any React frontend — a Next.js App Router app or a client-side
SPA (Vite, CRA-style) — with any server-state library (TanStack Query, SWR,
RTK Query) and any styling approach. Examples use a neutral layout:
`apps/web/src/…` for the frontend app, `@acme/shared` for contracts shared with
the backend, `@acme/ui` for a design-system package. Replace them with the
project's real paths.

## Before you place anything: map the project

The rules are fixed; the paths are not. Spend a minute finding:

1. **The frontend package(s)** — workspace config or package manifests.
2. **The routing root** — `src/app/` (Next.js App Router), `src/pages/`,
   `src/routes/` (React Router, TanStack Router).
3. **Where feature code lives** — route-private folders (`_components/` next to
   a route), a `features/<domain>/` tree, or both.
4. **The shared levels** — a shared components folder, a `lib/` (or `shared/`)
   for non-visual code, a design-system package, a shared contracts package.
5. **The data path** — the one HTTP client module and where query hooks live.
6. **Any enforced boundaries** — ESLint `import/no-restricted-paths`,
   `eslint-plugin-boundaries`, Nx module boundaries.
7. **The project's instruction files** when present — `CLAUDE.md`, `AGENTS.md`,
   `CONTRIBUTING.md`, package-level READMEs.

When this skill and the project's own conventions disagree, **the project
wins** — it is the project's contract. Tell the user about the divergence rather
than silently picking one; a stale convention is worth fixing, but not by
accident.

## Read this, not that

Structure is only one axis of frontend quality. Stay in your lane so the skills
do not contradict each other:

| Question | Where it is answered |
|---|---|
| Where does this file/constant/type/helper go? | **this skill** |
| Should this be `useMemo`? Is this effect necessary? Key prop? a11y? | `engineering-paved-path:react-best-practices` |
| How do route groups / metadata / streaming / `revalidate` work? | `engineering-paved-path:next-best-practices` |
| How do I test this component? | `engineering-paved-path:react-testing-library` |
| The exact folder names and file names to type | the project's instruction files and existing code |

## The decision procedure

Most "where do I put this?" questions resolve by asking **how many things use
it**, not by what kind of thing it is. Type-based filing (`utils/`, `helpers/`,
`types/`) is what turns folders into junk drawers — the name tells you the
shape of the code but never who owns it.

Start at the narrowest scope that works and move up only when a second consumer
appears:

```
same file  →  sibling file in the component folder
           →  the feature / route that owns it   (features/<domain>/ or app/<route>/_components/)
           →  src/components/<kebab>/            (UI shared across features/routes)
           →  src/lib/<subject>.ts               (non-visual code shared across the app)
           →  @acme/shared                       (contracts shared with the backend)
```

Two rules keep this honest:

- **Promote on the second consumer, not the first.** An abstraction with one
  caller is speculation. When a second route needs it, move it up — and move it
  in one commit so nothing imports the old location.
- **Never demote silently.** Once something is shared, deleting the last
  consumer is the signal to remove it, not to leave it orphaned in `src/lib/`.

### Where the answer usually lands

| What you are adding | Where it goes (recommended default) |
|---|---|
| UI used by one route / feature | `features/<domain>/components/<Name>/`, or `app/<route>/_components/<Name>/` in a route-colocated layout |
| UI used by two or more features/routes | `src/components/<kebab-case>/` |
| A UI primitive (button, badge, input) | the design-system package or `src/components/ui/` — reuse, don't re-invent |
| Pure function used by one component | `helpers.ts` in that component's folder |
| Pure function used across features | `src/lib/<subject>.ts` (kebab-case, named for the subject) |
| Literal, enum, threshold, keymap | `constants.ts` in the component's folder |
| Anything touching the API | a hook (`features/<domain>/api/*` or `src/lib/hooks/<domain>.ts`) → the one HTTP client (`src/lib/api.ts`) |
| A type used in one file | that same file |
| A type shared across the frontend | `src/lib/types.ts` (or the owning feature's `types.ts`) |
| A contract shared with the backend | the shared contracts package (e.g. `@acme/shared`, schema-first) |
| User-facing text | the project's i18n message catalogs, if it has i18n |
| App chrome: nav, breadcrumbs, global shortcuts | `src/components/app-shell/` |

### How to adapt to your project's layout

| The project uses | Feature level is | Notes |
|---|---|---|
| Next.js App Router with private folders | `app/<route>/_components/` | the route *is* the feature; shared code goes up to `src/components/` / `src/lib/` a step earlier |
| `features/<domain>/` (bulletproof-react style) | `features/<domain>/` with `components/`, `api/`, `hooks/`, `types.ts` inside | `app/` or `routes/` only composes features; a feature never imports another feature |
| Feature-Sliced Design | `features/`, `entities/`, `widgets/` slices | follow FSD's layer order; this skill's rules map onto its import-downward rule |
| a flat `components/` + `pages/` app | the page's own folder | introduce feature folders only when a domain spans several pages — discuss it first |

## The unit of organization is a folder, not a file

A component is a folder whose name is the component. The satellite files exist
so that a component can grow without its main file turning into a scroll:

```
features/catalog/components/ProductGrid/
  ProductGrid.tsx          # the component, nothing else
  ProductGrid.test.tsx     # component test, colocated
  constants.ts             # literals, enums, config
  helpers.ts               # pure functions
  styles.ts                # styles, if the project keeps them in a file (see "Styles")
  index.ts                 # the only public surface
```

Add a satellite file when it has content; never inline it back afterwards. The
point is that the *shape* stays predictable — a reader who has seen one
component folder can navigate every other one.

**`index.ts` is the component's public API.** Import `ProductGrid` from the
folder, never from `ProductGrid/ProductGrid`. Deep imports are what let
`constants.ts` leak into unrelated routes, and after that the folder is no
longer a unit you can move or delete.

> A note on barrel files: the wider ecosystem warns against them, and rightly —
> `export *` barrels wreck tree-shaking and slow dev servers. That warning is
> about *aggregating* barrels that re-export many modules. A one-line
> per-component `index.ts` is a different thing: it names a boundary. Keep those.
> If the project has a deliberate aggregating barrel (say, for query hooks),
> leave it documented as the exception — do not add more like it.

## Where business logic goes

Components render. Logic lives one step away, at the cheapest level that works:

1. **Pure functions in `helpers.ts`** — anything computable from its arguments.
   Sorting, filtering, formatting, deriving. No React, no fetch, trivially
   testable. Reach for this first; most "business logic" is this.
2. **A data hook** (`features/<domain>/api/*` or `src/lib/hooks/*`) — when the
   logic needs server data or the server-state cache. This is where a query key,
   its invalidation and its mutation live together.
3. **The HTTP client** (`src/lib/api.ts`) — HTTP only: base URL, headers, method,
   error normalization into one `ApiError` type. No domain rules here.
4. **The backend** — anything authoritative. The client is not the place to
   enforce a rule the API also has to enforce.

Two hard lines, worth restating because they are the ones most often broken
under time pressure:

- **No `fetch` in a component.** Adding an endpoint means adding a hook.
- **The page/route file stays thin.** It composes and passes props; it does not
  compute. If a page grows a helper, that helper belongs to a component folder
  owned by the feature, and usually so does the markup around it.

### Deriving vs. storing

Before adding state, ask whether the value can be computed during render from
what you already have. A `visibleProducts(products, hideOutOfStock)` helper
called during render is simpler and cannot desynchronize; the same value kept in
`useState` and refreshed by an effect can. `react-best-practices` covers the
mechanics — the architectural consequence is that **derived values belong in
`helpers.ts`, not in state**.

## Where constants go

Magic numbers and bare strings are a structure problem, not a style problem:
they make the same decision appear in several files with no way to find all the
copies. Give the value a name, then place it by scope:

- used inside one component → `constants.ts` in that folder, `UPPER_SNAKE_CASE`,
  with a one-line comment saying what the value means (`LOW_STOCK_THRESHOLD`
  reads better than `5`, but only the comment explains why it is 5);
- used across features → `src/lib/<subject>.ts`;
- environment-dependent → read it once where the module is configured (as the
  HTTP client does with the API base URL) and export the resolved value. Do not
  scatter `process.env` / `import.meta.env` reads through the tree.

## Where types go

Three rules, narrowest scope first:

1. Used in one file → declare it in that file. A `.types.ts` file per component
   is friction with no payoff.
2. Used across the frontend → `src/lib/types.ts` (or the owning feature's
   `types.ts`).
3. Shared with the backend → the shared contracts package, ideally as a schema
   (Zod or similar) with the type inferred from it, so validation and type stay
   in sync.

> If the shared contracts are vendored or generated into the frontend rather
> than imported from a workspace package, treat that folder as read-only: do not
> hand-edit it to make a frontend change compile. A contract change is a
> cross-package change and starts on the backend side.

## Splitting a component

Split when the component has more than one reason to change — not at a line
count. These are the signals worth acting on:

- it renders a list *and* owns the row markup → extract the row;
- it has a second `useState` cluster unrelated to the first → the two clusters
  are two components;
- a block of JSX is guarded by a condition that nothing else in the file reads →
  that block is a component;
- its props exceed roughly five, or several props are only forwarded → the
  component is doing a parent's job;
- a helper inside the body closes over nothing → it was never part of the
  component; move it to `helpers.ts`.

Prefer composition over configuration: a `children` slot beats a seventh boolean
prop. If several components must share state to work together (tabs, an
accordion), a compound component over context is the shape to reach for — but
see the boundary caveat below before doing it across a server/client line.

## Module boundaries

The structure only holds if imports respect it. If the project lints
boundaries, the linter is the source of truth; if it does not, these are review
rules — check them when writing or reviewing a change.
`references/enforcement.md` has a ready ESLint flat config for the day you want
them enforced mechanically.

Dependencies point one way:
`shared packages → lib → components → features → app/routes`.

- A feature's (or route's) private code is private. If another feature needs
  it, promote it to `src/components/<kebab-case>/` or `src/lib/` — do not reach
  across features or routes.
- `src/lib/` must not import from features, routes or `src/components/`. It is
  the layer below them; an import upward means the code was misfiled.
- `src/components/` must not import from features or routes.
- Vendored or generated code imports nothing from the app.
- Import through a component folder's `index.ts`, never a deep path.
- Use the project's path alias (`@/…`) for anything outside the current folder;
  relative paths only for siblings inside one component folder.

## The server/client boundary (React Server Components)

Applies to Next.js App Router and other RSC frameworks; skip it for a pure SPA.

`'use client'` is a boundary in the module graph, not a label on a component:
everything a client component imports is pulled into the client bundle, so the
directive placed high drags the subtree with it. Data crosses as serializable
props; server components passed as `children` do **not** get pulled in.

**Find out which data-access approach the project uses before proposing
changes.** Next.js documents three — External HTTP APIs (a separate backend),
a Data Access Layer (Next.js *is* the backend), and direct queries in server
components (prototypes) — and asks you to pick one and not mix them. A project
whose authoritative backend is a separate API, talked to over HTTP with a
client-side query library, is legitimately a client-heavy app: its pages may all
carry `'use client'`, and proposing a DAL, server actions or `server-only` for a
screen that just reads that API is a wrong turn. `references/nextjs.md` has the
decision tree.

For new code the convention still stands: **server component by default, push
`'use client'` as far down as it goes.** A static page whose interactivity lives
in two widgets should keep the directive on the widgets. When touching a page
that already carries the directive at the top, leave it be unless the user asked
for that refactor — narrowing the boundary is a real change with real risk, not
a drive-by cleanup.

Boundary gotcha worth knowing: a compound component's static properties
(`Tabs.Panel`) become `undefined` when a server component imports them across
the boundary. Expose the pieces as named exports instead.

## Styles

Styles live with the component — in the component file (utility classes such
as Tailwind), or in a colocated `styles.ts` / `*.module.css`. Follow the
project's approach.

If the project is migrating between approaches (say, style objects to
Tailwind), write new components in the target approach, migrate an old one
when you substantially rework it, and **do not mix both inside a single
component** — half-migrated components are harder to read than either form.

Repeated class combinations are a component, not a copy-paste: check the design
system before writing another badge.

## Tests

Colocate: `<Name>.test.tsx` beside `<Name>.tsx`. A component folder that has
grown helpers and constants but no test is the folder most likely to break.
Real browser journeys are a different unit — they live in the project's
end-to-end suite, not beside components. Query by role, label or text; see
`react-testing-library`.

## Red flags

Treat these as signals to stop and reconsider placement:

- a new top-level `utils/`, `helpers/` or `types/` folder — file by owner instead;
- `fetch` inside a component, or a page that computes;
- a deep import past an `index.ts`, or one feature/route's private folder
  imported by another;
- a `constants.ts` imported from outside its own component folder — the value is
  shared, so it belongs in `src/lib/`;
- a wrapper component that only forwards props;
- a hand-edit inside vendored or generated code;
- a hardcoded user-facing string in JSX in a project that has i18n.

## References

Load these when the question goes past the summary above:

- `references/structure.md` — an example tree, what each top-level folder is
  for, naming, and worked examples of promotion between levels.
- `references/nextjs.md` — App Router architecture in depth: routing vs. product
  code, the boundary rules, and the data-access approaches with a decision tree.
- `references/enforcement.md` — the review checklist in list form, plus a ready
  ESLint flat config encoding the boundary rules.
- `examples.md` — before/after pairs for the most common placement mistakes.
- `references/sources.md` — the articles and docs this skill is built from.
