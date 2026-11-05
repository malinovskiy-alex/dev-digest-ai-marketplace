# The shape of a frontend `src/`

Reference for `frontend-ui-architecture`. Read when you need more than the
summary table in SKILL.md — a folder you have not seen before, or a judgement
call about promoting code between levels. The tree is a neutral example; map it
onto the project you are in.

## Contents

- [An example tree](#an-example-tree)
- [What each top-level folder is for](#what-each-top-level-folder-is-for)
- [Naming, in one place](#naming-in-one-place)
- [Promotion: worked examples](#promotion-worked-examples)
- [Route-colocated vs. `features/` layouts](#route-colocated-vs-features-layouts)

## An example tree

A Next.js App Router app using route-private folders for feature code. A
`features/<domain>/` variant follows the same rules — see the last section.

```
apps/web/src/
├── app/                     # routes only — the router owns this
│   ├── layout.tsx           # root layout; providers mount here
│   ├── page.tsx
│   ├── globals.css
│   ├── catalog/
│   │   ├── page.tsx
│   │   ├── _components/     # private to /catalog
│   │   │   ├── ProductCard/
│   │   │   └── ProductGrid/
│   │   └── [productId]/
│   │       ├── page.tsx
│   │       └── _components/ProductDetail/
│   ├── cart/
│   ├── checkout/
│   └── account/[section]/
├── components/              # cross-route UI, kebab-case folders
│   ├── app-shell/           # nav, breadcrumbs, global shortcuts
│   ├── price-tag/
│   ├── rating-stars/
│   ├── empty-state/
│   └── page-shell/
├── lib/                     # non-visual code, kebab-case files
│   ├── api.ts               # the only place that calls fetch
│   ├── hooks/               # server-state hooks, one file per domain
│   │   ├── catalog.ts  cart.ts  orders.ts  account.ts
│   │   └── index.ts         # optional aggregating barrel (deliberate, documented)
│   ├── types.ts             # frontend-wide types
│   ├── providers.tsx  theme.tsx  toast.tsx
│   └── format-price.ts  product-urls.ts  availability.ts
├── i18n/                    # i18n wiring; strings live in message catalogs
└── test/                    # test setup and helpers
```

Shared packages, consumed through the workspace or path aliases:
`@acme/shared` (schema-first contracts shared with the backend) and `@acme/ui`
(design-system primitives and tokens). Use the project's alias (`@/*` →
`./src/*` is common) for anything outside the current component folder.

## What each top-level folder is for

**`app/`** (or `routes/`, `pages/`) — routing and page composition. A page picks
the hooks it needs, handles loading / empty / error states, and composes
components. It does not compute, fetch, or hold domain rules. Route segments may
also carry `layout.tsx`, `loading.tsx`, `error.tsx`; those are
`next-best-practices` territory.

**`app/**/_components/`** — the feature code for exactly one route. In Next.js
the leading underscore makes the folder invisible to the router, which is what
lets feature code sit next to the route that uses it instead of in a distant
`features/` tree. In this layout **the route is the feature**.

Nesting is allowed (`ProductDetail/_components/ReviewsTab/`) when a component has
children that only it uses. Do not nest for its own sake — three levels of
`_components` inside one route usually means the top component should have been
split differently.

**`components/`** — UI that two or more routes use, plus cross-cutting chrome.
Arriving here is a promotion, not a starting point.

**`lib/`** — everything non-visual: the HTTP client, the query hooks, shared
types, context providers, and subject-named pure modules (`product-urls.ts`,
`format-price.ts`). Note what this folder is *not*: it is not `utils/`. Every
file is named for its subject, so a reader can guess what is inside without
opening it. A file called `helpers.ts` here would be a bug.

**Vendored or generated code** (`vendor/`, `generated/`, an OpenAPI client) —
code owned elsewhere. Never hand-edit it; regenerate or update it at the source.
Hand edits are how two packages silently drift apart.

## Naming, in one place

A common, consistent scheme — adopt the project's if it differs:

| Thing | Case | Example |
|---|---|---|
| Component folder under a feature / `_components/` | PascalCase | `ProductGrid/` |
| Component folder under `src/components/` | kebab-case | `app-shell/` |
| The component file itself, either way | PascalCase | `AppShell.tsx` |
| Satellite files | lowercase, fixed names | `constants.ts`, `helpers.ts`, `styles.ts`, `index.ts` |
| Test | matches the component | `ProductGrid.test.tsx` |
| Anything under `src/lib/` | kebab-case, named for its subject | `product-urls.ts` |
| Constants | `UPPER_SNAKE_CASE` | `LOW_STOCK_THRESHOLD` |
| Hooks | `useThing` | `useCartTotals` |

The split between PascalCase and kebab-case folders is not arbitrary: a
PascalCase folder *is* a component, a kebab-case folder is a small module that
happens to contain one. Keeping them visually distinct means the tree tells you
which is which.

## Promotion: worked examples

**A component a second route needs.**
`PriceTag` started as product-detail UI. Once the cart needed the same tag, it
moved to `src/components/price-tag/` — folder renamed to kebab-case, component
file still `PriceTag.tsx`, `index.ts` unchanged. Do it in one commit and update
both call sites; a copy "for now" is how two divergent price tags appear.

**A helper a second component needs.**
A `formatPrice()` living in one component's `helpers.ts` moves to
`src/lib/format-price.ts` when a second component needs it — named for the
subject, not filed under a generic name. Its tests move with it.

**A constant that escapes.**
If you find yourself importing `AVAILABILITY_ORDER` from another route's
`constants.ts`, stop: that import is the boundary violation, not the fix. Move
the value to `src/lib/` (or, if the backend also orders by availability, to the
shared contract) and import it from there.

**A type the backend also needs.**
Frontend-only shapes live in `src/lib/types.ts`. The moment the backend must
agree on a shape, it becomes a schema in the shared contracts package with the
type inferred from it — and that is a cross-package change, so follow the
project's process for contract changes.

## Route-colocated vs. `features/` layouts

Most React guidance says to group by feature in a top-level `features/` folder
(bulletproof-react, Feature-Sliced Design). Route-colocated private folders reach
the same goal by a different route: feature code sits *inside* the route that
owns it, which is the same colocation with less indirection — there is no
mapping to maintain between a route and its feature folder.

The trade-off is real and worth knowing: in a route-colocated layout, code
shared by two routes has nowhere natural to sit, so it goes up to
`src/components/` or `src/lib/` a step earlier than it would in a `features/`
layout. That is why the promotion rule matters so much there — it is the
mechanism that keeps route folders from reaching into each other.

A `features/<domain>/` layout looks like this:

```
apps/web/src/features/cart/
  api/          # useCart, useAddToCart — query keys and invalidations
  components/   # CartDrawer/, CartLine/ — component folders as above
  hooks/        # non-data hooks owned by the feature
  types.ts
  index.ts      # the feature's public surface
```

Routes compose features; a feature never imports another feature (compose them
at the route, or promote the shared part). If a route-colocated project grows a
genuine cross-route domain — something with its own components, hooks, types and
rules that several routes compose — that is the point to discuss introducing
`src/features/<domain>/` with the user, rather than spreading it across
`src/components/` and `src/lib/`.
