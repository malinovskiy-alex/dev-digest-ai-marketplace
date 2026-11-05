# Examples

Before/after pairs for `frontend-ui-architecture`, on a neutral storefront
example (`apps/web/src/…`, a Next.js App Router app with a server-state query
library). Each one is a placement mistake, not a syntax mistake — the "before"
compiles and works.

## 1. A page that computes

The page is the composition layer. When it starts deriving, the logic has no
test and no home.

```tsx
// ✗ src/app/catalog/[categoryId]/page.tsx
export default function CategoryPage() {
  const { data: products = [] } = useCategoryProducts(categoryId);
  const [hideOutOfStock, setHideOutOfStock] = useState(false);

  const shown = [...(hideOutOfStock ? products.filter((p) => p.stock >= 5) : products)]
    .sort((a, b) => WEIGHTS[a.availability] - WEIGHTS[b.availability]);

  return <ProductGrid products={shown} onToggle={setHideOutOfStock} />;
}
```

```tsx
// ✓ page.tsx — composes and passes props
export default function CategoryPage() {
  const { data: products = [], isLoading, error } = useCategoryProducts(categoryId);

  if (isLoading) return <CategorySkeleton />;
  if (error) return <CategoryError error={error} />;

  return <ProductGrid products={products} />;
}
```

```ts
// ✓ _components/ProductGrid/constants.ts — the threshold has a name and a reason
/** Products with less stock than this are hidden when "hide low stock" is on. */
export const LOW_STOCK_THRESHOLD = 5;

/** Sort weight per availability (lower = shown first). */
export const AVAILABILITY_ORDER: Record<string, number> = {
  IN_STOCK: 0, LOW_STOCK: 1, BACKORDER: 2, OUT_OF_STOCK: 3,
};
```

```ts
// ✓ _components/ProductGrid/helpers.ts — pure, testable without React
import type { Product } from "@acme/shared";
import { LOW_STOCK_THRESHOLD, AVAILABILITY_ORDER } from "./constants";

export function visibleProducts(products: Product[], hideLowStock: boolean) {
  const shown = hideLowStock
    ? products.filter((p) => p.stock >= LOW_STOCK_THRESHOLD)
    : products;
  return [...shown].sort(
    (a, b) => (AVAILABILITY_ORDER[a.availability] ?? 9) - (AVAILABILITY_ORDER[b.availability] ?? 9),
  );
}
```

The grid owns `hideLowStock` — the state lives with the toggle that changes it —
and calls `visibleProducts` during render.

## 2. `fetch` in a component

```tsx
// ✗ the endpoint has no hook, so the component grew one inline
function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/orders`)
      .then((r) => r.json())
      .then(setOrders);
  }, []);
  // no error state, no cache, no invalidation, and a second copy of the base URL
}
```

```ts
// ✓ src/lib/hooks/orders.ts — the query key and its invalidations in one place
export function useOrders() {
  return useQuery({ queryKey: ["orders"], queryFn: () => api.get<Order[]>("/orders") });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Order>(`/orders/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}
```

```tsx
// ✓ the component just consumes it
function OrderHistory() {
  const { data: orders = [], isLoading, error } = useOrders();
  // ...
}
```

Going through the HTTP client also means failures arrive as one `ApiError` type
with a status, which is what a toast / inline / full-screen error taxonomy
branches on.

## 3. Deriving vs. storing

```tsx
// ✗ two sources of truth, kept in sync by hand
const [items, setItems] = useState<CartItem[]>([]);
const [itemCount, setItemCount] = useState(0);

useEffect(() => {
  setItemCount(items.reduce((n, i) => n + i.quantity, 0));
}, [items]);
```

```tsx
// ✓ one source of truth; the count cannot drift
const itemCount = items.reduce((n, i) => n + i.quantity, 0);
```

If the derivation is more than a line, it is a `helpers.ts` function. If it is
genuinely expensive — measured, not assumed — that is when `useMemo` enters, and
`react-best-practices` covers the trade-off.

## 4. Deep import past `index.ts`

```ts
// ✗ reaches into another component's internals; now the folder cannot move
import { AVAILABILITY_ORDER } from "../ProductGrid/constants";
```

Two legitimate outcomes, depending on what is true:

```ts
// ✓ if the value is genuinely shared — promote it
// src/lib/availability.ts
export const AVAILABILITY_ORDER: Record<string, number> = { /* ... */ };
```

```ts
// ✓ if only the rendered result is needed — export that from index.ts
import { ProductGrid } from "@/app/catalog/_components/ProductGrid";
```

What is *not* an outcome: adding the deep path to an allowlist. The import is
the symptom; the placement is the bug.

## 5. A component a second route needs

```
✗ src/app/catalog/[productId]/_components/PriceTag/   ← used by /catalog
  src/app/cart/_components/PriceTag/                  ← copy-pasted
```

```
✓ src/components/price-tag/
    PriceTag.tsx
    PriceTag.test.tsx
    constants.ts
    index.ts
```

The folder becomes kebab-case because it is now a shared module; the component
file stays `PriceTag.tsx`. Move it in one commit and update both call sites — a
copy "just for now" is how two price tags drift apart over a month.

In a `features/` layout the same move goes from
`src/features/catalog/components/PriceTag/` to `src/components/price-tag/`.

## 6. Generic bucket vs. subject-named module

```ts
// ✗ src/lib/utils.ts — tells you the shape, never the owner
export function formatPrice(cents: number, currency: string) {}
export function productUrl(slug: string) {}
export function shippingLabel(method: string) {}
```

```ts
// ✓ one subject per file, guessable from the name
// src/lib/format-price.ts, src/lib/product-urls.ts, src/lib/shipping-label.ts
```

A `utils.ts` has no natural stopping point: nothing ever fails to belong in it,
so it grows until it is a dependency of everything and owned by no one.

## 7. `'use client'` placed too high

```tsx
// ✗ the whole subtree ships to the browser for one popover
"use client";

export default function AccountLayout({ children }) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <section>
      <StaticHeading />   {/* static, but now client-side */}
      <HelpPopover open={helpOpen} onOpenChange={setHelpOpen} />
      {children}
    </section>
  );
}
```

```tsx
// ✓ the layout stays a server component; only the popover is a client one
export default function AccountLayout({ children }) {
  return (
    <section>
      <StaticHeading />
      <HelpPopover />      {/* "use client" lives in HelpPopover */}
      {children}
    </section>
  );
}
```

Read this as guidance for **new** code. If existing pages carry the directive at
the top by design — a SPA over a separate API — narrowing an existing boundary is
a deliberate refactor to propose, not a drive-by edit.

## 8. Where a type belongs

```ts
// ✗ a types/ folder that collects everything by shape
// src/types/index.ts
export interface ProductGridProps { /* used in exactly one file */ }
```

```tsx
// ✓ single-use type stays with its only consumer
// _components/ProductGrid/ProductGrid.tsx
type ProductGridProps = { products: Product[] };
```

```ts
// ✓ frontend-wide type
// src/lib/types.ts
export type PaymentMethodKind = "card" | "paypal" | "bank-transfer";
```

```ts
// ✓ a shape the backend must agree on — a schema in the shared contracts
// package, with the type inferred from it. Cross-package change: follow the
// project's contract-change process, and never hand-edit a vendored/generated
// copy to make the frontend compile.
export const Product = z.object({ /* ... */ });
export type Product = z.infer<typeof Product>;
```
