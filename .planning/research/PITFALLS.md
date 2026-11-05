# Pitfalls Research

**Domain:** Hardening and finishing a bilingual (AR RTL / EN) Astro static site with Cloudflare Workers + D1 and a Decap/GitHub-OAuth CMS. The site holds applicant PII (national ID, Iqama, passport, guardian data).
**Researched:** 2026-11-04
**Confidence:** MEDIUM-HIGH. Code-derived findings (I read `auth.ts`, `index.ts`, `cms-oauth-worker/src/index.js`, `db.ts`, `fakeD1.ts`, `wrangler.toml`, `.htaccess`, `public/admin/index.html`, `playwright.config.ts`, the CI seed step) are HIGH. Platform-behaviour claims (Safari cookie blocking, Workers CPU limits, rate-limit binding semantics, D1 transactions) come from established knowledge and were not re-verified against live docs this session. They are tagged MEDIUM and each needs a 10-minute docs check in its phase.

This file builds on `.planning/codebase/CONCERNS.md`. It does not repeat the concerns. It covers what usually goes wrong when you fix them, plus things CONCERNS.md missed.

Phase names below are suggestions, so rename them to match the roadmap:
- **P-ADMIN**: admin auth hardening
- **P-CMS**: CMS OAuth
- **P-TEST**: test and CI infrastructure
- **P-DB**: D1 and placement-test end to end
- **P-FORMS**: application and registration wizard
- **P-RTL**: mobile and RTL polish
- **P-REVIEW**: design review

---

## Critical Pitfalls

### Pitfall 1: The "SameSite=None cookie plus Origin check" fix leaves admin broken in Safari (and fragile everywhere)

**What goes wrong:**
The admin panel runs on `elc.com.sa`. The Worker runs on `placement-test-worker.alibashuaib90.workers.dev`. That is a cross-site, third-party cookie. Safari/ITP blocks third-party cookies by default, even with `SameSite=None; Secure`. Login returns 200, the `Set-Cookie` is dropped, and every later `/api/admin/*` call returns 401. Firefox partitions the cookie (CHIPS-style), which works but is fragile. Chrome currently allows it. The team adds an Origin check, sees "works in Chrome", and ships. Any staff member on an iPhone or Mac Safari is locked out.

**Why it happens:**
The code comment in `auth.ts` correctly says `SameSite=None` is "required", so people treat the architecture as fixed and only patch CSRF on top. The real fix is to remove the cross-site relationship, and that is architectural.

**How to avoid:**
- Decide early, not at the end. The best fix is to serve the Worker from a same-site hostname such as `api.elc.com.sa`, via a Workers Custom Domain. Then use `SameSite=Lax` (or `Strict`) plus `__Host-`/`__Secure-` prefix, and the CSRF problem mostly disappears.
- This requires `elc.com.sa` DNS to be on Cloudflare, or at least a delegated subdomain. DNS is currently on Hostinger and the cutover is out of scope. So this is a real dependency.
- Make an explicit decision with the user: (a) delegate `api.` to Cloudflare now, or (b) accept the cross-site design and document "admin supported on Chromium/Firefox only, not Safari". Do not leave it implicit.
- Alternative: switch to a bearer token. The login response returns a token stored in `sessionStorage` and sent in an `Authorization` header. That removes cookies and CSRF entirely, but makes token theft via XSS the main risk. That reinforces the XSS fix (Pitfall 4) and strictness of CSP.
- If staying cross-site: the Origin check is necessary but not sufficient (see Pitfall 2). Add the cookie `Partitioned` attribute for Firefox/Chrome future-proofing.
- Add a Playwright WebKit project that logs into admin against the real Worker (see Pitfall 11).

**Warning signs:**
Login "succeeds" but the panel immediately shows the login screen again. Works for the developer on Chrome, fails on the secretary's iPhone. No `WebKit` project in `playwright.config.ts`.

**Phase to address:** P-ADMIN, first plan, as a decision gate. Everything else in admin depends on it.

---

### Pitfall 2: CSRF fix that is bypassable, or that breaks CORS preflight

**What goes wrong:**
Four distinct failure modes:
1. **Content-type bypass.** `handleAdminLogin` and the admin handlers call `req.json()`, which parses regardless of `Content-Type`. A cross-site `<form enctype="text/plain">` (a "simple request", with no preflight) can deliver a JSON-shaped body. If the cookie is attached (`SameSite=None`), that is full CSRF with no CORS involvement. Adding CORS headers does not stop it, because CORS only governs reading responses.
2. **Origin check done wrong.** Common mistakes: `origin.includes('elc.com.sa')` (matches `elc.com.sa.evil.com`), `startsWith`, allowing a missing `Origin`, or treating `Origin: null` as OK. Also the Origin check is added to `/api/admin/*` but the PATCH/DELETE routes for applications/questions are forgotten, since routes are a flat array.
3. **Custom-header fix breaks preflight.** The CONCERNS.md recommendation of "require a custom header" is correct. But `withCors` sets `access-control-allow-headers: content-type` only. Add `X-Requested-With` or `X-CSRF` on the client and the preflight rejects it, so every admin call fails with an opaque CORS error. In addition, the fallback in `withCors` returns `ALLOWED_ORIGINS[0]` even for disallowed origins. Harmless today, but confusing when debugging.
4. **Tests can't see it.** Unit tests call `worker.fetch(new Request(...))` directly. There is no browser, no preflight, no cookie jar. The tests pass while the real thing is broken.

**Why it happens:**
CSRF defence is a rule that has to hold across every state-changing route, and the route table has an `admin: true` flag but nothing enforces policy centrally by method.

**How to avoid:**
- Enforce centrally in the dispatcher in `index.ts`: for any `route.admin` and method not in `GET/HEAD/OPTIONS`, require all of: `Content-Type: application/json` exact, `Origin` strictly equal to an allowed origin (a Set lookup, not substring), and optionally `Sec-Fetch-Site` in `same-origin|same-site` when present. Reject with 403 before the handler.
- Apply the same check to `POST /api/admin/login` (login CSRF).
- If adding a custom header, add it to `access-control-allow-headers` in the same commit, and add a Playwright test that makes a real credentialed call.
- Write negative tests: no Origin, `Origin: null`, `Origin: https://elc.com.sa.evil.com`, `text/plain` content type, for each mutating admin route (table-driven over `ROUTES.filter(r => r.admin && r.method !== 'GET')` so new routes are covered automatically).

**Warning signs:**
The CSRF check lives inside individual handlers. A new admin route can be added without it. Tests only cover the happy path with `Origin: https://elc.com.sa`.

**Phase to address:** P-ADMIN.

---

### Pitfall 3: Login rate limiting that doesn't actually limit, or that locks the admin out

**What goes wrong:**
- **Workers Rate Limiting binding semantics (MEDIUM, verify):** it is per Cloudflare location, eventually consistent, and only supports short periods (10 s or 60 s). It is a soft throttle, not a counter. An attacker spread across locations or IPs gets many more tries than the nominal limit. It cannot enforce "5 failures per hour".
- **Keyed by IP only:** a botnet or IPv6 rotation walks past it. **Keyed by username only:** an attacker locks the real admin out (DoS) by failing on purpose. Keying on `CF-Connecting-IP` is fine, but behind any proxy you must not trust `X-Forwarded-For`.
- **D1 counter race:** a read-then-write counter (`SELECT attempts`, then `UPDATE`) lets parallel requests all pass. Needs a single atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`.
- **Throttle placed after bcrypt:** the expensive compare has already burned CPU. Throttle must run first.
- **User enumeration by timing:** `handleAdminLogin` skips bcrypt entirely when the username does not exist. Response time reveals valid usernames. Always compare against a dummy hash.
- **Counter never resets on success**, or the lockout has no expiry, so one typo streak locks the account until someone edits D1 (and there is no admin-management UI).
- **bcryptjs on Workers CPU limits (MEDIUM, verify):** Free-plan Workers have a ~10 ms CPU limit. Pure-JS bcrypt at cost 10 takes far longer. Unit tests (Node, no CPU limit) pass, and production login fails with Worker exceeded CPU limit (error 1102). If the Worker is on the free plan, this is a showstopper. Options: paid plan, a lower cost (weaker), or WebCrypto PBKDF2 (capped at 100,000 iterations in workerd). Changing the hash scheme needs verify-old, rehash-on-login, and a `scheme` marker, or all admins are locked out.
- **Never raw `req.json()` for login:** non-string `username`/`password` throws, which becomes a 500 and logs. Validate types first.

**How to avoid:**
Layer it: (1) Rate Limiting binding as a cheap first gate by IP, (2) a D1 `login_attempts` table with an atomic upsert by (username, IP window) for the real lockout, with exponential or capped backoff, expiry, and reset on success, (3) the same 401 body and timing for unknown user versus wrong password. Add a one-off real-deploy test of login in the actual plan's CPU limits before calling P-ADMIN done.

**Warning signs:**
Login test uses a hash with a very low cost. No test for unknown-user timing. `wrangler.toml` has no rate limit binding and no `login_attempts` migration. Nobody has deployed and logged in on the real Worker.

**Phase to address:** P-ADMIN (design), verified in P-DB (first real deploy).

---

### Pitfall 4: Fixing XSS in `AdminPanel` only where the grep points

**What goes wrong:**
CONCERNS.md names `applicationList.innerHTML` (line ~189) and the `<option>` line. Teams fix those two, ship, and miss the rest: `TestRunner.astro` (9 `innerHTML` sites across `placement-test/*.astro`), `SearchOverlay.astro`, `ResultBooking.astro`. More dangerous are indirect sinks: `insertAdjacentHTML`, `outerHTML`, `setAttribute('href'/'src'/'onclick', userValue)`, `a.href = 'javascript:...'`, template literals feeding `innerHTML` through a helper, and Astro's `set:html`. Also:
- **A hand-rolled `esc()` that only handles `<` and `&`:** it misses `"` and `'`, so attribute-context injection (`value="${name}"`) still works.
- **Wizard fields multiply the surface:** the registration wizard adds a four-part name, nationality, guardian name, and "how did you hear" free text. The admin list line in the spec is a template string concatenating `student_name`, `phone`, `nationality`, `id_number`. Each is attacker-controlled by any visitor submitting the public form, with no auth, so stored XSS fires in the admin session, which holds the token for all applicant PII.
- **Escaping on the server instead of at render** corrupts data (`&amp;` stored) and still misses other contexts.
- **CSP does not save you here:** `.htaccess` has `script-src 'self' 'unsafe-inline' https://unpkg.com ...`. `unsafe-inline` means CSP will not block inline-handler XSS, so do not count on it.

**How to avoid:**
- Ban the sink, not the instances. Build admin DOM with `createElement` + `textContent` (the pattern already used for slots on lines 142 and 167). Add an ESLint rule `no-unsanitized/property` (or a simple grep CI check) that fails on `innerHTML|insertAdjacentHTML|outerHTML` in `src/components/**` unless the line has an explicit `// safe:` marker.
- Add a regression test: submit an application whose name is `"><img src=x onerror=window.__xss=1>` and assert in Playwright, on the admin page, that `window.__xss` is undefined and the text renders literally. Run it for every field the admin list displays.
- For href/src values from data, validate the scheme (`https:`/`tel:`/`mailto:` allowlist).
- Longer term, tighten the admin page's CSP (no `unsafe-inline`) if Astro's output allows. Otherwise note it as accepted.

**Warning signs:**
`grep -n "innerHTML" src` still returns hits that interpolate `${...}`. No XSS-payload test fixture exists.

**Phase to address:** P-ADMIN (before any wizard fields land in the admin list). Re-check in P-FORMS when the list line changes.

---

### Pitfall 5: Session revocation implemented in a way that doesn't revoke, or that locks everyone out

**What goes wrong:**
- **Logout only clears the cookie client-side.** There is currently no logout route at all (I found none). Adding `Set-Cookie: ...; Max-Age=0` "logs out" the browser, but a stolen cookie still works until expiry. That is the very threat model.
- **The cookie attributes on the clearing header don't match** (`Path`, `SameSite=None`, `Secure`, `Partitioned`), so the browser does not delete it.
- **Per-admin `session_version` revokes everyone at once.** That is fine for a 1–3 person staff but means logging out on the phone kills the laptop session. Better: a `sessions` table (random 128-bit id, `admin_id`, `expires_at`, `revoked_at`), cookie holds only the id.
- **Migrating the cookie format** breaks all live sessions at deploy, which is acceptable, but old-format cookies must be rejected, not crash `split('.')`.
- **Check ordering:** if the D1 lookup happens before the HMAC check, anyone can trigger DB reads with garbage cookies. Verify the signature first (it is already constant-time), then hit D1.
- **No way to revoke without D1 shell access** (no admin management UI) means "revocable" exists only on paper. A minimal `wrangler d1 execute` runbook is required.
- **Duplicate cookie names** (flagged in CONCERNS.md) matter more once `__Host-` prefix and domain cookies exist.

**How to avoid:**
Server-side session rows with a revoked flag, logout route that sets `revoked_at` and clears the cookie with matching attributes, `getSessionAdminId` checks D1, expired rows purged opportunistically. Test: log in, copy the cookie, call logout, replay the copied cookie, expect 401. Document the revoke-everything lever: rotating `ADMIN_COOKIE_SECRET`.

**Warning signs:**
Logout test only asserts the `Set-Cookie` header. No test replays an old cookie.

**Phase to address:** P-ADMIN.

---

### Pitfall 6: CMS OAuth "state validation" that doesn't bind to the browser, and gotchas in the fix itself

**What goes wrong:**
- **Signed state without a cookie binding is still login-CSRF-able.** An attacker can fetch a valid signed `state` from `/auth` themselves and feed it to a victim. State must be bound to the initiating browser: set a short-lived `HttpOnly; Secure; SameSite=Lax` cookie containing the nonce in `/auth` and compare it (constant time) in `/callback`, then clear it.
- **`Response.redirect()` returns immutable headers** (MEDIUM), so you cannot append `Set-Cookie` to it. The first attempt at the fix throws. Build `new Response(null, {status: 302, headers: {Location, 'Set-Cookie': ...}})`.
- **The postMessage origin.** The popup HTML does `window.opener.postMessage(msg, e.origin)` where `e.origin` is whatever origin sent the first message. Any page that opened the popup (or any frame) receives the GitHub token. Pin to a constant: check `e.origin === 'https://elc.com.sa'` before replying and pass that constant as `targetOrigin`. Keep the `'authorizing:github'` handshake to `'*'`, which carries no secret, but never the token.
- **Do not pin `targetOrigin` to a wrong value.** Decap runs at `https://elc.com.sa/admin/`, and the origin is scheme+host only (no path, no trailing slash). A wrong string makes `postMessage` silently drop, and the popup hangs on a blank page.
- **Token in the HTML:** `JSON.stringify(message)` embedded into a `<script>` without escaping `</script>` or `<!--`. Today the content is token and provider so it is low risk, but the error branch passes `tokenData.error_description` (GitHub-controlled text). Escape `<` as `<` when embedding.
- **Add `Cache-Control: no-store`** and `Referrer-Policy: no-referrer` on the callback response (the token is in the body).
- **Scope:** `repo,user` is broader than needed. For a public repo, `public_repo` is enough. Drop `user` (Decap works without it). `repo` also grants access to every private repo of that user. The sharper control is on the GitHub side: restrict the CMS login to a dedicated bot/collaborator account with access to only this repo, rather than staff's personal accounts. A scope cannot restrict by repository on an OAuth App. Evaluate whether a fine-grained GitHub App is feasible. If not, document the residual risk.
- **Non-technical staff need GitHub accounts with write access** for Decap's GitHub backend (`editorial_workflow` opens PRs). "Staff can log in and edit reliably" is as much an access-management task as a code task.
- **`public/admin/index.html` loads Decap from `https://unpkg.com/decap-cms@^3.0.0/...`**: a floating semver range, no integrity hash, on the page that holds a `repo`-scope token. A compromised or buggy 3.x release runs with write access to the repo. Pin an exact version and add SRI, or self-host via npm so it is in the lockfile. This is the same class of problem as `latest` deps and is not in CONCERNS.md.
- **`config.yml` `base_url` and the CSP `connect-src` hard-code `elc-cms-oauth.alibashuaib90.workers.dev`** in two places. A Worker rename silently breaks the CMS, because CSP failures show only in the console.
- **CMS editing and Astro content schemas:** staff saving a field Decap writes differently from the Zod schema (empty string versus missing, date formats) breaks `astro build`. This hits the "edit reliably" requirement. Validate by saving a real entry through the CMS to a branch and building it.

**How to avoid:**
Cookie-bound HMAC state, immutable-header-safe redirect, constant `targetOrigin`, exact scope review, exact-pinned self-hosted Decap, and tests in `cms-oauth-worker` (there are none; CONCERNS.md rates it Low, but the fix is security code, so add Vitest tests): missing state, wrong state, replayed state, state with no cookie, and that the HTML never contains `'*'` as the token's targetOrigin.

**Warning signs:**
Popup opens and hangs. Token appears in the HTML with `'*'`. The Decap script tag still has `^3`.

**Phase to address:** P-CMS.

---

### Pitfall 7: Treating the fake D1 as proof, and the "atomic" booking that isn't

**What goes wrong:**
- `fakeD1.ts` is a `better-sqlite3` shim written because `workerd` crashed in the dev sandbox (the header says so). It is real SQLite, so SQL syntax is mostly faithful, but it is not D1: it implements only `prepare().bind().run()/first()/all()` and `exec`. No `batch()`, no `meta.changes` parity guarantees, no network failure or retry behaviour, no D1's single-writer serialisation, and a different SQLite version/compile options. Passing tests prove SQL logic, not production behaviour.
- **`bookSlotAtomic` is not atomic.** It runs `UPDATE slots SET booked_count = booked_count + 1 ...` then, as a separate call, `INSERT INTO bookings`. If the INSERT fails (UNIQUE on session, FK, transient D1 error) the slot count is permanently incremented with no booking, so capacity leaks. The conditional UPDATE solves overselling but not this. D1 does not support `BEGIN/COMMIT` from Workers (MEDIUM). The primitive is `db.batch([...])`, which runs as an implicit transaction. Rewriting it to `batch` means the fake must implement `batch` faithfully (all-or-nothing) or the test will pass vacuously. Make the INSERT conditional (`INSERT ... SELECT ... WHERE (SELECT booked_count < capacity ...)`) and the UPDATE in the same batch, or add a compensating decrement on failure.
- **Migration replay:** the fake applies every file in `migrations/` (good, avoids the earlier drift), but there is no test that the same chain applies cleanly via real `wrangler d1 migrations apply --local`. The CI path does that for the smoke job only.
- **Destructive wizard migration.** The registration-wizard spec plans `ALTER TABLE applications DROP COLUMN id_number` (and email/id_type). Dropping populated columns is irreversible in prod. D1 has Time Travel, but take an explicit `wrangler d1 export` first, and check `DROP COLUMN` restrictions (fails if the column is indexed, in a CHECK/FK, or in a view/trigger).
- **Foreign keys:** D1 enforces them. Dropping `application_documents` (0021) or reordering table rebuilds hits FK errors only under real enforcement order.

**How to avoid:**
Keep the fast fake for unit tests, and add a thin second layer that runs in CI only: `@cloudflare/vitest-pool-workers` (or `wrangler dev` + HTTP) against real workerd D1 for a small contract suite: replay all migrations on an empty DB, concurrent `Promise.all` of N+1 bookings against capacity N, and a forced INSERT failure that must not leak capacity. Declare which suite is the source of truth in CI so "tests green" means something.

**Warning signs:**
`bookSlotAtomic` still has two awaits with no batch. Fake has no `batch`. A rewrite of a DB function goes in with no test that can fail.

**Phase to address:** P-TEST (contract suite), P-DB (rewrite of `bookSlotAtomic`; real-D1 run).

---

### Pitfall 8: Placeholder `database_id`, and the D1 local/remote mix-ups that follow

**What goes wrong:**
- Replacing the all-zero id with the real one, and then `migrations apply` run without an explicit `--local`/`--remote` flag. Defaults changed across Wrangler versions (MEDIUM), so a script written for one default hits the other database. Always pass the flag explicitly, as the npm scripts already do. Never run an unflagged `d1 execute` by hand.
- The old per-file `d1 execute` chain left no `d1_migrations` table (`wrangler.toml` warns). The first `migrations apply --remote` on that DB then tries to replay 0001 onward. That is data-destroying for seed-rewriting migrations (0003, 0006). Check the remote `d1_migrations` table before the first apply, not after. Take an export first.
- **Local state keys on the database id** (MEDIUM). Changing the placeholder to the real id changes the local `.wrangler/state` DB file, so local dev and CI see an empty DB, and the smoke seed step targets one file while `wrangler dev` reads another. Re-run `db:migrate:local` after the change, and use `--persist-to` consistently in CI.
- Committing the real id: it is not a secret (it is an identifier, useless without account credentials), so don't put it in a per-developer untracked file. Instead use `[env.production]` or commit it. A "not committed" id with no documented source means the next deploy silently binds a wrong or missing DB.
- `compatibility_date` for the OAuth Worker is `2024-11-01` and the placement Worker is `2026-08-01`. Different runtime behaviours across the two Workers, with `nodejs_compat` absent in both. Keep deliberate.
- Prod and test data share nothing: make sure test seed rows (`e2e-smoke-slot`) cannot ever be applied to the remote DB (the CI step is `--local`, keep it so).

**How to avoid:**
Write a short `docs/` runbook: how to create the DB, where the id lives, export-before-migrate, verify `d1_migrations`, apply `--remote`. Add a CI check that fails if `database_id` equals the all-zero placeholder on the deploy path.

**Warning signs:**
`wrangler d1 migrations list placement-test --remote` shows nothing or everything pending. Local DB suddenly empty after editing `wrangler.toml`.

**Phase to address:** P-DB (first plan).

---

### Pitfall 9: Date-dependent tests and timezone/calendar bugs ("works until 2027-01-01")

**What goes wrong:**
- The CI seed hard-codes `2027-01-01T10:00:00.000Z`. After that date `listOpenSlots` (which compares `starts_at > now`) returns nothing and the booking step fails. The fix `date -u -d '+30 days'` works on Linux CI but not on macOS/BSD `date` (relevant for local scripts: use `node -e` for portability). Also compute relative to a fixed far offset, and choose an hour so DST/timezone never matters (Saudi Arabia has no DST, but the CI runner is UTC).
- The same trap exists in the unit tests: any `new Date()`, `Date.now()` or literal future date in `booking.test.ts`, `application.test.ts`, or `db.ts`'s age-from-DOB logic (line ~28 mentions the cutoff for `dob`). Use Vitest fake timers (`vi.setSystemTime`) for unit tests, and `page.clock` in Playwright. A test that passes today but is a time bomb is the pattern to hunt.
- **String-compare of timestamps.** `datetime('now')` yields `YYYY-MM-DD HH:MM:SS` while slots are ISO `...T...Z`. `db.ts` already works around this for `listOpenSlots` with `strftime`. But `created_at`, `reviewed_at`, `completed_at` use `datetime('now')` and slots use ISO. Any new "within N days" query must use the same format or comparisons are wrong near boundaries. Document one canonical format.
- **Arabic date rendering:** `toLocaleDateString('ar-SA', ...)` defaults to the Umm al-Qura Hijri calendar (MEDIUM, verify in Node). `ArticleExperience.astro` and `NewsExperience.astro` use `'ar-SA'` and only force Latin digits (`numberingSystem: 'latn'`), not the calendar, so Arabic articles may print Hijri years (e.g. 1448) at build time. Either use `ar-SA-u-ca-gregory-nu-latn` or `ar` deliberately. Decide with the owner whether the audience expects Hijri, Gregorian, or both.
- **Admin timezone:** `AdminPanel.astro` calls `new Date(...).toLocaleString()` with no locale or `timeZone`, so staff outside Riyadh (or a laptop on the wrong timezone) see shifted slot times. Pass `{timeZone: 'Asia/Riyadh'}` explicitly for slots. Build-time rendering in Node uses the CI timezone (UTC), so date-only values could land on the wrong day.
- **Slot creation in admin:** `new Date(startsAt).toISOString()` interprets a `datetime-local` value in the browser's timezone. A secretary in another timezone creates slots at the wrong real time.

**How to avoid:**
Seed relative slots in CI, freeze time in tests, set `timeZone: 'Asia/Riyadh'` everywhere a slot is shown, and grep for `toLocale` calls to normalise them through one helper in `src/lib/`.

**Warning signs:**
A test fails only on certain dates, or only in CI. Arabic pages show a 14xx year.

**Phase to address:** P-TEST (seed and clocks), P-RTL (Arabic date formatting).

---

### Pitfall 10: Collecting national ID / Iqama / passport without the validation, minimisation and privacy controls the data needs

**What goes wrong:**
- **Arabic-Indic digits break validation.** Mobile Arabic keyboards and users on the AR page type `١٢٣٤٥٦٧٨٩٠`. JS `/\d/` does not match them, so a regex `^\d{10}$` rejects valid IDs, or worse the field's `inputmode="numeric"` accepts them and the Worker stores raw Arabic digits, so search and de-duplication fail. Normalise `٠-٩` and `۰-۹` (Persian) to `0-9` on the client and again on the Worker, before validating and storing. The same applies to the phone number.
- **Validate the structure for each ID type, not just length.** Saudi national ID: 10 digits, starting `1`. Iqama: 10 digits, starting `2`. Both carry a checksum (Luhn-style variant), cheap to implement and it catches typos. Passport: alphanumeric, variable length, so don't apply the 10-digit rule. The spec's `id_type` (`national_id|iqama|passport`) must drive which rule is used, and the Worker is the authority since client validation is bypassable. Over-strict passport rules reject real applicants; under-strict ones accept junk.
- **Hidden-step `required` fields silently block a multi-step wizard.** If steps are shown/hidden with `display:none`, the browser raises "An invalid form control is not focusable" on the hidden required input and the submit does nothing, with no visible error. Validate in script per step, and set `novalidate` on the form, or toggle `required`/`disabled` with the step. This applies in the wizard's single shared `<script>`.
- **Conditional guardian fields** (age-gated) are the most common state bug: user picks adult, fills guardian, changes DOB to child, then back. The hidden guardian value is submitted or lost. Clear and ignore hidden-branch fields on submit, and test the DOB boundary (the existing line ~28 age cutoff logic) at exactly 18/the threshold, with a frozen clock.
- **PII exposure paths:**
  - The admin list shows the full ID number inline (spec line `... — ${nationality} — ${idNumber} — ...`). Mask all but the last 4 digits in the list, and reveal on explicit click.
  - `console.error('placement API request failed', err)` and any future logging of request bodies puts IDs in Workers logs. Never log bodies.
  - `LOCAL_DEV` returns raw `err.message` to the client, so confirm it can never be true in production (it is a `--var`, good, but nothing stops a deploy with it set).
  - The wizard state must not persist IDs in `localStorage`/`sessionStorage` "to survive refresh". The institute likely has shared devices.
  - Unauthenticated `POST /api/apply` with no rate limit or CAPTCHA means automated junk and PII-bearing spam fill D1, and the admin list has no pagination (CONCERNS.md covers pagination; add the spam angle).
  - The ID is still stored in plaintext in D1. For a Saudi institute, the PDPL (Personal Data Protection Law) applies: collection notice, purpose, consent (the wizard already captures T&C and photo/video consent), retention, and minors' guardian data. Not legal advice, so ask the owner who is responsible. At minimum, decide a retention period and a deletion path, because there is no admin UI and deletion currently means hand-written SQL.
- **Identifier de-duplication and uniqueness:** the same person re-registers. Decide whether `id_number` is unique per student (UNIQUE index, plus its migration on existing rows that default to `''`, which would collide on a UNIQUE index). The spec adds `id_number TEXT NOT NULL DEFAULT ''`, so a UNIQUE index must exclude `''`.
- **Spec drift:** the application spec (2026-09-06) and the wizard spec (2026-09-08) conflict. The wizard moves email/ID/idType from `applications` to `students` and drops them from the application step. The repo is at 0021 (application-level ID). Implementing the application spec "as written" and then the wizard doubles the migrations and tests. Treat the wizard as superseding, and re-read what's already merged (PR #18) before planning.

**How to avoid:**
Single shared `normalizeDigits()` and `validateId(type, value)` in the Worker (with the client importing the same module if possible, to avoid a second copy, as CONCERNS.md warns about duplication), table-driven tests with Arabic-digit and bad-checksum cases, masked admin list, no body logging, and a written retention decision.

**Warning signs:**
Arabic-digit input test missing. Admin list shows a full 10-digit ID. A wizard step can be submitted with a hidden invalid field.

**Phase to address:** P-FORMS (validation, hidden-field logic), P-ADMIN (masking), a decision on retention before P-FORMS ships.

---

### Pitfall 11: Mobile and RTL "polish" verified only in Chromium desktop emulation

**What goes wrong:**
- `playwright.config.ts` has no `projects`, so it runs default Chromium at the default 1280x720 viewport. "Every page checked at phone width in AR + EN" has no automated enforcement. The smoke tests would pass on a layout that scrolls horizontally on phones.
- **Chromium mobile emulation is not iOS Safari.** Real differences: `100vh` includes the URL bar (use `100dvh`/`svh`), input font-size under 16px triggers auto-zoom on focus (hits the wizard's many inputs and the OTP/ID fields), fixed-position elements with `env(safe-area-inset-*)`, and different `position: sticky` and `overflow` behaviour. The WhatsApp FAB (currently uncommitted work) is a classic: it overlaps the wizard's primary Next button or cookie/consent bar, covers the form submit on small screens, or sits on the wrong side in RTL.
- **Physical CSS properties.** `margin-left`, `padding-right`, `left:`/`right:`, `text-align:left`, `float`, `border-top-left-radius`, `translateX()`, and `background-position` do not flip in RTL. Only a handful of hits showed up in my grep, but the uncommitted FAB/panel tweaks are exactly where they sneak in. Use logical properties (`margin-inline-start`, `inset-inline-end`, `text-align: start`). Directional icons (arrows, chevrons, "back/next" in the wizard, carousel, breadcrumbs) need mirroring in RTL; logos and phone numbers must not be mirrored.
- **Bidi fragments:** emails, URLs, IDs, phone numbers, and English course names inside Arabic text jumble punctuation and `+966` placement. Give LTR-content inputs `dir="ltr"` with `text-align: start` (or `end` for visual alignment) and wrap inline English in `<bdi>`. Placeholders in RTL inputs follow the input's `dir`.
- **Arabic typography:** `letter-spacing`, `text-transform: uppercase`, and some `font-feature-settings` break letter joining or have no effect. Tight `line-height` clips Arabic diacritics and descenders (especially with `line-clamp`/`overflow:hidden` on course titles, which is the very component being edited). Latin-only webfonts silently fall back to a system Arabic font for Arabic glyphs, with different metrics. `public/fonts` + CSP `font-src 'self'` means a missing Arabic subset/weight shows no error. Check the font actually renders Arabic, per weight used.
- **Horizontal overflow asymmetry:** an element pushed off-screen with `left:-100%` or a transform creates scrollable overflow in LTR but behaves differently in RTL (scroll origin flips). The mobile menu or off-canvas panel can create sideways scroll only in one direction. Test both.
- **Form widgets:** `<input type="date">` and `datetime-local` look and order differently in RTL, and the value stays ISO. Native `<select>` dropdown direction and the `textarea` follow `dir`.
- **Lighthouse CI budgets** measure performance/accessibility on chosen URLs, so they do not catch layout breakage.
- **Inherited tweaks:** the uncommitted mobile CSS has LF-to-CRLF warnings (CONCERNS.md); add `.gitattributes` (`* text=auto eol=lf`) before the first commit, or diffs of whole files show as changed and reviews are useless. No `.gitattributes` exists in the repo.

**How to avoid:**
Add Playwright projects: `mobile-chromium` (e.g. Pixel 7), `mobile-webkit` (iPhone 14, WebKit browser), `desktop`. Parametrise by locale (`/en/`, `/ar/`). Add one cheap invariant to every page: `document.documentElement.scrollWidth <= window.innerWidth` at 360 px and 390 px. For visual regression use screenshots of a small set of key pages (home, a course, placement-test, wizard steps, admin login) in AR+EN only, with fonts loaded and animations disabled, and mark the Hijri/date and review content as masked. Do a manual real-device pass on an iPhone for the wizard and FAB, because emulation can't prove it.

**Warning signs:**
`scrollWidth > innerWidth` on any page. The FAB overlaps a CTA. Any `left:`/`margin-left` in a diff touching an AR page.

**Phase to address:** P-RTL (config and checks first, then fixes), P-FORMS (wizard at phone width), P-REVIEW (use the same projects).

---

### Pitfall 12: Pinning `latest` the wrong way (and lockfile theatre)

**What goes wrong:**
- `"latest"` is in the Worker's `package.json` for `wrangler`, `vitest`, `typescript`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`, `bcryptjs`. Replacing `latest` with `^x.y.z` is still floating. The requirement says exact, so use `npm install --save-exact` and `.npmrc` `save-exact=true`.
- **Pin what the lockfile resolved, not what is newest today.** `npm ls --depth=0` (or read `package-lock.json`) and pin to those. Pinning to today's newest bumps several majors at once and mixes "pin" with "upgrade".
- **These packages are version-coupled.** `@cloudflare/vitest-pool-workers` has strict peer ranges on `vitest` (and `wrangler`). Pinning them independently yields `ERESOLVE` or runtime pool errors. `workers-types` should match the Worker `compatibility_date` era (or generate with `wrangler types`). `better-sqlite3` is a native module that needs a prebuilt binary or build toolchain per Node ABI (it already needs `allowScripts`), so changing Node versions in CI can break the install.
- **Root `package.json`**: `astro ^7.2.4` and `@astrojs/sitemap ^3.7.3` are caret ranges. Pinning only the Worker leaves the main site floating. The lockfile protects `npm ci`, and CI should use `npm ci` everywhere (check the Worker job too, since a plain `npm install` in CI ignores the pin intent).
- **bcryptjs:** the hash format is stable across versions, so a major bump is unlikely to break verification, but the unpinned `latest` risk is supply-chain. Pin, and add a test with a fixed known hash fixture (computed once) so any change in verify behaviour fails.
- **Pinned and then forgotten:** exact pins with no update mechanism rot. Add Dependabot/Renovate (grouped: wrangler + vitest-pool + workers-types together) and keep CI as the gate. Otherwise this exercise just freezes vulnerabilities in place.
- **Decap on unpkg `^3`** and any other CDN script (`unpkg.com` is in the CSP `script-src`) is the same class of problem outside `package.json`.
- **Node version:** `engines >=22.12` in root, `actions/setup-node` 22, and the Worker sub-package: one `.nvmrc` or `volta` to stop drift.

**How to avoid:**
Pin to lockfile-resolved versions, commit `.npmrc`, `npm ci` in every CI job, run the full Worker test and a `wrangler deploy --dry-run` after pinning to prove nothing moved, then upgrade deliberately in a separate commit.

**Warning signs:**
`npm install` in CI. Diff of `package-lock.json` larger than the `package.json` change.

**Phase to address:** P-TEST (first plan, before other test work builds on it).

---

## Moderate Pitfalls

### Pitfall 13: Test suite green in CI but smoke job flaky or silently skipping
**What goes wrong:** The Worker is started with `&` and polled for 90 s, with logs tailed from `/tmp`. Silent "no slots" (the date bomb) passes if the test skips instead of fails. Hard-coded `e2e-smoke-slot` ids collide on rerun. `workers: 1, fullyParallel: false` is correct for a shared DB, but a failing test leaves state for the next.
**Prevention:** Make "no slots" a hard failure (assert, never `test.skip`). Reset local D1 at job start (fresh `--persist-to` directory). Upload logs with `if: always()`. Fail the Astro build when `PUBLIC_PLACEMENT_API_URL` is unset (CONCERNS.md covers it). A Playwright test that hits the real built site is the only thing that has caught a runtime `ReferenceError` in `TestRunner`, so protect it.
**Phase:** P-TEST.

### Pitfall 14: Refactoring the 1,294-line `TestRunner.astro` before it has tests
**What goes wrong:** Extracting modules "to make it testable" without characterisation tests changes behaviour in question types (skip logic, number sequences) that only smoke tests cover. Astro `<script>` blocks are bundled and hoisted, so moving code to `src/lib` can change module scope and `import.meta.env` replacement. Another incident like the earlier `ReferenceError` is likely.
**Prevention:** Pin current behaviour with Playwright flows per question type first (or Vitest with jsdom against the extracted pure functions), then extract. Only do it if features need it. Finishing the placement test end to end does not require a refactor, so do not let it grow scope.
**Phase:** P-DB / P-TEST.

### Pitfall 15: Request validation added inconsistently
**What goes wrong:** Validation added to the new wizard endpoint but not to `handleAdminCreateSlot` (any `startsAt`, any `capacity`, including negative or `1e9`). `capacity` of 0 or negative creates unbookable slots. Invalid `startsAt` makes `listOpenSlots` string-compare garbage. `await req.json()` on invalid JSON throws, caught as a 500 with a console error, which is noisy, and a gift for log spam.
**Prevention:** One tiny `parseJson(req, schema)` helper (hand-rolled or Zod, whichever is already a dependency; the Worker has none, so prefer hand-rolled to avoid a bundle and dependency), returning 400 on bad shape. Apply to every route, public and admin, in one pass. Also cap body size.
**Phase:** P-ADMIN (admin routes), P-FORMS (public).

### Pitfall 16: `Origin`-allowlist hard-coded to `https://elc.com.sa` while preview/staging differ
**What goes wrong:** Admin and test flows are only allowed from production origin, but this milestone is explicitly pre-go-live. The site may be reviewed at a staging hostname or `www.`, and the Worker rejects every call. `https://www.elc.com.sa` versus apex is a classic. Conversely, adding wildcard origins to "fix" it opens the hole again.
**Prevention:** Put allowed origins in an env var (`ALLOWED_ORIGINS`, comma-separated) with strict exact match, a separate value for preview/local, and a documented list. Keep the `LOCAL_DEV` gate. Match the CSP `connect-src` and the CORS list from one source.
**Phase:** P-ADMIN.

### Pitfall 17: Content-Security-Policy lives only in `.htaccess` and is never tested
**What goes wrong:** `astro preview` and Playwright don't apply `.htaccess`, so CSP violations (a new Worker URL, a font, a script) never show in CI and only appear in production as silent blocked requests. `script-src 'unsafe-inline'` is also what keeps analytics inline snippets working, which means the policy gives little XSS protection.
**Prevention:** Add one test or script that parses `.htaccess` `connect-src` and asserts it contains `PUBLIC_PLACEMENT_API_URL`'s origin and the CMS Worker origin. If the Worker moves to `api.elc.com.sa` (Pitfall 1), update CSP in the same commit. Consider a staging check with real headers before go-live (later milestone, flag it).
**Phase:** P-TEST / P-ADMIN.

### Pitfall 18: Running the "full design review" as one big phase with unbounded findings
**What goes wrong:** A review of AR+EN, mobile+desktop produces dozens of findings, the phase swells, and fixes regress other pages. No agreed severity threshold means "fix all" never ends. Findings against a page still being changed (wizard, course page) go stale immediately.
**Prevention:** Run the review last, after features and the RTL baseline land. Triage into must-fix (broken layout, unreadable, inaccessible, wrong language) versus later. Fix by page, with the same Playwright overflow and screenshot checks. Time-box. Log deferred items rather than leaving them half-fixed.
**Phase:** P-REVIEW.

### Pitfall 19: Google Places key and build-time reviews swept into scope
**What goes wrong:** `googleReviews.ts` has a null path with no test, and the build behaves differently with and without `GOOGLE_PLACES_API_KEY`. CI without the key builds a site with no reviews section, and a visual or layout check passes on a page that looks different in production. Weekly rebuild is disabled and is a go-live concern.
**Prevention:** Test the no-key path, and make the review screenshots deterministic (mask or stub the reviews). Leave the rebuild schedule out of scope as the project states.
**Phase:** P-TEST / P-RTL.

---

## Minor Pitfalls

- **`preview.log`/`preview.pid` committed with the next `git add .`** → add to `.gitignore` first. Also ensure `.dev.vars` is ignored in the Worker's own `.gitignore` before the first commit that touches that folder.
- **Cookie parser via `new RegExp(COOKIE_NAME)`:** fine for a constant, but replace with split-on-`;` exact-name matching when moving to `__Host-` prefix (the `-` and `_` are regex-safe, but a prefix change invites a copy-paste with unescaped input).
- **`constantTimeEqual` returns early on length mismatch:** leaks only length, and the length is fixed for HMAC-SHA256 base64, so no practical risk. Don't spend a phase on it. Prefer `crypto.subtle.verify` if the signing code is touched anyway.
- **Admin full-table reads:** add `LIMIT` before the wizard multiplies applications, but it is not urgent at this volume.
- **Lighthouse CI budgets tuned to pass once:** new wizard JS and the FAB can push the budget. Re-baseline consciously rather than raising the number silently.
- **`unpkg.com` in `script-src`** exists only for Decap/other CDN scripts. Once Decap is self-hosted, drop it.
- **Two Workers, two compat dates, two lockfiles:** `cms-oauth-worker` has no `package.json`/CI job. Pinning and tests need to cover it too, or it is the one thing that stays unpinned.
- **Error messages in Arabic/English:** API returns English `error` strings (`invalid credentials`, `slot_has_bookings`). The client should map error codes to localised messages. Don't ship raw codes to AR users.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep cross-site cookie (`workers.dev` ↔ `elc.com.sa`) and bolt on Origin check | No DNS/domain work | Safari staff locked out; permanent CSRF surface; third-party-cookie policy risk | Only with an explicit "Chromium/Firefox only" decision recorded |
| Rate limit via Workers binding alone | One config block | Soft, per-location, can't enforce lockouts | Acceptable as a first gate if paired with a D1 counter |
| Stateless HMAC session + short TTL instead of server sessions | No schema change | Can't revoke a stolen cookie or offboard staff | Never for admin that reads national IDs; the requirement already says revocable |
| Fake D1 as the only DB test layer | Fast, works in the sandbox | False confidence on batch/transaction/concurrency | OK for SQL logic, never as the sole proof for booking or migrations |
| `innerHTML` with template literals "because values are internal" | Quicker UI code | Any later field (name, email) turns it into stored XSS | Never in admin; only for static literal strings with a `// safe:` marker |
| Hard-coded future date in seed/tests | Zero setup | Breaks on that date, fails silently | Never |
| Pin to `^` instead of exact | Receives patches | Not what the requirement says; lockfile drift | Never for these deps; use Renovate for updates |
| Copy ID validation into client and Worker separately | Fast to write | Rules drift; client accepts what Worker rejects | Avoid; share one module or drive client from Worker error codes |
| Store raw ID in D1 and show in admin list | Matches spec | PII exposure on screens, logs, shoulder-surfing | Store raw if needed, but mask in list views |
| Skip tests for `cms-oauth-worker` | No new CI job | Security-code changes unguarded | Not acceptable once state/postMessage logic is rewritten |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub OAuth (Decap popup) | Unbound or unchecked `state`; `postMessage` to `e.origin`/`'*'` | Cookie-bound signed state, constant `targetOrigin`, `Response` (not `Response.redirect`) so cookies can be set |
| GitHub OAuth scopes | Keeping `repo,user` | `public_repo` if the repo is public; drop `user`; dedicated collaborator account; document residual risk |
| Decap CMS from CDN | `unpkg.com/decap-cms@^3.0.0` with no SRI | Exact version, self-hosted via npm/lockfile, or SRI hash |
| Decap + Astro content collections | Decap writes values the Zod schema rejects (empty strings, date formats) | Round-trip test: save via CMS to a branch, run `astro build` |
| Cloudflare D1 | Assuming SQL `BEGIN/COMMIT` works; two sequential `run()` calls treated as atomic | `db.batch()` for multi-statement atomicity; verify with a real-D1 test |
| Cloudflare D1 migrations | Unflagged `d1 execute`/`migrations apply`; replaying onto a DB that lacks `d1_migrations` | Always `--local` or `--remote`; export first; check `d1_migrations` before first remote apply |
| Wrangler local state | Changing `database_id` and seeing an empty local DB | Re-run `db:migrate:local`; use consistent `--persist-to` in CI |
| Workers CPU limit + bcryptjs | Passing in Node tests, failing in production (1102) | Check the plan's CPU limit; measure login on a real deploy; plan a hash-scheme migration if changing |
| Workers Rate Limiting binding | Treating it as an exact counter | Soft per-location throttle only; add D1 counter for lockouts |
| Playwright + Hostinger `.htaccess` | CSP/headers never exercised in tests | Static check on `.htaccess`; real-header check before go-live |
| `Intl`/`toLocale*` for `ar-SA` | Gets Hijri calendar and Arabic digits by default | Explicit `-u-ca-gregory-nu-latn` and `timeZone: 'Asia/Riyadh'` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| bcryptjs at cost 10+ on every login | Slow login; error 1102 on a low-CPU plan; brute-force amplifies CPU cost | Throttle before bcrypt; confirm plan limit; consider cost/scheme trade-off | Immediately on a 10 ms CPU plan; otherwise under an attack |
| `listBookingsWithDetails` / applications unbounded | Admin panel slow, large payloads of PII | `LIMIT`/pagination, date window | A few thousand rows, or after a spam burst on public `/api/apply` |
| Session lookup in D1 on every admin request | Added latency | Verify HMAC first, index `sessions(id)`, purge expired rows | Not a concern at 1–5 admins |
| Large wizard inline script | Slow on low-end phones, hydration jank | Keep logic in one script, no framework; check Lighthouse budget | Mid-range Android on 3G, which is realistic for the audience |
| Full search index JSON per language | Slow first search on mobile | Fine now (CONCERNS.md); do not add per-keystroke re-render of large lists | Only if content grows a lot |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Public unauthenticated `/api/apply` and `/api/session` with no throttling or bot protection | Spam fills D1 with junk PII records; admin XSS payloads delivered to staff | Rate limit by IP, size caps, optional Turnstile; escape on render |
| Admin list showing full ID, name, email in plain text | Shoulder-surfing, screenshots, XSS exfiltration | Mask by default, reveal on click, never log |
| Logging request bodies or errors containing PII | PII in Workers logs | Log ids and codes only |
| `LOCAL_DEV=true` returning `err.message` | Leaks internals if ever set in production | Assert not set in deploy workflow; separate `[env.dev]` |
| Verbose login errors / timing differences | Username enumeration | Same body and timing for unknown user and wrong password |
| Token reflected through `postMessage` to unpinned origin | GitHub token theft → repo write | Constant target origin, origin check on received message |
| Third-party script supply chain (unpkg Decap, `latest` deps) | Arbitrary code in admin or CMS context | Exact pins, SRI or self-hosting |
| Confusing CORS with CSRF | CORS headers added, CSRF stays open (simple requests) | Server-side Origin + content-type enforcement |
| No offboarding path (no admin management UI) | Former staff keep access | Session revocation plus a documented D1 runbook (disable user, revoke sessions) |
| Secrets in the planning artifacts | Leaks via committed docs | Never copy `.dev.vars`/`.env` values into docs, tests or fixtures; use generated test secrets |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Wizard loses everything on refresh/back | Applicant abandons after typing four-part name and ID | Keep non-sensitive fields in memory per step; warn on leave; do NOT store the ID in storage |
| Validation errors only in English or as raw codes | Arabic users can't fix the form | Map error codes to localised messages next to the field |
| Arabic-digit input rejected as invalid | Frustration on the AR form | Normalise digits silently |
| Date picker showing Gregorian when users think Hijri (or reverse) | Wrong DOB, age-gate misfires | Be explicit about the calendar; for DOB use separate day/month/year selects or a clearly labelled Gregorian input |
| Phone input rejecting `05xxxxxxxx` vs `+9665xxxxxxxx` | Failed submissions | Accept both, normalise to E.164 |
| FAB covering primary CTA on small screens | Can't tap Next/Submit | Reserve bottom padding on wizard pages, or hide the FAB there |
| Slot list showing times in the wrong timezone | Student misses the test | `Asia/Riyadh` explicitly, label the timezone |
| Hidden required field blocks submit silently | "Button does nothing" | Per-step validation with visible, focused errors |
| Placement-test result relies on client-side level names | Mismatch if renamed | Display the Worker-returned `levelName` (CONCERNS.md) |

## "Looks Done But Isn't" Checklist

- [ ] **Admin login in Safari/iPhone:** often passes in Chrome only. Verify with a WebKit Playwright run against the real Worker, plus one manual iPhone login.
- [ ] **Logout:** often only clears the cookie. Verify a copied pre-logout cookie returns 401.
- [ ] **CSRF:** often covers some routes. Verify a table-driven test over every mutating admin route with bad Origin, no Origin, and `text/plain`.
- [ ] **Rate limit:** often unit-tested with a fake counter. Verify N+1 rapid real requests get 429 and a correct login after the window works.
- [ ] **Login on real Workers:** often never exercised. Verify bcrypt login on the deployed Worker, not just in Vitest.
- [ ] **XSS:** often fixed in two places. Verify the payload test in every field shown in admin, and `grep innerHTML` returns no interpolated hits.
- [ ] **OAuth popup:** often "works" with `'*'`. Verify the token is only ever posted to `https://elc.com.sa` and a wrong-state callback is rejected.
- [ ] **CMS edit flow:** often tested up to login. Verify editing a course in both locales, publishing, and a successful `astro build` of the result.
- [ ] **D1:** often a placeholder stays. Verify `wrangler d1 migrations list --remote` shows 0001–latest applied and the deployed Worker reads rows.
- [ ] **Booking capacity:** often not atomic. Verify a forced INSERT failure does not change `booked_count`.
- [ ] **Smoke test dates:** often hidden time bombs. Verify with the system clock set to 2027-02-01 (or `page.clock`) that the suite still passes.
- [ ] **Pinned deps:** often only some. Verify `grep -rn '"latest"\|"\^' */package.json package.json` shows what you expect and CI uses `npm ci`.
- [ ] **Wizard Arabic input:** often English-tested only. Verify Arabic-Indic digits for ID and phone, RTL input direction, and submit on a 390 px iPhone.
- [ ] **No horizontal scroll:** often only on the page being edited. Verify the `scrollWidth <= innerWidth` check across all routes in AR and EN.
- [ ] **PII:** often forgotten. Verify the admin list masks IDs and no log line contains a body.
- [ ] **Line endings:** often noisy diffs. Verify `.gitattributes` exists before committing the uncommitted mobile work.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Safari admin lockout discovered late | MEDIUM-HIGH | Custom domain for the Worker or bearer-token auth. Needs DNS access and a client change. |
| Stored XSS already exploited | HIGH | Rotate `ADMIN_COOKIE_SECRET` (kills all sessions), purge malicious rows, audit PII access, notify per PDPL guidance |
| Wrong `database_id` / replayed migrations on prod | HIGH | D1 Time Travel restore, then re-seed `d1_migrations` correctly; hence export before apply |
| Capacity leaked by failed booking | LOW | One-off SQL to recompute `booked_count` from `bookings` rows; then fix with `batch` |
| GitHub token leaked via postMessage | MEDIUM | Revoke the OAuth app's tokens in GitHub, rotate client secret (`wrangler secret put`), review repo for unexpected commits |
| bcrypt login fails on production CPU limit | MEDIUM | Switch plan, or deploy dual-verify rehash scheme; reset admin hashes via D1 |
| Pinned dependency set will not install | LOW | Revert to the previous lockfile; re-pin as a coupled set (wrangler + vitest + vitest-pool + types) |
| Hijri dates published in Arabic pages | LOW | Change the formatter, rebuild; check cached CDN copies |
| Wizard migration dropped columns with data | HIGH | Restore from export/Time Travel; redo with additive migration (copy then drop later) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Cross-site cookie / Safari | P-ADMIN (decision gate, first) | WebKit Playwright login test passes against the real Worker |
| 2. CSRF bypass / preflight | P-ADMIN | Table-driven negative tests on all mutating routes; real credentialed browser call works |
| 3. Rate limiting / bcrypt CPU / enumeration | P-ADMIN design, P-DB real deploy | 429 test; same response for unknown user; login works on deployed Worker |
| 4. XSS beyond the named lines | P-ADMIN | Payload fixtures in Playwright; lint/grep rule for `innerHTML` in CI |
| 5. Session revocation | P-ADMIN | Replay-after-logout returns 401 |
| 6. CMS OAuth state / origin / scope / Decap pin | P-CMS | New `cms-oauth-worker` tests; manual end-to-end CMS edit by a non-developer account |
| 7. Fake D1 / non-atomic booking | P-TEST (contract suite), P-DB (rewrite) | Concurrency + forced-failure tests on real D1 in CI |
| 8. `database_id` / migration mix-ups | P-DB (first plan) | `migrations list --remote`; CI guard against zero placeholder on deploy path |
| 9. Date bombs / timezone / Hijri | P-TEST (clock + seed), P-RTL (formatting) | Suite passes with clock moved past 2027-01-01; Arabic pages show Gregorian (or chosen calendar) |
| 10. ID/PII handling, Arabic digits, wizard logic | P-FORMS, with masking in P-ADMIN | Table-driven validator tests (Arabic digits, checksums); masked list; hidden-field submit test |
| 11. Mobile/RTL verification gap | P-RTL (config first) | Mobile + WebKit projects; overflow invariant across all routes AR+EN |
| 12. Dependency pinning | P-TEST (first plan) | `npm ci` everywhere; no `latest`/`^` in targeted packages; dry-run deploy |
| 13. Flaky/skipping smoke | P-TEST | "No slots" fails hard; logs uploaded `always()` |
| 14. Premature refactor of TestRunner | P-DB/P-TEST | Characterisation tests before any extraction |
| 15. Inconsistent request validation | P-ADMIN, P-FORMS | Every route returns 400 on malformed JSON/types |
| 16. Origin allowlist rigidity | P-ADMIN | Allowed origins from one env source, shared with CSP check |
| 17. CSP untested | P-TEST | Static check ties `.htaccess` connect-src to env origins |
| 18. Unbounded design review | P-REVIEW (last) | Triaged findings list with explicit defer list |
| 19. Reviews no-key path | P-TEST | Test for null path; deterministic screenshots |

## Research flags for phases

- **P-ADMIN:** needs a short docs check. Confirm Workers Rate Limiting binding syntax and limits, current CPU limits for the account's plan, and cookie `Partitioned` support. Needs a user decision on Pitfall 1 (custom domain vs accept cross-site).
- **P-CMS:** check Decap's current OAuth handshake and supported scopes, and whether the repo is public (decides `public_repo`).
- **P-DB / P-TEST:** check `@cloudflare/vitest-pool-workers` peer ranges vs `vitest`, and whether workerd runs in the available CI (it did not in the original sandbox).
- **P-FORMS:** needs a domain decision on PDPL retention and who owns it; check the Saudi ID checksum algorithm against test vectors before encoding it.
- **P-RTL / P-REVIEW:** standard patterns, minimal research; mainly tooling setup.

## Sources

- Codebase files read this session (HIGH): `placement-test-worker/src/auth.ts`, `src/index.ts`, `src/routes/admin.ts`, `src/db.ts` (`bookSlotAtomic`, `listOpenSlots`), `src/test-utils/fakeD1.ts`, `wrangler.toml`, `package.json`, `migrations/0019`, `0021`; `cms-oauth-worker/src/index.js`, `wrangler.toml`; `public/admin/index.html`, `public/admin/config.yml`, `public/.htaccess` (CSP line); `playwright.config.ts`; `.github/workflows/ci.yml` (seed step); `docs/superpowers/specs/2026-09-08-registration-wizard-design.md`; `.planning/codebase/CONCERNS.md`; `.planning/PROJECT.md`.
- Platform behaviour (MEDIUM, from established knowledge, not re-fetched; verify per research flags): Safari ITP third-party cookie blocking; Firefox cookie partitioning; Workers CPU limit by plan; Workers Rate Limiting binding semantics (per-location, 10 s/60 s periods); D1 `batch()` as the transaction primitive and lack of `BEGIN/COMMIT`; `Response.redirect()` immutable headers; `ar-SA` default Umm al-Qura calendar in `Intl`; WebCrypto PBKDF2 100,000-iteration cap in workerd; Wrangler local D1 state keyed by database id; SQLite `ALTER TABLE DROP COLUMN` restrictions.
- Decap CMS GitHub backend / external OAuth handshake: https://decapcms.org/docs/backends-overview/ (referenced by the existing worker code).

---
*Pitfalls research for: hardening and finishing a bilingual Astro + Cloudflare Workers/D1 + Decap CMS site with applicant PII*
*Researched: 2026-11-04*
