---
phase: 01-foundations
plan: 01
subsystem: testing
tags: [playwright, wrangler, d1, astro, ci, git]

requires: []
provides:
  - "`npm run test:all`: worker tests + typecheck, then Playwright smoke against Playwright-started local Worker and in-process preview"
  - "Smoke suite seeds its own slot `e2e-slot` at now+30 days in local D1"
  - "CI smoke job uses the same Playwright config"
  - "LF normalisation via .gitattributes; preview.log, preview.pid, .dev.vars ignored"
  - "User approval for first installs and the MOB-01 as-is commit"
affects: [01-02, 01-03, 01-04]

actuals:
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Playwright globalSetup builds site, seeds local D1 via execFileSync (no shell), serves dist with in-process astro preview()"

key-files:
  created: [tests/e2e/global-setup.ts, .gitattributes]
  modified: [package.json, placement-test-worker/package.json, playwright.config.ts, .github/workflows/ci.yml, .gitignore]

key-decisions:
  - "Phase 1 commits go on branch gsd/phase-01-foundations (user choice, 2026-11-05); main is protected"

requirements-completed: [FND-04, FND-05, FND-06]

coverage:
  - id: D1
    description: "One command runs worker tests and Playwright smoke green, twice back to back, no orphaned :4322"
    requirement: FND-06
    verification:
      - kind: e2e
        ref: "npm run test:all"
        status: pass
    human_judgment: false
  - id: D2
    description: "Smoke creates its own future slot; no 2027-01-01 slot left in local D1"
    requirement: FND-04
    verification:
      - kind: integration
        ref: "wrangler d1 execute placement-test --local: COUNT slots LIKE '2027-01-01%' = 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "git status clean of CRLF noise and preview/secret files"
    requirement: FND-05
    verification:
      - kind: other
        ref: "git check-ignore / git ls-files --eol / git diff --stat"
        status: pass
    human_judgment: false

completed: 2026-11-05
status: complete
---

# Phase 1 Plan 01: Local test bed Summary

**`npm run test:all` now proves the whole stack locally in one command, with the smoke suite booking a slot it creates 30 days ahead; git status is free of CRLF and preview-file noise.**

## Tasks

| Task | Result | Commit |
|------|--------|--------|
| 1. One-command suite + own future slot | Passed 3 runs (2026-11-04); static checks re-run 2026-11-05 | b2e3cd5 |
| 2. LF line endings + ignores | All verify checks pass | 17936c8 |
| 3. Checkpoint: package versions + mobile files | User replied "approved" 2026-11-05 | — |

## Checkpoint approval (Task 3)

User approved on 2026-11-05: the exact install versions listed in the plan (worker and root), and committing the three mobile files as-is.

MOB-01 approved diff hash: b4b2894291c3813a72dda6f4c6490d85ea7650d1
MOB-01 approved stat: 3 files changed, 15 insertions(+), 4 deletions(-)

## Deviations

- **Local D1 migration ledger fix (local only):** `d1_migrations` row id=20 name set to `0021_application_email_idtype.sql` so `db:migrate:local` stops re-applying it. No repo files changed; reversible by setting the name back.
- **Branch:** commits on `main` were refused by the protected-branch guard; execution paused overnight and resumed on `gsd/phase-01-foundations`.
- Task 1 executed by a subagent on 2026-11-04; Tasks 2-3 run inline on 2026-11-05.

## Legacy rows deleted from local D1 (step 6, for reversibility)

Deleted with `DELETE FROM bookings WHERE slot_id='e2e-smoke-slot'; DELETE FROM slots WHERE id='e2e-smoke-slot'` (local only).

Bookings:
```json
[
 {"id":"2c086e24-cf37-4829-ba0e-24e89a5da17b","session_id":"86c3d7bc-8822-46bd-a1a9-6465dadcba44","slot_id":"e2e-smoke-slot","status":"confirmed","created_at":"2026-09-08 15:51:02"},
 {"id":"3d5e6967-5740-4c49-94c9-89897ce29cca","session_id":"4e010c1b-7de1-430f-9e49-5f51da3719ad","slot_id":"e2e-smoke-slot","status":"confirmed","created_at":"2026-09-14 18:23:42"}
]
```
Slot:
```json
[{"id":"e2e-smoke-slot","starts_at":"2027-01-01T10:00:00.000Z","capacity":5,"booked_count":2}]
```

## Next

Plan 01-02: worker tests on real local D1 and the approved worker package versions.
