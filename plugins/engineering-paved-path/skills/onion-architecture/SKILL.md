---
name: onion-architecture
description: "Onion / clean / hexagonal architecture for backend code — which ring (domain, application, infrastructure, transport) a piece of code belongs to and which way its imports are allowed to point. Use this whenever adding or moving backend code: a route or controller, a service, a repository, a background job, an adapter for an external API, a migration-backed feature; when a service or route file is growing; when deciding whether logic belongs in the route, the service, the repository or a pure core package; when a unit test needs a real database to run; when the project's architecture check (dependency-cruiser, eslint-plugin-boundaries, import-linter, ArchUnit…) fails; or whenever the question is 'where should this backend code go?' — including when the user only says 'add an endpoint', 'wire up this API', or 'refactor this module'. Not for HTTP-framework mechanics (use fastify-best-practices for Fastify), ORM query syntax or table design."
---

# Onion Architecture (backend)

This skill answers one question: **which ring does this code belong to, and
which way is it allowed to import?**

It applies to any backend package of a project — an HTTP API, a worker, a
pure engine/core library consumed by the API. The examples use TypeScript with
a Fastify-style HTTP layer and a typed query builder (Drizzle-style), because
that is where the rules are easiest to show; the rules themselves hold for
Express, NestJS, Koa, Hono, Prisma, TypeORM, Knex — and for other languages.

The rings are **logical**. A project does not need `domain/`, `application/`
or `infrastructure/` folders to have them. A layout of vertical modules whose
file *names* encode the ring (`routes.ts`, `service.ts`, `repository.ts`,
`helpers.ts`) already carries all the information, and an architecture check
is what makes it real. If the project you are in *does* use ring folders, keep
them — consistency with the codebase beats this skill's default.

## Before you place anything: map the project

The rules are fixed; the paths are not. Before deciding where code goes, spend
a minute building the project's ring map:

1. **Find the packages.** Workspace config (`pnpm-workspace.yaml`, `package.json`
   `workspaces`, `nx.json`, `turbo.json`, `go.work`, a Gradle/Maven multi-module
   build…) or, failing that, every directory with its own package manifest.
2. **Find the module convention.** Look at two or three existing feature folders
   (`src/modules/*`, `src/features/*`, `src/<domain>/*`, Nest `*.module.ts`…)
   and note which file names recur. Those names are the project's rings.
3. **Find the composition root.** The one file that constructs database
   clients, SDK clients and services — a container, an `app.ts`, a Nest module
   graph, a `main.go`.
4. **Find the architecture check, if any.** `.dependency-cruiser.cjs`,
   `eslint-plugin-boundaries` / `import/no-restricted-paths` in the ESLint
   config, `.importlinter`, ArchUnit tests, Nx `enforce-module-boundaries`.
   Note the command that runs it (package.json scripts, Makefile, CI workflow).
5. **Read the project's instruction files** when present — `CLAUDE.md`,
   `AGENTS.md`, `CONTRIBUTING.md`, package-level READMEs. They often state the
   module layout tersely.

Then fill in the "Ring" column of the table below with the project's real paths.
When the table and the project's own instructions disagree, **the project's
instructions win** — they are its contract. Say so rather than silently
picking one.

## Read this, not that

Structure is one axis of backend quality. Stay in your lane so the skills do not
contradict each other:

| Question | Where it is answered |
|---|---|
| Which ring does this go in? Which way may it import? | **this skill** |
| Hooks, lifecycle, plugin options, serialization, logging (Fastify) | `engineering-paved-path:fastify-best-practices` |
| How do I write this query / relation / transaction? | your ORM's documentation |
| What type, index or constraint should this column have? | your database's documentation |
| Is this input handling safe? Where do secrets live? | `engineering-paved-path:security` |
| The exact folder and file names to type | the project's instruction files and existing modules |

## The rule

> **Imports point inward.** A ring may import the rings inside it and nothing
> outside it. When an inner ring needs outer behaviour, it declares an
> **interface** (a *port*) and the composition root supplies the implementation
> (an *adapter*).

That is the whole architecture. Everything below is this rule applied to the
tools a typical backend uses.

## The four rings

Recommended default, shown on a neutral layout (`apps/api/src/…` for the HTTP
service, `packages/core` for a pure engine shared with other apps,
`@acme/shared` for contracts shared with the frontend). Replace the paths with
the project's own.

| Ring | What lives there | May import | Must never import |
|---|---|---|---|
| **1 · Domain** | a pure core package (`packages/core/src/**`), `modules/*/helpers.ts`, shared contracts and port interfaces (`@acme/shared`), pure platform files (`errors.ts`, `retry.ts`) | the validation library, stdlib, other Ring 1 | the HTTP framework, the ORM, `db/*`, `adapters/*`, any SDK, `process.env` |
| **2 · Application** | `modules/*/service.ts`, multi-step orchestrators (`checkout/run-checkout.ts`), pipelines, job handlers | Ring 1, **port interfaces**, its own repository | the HTTP framework, the ORM, the DB schema, concrete adapter classes |
| **3 · Infrastructure** | `adapters/*`, `db/*`, `modules/*/repository*.ts`, the composition root, config loading, the job queue, the event bus | Rings 1–2, third-party SDKs | another module's folder |
| **4 · Transport** | `modules/*/routes.ts` (or controllers), `app.ts`, `server.ts`, CLI entry points | Ring 2 services, contracts, `modules/_shared/*` | the ORM, the DB schema, `adapters/*` |

A `platform/` (or `lib/`, `common/`, `core/`) folder is usually **not** one
ring — it is split across them. The pure files (error classes, retry/timeout
combinators, formatting) are Ring 1 and import nothing but contracts; the ones
that own a process resource (container, config, job queue, event bus, file
loaders) are Ring 3. Check the imports before adding a file there.

If the project has a package with **zero I/O** — an engine that receives
everything it needs as arguments — that package is the reference
implementation of Ring 1. When you are unsure how pure Ring 1 should be, open
it.

### How to adapt to your project's layout

| The project looks like | Ring mapping |
|---|---|
| vertical modules with role-named files (`routes.ts`, `service.ts`, `repository.ts`) | the default above |
| NestJS (`*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.module.ts`) | controller = 4, service = 2, repository/entity = 3, DTO + pure helpers = 1; the module graph is the composition root |
| layered folders (`controllers/`, `services/`, `models/`) | the same rings, by folder; module boundaries become the second axis — group by subject inside each folder |
| explicit ring folders (`domain/`, `application/`, `infrastructure/`, `interfaces/`) | the folders *are* the rings; follow them |
| a single small app with no modules | probably too small for this (see "When not to do this"); keep the dependency rule, skip the ceremony |

## The decision procedure

Ask these in order and stop at the first yes. The question is never "what kind of
thing is this?" — it is **"what does it need in order to run?"**

1. **Can it be computed from its arguments alone?** → Ring 1. `helpers.ts` in the
   module, or the pure core package if another app needs it too. No `async`,
   no clients.
2. **Does it orchestrate — call a port, then a repository, then decide?** →
   Ring 2, `service.ts`. It takes identity values (`tenantId`, `userId`) and
   DTOs, never a request object.
3. **Does it talk SQL, HTTP, the filesystem or an SDK?** → Ring 3. SQL goes in
   `repository.ts`; anything external goes behind a port declared with the
   contracts, with its implementation in `adapters/`.
4. **Does it read the request or write the response?** → Ring 4, `routes.ts`.
   Parsing, status codes, delegation. Nothing else.

Two rules keep this honest:

- **The narrowest ring that works wins.** Code drifts outward on its own; it
  never drifts back in.
- **A ring boundary is crossed by a type, not just by a call.** Handing an ORM
  row type to Ring 1 moves persistence into the domain even though no
  `import … from 'drizzle-orm'` appears. See "What may cross a boundary" below.

## The shape of a module

A module is a folder under `src/modules/` (or the project's equivalent), and
its **file names are its rings**:

```
modules/<name>/
  routes.ts        # Ring 4 — the module's HTTP surface, its only export to the app
  service.ts       # Ring 2 — business logic, one class or one set of functions
  repository.ts    # Ring 3 — the only file that touches this module's tables
  helpers.ts       # Ring 1 — pure functions
  constants.ts     # literals, job kinds, limits
  types.ts         # module-local types (only when they outgrow the files above)
```

Add a file when it has content; never inline it back afterwards. A reader who has
seen one module can navigate every other one.

**Prefer static registration.** A new module is one import plus one entry in a
module registry (`modules/index.ts`). Filesystem autoload of `.ts` files is
fragile across runtimes, bundlers and test runners; if the project already
autoloads and it works, leave it — but do not introduce it.

**A module never reaches into a sibling module's folder.** Repositories that
several modules need are built by the composition root and handed out from
there; shared request plumbing lives in `modules/_shared/`. The architecture
check should enforce this.

## Dependency injection, concretely

The composition root (a container, the app factory, the framework's DI module)
is the **one place allowed to say `new` on an adapter**. Everything else
receives what it needs.

**The target shape for a service** is explicit dependencies:

```ts
export class OrderService {
  constructor(private deps: {
    orders: OrderRepository;
    payments: PaymentGateway;   // port, not StripePaymentGateway
    jobs: JobQueue;
    secrets: SecretsProvider;
  }) {}
}
```

Write new services this way. A common alternative is a service that takes the
whole `Container` and builds its own collaborators — that is a service locator.
It hides the dependency list, forces every unit test to construct a full
container, and tends to produce an import cycle between the composition root
and the services it constructs. If the codebase already does this, **do not
mass-refactor it** as part of an unrelated change, and do not copy it into a new
module; record it as architecture debt where the project tracks debt.

The one accepted exception: a service may `new` **its own** module's repository.
A repository usually has no port and no mock — it is swapped by pointing it at a
different database handle. Adapters are different: they are swapped through the
composition root's test overrides, so they must arrive already built.

**Adding an integration with an external service, in order:**

1. Declare the port — an interface next to the contracts (Ring 1), described
   in terms of *your* domain, not the vendor's. If the contracts are duplicated
   across packages (vendored copies, generated clients), update every copy in
   the same commit; duplicated contracts silently drift otherwise.
2. Implement it in `adapters/<vendor>/`. This file may import the SDK; nobody
   else may.
3. Expose it from the composition root (a lazy getter or a provider) with a test
   override hook.
4. Inject the port into the service. The service names the capability
   (`PaymentGateway`), never the vendor (`StripePaymentGateway`).

Secrets are resolved inside the composition root through a secrets provider or
the environment, and never reach the database, git, logs, or a service
constructor argument as a raw value.

## What may cross a boundary

| Crossing | Allowed | Why |
|---|---|---|
| Route → service | a DTO validated by a schema, plus identity values (`tenantId`, `userId`) | the service must be callable by the job runner, a CLI or a test, none of which has a request |
| Service → repository | domain values and narrow input objects | keeps SQL construction in one file |
| Repository → service | a domain object, or a row type named in one shared place (e.g. `db/rows.ts`) | a shared row type has one home next to the schema |
| Repository → anywhere | a query builder, a transaction handle, a driver error | leaking these makes every caller an ORM caller |
| Anything → Ring 1 | an inline ORM-inferred row type (`typeof schema.orders.$inferSelect`, a Prisma model type) | this is the leak that a `core-no-io` rule catches |

The last row is the mistake codebases most often make. Giving shared row types
one named home next to the schema lets a cross-cutting consumer name a row
shape without importing another module's data layer — and the better fix is
usually to hand Ring 1 the **domain** type (`Order`) and leave the row→DTO
mapper in the repository, which already owns the row.

## Background work and streaming

- A job handler is Ring 2. Register it from the service
  (`jobs.register(KIND, …)`), give the payload an exported interface, and keep
  the kind string in `constants.ts`. A route enqueues; it never runs the work.
- An event bus / SSE / WebSocket fan-out is Ring 3–4 plumbing. A service
  publishes a domain event to it; it does not know a browser is listening.
- Anything long-running checks cancellation before the next expensive step,
  not after it.

## Errors

Throw an application error subclass (`AppError` → `NotFoundError`,
`ValidationError`, `ExternalServiceError`, `ConfigError`, each carrying a
status code) in whatever ring notices the problem. One global error handler in
Ring 4 renders the error envelope (e.g. `{ error: { code, message, details } }`)
— never build that envelope by hand in a handler. Ring 1 and Ring 2 throw;
Ring 4 maps.

## Tests prove the architecture

| The test needs | What that means |
|---|---|
| nothing but the module | Ring 1 — plain unit test |
| mocks passed to a constructor or to the composition root's overrides | Ring 2 — plain unit test |
| a real database (testcontainers, a test DB) | Ring 3 — an integration test, kept apart by name (e.g. `*.it.test.ts`) or folder |

If a unit test of a *service* needs a database, the service is reaching into
Ring 3 — fix the dependency, not the test. Keep integration tests separable by
a naming or folder convention so the hermetic unit suite never needs Docker;
follow whatever convention the project already uses.

## Enforcement

Rules nobody checks decay. Use the project's architecture check if it has one;
otherwise recommend one and, until it exists, review imports manually and say
so in your report.

| Ecosystem | Tool |
|---|---|
| JS/TS | `dependency-cruiser` (forbidden-dependency rules, known-violations baseline), `eslint-plugin-boundaries`, `eslint-plugin-import` `no-restricted-paths`, Nx `enforce-module-boundaries` |
| Python | `import-linter` (layers and forbidden contracts) |
| JVM | ArchUnit |

A failure should name the rule; `references/enforcement.md` lists the standard
rule set and the fix for each one.

When adopting a check on an existing codebase, **grandfather today's violations
in a committed baseline** so the check is green on a clean tree and red the
moment someone adds a new one. **Never regenerate the baseline to make your own
violation disappear** — the baseline only shrinks. If a rule is wrong, change the
rule and say why in the commit.

## When not to do this

Onion turns into cargo cult fast. Do **not**:

- create a class per use case (`PlaceOrderUseCase`) when a service of 5–7
  methods is the natural size;
- write a row→domain mapper when the shapes are identical;
- add a port for something with one implementation that no test ever swaps —
  promote to a port on the second implementation, not the first;
- split a module into ring folders because it grew; split it by **subject**
  (`orders/repository/{order,line-item,refund}.repo.ts`);
- "fix" existing boundary debt as a side effect of an unrelated change. One
  boundary, one commit, and update wherever the project tracks the debt;
- apply the full ceremony to a small CRUD app — the original author of the
  pattern warned it is not for small sites. Keep the dependency rule; skip
  the layers you do not need yet.

## Further reading

- `references/rings.md` — a full example folder map, what each ring owns, promotion examples, package boundaries.
- `references/tooling.md` — the rules per tool: HTTP framework, ORM, validation, DI, jobs, errors, tests.
- `references/enforcement.md` — the standard rule set, what each catches, how to fix it, a sample config, the review checklist.
- `examples.md` — before/after pairs for the most common boundary violations.
- `references/sources.md` — the articles and docs this skill is built from.
