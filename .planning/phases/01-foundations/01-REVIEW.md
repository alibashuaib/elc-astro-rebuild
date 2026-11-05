---
phase: 01-foundations
reviewed: 2026-11-05T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - .gitattributes
  - .github/workflows/ci.yml
  - .gitignore
  - .npmrc
  - package.json
  - placement-test-worker/.npmrc
  - placement-test-worker/README.md
  - placement-test-worker/env.d.ts
  - placement-test-worker/package.json
  - placement-test-worker/src/http.ts
  - placement-test-worker/src/index.ts
  - placement-test-worker/src/malformed.test.ts
  - placement-test-worker/src/routes/admin.ts
  - placement-test-worker/src/routes/application.ts
  - placement-test-worker/src/routes/booking.ts
  - placement-test-worker/src/routes/session.ts
  - placement-test-worker/src/test-utils/fakeD1.ts
  - placement-test-worker/src/types.ts
  - placement-test-worker/test/apply-migrations.ts
  - placement-test-worker/test/migrations.test.ts
  - placement-test-worker/tsconfig.json
  - placement-test-worker/vitest.config.ts
  - playwright.config.ts
  - scripts/check-pins.mjs
  - src/components/CourseContentPanel.astro
  - src/components/WhatsAppButton.astro
  - src/pages/[lang]/courses/[slug].astro
  - tests/e2e/global-setup.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-11-05
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Reviewed the diff `2f0f80b..HEAD` for the listed files. The Worker side (readJson helper, BadRequestError mapping in `index.ts`, real-D1 test harness, truncate-between-tests hook) is sound: the error mapping sits inside the single try/catch that wraps every route, auth runs before body parsing on admin routes (the test confirms 401-before-400), and `handleAnswer` reads the body only after the session lookup. The intentional deletions (UD-01) leave no dangling references: `package.json` no longer has `dev:fallback`, and the comment in `types.ts` was updated.

Four real problems. The most important is that the local smoke suite overwrites `dist/` with a build that has `localhost:8787` baked in, which matters for a project that uploads `dist/` by hand. Necessity (#4100) was not assessed in this pass because the reference file was not loaded, so no `necessity:` count is emitted.

## Warnings

### WR-01: Smoke global-setup builds into `dist/` with `PUBLIC_PLACEMENT_API_URL=http://localhost:8787`

**File:** `tests/e2e/global-setup.ts:8-13` (also `:19`, `playwright.config.ts:673`)
**Issue:** `npm run smoke` and `npm run test:all` run `astro build` with the default `outDir` (`dist/`, gitignored). Whatever was in `dist/` is replaced by a build whose client JS calls `http://localhost:8787`. This project is local-first and the plan is to build locally and upload, so anyone who runs `test:all` and then uploads `dist/` ships a placement test and application form that call the visitor's own localhost. The failure is silent: pages render and only the API calls fail. CI is not affected, because CI builds fresh in each job.
**Fix:** Build the test copy somewhere else and preview from there.
```ts
// global-setup.ts
execFileSync(process.execPath, [astroBin, 'build', '--outDir', 'dist-e2e'], { ... });
const server = await preview({ root, outDir: 'dist-e2e', server: { port: 4322 } });
```
Add `dist-e2e/` to `.gitignore`.

### WR-02: Valid-JSON objects with missing or wrong-typed fields still produce 500 on unauthenticated login

**File:** `placement-test-worker/src/routes/admin.ts:16-17` (similar: `admin.ts:30`, `admin.ts:70`)
**Issue:** `readJson` only guarantees the body is a JSON object. `POST /api/admin/login` with `{}` gives `username === undefined`, and `getAdminByUsername` (`db.ts:320`) calls `.bind(undefined)`, which D1 rejects with `D1_TYPE_ERROR`. The result is a 500 plus a `console.error`. With `{"username":"x"}` the call reaches `bcrypt.compare(undefined, hash)` only if the user exists, and that throws too. Anyone can trigger server errors on the login endpoint. This is the same "malformed input becomes 500" class that plan 01-04 set out to remove, but the tests only cover non-object bodies. `createSlot` (`{}` gives an undefined bind) and `setQuestionActive` (undefined `active`) behave the same way, though they are behind auth. This predates the diff, but the new helper's doc comment and test names ("-> 400") suggest the class is closed when it is not.
**Fix:** Validate field types in the login handler (at minimum), for example:
```ts
if (typeof username !== 'string' || typeof password !== 'string') throw new BadRequestError('invalid_json');
```
Add `'{}'` to `BAD_BODIES` for login, or state in the `http.ts` comment that this is only a shape check.

### WR-03: Course-page chevron icon does not exist, and the CSS edited in this diff styles an empty SVG

**File:** `src/pages/[lang]/courses/[slug].astro:133` (CSS at `:282-283`); `src/components/Icon.astro:5-9`
**Issue:** `<Icon name="chevron-down" />` is used, but `chevron-down` is neither in the `name` union nor in the `paths` map. `paths['chevron-down']` is `undefined`, so the SVG renders `<path d>` with no data and the "View all intakes" button shows no chevron. The `svg` rotate rules touched by this diff (dropping `:global`, which is correct inside the `is:global` block) therefore animate nothing. The bug predates the diff, but the diff edits the exact rule that depends on it. `astro check` would also fail on the invalid prop.
**Fix:** Add `'chevron-down'` to the union and `'chevron-down': 'm6 9 6 6 6-6'` to `paths`.

### WR-04: CI jobs have no timeout, and the new global-setup shell-outs have none either

**File:** `.github/workflows/ci.yml` (all three jobs); `tests/e2e/global-setup.ts:8,20`
**Issue:** The smoke job now does a full `astro build`, a wrangler D1 write and a `wrangler dev` start inside Playwright's globalSetup and webServer. `execFileSync` has no `timeout`, and no job sets `timeout-minutes`. A hung `wrangler`, or a hung `workerd` start (the README says it prints a crash line on startup), will hold the runner for the 6-hour default. Playwright's 30s test timeout does not cover globalSetup.
**Fix:** Add `timeout-minutes: 15` to each job, and pass `timeout: 120_000` to both `execFileSync` calls.

## Info

### IN-01: `global-setup.ts` resolves paths from `process.cwd()`

**File:** `tests/e2e/global-setup.ts:5`
**Issue:** `const root = process.cwd()` breaks if Playwright is invoked from a subdirectory (for example `npx playwright test -c ../playwright.config.ts`). The `webServer.command` has the same cwd dependence on `--prefix placement-test-worker`.
**Fix:** `const root = path.resolve(import.meta.dirname, '../..')` (the repo already relies on `import.meta.dirname` in the worker config).

### IN-02: Pin policy has gaps that `check-pins` does not cover

**File:** `scripts/check-pins.mjs:9-10`; `.github/workflows/ci.yml:36`
**Issue:** The script checks only the four dependency sections. It skips `overrides` and `allowScripts`, and CI still runs `npx @lhci/cli@0.13.x` (a range) and uses floating `actions/*@v4` tags. The script's skip of `cms-oauth-worker` (`existsSync`) is speculative until that package exists, and the directory exists today without a `package.json`. This is low impact, but "exact pins" is the phase goal.
**Fix:** Pin `@lhci/cli` to an exact version (or add it to devDependencies). Optionally also scan `overrides`.

### IN-03: Test-harness details that will mislead later

**File:** `placement-test-worker/src/test-utils/fakeD1.ts:1-6`; `placement-test-worker/test/apply-migrations.ts:10`; `placement-test-worker/test/migrations.test.ts:7`
**Issue:** (a) `createFakeD1()` now returns one shared real binding. Tests such as `session.test.ts` `makeEnv()` and `env2` look like isolated databases but share one; this is fine because of the `beforeEach` wipe, but the name hides it. The file's comment also points at another branch ("feature/registration-wizard's"), which will go stale. (b) `KEEP = ['questions','passages',...]` means a future test that inserts or deactivates a question leaks into later tests in the same file. No current test does this. (c) The `>= 21` in `migrations.test.ts` is a magic number that needs a bump on every migration, and the next assertion already covers "all applied".
**Fix:** Rename when the registration-wizard branch is merged. Document the questions/passages caveat next to `KEEP`. Drop the hard-coded 21 in favour of `toBeGreaterThan(0)`.

---

_Reviewed: 2026-11-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
