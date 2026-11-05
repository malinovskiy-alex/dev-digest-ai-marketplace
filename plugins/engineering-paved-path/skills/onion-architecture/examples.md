# Before / after

Each pair below is a boundary violation that shows up in real backends. None of
them are bugs — the code works. They are places where a ring boundary is
crossed, and each one has a cost you can name. Paths use the neutral example
layout (`apps/api/src/…`); the rule named on each one is from
`references/enforcement.md`.

---

## 1. A route that owns its own SQL

**Rule:** `routes-no-db` · **Where:** `apps/api/src/modules/orders/routes.ts`

```ts
// before — modules/orders/routes.ts
import { and, eq } from 'drizzle-orm';
import * as t from '../../db/schema.js';

app.get('/orders/:id', async (req) => {
  // …fetch the latest shipment status from the carrier, then:
  await db.delete(t.shipmentEvents).where(eq(t.shipmentEvents.orderId, order.id));
  await db.insert(t.shipmentEvents).values(/* … */);
  // …and in the catch branch, a second set of reads:
  const lines  = await db.select().from(t.orderLines).where(eq(t.orderLines.orderId, order.id));
  const events = await db.select().from(t.shipmentEvents).where(eq(t.shipmentEvents.orderId, order.id));
});
```

```ts
// after — modules/orders/routes.ts  (Ring 4)
app.get('/orders/:id', { schema: { params: OrderParams } }, async (req) => {
  const { tenantId } = await getContext(req);
  return service.detail(tenantId, req.params.id);
});

// modules/orders/service.ts  (Ring 2)
async detail(tenantId: string, orderId: string): Promise<OrderDetail> {
  const order = await this.deps.orders.getById(tenantId, orderId);
  if (!order) throw new NotFoundError(`order ${orderId}`);
  try {
    const fresh = await this.deps.carrier.trackingEvents(order.trackingNumber);
    await this.deps.orders.replaceShipmentEvents(order.id, fresh);   // one atomic method
    return toOrderDetail(order, fresh);
  } catch (err) {
    this.deps.log.warn({ err }, 'carrier refresh skipped; serving persisted detail');
    return this.deps.orders.getPersistedDetail(order.id);
  }
}
```

**What it costs as written.** The fallback path is a business rule — *"when the
carrier is unreachable, serve what we persisted"* — and it is only reachable
through an HTTP request, so it can only be tested by booting the server. The
delete + insert pair is not in a transaction, and nothing in Ring 4 makes that
visible. Tenant scoping has to be remembered here separately from the
repository.

---

## 2. A domain helper that takes a database row

**Rule:** `core-no-io` · **Where:** `apps/api/src/modules/customers/helpers.ts`

```ts
// before — modules/customers/helpers.ts  (claims to be Ring 1)
import * as t from '../../db/schema.js';

export function toCustomerDto(row: typeof t.customers.$inferSelect): Customer { … }
```

```ts
// after — the mapper moves to the file that already owns the row
// modules/customers/repository.ts  (Ring 3)
import type { Customer } from '@acme/shared';

export class CustomerRepository {
  private toDto(row: CustomerRow): Customer { … }
  async list(tenantId: string): Promise<Customer[]> {
    const rows = await this.db.select().from(t.customers).where(eq(t.customers.tenantId, tenantId));
    return rows.map((r) => this.toDto(r));
  }
}
```

**What it costs as written.** `helpers.ts` is the file the whole module treats as
"safe to import anywhere", and it now transitively pulls in the schema barrel —
which is why `core-no-io` fires on a file containing no I/O at all. The service
above it deals in rows instead of `Customer`, so the persistence shape reaches
Ring 2 as well.

**The minimum fix**, when you are not ready to move the mapper: add
`export type CustomerRow = typeof t.customers.$inferSelect;` to `db/rows.ts` and
import that. It removes the schema import; it does not remove the row from the
domain.

---

## 3. A cycle made of two "pure" files

**Rule:** `no-circular` · **Where:** `apps/api/src/modules/catalog/helpers.ts`

```ts
// before
// helpers.ts     ─→ import type { ProductRow, VariantRow } from './repository.js';
// repository.ts  ─→ import { isPriceChange } from './helpers.js';
```

```ts
// after — both take the row type from where it is actually defined
// modules/catalog/helpers.ts
import type { ProductRow, VariantRow } from '../../db/rows.js';
```

**What it costs as written.** The repository already imports those two types
from `db/rows.ts` and re-exports them, so the helper is taking the long way
round and creating a cycle to do it. A shared row-types file next to the schema
exists for exactly this: a consumer can name a row shape without importing a
data layer.

---

## 4. A service that takes the container

**Rule:** `no-circular` (`container.ts ⇄ catalog/service.ts`)
**Where:** `apps/api/src/modules/catalog/service.ts`

```ts
// before
export class CatalogService {
  private products: ProductRepository;
  constructor(private container: Container) {
    this.products = new ProductRepository(container.db);
  }
  async importFeed(tenantId: string, userId: string, url: string) {
    const key = await this.container.secrets.get(FEED_API_KEY);
    const feed = await this.container.http.download(/* … */);
    this.container.jobs.register(/* … */);
  }
}
```

```ts
// after
export interface CatalogServiceDeps {
  products: ProductRepository;
  feeds: FeedDownloader;     // the port, not AxiosFeedDownloader
  jobs: JobQueue;
  secrets: SecretsProvider;
}

export class CatalogService {
  constructor(private deps: CatalogServiceDeps) {}
  async importFeed(tenantId: string, userId: string, url: string) {
    const key = await this.deps.secrets.get(FEED_API_KEY);
    const feed = await this.deps.feeds.download(url, key);
  }
}

// the route stays a one-liner, the composition root keeps composing:
const service = new CatalogService({
  products: new ProductRepository(container.db),
  feeds: container.feeds,
  jobs: container.jobs,
  secrets: container.secrets,
});
```

**What it costs as written.** The constructor no longer documents anything — you
have to read every method to learn what the service touches. A unit test has to
build a whole `Container`. And when the container also constructs
`CatalogService(this)`, the pattern produces a genuine import cycle between the
composition root and a Ring 2 service.

**Do not mass-refactor this** as a side effect of other work. Record it where the
project tracks architecture debt, and write *new* services in the "after" shape.

---

## 5. An adapter import that should have been a move, not a port

**Rule:** `no-concrete-adapters` · **Where:** `apps/api/src/modules/imports/loader.ts`

```ts
// before
import { parseCsv } from '../../adapters/csv/parse.js';
```

`parse.ts` performs no I/O — it takes a string and returns rows. It is Ring 1
code living in an adapter folder, and wrapping it in a port would be pure
ceremony.

```ts
// after — move the file, keep the call
// platform/csv.ts  (Ring 1)
export function parseCsv(text: string): CsvRow[] { … }
```

Contrast with a neighbouring violation of the same rule:

```ts
// modules/imports/service.ts — a REAL adapter, needs a port
import { … } from '../../adapters/virus-scan/index.js';   // spawns a scanner, touches the fs
```

That one gets an interface next to the other ports, a composition-root getter
and a test override — because a test must be able to replace it.

**The distinction to carry:** *does it do anything the test would want to fake?*
No → move it inward. Yes → put a port in front of it.

---

## 6. A constant reaching across modules

**Rule:** `no-cross-module` · **Where:** `apps/api/src/modules/billing/service.ts`

```ts
// before
import { INVOICE_JOB_KIND, REFUND_JOB_KIND } from '../orders/constants.js';
```

```ts
// after — modules/_shared/job-kinds.ts
export const INVOICE_JOB_KIND = 'orders.invoice';
export const REFUND_JOB_KIND = 'orders.refund';
```

**What it costs as written.** A job kind that two modules use is a contract
between them, not a private constant of one. As written, `billing` cannot be
read, moved or tested without `orders`, and the direction of that dependency is
accidental — it exists because of where someone typed the string first.

---

## 7. What "right" looks like

A pure core package with injected ports never shows up in the baseline, and that
is not luck:

```ts
// packages/core/src/pricing/quote.ts  (Ring 1)
export async function quote(input: QuoteInput): Promise<Quote> {
  // the only side effect permitted is a call on the INJECTED port
  const rates = await input.taxRates.forRegion(input.region);
  input.checkCancelled?.();
  return applyDiscounts(priceLines(input.lines, rates), input.promotions);
}
```

The core never learns which tax provider answered, never reads a file, never sees
a tenant id or a request. Configuration and reference data arrive as resolved
values — resolving them is the caller's job. That is the standard the rest of
the backend is measured against, and it is why such a package can be tested
with no Docker, no keys and no network.
