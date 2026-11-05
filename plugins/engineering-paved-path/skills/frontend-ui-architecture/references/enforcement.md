# Enforcing the boundaries

Reference for `frontend-ui-architecture`. Structure decays quietly: no single
import feels wrong at the time, and a year later the folders mean nothing. This
file is how you keep that from happening — a checklist for review, and a lint
config for when you want it mechanical.

## Contents

- [Review checklist](#review-checklist)
- [The ESLint config, for when you want it mechanical](#the-eslint-config-for-when-you-want-it-mechanical)
- [What a violation usually means](#what-a-violation-usually-means)

## Review checklist

First check whether the project already lints boundaries
(`import/no-restricted-paths`, `eslint-plugin-boundaries`, Nx
`enforce-module-boundaries`). Whatever it does not check mechanically is
checked by whoever writes or reviews the change. Run through these when a diff
adds or moves a frontend file.

**Placement**

- [ ] Is this at the narrowest scope that works? A component used by one route
      or feature lives with that route/feature, not in `src/components/`.
- [ ] If it moved up a level, did a *second* consumer actually appear?
- [ ] Does the new file have a subject-named home, or did it land in a generic
      bucket? No new `utils/`, `helpers/` or `types/` at the top level.
- [ ] If the project has i18n, is a user-facing string going through it rather
      than sitting in JSX?

**Imports**

- [ ] Does anything in `src/lib/` import from routes, features or
      `src/components/`? That is an upward import — the file is misfiled.
- [ ] Does `src/components/` import from routes or features?
- [ ] Does one route's or feature's code import another's private folder?
- [ ] Does any import reach past a component folder's `index.ts` into
      `helpers.ts`, `constants.ts` or `styles.ts`?
- [ ] Is vendored or generated code untouched, and does it import nothing from
      the app?
- [ ] Are non-sibling imports using the project's path alias rather than
      `../../..`?

**Layering**

- [ ] Any `fetch` outside the HTTP client module?
- [ ] Does the page/route file compute anything, or does it only compose?
- [ ] Is there logic in a component body that closes over nothing — a pure
      function that belongs in `helpers.ts`?
- [ ] Is a value stored in state that could be derived during render?
- [ ] Does a new endpoint have a hook, with its query key and invalidations in
      one place?

**Shape**

- [ ] Does the component folder follow the project's folder shape, with
      `index.ts` as its only public surface?
- [ ] Is there a colocated `*.test.tsx`?
- [ ] Do new styles follow the project's current styling approach, and is the
      component not half-migrated between two approaches?

## The ESLint config, for when you want it mechanical

This config is **a starting point that has not been run against your project**
— install, run it, and expect to adjust the zones before committing it. It
targets the example layout (route-private `_components/` plus optional
`features/`); adapt the paths.

Add the dev dependencies with the project's package manager:
`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-import`.

`eslint.config.mjs` in the frontend package:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

// One entry per top-level route: a route may not reach into a sibling route's
// private folders. When two routes need the same thing, it gets promoted to
// src/components/ — that promotion is the point of the rule.
const routes = ["catalog", "cart", "checkout", "account"];
const routeIsolation = routes.map((route) => ({
  target: `./src/app/${route}`,
  from: "./src/app",
  except: [`./${route}`],
  message:
    "Routes are private to each other. Promote shared UI to src/components/.",
}));

// Same idea for a features/ layout: a feature never imports another feature.
const features = ["catalog", "cart", "checkout"];
const featureIsolation = features.map((feature) => ({
  target: `./src/features/${feature}`,
  from: "./src/features",
  except: [`./${feature}`],
  message: "Features are independent. Compose them in a route, or promote the shared part.",
}));

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { import: importPlugin },
    rules: {
      // Dependencies point one way: lib -> components -> features -> app.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/lib",
              from: ["./src/app", "./src/features", "./src/components"],
              message:
                "src/lib is below the UI. An upward import means this file is misfiled.",
            },
            {
              target: "./src/components",
              from: ["./src/app", "./src/features"],
              message:
                "Shared components cannot depend on a route or feature. Move what they need into src/lib.",
            },
            {
              target: "./src/features",
              from: "./src/app",
              message: "Features are composed by routes, never the other way round.",
            },
            ...routeIsolation,
            ...featureIsolation,
          ],
        },
      ],

      // A component folder's index.ts is its public API.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/_components/*/*", "@/components/*/*", "@/features/*/components/*/*"],
              message:
                "Import a component through its folder's index.ts, not a deep path.",
            },
          ],
        },
      ],

      // fetch belongs in the HTTP client only. Reported everywhere, then
      // switched off for that one file below.
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Data goes through a data hook and the HTTP client." },
      ],
    },
  },
  {
    files: ["src/lib/api.ts"],
    rules: { "no-restricted-globals": "off" },
  },
  {
    // Vendored/generated code is owned elsewhere; linting it produces noise nobody acts on.
    ignores: ["src/vendor/**", "src/generated/**", ".next/**", "dist/**"],
  },
);
```

Add a `lint` script (for example `"lint": "eslint src"`) and wire it into CI
next to type checking.

A caveat worth stating plainly: `import/no-restricted-paths` reasons about file
paths, so it catches the structural violations and nothing else. It will not
notice a page that computes, or a value in state that should be derived. Those
stay on the human checklist. For richer element-type rules (e.g. "a `ui`
element may only import `ui`"), `eslint-plugin-boundaries` is the next step up.

## What a violation usually means

The useful habit is to read a boundary error as a *placement* question rather
than an import problem. Adding the import to an allowlist is almost always the
wrong fix.

| The error | What it usually means | The fix |
|---|---|---|
| `src/lib` imports from `src/components` | A React-shaped thing ended up in `lib`, or a pure thing is stuck in a component | Move the pure part down, leave the JSX up |
| Route/feature A imports route/feature B's private code | The component was never local | Promote it to `src/components/<kebab>/` |
| Deep import past `index.ts` | A sibling needs an internal, or the folder is doing two jobs | Export it from `index.ts`, or split the folder |
| `constants.ts` imported from elsewhere | The constant is shared | Move it to `src/lib/<subject>.ts` |
| `fetch` outside the HTTP client | The endpoint has no hook yet | Add the hook |
