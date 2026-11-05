# engineering-paved-path

Stack and quality skills for TypeScript web projects: backend and frontend
architecture rules, React, Next.js and Fastify best practices, React Testing
Library, web-app security (OWASP Top 10) and Mermaid diagrams.

Install it when you want Claude to place code in the right layer, follow the
idioms of your stack and review against a consistent rulebook — on its own, or
as the shared skill library behind the agents in `architecture-review` and
`sdd-engineering`. All skills are project-agnostic: the architecture skills
first map your repository's layout and then apply the rules to it.

## Install

```
/plugin marketplace add malinovskiy-alex/dev-digest-ai-marketplace
/plugin install engineering-paved-path@dev-digest-ai
```

## Requirements

None. The skills are instructions only — no scripts, no external tools, no
environment variables. (Some skills *recommend* tools for your project, e.g.
dependency-cruiser or ESLint; installing them is your call.)

## Components

| Type | Name | Covers | Triggers when |
|---|---|---|---|
| Skill | `engineering-paved-path:onion-architecture` | Backend rings (domain → application → infrastructure → transport), import direction, ports/adapters, composition root, module boundaries, enforcement tooling | adding or moving backend code: an endpoint, a service, a repository, a job, an external-API adapter; "where should this backend code go?" |
| Skill | `engineering-paved-path:frontend-ui-architecture` | Where frontend code goes: route/feature vs shared, component folders, business logic, data hooks, constants, types, import direction, the RSC server/client split | adding, moving or splitting React/Next.js code; "add a screen", "extract this" |
| Skill | `engineering-paved-path:react-best-practices` | React component design, state, hooks misuse, performance, data fetching anti-patterns | writing, reviewing or refactoring React components and hooks |
| Skill | `engineering-paved-path:next-best-practices` | Next.js file conventions, RSC boundaries, async APIs, data patterns, metadata, error handling, route handlers, image/font, bundling, self-hosting | writing or reviewing Next.js code (background skill — loaded by Claude, hidden from the `/` menu) |
| Skill | `engineering-paved-path:fastify-best-practices` | Fastify routes, plugins, hooks, schemas, serialization, errors, auth, CORS, logging, testing, deployment | building or debugging a Fastify server |
| Skill | `engineering-paved-path:react-testing-library` | RTL + Vitest: setup, query priority, `userEvent`, async patterns, MSW mocking, user-flow tests | writing, reviewing or setting up React component and hook tests |
| Skill | `engineering-paved-path:security` | OWASP Top 10:2025 with confidence-based reporting; auth, input handling, uploads, secrets, API endpoints | security review, auth work, handling user input or files |
| Skill | `engineering-paved-path:mermaid-diagram` | Choosing and writing Mermaid diagrams: flowchart, sequence, class, ER, state and more | visualizing a workflow, architecture, API flow or data model in markdown |

## Usage

**Automatic.** Claude loads a skill when the task matches its description. For
example:

- "Add a `POST /orders/:id/refund` endpoint" → `onion-architecture` decides that
  the route only delegates, the refund rule goes in the service, the SQL goes in
  the repository and the payment provider sits behind a port;
  `fastify-best-practices` covers the route schema and error handling.
- "Extract the filters panel from the catalog page" → `frontend-ui-architecture`
  puts it in a component folder owned by the catalog route with `helpers.ts` /
  `constants.ts`, and keeps the page composing only.
- "Review this login handler for security issues" → `security` traces the data
  flow and reports only confirmed (HIGH) issues with file, line, exploit and fix.

**Manual.** Invoke a skill by its namespaced name, optionally with a target:

```
/engineering-paved-path:react-best-practices review src/features/cart/
/engineering-paved-path:onion-architecture where should a Stripe webhook handler go?
/engineering-paved-path:mermaid-diagram sequence diagram of the checkout flow
```

`next-best-practices` is a background skill (`user-invocable: false`): Claude
uses it automatically for Next.js work; it does not appear in the `/` menu.

**From your own agents.** Preload a skill in an agent's frontmatter with its
namespaced name:

```yaml
---
name: my-reviewer
description: Reviews backend changes for layering problems
skills:
  - engineering-paved-path:onion-architecture
---
```

## How it fits with the other plugins

`engineering-paved-path` is a dependency plugin: it has no dependencies of its
own and can be installed alone.

| Plugin | Uses |
|---|---|
| `architecture-review` | `architecture-review:architecture-reviewer` preloads `engineering-paved-path:onion-architecture` and `engineering-paved-path:frontend-ui-architecture` (frontmatter `skills:`). `architecture-review` declares this plugin as a dependency (`^1.0.0`), so it is always installed alongside. |
| `sdd-engineering` | declares this plugin as a dependency (`^1.0.0`). `sdd-engineering:implementation-planner` and `sdd-engineering:implementer` preload `onion-architecture` and `frontend-ui-architecture`; the implementer also uses the stack skills (React, Next.js, Fastify, React Testing Library, security) for the files it touches; `sdd-engineering:spec-creator` uses `mermaid-diagram`. |

Because the architecture skills are preloaded into those agents, each
`SKILL.md` is a self-contained rulebook; the `references/` files and
`examples.md` add depth on demand.

## Hooks, network calls, telemetry

None. No hooks, no MCP servers, no scripts, no network calls, no telemetry.

## Versioning

See [CHANGELOG.md](CHANGELOG.md). Releases are tagged
`engineering-paved-path--v<version>`.

## License and attribution

The plugin is distributed under the terms in [LICENSE](LICENSE).
`onion-architecture` and `frontend-ui-architecture` are original to this
marketplace. The other six skills were written by third parties — see
[NOTICE.md](NOTICE.md) for each skill's upstream source, its license status and
what was changed. Some upstream licenses are not yet confirmed; NOTICE.md marks
them.
