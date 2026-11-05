---
phase: 01-foundations
plan: 03
subsystem: testing
tags: [npm-pins, check-pins, ci, mobile]

requires:
  - phase: 01-foundations/01
    provides: approved install versions and MOB-01 approved diff hash/stat; `npm run test:all` harness
  - phase: 01-foundations/02
    provides: exact worker pins (scanned by the pin check)
provides:
  - "MOB-01: the user's three mobile files committed byte-for-byte as approved"
  - "Exact root pins (astro 7.2.4, @astrojs/sitemap 3.7.3, @playwright/test 1.64.1) + root .npmrc save-exact"
  - "`npm run check:pins` (scripts/check-pins.mjs), first step of `npm run test:all` and CI build-and-audit"
affects: [01-04]

tech-stack:
  added: []
  patterns:
    - "node:fs-only pin checker; skips folders without package.json (cms-oauth-worker until Phase 5)"

key-files:
  created: [scripts/check-pins.mjs, .npmrc]
  modified: [package.json, package-lock.json, .github/workflows/ci.yml, src/components/CourseContentPanel.astro, src/components/WhatsAppButton.astro, "src/pages/[lang]/courses/[slug].astro"]

key-decisions:
  - "check:pins step added only to the build-and-audit CI job (root install); the worker jobs do not have the script"

requirements-completed: [MOB-01, FND-01, FND-06]

completed: 2026-11-05
status: complete
commits: 2
plan_head_before: 9d084bd1c30914e69cec9c2a3ba68495941f3eb1
plan_head_after: 06a7f2f5c5ede59227bcf7f6934f914e4cc74f44
actuals:
  tasks: 2
  commits: 2
---

# Phase 1 Plan 03: MOB-01 and exact root pins Summary

**The user's mobile tweaks are in history exactly as approved, root installs are exact and reproducible, and `npm run test:all` now starts with a pin check that fails on any `^`, `~` or `latest`.**

## Tasks

| Task | Result | Commit |
|------|--------|--------|
| 1. MOB-01 mobile files | Pre-commit hash/stat matched; post-commit hash and stat matched; exactly 3 paths; build OK | d24f449 |
| 2. Exact root pins + check:pins | `npm ci` from deleted node_modules OK; pin check green and red on sample; test:all green twice | 06a7f2f |

## Verification results

- MOB-01 pre-commit: diff hash `b4b2894291c3813a72dda6f4c6490d85ea7650d1`, stat `3 files changed, 15 insertions(+), 4 deletions(-)` both matched the lines in 01-01-SUMMARY.md before staging.
- MOB-01 post-commit (d24f449): hash and stat of `C^..C` for the three paths equal the approved values; `git show --name-only` lists exactly the three paths; `git status` outside `.planning` empty; `npm run build` exit 0 (40 pages).
- `rm -rf node_modules && npm ci && npx playwright install chromium`: no `npm error`; Chromium headless shell v1248 installed.
- `npm ls`: astro@7.2.4, @astrojs/sitemap@3.7.3, @playwright/test@1.64.1.
- `npm run check:pins` exit 0 on the repo; on a temp package.json with `^1.0.0`, `~2.0.0`, `latest` it exits 1 with one "is not an exact version" line for each of dependencies.a, dependencies.b, devDependencies.c.
- `npm run test:all` twice in a row: exit 0 both times (137 worker tests, 13 Playwright tests); `:4322` not LISTENING afterwards; `git status --porcelain` empty after the commit.

## Deviations from Plan

**1. [Rule 1 - Bug, self-caused] First CI edit hit three `npm ci` lines**
- **Found during:** Task 2 step 5
- **Issue:** My sed added `npm run check:pins` after every `- run: npm ci` (including the worker jobs, which have no such script).
- **Fix:** Reverted ci.yml (my own uncommitted edit) and added the step only to build-and-audit, per plan. Final diff: one added line.
- **Commit:** 06a7f2f

No other deviations. `npm install` reported 10 audit vulnerabilities (1 moderate, 8 high, 1 critical) in the root tree; out of scope for this plan, not addressed.

## Open end-of-phase human check

After your next push (or PR), open the GitHub Actions run: build-and-audit (with check:pins), placement-test-worker and placement-test-smoke should all be green. The new smoke orchestration and pin step have never run on Ubuntu; nothing was pushed (accepted risk T-01-11).

## Known Stubs

None.

## Next

Plan 01-04.

## Self-Check: PASSED

Commits d24f449 and 06a7f2f exist on gsd/phase-01-foundations; scripts/check-pins.mjs and .npmrc present.
