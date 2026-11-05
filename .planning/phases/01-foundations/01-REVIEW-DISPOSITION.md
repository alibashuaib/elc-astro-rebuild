---
phase: 01-foundations
source: 01-REVIEW.md
updated: 2026-11-05
open: 7
---

# Phase 01 code review disposition

Set a row to `fixed`, `skipped` or `deferred` by hand, with the reason in Source.

| ID | Severity | Disposition | Source |
|----|----------|-------------|--------|
| WR-01 | warning | open | Smoke build writes localhost API URL into dist/ (risk if dist/ is uploaded by hand after a smoke run) |
| WR-02 | warning | open | Login with `{}` still 500s; readJson checks object shape only (pre-existing) |
| WR-03 | warning | open | `chevron-down` icon missing from Icon.astro (pre-existing) |
| WR-04 | warning | open | No CI job timeouts / execFileSync timeouts |
| IN-01 | info | open | global-setup uses process.cwd() |
| IN-02 | info | open | check-pins gaps (overrides, floating action tags, speculative cms-oauth-worker entry) |
| IN-03 | info | open | Test-harness naming/magic number details |
