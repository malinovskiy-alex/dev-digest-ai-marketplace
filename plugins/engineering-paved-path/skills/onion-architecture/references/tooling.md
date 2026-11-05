# The rings, per tool

Every tool in a backend either helps the dependency rule or quietly breaks it.
This file is the ruling for each kind of tool, with the reason attached — a rule
whose "why" is missing gets "fixed" by the next person. Examples use Fastify,
a Drizzle-style query builder and Zod; the same rulings apply to their
equivalents (Express/NestJS/Hono, Prisma/TypeORM/Knex, Valibot/Yup/class-validator).

---

## The HTTP framework (Fastify as the example)

The HTTP framework is Ring 4 and stays there. Frameworks are genuinely good at
encapsulation (Fastify plugins, Nest modules, Express routers), which is what
makes a module a module — but their conveniences (`decorate`, request-scoped
state, hooks, middleware) all pull logic outward.

**1. A route handler does four things and no more:** read the validated input,
resolve the request context, call one service method, map the status code.

```ts
app.post('/orders', { schema: { body: OrderInput } }, async (req, reply) => {
  const { tenantId, userId } = await getContext(req);
  const { order, created } = await service.place(tenantId, userId, req.body);
  reply.status(created ? 201 : 200);
  return order;
});
```

If a handler has a second `await` on something that is not a service, the logic
it is expressing belongs in the service.

**2. The request object never crosses into Ring 2.** One helper (e.g.
`modules/_shared/context.ts`) is the *only* place a service's inputs are
extracted from a request, and it hands back plain values (`{ tenantId, userId }`).
Passing `req` into a service couples the use case to HTTP and makes it
uncallable from the job runner.

**3. One module, one encapsulated plugin/router, registered statically.** A new
module is `modules/<name>/routes.ts` exporting a plugin, plus one import and one
entry in the module registry. Prefer this to filesystem autoload, which is
fragile across runtimes, bundlers and test runners.

**4. Plugin/middleware order is part of the architecture.** Security headers,
CORS, rate limiting and the error handler register *before* the modules,
because an encapsulated plugin inherits only what was registered earlier.
Registering a module before a security plugin silently un-protects it.

**5. Framework decoration is for the composition root and nothing else.** If you
`app.decorate(...)`, decorate the container (or nothing). Decorating services,
repositories or request-scoped helpers turns the framework into the DI container
and makes every consumer reachable only through a live server.

**6. The framework's error handler owns the error envelope.** See *Errors* below.

---

## The ORM / query builder (Drizzle as the example)

A typed query builder is not a repository. It is excellent Ring 3 and
catastrophic anywhere else — because its types are *so* convenient that a row
shape spreads through the codebase without a single ORM import.

**1. The ORM is importable from `db/**` and `*/repository*.ts` only.** Enforced
by the `app-no-orm` and `routes-no-db` rules (see `enforcement.md`).

**2. The repository is the only file that knows its tables.** Say it in the
repository's header comment: "the ONLY place that touches the `orders` table".
One module's repository never queries another module's tables — share the
repository through the composition root instead.

**3. Nothing ORM-shaped leaves a repository.** No query builder, no transaction
handle, no driver error. Return a domain object, or a row type that is named in
one shared place. A repository that returns a partially-built query has made
every caller an ORM caller.

**4. Row types have exactly one home.** Writing
`typeof schema.orders.$inferSelect` (or importing a generated model type) in a
service or a helper is the most common leak. Two escalating fixes:

```ts
// worse — Ring 1/2 file importing the schema barrel for a type
import * as schema from '../../db/schema.js';
function toOrderDto(row: typeof schema.orders.$inferSelect): Order { … }

// better — the row type is named once, next to the schema
import type { OrderRow } from '../../db/rows.js';
function toOrderDto(row: OrderRow): Order { … }

// best — Ring 1 never sees a row; the repository maps on the way out
import type { Order } from '@acme/shared';
function summarize(order: Order): string { … }
```

Reach for "best" when you are already editing the file; "better" is the minimum.

**5. Transactions are an application decision executed in infrastructure.** The
service decides what must be atomic; the repository exposes one method that runs
it in a transaction. A service that opens a transaction and passes `tx` around
has inverted the ring.

**6. Tenant scoping is a domain rule that lives in Ring 3.** In a multi-tenant
product every domain table carries a tenant id and every query filters by it.
This is the strongest single argument against routes querying directly: one
forgotten `where tenant_id = …` in a route is a cross-tenant leak that no test in
another module will catch.

**7. Migrations are applied deliberately.** Prefer an explicit migrate step over
applying migrations on boot; treat an applied migration as immutable and add a
new migration for every change, keeping the tool's file naming and ordering.

---

## Validation schemas and contracts (Zod as the example)

A schema-first validation library sits in Ring 1, and it can let a codebase skip
a separate DTO layer: the contract *is* the domain type.

**1. Validation is schema-first and declarative.** Declare `params` / `body` /
response schemas on the route through the framework's type provider or
validation pipe. Do not hand-roll `Schema.parse(req.body)` inside a handler —
invalid input must fail with a 4xx before the handler runs, and a hand-rolled
parse inside `try` tends to produce a 500 instead.

**2. The contract is the boundary type.** `Order`, `LineItem`, `Customer` come
from the shared contracts package (`@acme/shared`) and are what crosses every
ring boundary. A core package never redefines them locally.

**3. Duplicated contracts drift.** If the contracts exist in more than one place
(vendored copies for the API and the frontend, generated clients), editing one
without the others in the same commit makes request validation and the client's
types disagree silently. The same holds for port interfaces kept beside them.

**4. Do not grow a second contract layer.** If a route needs a narrower shape,
derive it (`.pick()`, `.omit()`) next to the route. A parallel `dto/` folder
duplicating the contracts is how the two drift.

---

## The composition root and dependency injection

The composition root (`platform/container.ts`, an app factory, a Nest module
graph) owns config, the database handle, the job queue, the event bus, and every
adapter — typically behind a lazy getter.

**1. `new` on an adapter happens here and nowhere else.** The root caches it,
resolves its secret, and exposes an override hook so a test can replace it. A
service that constructs `new StripeClient(key)` cannot be tested without a
network.

**2. A service takes its dependencies, not the container.**

```ts
// target — the constructor is the dependency list, and the test is three lines
constructor(private deps: { orders: OrderRepository; payments: PaymentGateway; jobs: JobQueue }) {}

// service locator — hides the dependency list and invites a cycle with the container
constructor(private container: Container) { this.orders = new OrderRepository(container.db); }
```

Write new services in the target shape. Existing service-locator services are
debt; do not mass-refactor them in passing, and do not copy them.

**3. A service may `new` its own repository.** A repository usually has no port
and no mock — it is swapped by pointing at a different database handle.
Adapters are swapped through the composition root's overrides, so they must
arrive already built. This is the one place the "never `new` in a service" rule
does not apply.

**4. Ports are named for the capability, not the vendor.** `PaymentGateway`, not
`StripeClient`. `EmailSender`, not `SesClient`. The port is your vocabulary; the
adapter is theirs.

**5. Adding an external integration, in this order:** port next to the contracts
(+ every duplicated copy) → implementation in `adapters/<vendor>/` → getter +
test override in the composition root → inject into the service. Doing it in the
other order produces a port shaped like the vendor's SDK instead of like your
domain.

**6. Secrets resolve inside the composition root.** From the environment or a
secrets provider; they never reach the database, a committed `.env`, logs, or a
service constructor argument as a raw value.

**7. Graceful degradation is a composition-root concern.** When an optional
capability is disabled or unconfigured, the getter throws a `ConfigError` (or
returns a no-op adapter) *before* constructing the client, so the app makes zero
requests; callers catch and degrade. Put the gate where the client is built, not
in every caller.

---

## Jobs and streaming

**1. A job handler is Ring 2 wearing a callback.** Register it from the service
(`jobs.register(KIND, …)`), export an interface for its payload, and keep the
kind string in `constants.ts`. The job queue itself is Ring 3.

**2. A route enqueues; it never runs the work.** `POST /imports` persists and
enqueues; the import happens in the job. This is also why services take
identity values rather than a request: the job runner has no request.

**3. A job kind shared by two modules is a contract.** It belongs in
`modules/_shared/`, not in one module's `constants.ts`.

**4. Event streams carry domain events, not HTTP.** A service publishes an event;
the event bus and a route turn it into SSE or WebSocket frames. Ring 2 must not
know a browser is attached.

**5. Know your process model.** Startup work such as reaping stale "running"
jobs assumes a particular number of API instances per database; check that
assumption before adding a second process.

---

## Errors

An `errors.ts` in Ring 1 holds `AppError` and its subclasses — `NotFoundError`,
`ValidationError`, `ExternalServiceError`, `ConfigError` — each carrying a
status code. They are pure classes, no framework.

- **Throw in the ring that notices.** A repository throws `NotFoundError`; an
  adapter throws `ExternalServiceError`; the composition root throws
  `ConfigError` for a missing key.
- **Map in Ring 4 only.** One global handler renders the envelope (e.g.
  `{ error: { code, message, details } }`). Never build that envelope by hand
  and never `reply.status(500).send({ error: … })` in a handler — two shapes of
  the same error is a client-side bug generator.
- **Do not catch to log and rethrow.** The handler logs. A catch that adds
  nothing removes the stack.

---

## Tests

The test suites are the architecture's proof. The shape of a test tells you
which ring its subject is really in.

| Needs | Ring | Typical convention |
|---|---|---|
| nothing | 1 | `*.test.ts` |
| constructor mocks or composition-root overrides | 2 | `*.test.ts` |
| a real database (testcontainers, a test DB) | 3 | `*.it.test.ts`, or an `integration/` folder |

- **A database test in the unit suite poisons it** — keep integration tests
  separable by name or folder so the hermetic suite runs without Docker; follow
  the project's existing convention.
- **If a service test needs a database, fix the service.** That is the single
  most reliable smell for a ring violation, and it shows up long before an
  architecture check does.
- A pure core package's tests are hermetic by construction: stubbed ports, no
  keys, no network. If a change there needs a fixture from disk or a live call,
  the change belongs in an outer ring.

---

## An external-provider path, end to end

Worth tracing once, because it crosses every ring and gets it right:

```
routes.ts              Ring 4  POST /orders/:id/pay → service.pay()
service.ts             Ring 2  loads the order, checks state, enqueues or calls the engine
packages/core          Ring 1  computes totals, taxes, the charge request (pure)
  ↓ calls the injected port
PaymentGateway         Ring 1  the interface, in the shared contracts
  ↑ implemented by
adapters/payments/*.ts Ring 3  speaks the provider's SDK
container.payments()   Ring 3  resolves the key, builds the adapter, caches it
```

The core never learns which provider answered, and the adapter never learns what
an order is. Provider choice and credentials are configuration that flows *in*.
