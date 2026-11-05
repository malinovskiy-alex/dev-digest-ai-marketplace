# Enforcement

The rules are not advice. An architecture check turns each one into a build
failure. Use the project's check if it has one (look for
`.dependency-cruiser.*`, `eslint-plugin-boundaries` or
`import/no-restricted-paths` in the ESLint config, `.importlinter`, ArchUnit
tests, Nx `enforce-module-boundaries`) and run it with the project's own command
(package.json scripts, Makefile, CI workflow). If the project has none, review
the imports by hand against the rules below and say so in your report — and
offer the sample config at the end of this file.

## How a baseline works

When adopting a check on an existing codebase, set every rule to `error` and
record today's violations in a committed baseline file that the check ignores.
dependency-cruiser supports this directly:

```sh
# record the current violations (run from the package root)
npx depcruise src --config .dependency-cruiser.cjs --output-type baseline > .dependency-cruiser-known-violations.json

# the everyday check: fails only on violations that are NOT in the baseline
npx depcruise src --config .dependency-cruiser.cjs --ignore-known
```

So:

- on a clean tree the check is **green**;
- the moment you add a new violation it is **red**, with the rule name and the
  exact edge;
- the debt is a committed, countable list instead of a `warn` nobody reads.

**Never regenerate the baseline to make your own violation disappear.** The
baseline shrinks; it does not grow. If a rule is genuinely wrong, change the rule
and say why in the commit message — that is a reviewable decision, a regenerated
baseline is not.

Other tools have equivalents (an ESLint suppressions file or per-line disables
with a reason, import-linter `ignore_imports`, ArchUnit `FreezingArchRule`).

## The standard rule set

Paths below use the example layout from `rings.md`, relative to the backend
package root. Adapt the globs to the project.

### `core-no-io` — Ring 1 must not touch I/O
**From** the pure core package, `modules/*/helpers.ts`, pure platform files
**To** the ORM, `db/*`, `adapters/*`, the HTTP framework, database drivers, any
vendor SDK, and the stateful platform files (container, config, jobs, events)

Catches a pure helper that grew a dependency. Almost always a *type* import of an
ORM row, not a real call.

**Fix:** hand the helper the domain type and move the row→DTO mapping into the
repository. If it truly needs I/O, it was never a helper — move it to
`service.ts`.

### `app-no-orm` — Ring 2 does not speak SQL
**From** `modules/*/service.ts`, orchestrators, `modules/*/pipeline/*`
**To** the ORM and `db/schema`

**Fix:** move the query into the module's `repository.ts`. When it is only a row
*type*, name it in the shared row-types file and import that instead.

### `app-no-http-framework` — Ring 2 does not know it is behind HTTP
**From** the same Ring 2 set **To** the HTTP framework

**Fix:** the service takes identity values and DTOs. Extract them in the route
with the shared context helper.

### `routes-no-db` — Ring 4 must not query
**From** any `routes.ts` / controller **To** the ORM and `db/schema`

**Fix:** create `service.ts` for the module (and `repository.ts` if it has none),
move the query down, leave the route with one service call. A module without a
service is not exempt — it is the reason the rule fires.

### `no-concrete-adapters` — only the composition root builds adapters
**From** `modules/**` **To** `adapters/*`

**Fix, pick one:**
- the import is a **pure function** (a parser, a formatter) → move the file into
  Ring 1; it is not an adapter at all;
- the import is a **real adapter** (spawns a process, touches the filesystem or
  network) → declare its interface with the other ports, add a composition-root
  getter and a test override, inject it;
- the import is an **interface that happens to live beside its implementation**
  → move the interface next to the other ports.

### `no-cross-module` — a module never reaches into a sibling
**From** `modules/<a>/` **To** `modules/<b>/` where `b ∉ {a, _shared}`
(dependency-cruiser's `$1` group back-reference in `pathNot` is what makes
"same module" work)

**Fix:** a shared repository or service goes on the composition root; a shared
schema or helper goes in `modules/_shared/`; a job kind two modules agree on is a
contract and belongs in `_shared/` too.

### `no-circular` — no import cycles
**From** anything **To** itself, transitively

A cycle is nearly always a ring inversion: an inner file importing an outer one
that imports it back.

**Fix:** the two common shapes —
- **container ⇄ service:** the service takes the whole container, and the
  container constructs the service. Injecting explicit dependencies removes it.
- **helpers ⇄ repository:** the helper imports row types *from the repository*
  while the repository imports a function from the helper. Importing the rows
  from the shared row-types file breaks it.

### `not-to-unresolvable` — every import must resolve
Catches a broken path alias or a missing extension. Point the tool at the
project's `tsconfig.json` so path aliases resolve.

## Sample dependency-cruiser config

A starting point, written for the example layout and run from the backend
package root. **It has not been run against your project** — adjust the paths,
run it, and expect to tune the globs before committing it.

```js
// .dependency-cruiser.cjs
const RING1 = '^src/(modules/[^/]+/helpers\\.ts|platform/(errors|resilience|money|dates|format)\\.ts)$';
const RING2 = '^src/modules/[^/]+/(service\\.ts|pipeline/)';
const ORM = '^(node_modules/)?(drizzle-orm|@prisma/client|typeorm|knex)';
const HTTP = '^(node_modules/)?(fastify|express|@nestjs/[^/]+|hono|koa)';

module.exports = {
  forbidden: [
    {
      name: 'core-no-io',
      severity: 'error',
      from: { path: RING1 },
      to: { path: [ORM, HTTP, '^src/db/', '^src/adapters/', '^src/platform/(container|config|jobs|events)\\.ts$'] },
    },
    { name: 'app-no-orm', severity: 'error', from: { path: RING2 }, to: { path: [ORM, '^src/db/schema'] } },
    { name: 'app-no-http-framework', severity: 'error', from: { path: RING2 }, to: { path: HTTP } },
    {
      name: 'routes-no-db',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/routes\\.ts$' },
      to: { path: [ORM, '^src/db/'] },
    },
    { name: 'no-concrete-adapters', severity: 'error', from: { path: '^src/modules/' }, to: { path: '^src/adapters/' } },
    {
      name: 'no-cross-module',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/_shared/'] },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    { name: 'not-to-unresolvable', severity: 'error', from: {}, to: { couldNotResolve: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true, // type-only imports count: that is where row types leak
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
```

`tsPreCompilationDeps: true` matters: most ring leaks are `import type`, which
disappears after compilation and would otherwise go unseen.

Add a script for it (for example `"arch": "depcruise src --config .dependency-cruiser.cjs --ignore-known"`)
using the project's package manager, and wire it into CI next to type checking —
either straight away with the baseline, or once the baseline is empty if the
team prefers not to carry an ignored list in CI.

## Review checklist

An import checker sees import direction. It does **not** see logic that moved
rings without moving an import — for that, read the diff and ask:

1. **Does any route handler make a decision?** A branch on domain state, a
   default value, a second write — that is a service method that has not been
   written yet.
2. **Does any service signature mention HTTP, SQL or a vendor?** `req`, `tx`,
   an SDK client, a provider-specific id that was not passed in.
3. **Did a new type appear in two rings at once?** A row shape in a helper
   signature is the usual one.
4. **Could this service be called from a job?** If not, something request-shaped
   leaked in.
5. **Does the new test need Docker?** If the subject is a service, the answer
   should be no.
