---
phase: 01-foundations
plan: 02
subsystem: testing
tags: [vitest, cloudflare, workerd, d1, npm-pins]

requires:
  - phase: 01-foundations/01
    provides: approved install versions; `npm run test:all` harness
provides:
  - "Worker tests run in workerd on a real local D1 that replays all 21 migrations per test file"
  - "Exact worker pins + .npmrc save-exact; single wrangler 4.157.0"
  - "createFakeD1() shim returning env.DB; dead local fallback deleted"
affects: [01-03, 01-04, phase-03, phase-04, phase-06]

tech-stack:
  added: ["@cloudflare/vitest-plugin 1.5.1"]
  removed: ["better-sqlite3", "@types/better-sqlite3", "@cloudflare/vitest-pool-workers"]
  patterns:
    - "Global beforeEach reads sqlite_master and empties all tables except questions/passages/d1_migrations"

key-files:
  created:
    - placement-test-worker/vitest.config.ts
    - placement-test-worker/env.d.ts
    - placement-test-worker/.npmrc
    - placement-test-worker/test/apply-migrations.ts
    - placement-test-worker/test/migrations.test.ts
  modified:
    - placement-test-worker/package.json
    - placement-test-worker/package-lock.json
    - placement-test-worker/tsconfig.json
    - placement-test-worker/src/test-utils/fakeD1.ts
    - placement-test-worker/src/types.ts
    - placement-test-worker/README.md
  deleted:
    - placement-test-worker/scripts/local-dev.ts
    - placement-test-worker/scripts/vite.local.config.ts

key-decisions:
  - "placement-test-worker/package.json gets \"type\": \"module\" because @cloudflare/vitest-plugin is ESM-only"

requirements-completed: [FND-01, FND-02]

duration: 25min
completed: 2026-11-05
status: complete
commits: 2
plan_head_before: 96e9cf3073a55039125e0fbd92f04c4281165c98
plan_head_after: c65e976300c9e5b4ce0c8cbcbe6196c70e363d9b
actuals:
  tasks: 2
  commits: 2
---

# Phase 1 Plan 02: Worker tests on real local D1 Summary

**Worker tests now run inside workerd on a real local D1 rebuilt from all 21 migrations, installed from exact pins; the sqlite shim, deprecated pool and dead local fallback are gone.**

## Tasks

| Task | Result | Commit |
|------|--------|--------|
| 1. Real local D1 + exact worker pins | 10 test files / 137 tests pass, typecheck clean, single wrangler 4.157.0 | 31eaeee |
| 2. Remove dead fallback, fix docs | `npm run test:all` green (137 worker tests + 13 Playwright) | c65e976 |

## Verification results

- `npm ci --prefix placement-test-worker` from deleted node_modules: success, 0 vulnerabilities.
- `npm test --prefix placement-test-worker`: `Test Files 10 passed (10)`, `Tests 137 passed (137)`.
- `npm run typecheck --prefix placement-test-worker`: exit 0.
- Pin check: 0 matches for `better-sqlite3|vitest-pool-workers|"latest"`; `.npmrc` is `save-exact=true`; `npm ls --all wrangler` shows only 4.157.0.
- UD-06 files and wrangler.toml: no commits or diffs since 1e299de.
- `git diff --numstat 1e299de -- placement-test-worker/src/types.ts` = `1 1`.
- `npm run test:all`: exit 0, 13 Playwright tests passed, no listener left on 4322/8787.
- Outside `.planning/`, `git status` lists only the user's three mobile files (` M`).

## Deviations from Plan

**1. [Rule 3 - Blocking] Added `"type": "module"` to placement-test-worker/package.json**
- **Found during:** Task 1 first `npm test`
- **Issue:** Vitest failed to load `vitest.config.ts` ("@cloudflare/vitest-plugin is ESM only but was tried to load by require"); the worker package had no `type` field.
- **Fix:** Added `"type": "module"`. The package has no .js/.cjs files (only .ts/.sql), so nothing else is affected. Kept the plan's `vitest.config.ts` filename.
- **Commit:** 31eaeee

**2. README: kept the unrelated "Recommendation (SameSite cookie / custom route)" paragraph** that sat inside the old Testing Setup section; only the sandbox, shim-validation and smoke text was rewritten.

## Notes

- Test output prints "Using secrets defined in .dev.vars" (wrangler config read); the explicit `miniflare.bindings` (`ADMIN_COOKIE_SECRET: 'test-secret'`) take precedence, so tests do not depend on the secret's value.
- Phase 3 merge note recorded in c65e976: `feature/registration-wizard` edits `scripts/local-dev.ts`; resolve the modify/delete conflict by keeping the deletion.
- npm 12 prints blocked install-script warnings for esbuild/workerd; harmless (Pitfall 7).

## Known Stubs

None.

## Next

Plan 01-03: root pins, `check:pins`, and committing the user's three mobile files (MOB-01).

## Self-Check: PASSED

Commits 31eaeee and c65e976 exist on gsd/phase-01-foundations; all created files present; scripts/local-dev.ts and scripts/vite.local.config.ts absent.
