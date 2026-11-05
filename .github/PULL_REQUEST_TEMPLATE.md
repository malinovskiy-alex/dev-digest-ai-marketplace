## What changed

## Checklist

- [ ] `claude plugin validate . --strict` passes
- [ ] `version` bumped and `CHANGELOG.md` updated for every changed plugin (`node scripts/release.mjs <plugin> <bump> --note "..."`)
- [ ] Marketplace entry `name` matches `plugin.json` `name`
- [ ] Plugin README lists components, hooks and network calls
- [ ] No hardcoded secrets
