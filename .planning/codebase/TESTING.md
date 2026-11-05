---
last_mapped_commit: ac55aef49355220178d0ae075fc1dac4a417ae78
last_mapped_at: 2026-11-04
---
# Testing Patterns

**Analysis Date:** 2026-11-04

Two separate test stacks exist. They do not share config, and CI runs them as separate jobs (`.github/workflows/ci.yml`).

## Test Framework

**Site (root project):**
- Browser smoke tests: `@playwright/test` (`^1.62.1` in `package.json`).
- Config: `playwright.config.ts`. `testDir: ./tests/e2e`, `workers: 1`, `fullyParallel: false`, 30 s timeout, `baseURL` from `SMOKE_BASE_URL` (default `http://localhost:4321`).
- Performance, accessibility, and SEO budgets: Lighthouse CI, configured in `lighthouserc.json`, run in CI with `npx @lhci/cli@0.13.x autorun`.
- No unit test runner is configured at the root. Logic in `src/lib/` is covered only through the browser and build.

**Worker (`placement-test-worker/`):**
- Unit tests: `vitest` (`"test": "vitest run"` in `placement-test-worker/package.json`). The Vitest config file is not present in the repo; defaults apply.
- Cloudflare pool: `@cloudflare/vitest-pool-workers` is listed as a dev dependency but the test shim below does not use it (see Mocking).
- Type check: `npx tsc --noEmit` in `placement-test-worker/`, run in CI.

**Assertion Library:**
- Site: Playwright `expect`.
- Worker: Vitest `expect` (`import { describe, it, expect } from 'vitest';`).

**Run Commands:**
```bash
# Site (repo root)
npm run build                 # Astro build (no tests)
npm run smoke                 # playwright test (needs a running server or SMOKE_BASE_URL)
npx playwright test tests/e2e/placement-test.spec.ts   # single spec
npm run lhci                  # Lighthouse CI

# Worker (placement-test-worker/)
npm test                      # vitest run (all unit tests)
npx vitest run src/scoring.test.ts     # single file
npx tsc --noEmit              # typecheck
npm run db:migrate:local      # apply D1 migrations locally before manual testing
```

## Test File Organization

**Location:**
- Site: browser specs live in `tests/e2e/`, separate from `src/`.
- Worker: unit tests are co-located with the module they cover (`src/auth.ts` + `src/auth.test.ts`) or with the route (`src/routes/session.ts` + `src/routes/session.test.ts`).

**Naming:**
- Site: `<feature>.spec.ts` (`application.spec.ts`, `course-diagram.spec.ts`, `placement-test.spec.ts`).
- Worker: `<module>.test.ts`.

**Structure:**
```
tests/e2e/
  application.spec.ts        # full adult flow: placement test -> slot -> application
  course-diagram.spec.ts     # course diagram stages, en + ar
  placement-test.spec.ts     # kids placement test render + grading

placement-test-worker/src/
  auth.ts / auth.test.ts
  bands.ts / bands.test.ts
  kids.ts / kids.test.ts
  scoring.ts / scoring.test.ts
  index.ts / index.test.ts
  routes/
    admin.ts / admin.test.ts
    application.ts / application.test.ts
    booking.ts / booking.test.ts
    session.ts / session.test.ts
  test-utils/fakeD1.ts       # in-memory D1 shim
```

## Test Structure

**Worker suite organization:**
```typescript
import { describe, it, expect } from 'vitest';
import { issueSessionCookie, verifyAdminSession } from './auth';

function makeEnv(overrides: Record<string, unknown> = {}) {
  return { ADMIN_SESSION_TTL_SECONDS: '43200', /* ... */ ...overrides } as any;
}

describe('admin session cookies', () => {
  it('issues a cookie that verifies', async () => {
    const env = makeEnv();
    const cookie = await issueSessionCookie(env, 'a1');
    expect(await verifyAdminSession(requestWithCookie(cookie), env)).toBe(true);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['zero', '0'],
  ])('refuses to issue a cookie when the TTL is %s', async (_label, ttl) => {
    const env = makeEnv({ ADMIN_SESSION_TTL_SECONDS: ttl });
    await expect(issueSessionCookie(env, 'a1')).rejects.toThrow(/ADMIN_SESSION_TTL_SECONDS/);
  });
});
```

**Patterns:**
- `describe` per module or concern, `it` per behavior. Use plain-English sentences (`'all correct climbs to the top of the ladder and stays there'`).
- Use `it.each` for input matrices (config values, band edges).
- Bug-regression tests name the failure they prevent in a comment above the test (see `placement-test-worker/src/auth.test.ts`, the NaN-expiry case).
- Helpers such as `makeEnv()` and `requestWithCookie()` are defined at the top of the test file, not shared, unless they need the DB.

**Site E2E structure:**
```typescript
function failOnConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(`${err.name}: ${err.message}`));
  return errors;
}

test('...', async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  // ... steps ...
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
```
- Every E2E spec must end with the console-error assertion. The rationale is recorded in `tests/e2e/placement-test.spec.ts`: runtime faults in client scripts passed the build and unit tests.
- Select elements by role and label (`getByRole('button', { name: 'Start test' })`, `getByLabel('Full name')`). Use `#id` locators only for app-internal containers (`#placement-test-runner`, `#pt-options button`).
- Use `test.setTimeout(120_000)` for long multi-step flows.
- Adult flows loop with a bounded counter (`for (let i = 0; i < 100 && ...)`) rather than waiting on a fixed count.

## Mocking

**Worker framework:** Hand-rolled. No `vi.mock` for the DB.

**Database:** `placement-test-worker/src/test-utils/fakeD1.ts` is an in-memory `D1Database`-compatible shim backed by `better-sqlite3`. It:
- applies every file in `placement-test-worker/migrations/` in filename order,
- implements only `prepare().bind().run()/first()/all()` and `db.exec()`,
- is used only from tests. Production code keeps `Env.DB` typed as the real `D1Database`.

The file header explains why the real `workerd` runtime is not used here (it crashed in the sandboxed environment). If CI gets a working `workerd`, swap in `@cloudflare/vitest-pool-workers` as the comment describes.

**Env stubs:** Build a plain object cast to `Env` or `any` with only the fields the code path reads (`makeEnv()` in `auth.test.ts`).

**Crypto and cookies:** Tests run real HMAC signing and real `Request` objects. Do not stub `crypto.subtle`; the tests depend on it.

**Network (site):** The E2E specs hit the real built site and the real placement Worker (`PUBLIC_PLACEMENT_API_URL` is baked into the build). They do not mock the API.

**What to Mock:**
- The D1 database in Worker unit tests: use `fakeD1.ts`, not a hand-written fake per test.
- Environment bindings and secrets: pass a stub object.

**What NOT to Mock:**
- Password hashing (`bcryptjs`) and cookie signing: test the real code.
- The site's build pipeline or the placement API in E2E specs.
- Google Places API: the build-time fetch in `src/lib/googleReviews.ts` returns `null` when `GOOGLE_PLACES_API_KEY` or `GOOGLE_PLACE_ID` is unset. Tests and local builds rely on that path, not a mock.

## Fixtures and Factories

**Test data:**
- Worker: inline objects and literal sessions, applications, and slots, inserted through the route functions or `fakeD1`.
- Scoring and band tests use fixed answer sequences (`for (let i = 0; i < 10; i++) state = applyAnswer(state, true);` in `scoring.test.ts`).
- E2E uses fixed, obviously fake identities: `Smoke Test`, `0500000000`, `smoke-test@example.com`, ID `1234567890`. Keep new fixtures in this style. Never use real student data in fixtures.

**Location:**
- Worker shared helpers: `placement-test-worker/src/test-utils/`.
- Site: no shared fixture directory. Inline in each spec.

## Coverage

**Requirements:** None enforced. No coverage tool is configured in either project.

**View Coverage:** Not configured. To add it for the worker, use Vitest's built-in coverage (`npx vitest run --coverage`) after installing a provider.

## Test Types

**Worker unit tests (`placement-test-worker/src/**/*.test.ts`):**
- Scope: scoring, band placement, kids track, admin auth, route handlers, booking, applications.
- Approach: call exported functions and route handlers directly with `Request` objects and the fake D1.
- Run in CI on every PR (`placement-test-worker` job in `.github/workflows/ci.yml`).

**Site E2E smoke tests (`tests/e2e/*.spec.ts`):**
- Scope: placement test runner, adult placement-to-application flow, course diagram stages in English and Arabic.
- Approach: real browser (Playwright), real built site, real Worker. Console errors fail the test.
- Run manually with `npm run smoke` against a running build. CI's `build-and-audit` job runs the build and Lighthouse only; the Playwright specs are not wired into CI.

**Lighthouse CI (site):**
- Budgets in `lighthouserc.json` gate the build job in CI.

**Integration Tests:**
- Covered by the E2E specs against the live Worker. No separate integration suite.

## Common Patterns

**Async testing (Worker):**
```typescript
it('issues a cookie that verifies', async () => {
  const cookie = await issueSessionCookie(env, 'a1');
  expect(await verifyAdminSession(requestWithCookie(cookie), env)).toBe(true);
});
```

**Error and rejection testing (Worker):**
```typescript
await expect(issueSessionCookie(env, 'a1')).rejects.toThrow(/ADMIN_SESSION_TTL_SECONDS/);
```
- For route handlers, assert on status and JSON body: `expect(res.status).toBe(409); expect(await res.json()).toEqual({ error: 'already_applied' });`.

**Browser assertions (site):**
```typescript
await expect(page.locator('#pt-progress')).toContainText('1 / 35');
await expect(diagram.locator('.progression-card')).toHaveCount(16);
await expect(resultCard).toBeVisible({ timeout: 20_000 });
```
- Use `toHaveCount` and `toContainText` for content. Use `toBeVisible` with a timeout for anything created at runtime.
- For CSS that must apply to runtime-created DOM, assert rendered size (`boundingBox()`), not just the class. Both `placement-test.spec.ts` and the kids test rely on this, because unstyled controls passed earlier checks.

**Error testing (E2E):**
- Expected failures are asserted by visible text or role, not by swallowing errors. Use `.catch(() => {})` only inside the bounded adult-flow loop, where a missing control is a normal state.

## Gaps

- No unit tests for `src/lib/` (`googleReviews.ts`, `schema.ts`, `placementApi.ts`) or for `src/i18n/`.
- `cms-oauth-worker/` has no test script.
- Playwright specs are not run in CI.
- No coverage reporting.

---

*Testing analysis: 2026-11-04*
