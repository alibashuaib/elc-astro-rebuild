---
last_mapped_commit: ac55aef49355220178d0ae075fc1dac4a417ae78
last_mapped_at: 2026-11-04
---
# Codebase Concerns

**Analysis Date:** 2026-11-04

## Tech Debt

**Production deploy is disabled:**
- Issue: The only deploy workflow has every automatic trigger commented out and is `workflow_dispatch` only. A TODO notes that FTP secrets and the Hostinger `server-dir` path are unconfirmed.
- Files: `.github/workflows/deploy.yml`
- Impact: Nothing ships automatically from `main`. Google reviews baked at build time (`src/lib/googleReviews.ts`) go stale because the weekly cron is also disabled. The CMS webhook `repository_dispatch` path is not wired.
- Fix approach: Confirm `/public_html/` in hPanel, add `FTP_SERVER`/`FTP_USERNAME`/`FTP_PASSWORD` repo secrets, then restore the `push`, `repository_dispatch`, and `schedule` triggers.

**Placeholder D1 database id:**
- Issue: `placement-test-worker/wrangler.toml` sets `database_id = "00000000-0000-0000-0000-000000000000"`.
- Files: `placement-test-worker/wrangler.toml`
- Impact: A real `wrangler deploy` against this file will not bind to the production D1 database unless the id is overridden elsewhere. That needs verifying before any deploy.
- Fix approach: Confirm the production id is supplied by an environment-specific config or CI, and document where. Do not commit the real id if the team treats it as sensitive.

**Unpinned runtime dependency:**
- Issue: `bcryptjs` is pinned to `"latest"` in the Worker's `package.json`.
- Files: `placement-test-worker/package.json`
- Impact: `npm ci` with the lockfile is reproducible only until the lockfile is regenerated. Any fresh install can pull a new major version that changes hashing behavior.
- Fix approach: Pin to an exact version such as `"^3.0.x"` (check the version already in `package-lock.json`).

**Large monolithic client components:**
- Issue: `src/components/placement-test/TestRunner.astro` is about 1,294 lines and mixes rendering, state machine, and fetch calls in inline `<script>`.
- Files: `src/components/placement-test/TestRunner.astro`, `src/components/placement-test/AdminPanel.astro` (365 lines), `src/components/placement-test/RegistrationForm.astro` (315 lines)
- Impact: Changes to one question type risk regressions in others. Smoke tests are the only coverage for these scripts (see Test Coverage Gaps).
- Fix approach: Extract question-type renderers and the session state machine into separate modules under `src/lib/` before adding question types.

**Duplicated scoring and band logic across layers:**
- Issue: Band placement and level names live in `placement-test-worker/src/bands.ts`, `scoring.ts`, and `kids.ts`, with stage names also referenced in `src/lib/placementApi.ts` comments (`STAGE_NAMES_BY_TRACK`).
- Files: `placement-test-worker/src/bands.ts`, `placement-test-worker/src/scoring.ts`, `placement-test-worker/src/kids.ts`, `src/lib/placementApi.ts`
- Impact: Renaming a level requires edits in both the Worker and the client display logic.
- Fix approach: Have the Worker return display names in the `done` payload (it already returns `levelName`) and make the client display-only.

## Known Bugs

**Uncommitted work in progress in the working tree:**
- Symptoms: `git status` shows modifications in `src/components/CourseContentPanel.astro`, `src/components/WhatsAppButton.astro`, and `src/pages/[lang]/courses/[slug].astro` (15 insertions, 4 deletions). Git also warns about LF→CRLF conversion on these files.
- Files: `src/components/CourseContentPanel.astro`, `src/components/WhatsAppButton.astro`, `src/pages/[lang]/courses/[slug].astro`
- Trigger: Any build or commit that includes these files without review.
- Workaround: Treat as in-progress work. Do not assume it is complete. Normalize line endings (add a `.gitattributes`) before committing.

**Untracked runtime artifacts at repo root:**
- Symptoms: `preview.log` and `preview.pid` are untracked at the repo root. `.gitignore` does not list them.
- Files: `preview.log`, `preview.pid`
- Trigger: `astro preview` run in the background.
- Workaround: Add `preview.log` and `preview.pid` to `.gitignore`, or delete them after use.

**Login has no rate limiting:**
- Symptoms: `handleAdminLogin` in `placement-test-worker/src/routes/admin.ts` checks bcrypt on every request with no attempt counter, lockout, or delay. The `auth.ts` module has none either.
- Files: `placement-test-worker/src/routes/admin.ts`, `placement-test-worker/src/auth.ts`
- Trigger: Repeated POSTs to `/api/admin/login`. Each attempt also costs bcrypt CPU time on the Worker.
- Workaround: None in code. Relying on password strength only.

## Security Considerations

**Admin session cookie uses `SameSite=None` and is cross-site by design:**
- Risk: The admin panel on `elc.com.sa` calls the Worker on `*.workers.dev` with credentialed fetches. `SameSite=None; Secure` makes the cookie sent on cross-site requests. No CSRF token is used on state-changing admin routes (`POST`, `DELETE`, `PATCH` under `/api/admin/*`).
- Files: `placement-test-worker/src/auth.ts`, `placement-test-worker/src/index.ts`
- Current mitigation: CORS allowlist limited to `https://elc.com.sa` (plus loopback only when `LOCAL_DEV === 'true'`). `HttpOnly` and `Secure` flags are set.
- Recommendations: Add an Origin check on state-changing admin routes (reject if `Origin` is not in `ALLOWED_ORIGINS`), or require a custom header that a simple cross-site form cannot send.

**Session token is not server-revocable:**
- Risk: Admin sessions are stateless HMAC-signed `adminId.expires.sig` values. Removing an admin from `admin_users` or rotating credentials does not invalidate outstanding cookies until expiry (default 43,200 seconds, set in `placement-test-worker/wrangler.toml`).
- Files: `placement-test-worker/src/auth.ts`, `placement-test-worker/wrangler.toml`
- Current mitigation: Short-ish TTL (12 hours). Expiry is checked correctly after the NaN fix described in `auth.ts`.
- Recommendations: Store a session version per admin in D1 and compare it in `getSessionAdminId`, or reduce the TTL.

**CMS OAuth state is not validated:**
- Risk: `handleAuth` in `cms-oauth-worker/src/index.js` generates a random `state` but never checks it in `handleCallback`, so the OAuth flow is open to login CSRF. The requested scope `repo,user` grants broad write access to the CMS user's repositories.
- Files: `cms-oauth-worker/src/index.js`
- Current mitigation: Code comment says the tool is single-tenant and low-risk.
- Recommendations: Sign `state` (HMAC with a Worker secret) and verify it in `/callback`. Narrow scope if Decap supports it for the content repo.

**postMessage origin is taken from the request, not pinned:**
- Risk: `renderPostMessage` in `cms-oauth-worker/src/index.js` sends the token to `e.origin` of whichever window sends a message, after the opener sends `authorizing:github` to `'*'`.
- Files: `cms-oauth-worker/src/index.js`
- Current mitigation: The token is only sent to the opener window's `postMessage` handler on message receipt.
- Recommendations: Post the success message to the known CMS origin (`https://elc.com.sa`) rather than `e.origin`.

**`innerHTML` built from API data:**
- Risk: Admin and test UI build markup from strings with template literals. `src/components/placement-test/AdminPanel.astro` line 248 writes `<option value="${l}">${l}</option>`, and `src/components/SearchOverlay.astro` lines 59-62 interpolate content into `innerHTML`.
- Files: `src/components/placement-test/AdminPanel.astro`, `src/components/SearchOverlay.astro`, `src/components/placement-test/ResultBooking.astro` (line 81 clears, verify inserts), `src/components/placement-test/TestRunner.astro`
- Current mitigation: Values are mostly internal (levels, slot labels). Applicant-supplied names and emails are rendered in the admin application list (`applicationList.innerHTML` at `AdminPanel.astro` line 189), which is a stored-XSS path if values are not escaped.
- Recommendations: Use `textContent` or an escape helper for any user-supplied field before insertion in `AdminPanel.astro` and `TestRunner.astro`.

**Placement-test Worker has no request validation layer:**
- Risk: Route handlers call `req.json<...>()` and trust the shape. For example, `handleAdminCreateSlot` in `placement-test-worker/src/routes/admin.ts` accepts any `startsAt` string and `capacity` number, and `handleAdminLogin` accepts any username and password types.
- Files: `placement-test-worker/src/routes/admin.ts`, `placement-test-worker/src/routes/application.ts`, `placement-test-worker/src/routes/session.ts`
- Current mitigation: D1 prepared statements with bound parameters (`placement-test-worker/src/db.ts`) prevent SQL injection. No raw string interpolation into SQL was found.
- Recommendations: Validate bodies at trust boundaries (types, `capacity` integer range, ISO date format, email format for applications).

**Secrets handling (existence only):**
- `.env` and `placement-test-worker/.dev.vars` exist locally. Their contents were not read for this document. `.gitignore` covers `.env`. Confirm `.dev.vars` is ignored by `placement-test-worker/.gitignore` before committing.
- `ADMIN_COOKIE_SECRET`, `GITHUB_OAUTH_CLIENT_SECRET`, and `GOOGLE_PLACES_API_KEY` are required at runtime and must come from `wrangler secret put` or GitHub Actions secrets. None is hardcoded in tracked source.

## Performance Bottlenecks

**Client-side search index loaded in full:**
- Problem: `src/pages/[lang]/search-index.json.ts` generates a full JSON index that `src/components/SearchOverlay.astro` filters in the browser.
- Files: `src/pages/[lang]/search-index.json.ts`, `src/components/SearchOverlay.astro`
- Cause: Index is fetched whole and filtered per keystroke.
- Improvement path: Fine at current content volume. Add pagination or a build-time prebuilt index per language if the blog or course count grows.

**Bcrypt on the Worker for every admin login:**
- Problem: `bcryptjs` runs in the Worker's CPU budget on each login.
- Files: `placement-test-worker/src/auth.ts`
- Cause: Pure-JS bcrypt is slow by design.
- Improvement path: Keep cost factor modest and pair with the rate limiting noted above.

**Full-table reads in admin listings:**
- Problem: `listSlotsAll`, `listBookingsWithDetails`, and `listQuestions` in `placement-test-worker/src/db.ts` return all rows with no `LIMIT`.
- Files: `placement-test-worker/src/db.ts` (lines ~325, ~361, ~365)
- Cause: No pagination in admin routes.
- Improvement path: Add `LIMIT`/`OFFSET` or date-window filters once bookings and applications accumulate.

## Fragile Areas

**Question bank migrations are a long sequential chain:**
- Files: `placement-test-worker/migrations/0001_init.sql` through `0021_application_email_idtype.sql`
- Why fragile: Several later migrations rewrite seed rows (`0003_real_questions.sql`, `0006_fixed_sequential_order.sql`, `0016_fix_kids_letter_case_sensitivity.sql`, `0017`/`0018` illustrations, `0020_single_kids_number_activity.sql`). Changing question ordering or ids requires checking every earlier migration.
- Safe modification: Add a new migration numbered after `0021`. Do not edit applied migrations. `placement-test-worker/wrangler.toml` notes that a database migrated by the old per-file chain needs the `d1_migrations` table seeded before `migrations apply`.
- Test coverage: `placement-test-worker/src/scoring.test.ts` and `bands.test.ts` exist, but no test replays the full migration chain against an empty database.

**Smoke test depends on a hand-seeded slot:**
- Files: `.github/workflows/ci.yml` (step "Seed a bookable slot"), `tests/e2e/application.spec.ts`
- Why fragile: The slot id `e2e-smoke-slot` and starts-at `2027-01-01` are hardcoded. The slot will be treated as past after 2027-01-01 and the booking step will fail silently with "no slots".
- Safe modification: Compute the start time in the workflow step (for example, `date -u -d '+30 days'`).

**Start-of-run ordering for the Worker in CI:**
- Files: `.github/workflows/ci.yml` (job `placement-test-smoke`)
- Why fragile: The Worker is started with `&` and polled with `curl` for 90 seconds. Failure output is limited to a `tail` of two `/tmp` logs.
- Safe modification: Use `wrangler dev` with `--ip`/`--port` in the background step, and add `if: always()` to the log-upload step.

**Placement-test client depends on build-time env:**
- Files: `src/lib/placementApi.ts` (`import.meta.env.PUBLIC_PLACEMENT_API_URL`), `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- Why fragile: If the variable is unset, requests go to `undefined/api/session` and fail silently (noted in both workflow files). The value is also duplicated in `public/.htaccess` CSP `connect-src`.
- Safe modification: Fail the build when `PUBLIC_PLACEMENT_API_URL` is missing (add a check in `astro.config.mjs` or a prebuild script) and keep the CSP entry generated from the same constant.

**Admin session cookie parsing uses a regex built from a constant:**
- Files: `placement-test-worker/src/auth.ts` (line 47)
- Why fragile: The pattern is built with `new RegExp` and matches the first cookie named `elc_admin_session`. Duplicate cookies from other subdomains would be ambiguous.
- Safe modification: Use a small parser that splits on `;` and matches the exact name.

## Scaling Limits

**Single D1 database for all placement data:**
- Current capacity: One D1 database `placement-test` holds sessions, responses, slots, bookings, applications, and admin users.
- Limit: D1 has per-database size and throughput limits. `bookSlotAtomic` relies on `booked_count < capacity` checks; contention at slot release times is not load-tested.
- Scaling path: Load-test `bookSlotAtomic` under concurrent bookings. Keep slot capacity checks in a single conditional `UPDATE` (already the approach in `placement-test-worker/src/db.ts`).

**Build-time Google reviews:**
- Current capacity: Reviews are fetched once per build by `src/lib/googleReviews.ts` using `GOOGLE_PLACES_API_KEY`.
- Limit: Staleness grows between builds, and the scheduled rebuild is disabled (see Tech Debt).
- Scaling path: Re-enable the weekly `schedule` trigger in `.github/workflows/deploy.yml`, or fetch at runtime through a Worker with caching.

## Dependencies at Risk

**`bcryptjs` unpinned:**
- Risk: `"latest"` in `placement-test-worker/package.json`.
- Impact: Silent upgrade on lockfile regeneration; hashes from the old version must remain compatible.
- Migration plan: Pin to the version in `package-lock.json`.

**Astro major version in use:**
- Risk: `package.json` pins `astro` at `^7.2.4`, and `@astrojs/sitemap` at `^3.7.3`. Plugin compatibility with Astro 7 is not verified by any test in the repo.
- Impact: Build breaks on minor updates if the sitemap integration lags.
- Migration plan: Keep the lockfile committed and run `npm run build` in CI (already done in `.github/workflows/ci.yml`) before accepting upgrades.

**Node version floor:**
- Risk: `package.json` requires `node >=22.12.0` and CI uses Node 22. Local `preview.log` and `preview.pid` suggest a background preview process, unrelated to the Node floor.
- Impact: Low.

## Missing Critical Features

**No automated production deploy:**
- Problem: Pushes to `main` do not deploy the site (see Tech Debt).
- Blocks: Continuous delivery of content and fixes; the CMS save webhook cannot trigger a rebuild.

**No admin account management UI:**
- Problem: Admin users are rows in `admin_users`, seeded manually (tests show the insert pattern in `placement-test-worker/src/routes/admin.test.ts`). No route creates, disables, or rotates admins.
- Blocks: Staff offboarding without a direct D1 write.

## Test Coverage Gaps

**Client Astro scripts are covered only by smoke tests:**
- What's not tested: `TestRunner.astro` (question flow, skip logic, number-sequence activities), `AdminPanel.astro`, `RegistrationForm.astro`, `ResultBooking.astro`.
- Files: `src/components/placement-test/TestRunner.astro`, `src/components/placement-test/AdminPanel.astro`, `tests/e2e/placement-test.spec.ts`, `tests/e2e/application.spec.ts`
- Risk: Runtime faults in client scripts ship with green unit tests. The CI comment in `.github/workflows/ci.yml` records one such incident.
- Priority: High

**Course pages and Google reviews:**
- What's not tested: `src/pages/[lang]/courses/[slug].astro`, `src/components/CourseContentPanel.astro` (in-progress edits), `src/lib/googleReviews.ts` (null-path when keys are absent).
- Files: as listed.
- Risk: The in-progress course-page changes have no test. The no-key path is only exercised implicitly.
- Priority: Medium

**Worker tests use a fake D1:**
- What's not tested: `placement-test-worker/src/test-utils/fakeD1.ts` is hand-written. Real D1 semantics (for example, transactional behavior in `bookSlotAtomic`) are not exercised by unit tests.
- Files: `placement-test-worker/src/test-utils/fakeD1.ts`, `placement-test-worker/src/routes/booking.test.ts`
- Risk: Atomic booking and capacity races could pass unit tests and fail in production.
- Priority: High

**No tests for `cms-oauth-worker`:**
- What's not tested: `cms-oauth-worker/src/index.js` has no test file and no CI job.
- Files: `cms-oauth-worker/src/index.js`
- Risk: Changes to the OAuth flow would not be caught.
- Priority: Low (single-tenant tool), but the state-validation gap above argues for a test.

---

*Concerns audit: 2026-11-04*
