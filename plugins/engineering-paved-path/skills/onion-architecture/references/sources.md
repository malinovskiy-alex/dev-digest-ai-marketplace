# Sources

The articles and documentation this skill is built from, grouped by the question they answer.

### The canon

1. [Jeffrey Palermo — The Onion Architecture, part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) — the 2008 original: interfaces for behaviour contracts, "forces the externalization of infrastructure", and the explicit warning that it is not for small sites.
2. [jeffreypalermo.com — the onion-architecture tag](https://jeffreypalermo.com/tag/onion-architecture/) — parts 2–4.
3. [Herberto Graça — Onion Architecture](https://herbertograca.com/2017/09/21/onion-architecture/) — where onion sits among the other styles.
4. [The Software Architecture Chronicles — Onion Architecture](https://medium.com/the-software-architecture-chronicles/onion-architecture-79529d127f85) — the same material on Medium.
5. [Oliver Drotbohm — Sliced Onion Architecture](https://odrotbohm.github.io/2023/07/sliced-onion-architecture/) — how concentric rings coexist with vertical modules, and why per-module ring folders are a mistake.
6. [Milan Jovanović — Clean vs Onion vs Hexagonal](https://milanjovanovic.tech/blog/clean-architecture-vs-onion-vs-hexagonal) — the three are one idea; the dependency rule matters more than the labels; when it is overkill.
7. [Khalil Stemmler — The Dependency Rule](https://khalilstemmler.com/wiki/dependency-rule/) — the one-line statement.
8. [Wikipedia — Hexagonal architecture (Ports & Adapters)](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)) — the port/adapter vocabulary.
9. [Eric Damtoft — Onion vs Clean vs Hexagonal](https://medium.com/@edamtoft/onion-vs-clean-vs-hexagonal-architecture-9ad94a27da91) — a short side-by-side.

### Node.js / TypeScript practice

10. [Remo Jansen — Implementing SOLID and the onion architecture in Node.js with TypeScript](http://blog.wolksoftware.com/implementing-solid-and-the-onion-architecture-in-node-js-with-typescript-and-inversifyjs) — the reference TS write-up; this skill takes the layering and skips the IoC container.
11. [The same article on DEV](https://dev.to/remojansen/implementing-the-onion-architecture-in-nodejs-with-typescript-and-inversifyjs-10ad)
12. [Remo Jansen — Enforce Clean Architecture with fresh-onion](https://dev.to/remojansen/enforce-clean-architecture-in-your-typescript-projects-with-fresh-onion-45pi) — the idea of checking boundaries mechanically rather than by review.
13. [André Bazaglia — Clean architecture with TypeScript: DDD, Onion](https://bazaglia.com/clean-architecture-with-typescript-ddd-onion/)
14. [Melzar/onion-architecture-boilerplate](https://github.com/Melzar/onion-architecture-boilerplate) — a full Node+TS folder layout for comparison.
15. [Sankhadip Samanta — Onion Architecture in Node.js with TypeScript](https://sankhadip.medium.com/onion-architecture-in-node-js-with-typescript-5508612a4391)

### Enforcement

16. [dependency-cruiser — rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) — `forbidden` / `allowed`, `from`/`to`, `pathNot`, group matching with `$1`, `tsPreCompilationDeps`.
17. [Atomic Object — Dependency Cruiser: Restrict Imports in JavaScript](https://spin.atomicobject.com/dependency-cruiser-imports/) — a layered-rule walkthrough.
18. [Jakub Andrzejewski — Avoid Cross Module Dependencies with Dependency Cruiser](https://dev.to/jacobandrewsky/avoid-cross-module-dependencies-with-dependency-cruiser-3b0b) — the "a module never reaches into a sibling" rule.

### Fastify and dependency injection

19. [fastify/help #284 — best practice for dependency injection](https://github.com/fastify/help/issues/284) — the maintainers' position: plugin encapsulation and `decorate`, not a DI framework.
20. [fastify-decorators — Services and dependency injection](https://github.com/L2jLiga/fastify-decorators/blob/v3/docs/Services%20and%20dependency%20injection.md)
21. [fastify-resty — Dependency Injection](https://github.com/FastifyResty/fastify-resty/blob/main/docs/Dependency-Injection.md)

### Repositories and Drizzle

22. [Sentry Blog — Atomic Repositories in Clean Architecture and TypeScript](https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript/) — "don't expose raw schema types beyond repository boundaries"; the argument this skill uses.
23. [Khalil Stemmler — DTOs, Mappers & the Repository Pattern](https://khalilstemmler.com/articles/typescript-domain-driven-design/repository-dto-mapper/) — the maximalist position.
24. [Jay Freestone — You might not need the repository pattern](https://dev.to/jayfreestone/you-might-not-need-the-repository-pattern-46b) — the counter-argument; the reason for the "when not to do this" section.
25. [Repository Pattern with Drizzle ORM](https://medium.com/@vimulatus/repository-pattern-in-nest-js-with-drizzle-orm-e848aa75ecae)
26. [Drizzle ORM Best Practices](https://paulserban.eu/blog/post/drizzle-orm-best-practices-principles-patterns-and-real-world-case-studies/)

