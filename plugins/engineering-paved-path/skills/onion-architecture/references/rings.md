# The rings, mapped onto a typical backend

An example layout with every folder assigned to a ring, and what that costs
you. Ring numbers grow outward; imports point inward. The paths are a neutral
example (`apps/api/src/…` for the HTTP service, `packages/core` for a pure
engine, `@acme/shared` for contracts) — map them onto the project you are in
before applying anything (see "Before you place anything" in `SKILL.md`).

```
                    ┌──────────────────────────────────────────────┐
                    │ 4  routes.ts · app.ts · server.ts             │
                    │  ┌────────────────────────────────────────┐  │
                    │  │ 3  adapters/ · db/ · repository.ts ·    │  │
                    │  │    container.ts · config.ts · jobs.ts   │  │
                    │  │  ┌──────────────────────────────────┐   │  │
                    │  │  │ 2  service.ts · orchestrators    │   │  │
                    │  │  │    pipeline/ · job handlers      │   │  │
                    │  │  │  ┌────────────────────────────┐  │   │  │
                    │  │  │  │ 1  packages/core/src       │  │   │  │
                    │  │  │  │    helpers.ts · contracts  │  │   │  │
                    │  │  │  │    platform/errors.ts …    │  │   │  │
                    │  │  │  └────────────────────────────┘  │   │  │
                    │  │  └──────────────────────────────────┘   │  │
                    │  └────────────────────────────────────────┘  │
                    └──────────────────────────────────────────────┘
```

Ring 3 sits *outside* Ring 2 on purpose. A repository is not "deeper" than a
service — it is further from the domain, because it knows about the database.

---

## Ring 1 — Domain

**Rule:** computable from its arguments. No `async` unless the caller passed the
async thing in. No client, no clock read you did not receive, no `process.env`.

| Example path | What it holds |
|---|---|
| `packages/core/src/**` | a pure engine: pricing, rule evaluation, document assembly — whatever the product's core computation is |
| `@acme/shared` (`packages/shared/src/contracts/*`) | the schema-first contracts — `Order`, `LineItem`, `Customer`, `Money` — and the port interfaces |
| `apps/api/src/modules/*/helpers.ts` | per-module pure functions: parsing, mapping, deriving |
| `apps/api/src/platform/errors.ts` | the `AppError` hierarchy |
| `apps/api/src/platform/resilience.ts` | `withTimeout`, `withRetry` — combinators over a passed-in function |
| `apps/api/src/platform/{money,dates,format}.ts` | pure transforms over contracts |

**A zero-I/O core package is the strictest part of Ring 1.** It receives
everything it needs as **already-resolved values** — configuration, templates,
lookup data. Resolving an id into a value is the caller's job. When you need a
new fact inside the engine, add an optional input field that is ignored when
empty; do not add a lookup.

**What pushes code out of Ring 1:** needing a row type, a config value, a
database, or "just one" HTTP call. All four mean it was Ring 2 all along.

---

## Ring 2 — Application

**Rule:** orchestrates. Calls ports and repositories in an order that encodes a
business decision, and returns domain values.

| Example path | What it holds |
|---|---|
| `modules/*/service.ts` | the module's use cases, one class, 5–7 methods |
| `modules/checkout/run-checkout.ts` | a multi-step use case start to finish |
| `modules/catalog/pipeline/*` | stages of an import/indexing pipeline |
| `modules/orders/status.ts` | status derivation that needs repository data |
| job handlers registered via `jobs.register(KIND, …)` | the async half of a use case |

A Ring 2 signature never mentions HTTP. It takes identity values (`tenantId`,
`userId`) and DTOs, because the same method is called by a route **and** by the
job runner, a CLI or a test, which have no request.

**What pushes code out of Ring 2:** writing SQL (→ Ring 3), touching the
framework's request object (→ Ring 4), constructing a vendor client (→ the
composition root).

---

## Ring 3 — Infrastructure

**Rule:** knows a vendor, a protocol or a table, and hides it from everyone else.

| Example path | What it holds |
|---|---|
| `adapters/<vendor>/` | one folder per external system: `payments/stripe.ts`, `email/ses.ts`, `storage/s3.ts`, `search/meilisearch.ts`, `llm/<provider>.ts` |
| `adapters/mocks.ts` (or `test/fakes/`) | the in-memory implementations tests inject |
| `db/schema/<domain>.ts` | table definitions, one file per domain, re-exported by a schema barrel |
| `db/rows.ts` | row types shared across modules — the sanctioned way to name a row outside its owner |
| `db/client.ts`, `migrate.ts`, `seed.ts` | connection, migration runner, demo data |
| `modules/*/repository.ts`, `modules/*/repository/*.repo.ts` | the only files that query that module's tables |
| `platform/container.ts` | the composition root |
| `platform/config.ts` | env parsing into a typed config object |
| `platform/jobs.ts` | the job queue |
| `platform/events.ts` | an in-process event bus |

**Ports live with the contracts, not with the adapters.** The interfaces
(`PaymentGateway`, `EmailSender`, `FileStorage`, `SearchIndex`,
`SecretsProvider`, `AuthProvider`) are declared in Ring 1 (e.g.
`@acme/shared/ports.ts`), so Ring 2 can depend on them without looking outward.
`adapters/` holds only implementations.

> A common slip: an adapter declares its interface beside its implementation
> (`adapters/search/index.ts` exports both `SearchIndex` and
> `MeiliSearchIndex`). Every Ring 2 file that imports the type now depends on
> Ring 3, and the architecture check flags it. When you next touch such an
> adapter, move the interface next to the other ports.

**Tenant scoping is a domain rule enforced in Ring 3.** If the product is
multi-tenant, every domain table carries `tenant_id` and every query filters by
it. Ring 3 is where the query is built — which is exactly why routes must not
build queries.

---

## Ring 4 — Transport

**Rule:** translates HTTP (or a CLI, or a message) into a service call and back.
Delete it and the application still works.

| Example path | What it holds |
|---|---|
| `modules/*/routes.ts` | one HTTP plugin/router per module |
| `modules/index.ts` | the static module registry — imports and wiring only |
| `modules/_shared/context.ts` | `getContext(req)` → `{ tenantId, userId }` |
| `modules/_shared/schemas.ts` | request schemas shared by several modules |
| `app.ts` | plugin/middleware order, the global error handler, wiring the composition root |
| `server.ts` | listen, signal handling |

**Middleware/plugin order is load-bearing:** security headers, CORS, rate
limiting and the error handler register *before* the modules. In frameworks
with encapsulated plugins (Fastify) a module inherits only what was registered
earlier; registering a module first silently un-protects it.

---

## Promotion: where things move as they grow

Start at the narrowest scope and move up only when a second consumer appears.

```
inside one function
  → helpers.ts in the module                    (Ring 1, module-local)
  → platform/<subject>.ts                       (Ring 1, app-wide)
  → packages/core/src/                          (Ring 1, shared with another app)
  → @acme/shared                                (Ring 1, shared with the frontend)
```

```
a query inside a service
  → the module's repository.ts                  (Ring 3, one owner)
  → repository/<subject>.repo.ts                (when the file outgrows itself)
  → a repository exposed by the composition root (when a second module needs it)
```

Worked examples:

- **A row type two modules need.** Not a re-export from the other module's
  `repository.ts` — name it in `db/rows.ts` (or the project's equivalent). The
  owning repository re-exports it from there so its public type API does not
  change.
- **A repository two modules need.** Construct it in the composition root and
  hand it to both services (`container.customersRepo`). Reaching into
  `../customers/repository.js` is not the way.
- **A constant two modules need.** `billing/service.ts` importing
  `INVOICE_JOB_KIND` from `orders/constants.ts` is a cross-module import. Job
  kinds that cross a module boundary belong in `modules/_shared/`, because a job
  kind is a contract between two modules.
- **A pure function in an adapter folder.** A parser under
  `adapters/csv/parse.ts` that takes a string and returns rows does no I/O at
  all — it is Ring 1 wearing an adapter's folder name. Move the file; do not
  wrap it in a port.

---

## Package boundaries

In a multi-package repository the rings also apply *between* packages:

| Example package | Ring it plays | Consumed as |
|---|---|---|
| `packages/core` | Ring 1 for the API and any other app (a worker, a CLI, a CI job) | a workspace dependency or source alias |
| `@acme/shared` | Ring 1 contracts + port interfaces | a workspace dependency of the API **and** the frontend |
| `apps/api` | Rings 2–4 | the running API |
| `apps/web` | a separate onion; see `engineering-paved-path:frontend-ui-architecture` | — |

Rules that follow:

- **Inner packages never depend on outer ones.** `packages/core` and
  `@acme/shared` import nothing from `apps/*`.
- **Keep the core package dependency-light.** Every dependency added there lands
  in every consumer.
- **If contracts are duplicated** (vendored copies, generated clients) instead of
  shared through the workspace, a contract or port change is **one edit per copy
  in one commit**. Miss a copy and request validation and the client's types
  drift apart silently.
- Follow the project's existing mechanism for sharing code (workspace packages,
  path aliases, published packages); do not introduce a second one.
