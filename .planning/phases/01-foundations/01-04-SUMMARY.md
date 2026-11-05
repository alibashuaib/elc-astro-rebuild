---
phase: 01-foundations
plan: 04
subsystem: worker-api
tags: [json-parsing, input-validation, tdd, d1]

requires:
  - phase: 01-foundations/02
    provides: worker tests on real local D1 (createFakeD1 shim returning env.DB)
  - phase: 01-foundations/03
    provides: `npm run test:all` with check:pins
provides:
  - "FND-03: every worker route that reads a JSON body answers a malformed or non-object body with 400 {error:'invalid_json'}, never 500"
  - "placement-test-worker/src/http.ts: BadRequestError and readJson<T>(req)"
  - "Table-driven src/malformed.test.ts (4 student routes, 5 admin routes, 5 bad bodies each, control row, auth-first row)"
affects: [phase-03-wizard, phase-04-auth]

tech-stack:
  added: []
  patterns:
    - "Handlers throw BadRequestError; one catch line in index.ts maps it to a 400 before the logging/500 path"

key-files:
  created: [placement-test-worker/src/http.ts, placement-test-worker/src/malformed.test.ts]
  modified: [placement-test-worker/src/index.ts, placement-test-worker/src/routes/session.ts, placement-test-worker/src/routes/booking.ts, placement-test-worker/src/routes/application.ts, placement-test-worker/src/routes/admin.ts]

key-decisions:
  - "Each of the 9 call sites changed by one expression only (req.json<T>() -> readJson<T>(req)) so the Phase 3 wizard-branch merge re-applies trivially"

requirements-completed: [FND-03]

completed: 2026-11-05
status: complete
commits: 4
plan_head_before: 3bc3df8f2135b893315a80f1cd70bed5887a2456
plan_head_after: 9a21379ae9012437b76873836706fc4e82319030
actuals:
  tasks: 2
  commits: 4
---

# Phase 1 Plan 04: Malformed JSON returns 400 Summary

**One shared `readJson()` plus one catch line in `index.ts` turn empty, unparseable, `null`, array and string bodies into 400 `{"error":"invalid_json"}` on all 9 body-reading call sites.**

## Tasks

| Task | Result | Commits |
|------|--------|---------|
| 1. Student routes (session, answer, bookings, apply) | RED: 20 failed / 1 control passed; GREEN: 21 passed | 737a40b (test), a5d994a (feat) |
| 2. Admin routes (login, slots, questions x2, applications) | RED: 25 failed (auth-first row already passed); GREEN: all pass | 3201d08 (test), 9a21379 (feat) |

## Verification results

- `npm test --prefix placement-test-worker`: `Test Files 11 passed (11)`, `Tests 184 passed (184)`.
- `npm run typecheck --prefix placement-test-worker`: exit 0, no `error TS`.
- 0 non-comment `req.json` lines across the four route files (baseline 9); `admin.ts` imports from `'../http'`.
- UD-06 files (session.test.ts, application.test.ts, index.test.ts, tests/e2e/application.spec.ts): no commits since 1e299de, `git diff --quiet` clean.
- `npm run test:all`: exit 0 (check:pins, worker suite, typecheck, 13 Playwright tests passed).
- `git log`: `test(01-04)` immediately before `feat(01-04)` for both tasks.
- `graphify update .` run after code changes.

## Deviations from Plan

None - plan executed as written. Task 1's GREEN commit contains six paths (http.ts is new, plus index.ts and three route files), not the "five" the plan text says; the plan's own list of files names all six.

## Threat model

T-01-12 (fixed `invalid_json` string, no stack or request echo, no error log for client mistakes), T-01-13 (auth-first row: malformed body with no cookie gets 401) and T-01-14 (null/array/string rejected) are mitigated and covered by tests.

## Known Stubs

None.

## Self-Check: PASSED

http.ts, malformed.test.ts exist; commits 737a40b, a5d994a, 3201d08, 9a21379 are ancestors of HEAD.
