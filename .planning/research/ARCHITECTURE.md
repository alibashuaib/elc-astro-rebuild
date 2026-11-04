# Architecture Research

**Domain:** Static bilingual Astro 7 site (Hostinger) + Cloudflare Worker/D1 API (placement test, bookings, applications, staff admin) + Decap CMS GitHub OAuth worker
**Researched:** 2026-11-04
**Mode:** Subsequent milestone (harden and finish). Integration of hardened admin auth, placement test on real D1, student application, registration wizard, and reliable CMS editing into the existing architecture.
**Confidence:** HIGH for the integration points read directly from the code (`index.ts`, `auth.ts`, `routes/*`, `cms-oauth-worker`, wrangler config, CI). MEDIUM for platform behaviour claims (third-party cookie blocking, Decap scope and save semantics), marked inline and listed under "Verify in phase".

## Standard Architecture

### System Overview (target state)

```
 BROWSER (public visitor)                      BROWSER (staff)
   |                                              |
   | static HTML/JS                               | /admin (Decap)            /{en}/placement-test/admin
   v                                              v                                 |
┌───────────────────────────────┐   ┌───────────────────────────┐                  |
│ Hostinger: static dist/       │   │ Hostinger: public/admin   │                  |
│  - [lang]/* pages             │   │  Decap CMS (unpkg script) │                  |
│  - registration wizard        │   └──────────┬────────────────┘                  |
│  - placement test, apply      │              │ popup                             |
│  - admin page (AdminPanel)    │              v                                   |
└──────────────┬────────────────┘   ┌───────────────────────────┐                  |
               │ fetch (JSON)       │ cms-oauth-worker          │                  |
               │ credentials        │ /auth  -> signed state    │                  |
               v                    │ /callback -> verify state,│                  |
┌──────────────────────────────────────────────────────────────┐ │   code->token,            │
│ placement-test-worker                                        │ │   postMessage to pinned   │
│                                                              │ │   origin only             │
│  fetch()                                                     │ └──────────┬────────────────┘
│   1 CORS + Origin guard      (http.ts / cors.ts)             │            │ GitHub OAuth
│   2 route match              (ROUTES table)                  │            v
│   3 auth  -> AdminCtx        (auth.ts, admin_sessions)       │       github.com
│   4 CSRF  (unsafe + admin)   (csrf.ts)                       │
│   5 validate body            (validate.ts, per-route)        │
│   6 handler -> db.ts         (routes/*.ts)                   │
└──────────────────────────────┬───────────────────────────────┘
                               v
                    ┌──────────────────────┐
                    │ D1 "placement-test"  │
                    │ students, test_sessions, responses, questions, slots,
                    │ bookings, applications, admin_users,
                    │ + admin_sessions, login_attempts (new)
                    └──────────────────────┘
```

The shape does not change. The three runtime units (static site, placement worker, CMS OAuth worker) stay separate. All new work is inside the placement worker's request pipeline, two new D1 tables, one rewritten client module, and the CMS OAuth worker's two handlers.

### Component Responsibilities

| Component | Owns | Talks to | Change in this milestone |
|-----------|------|----------|--------------------------|
| `src/pages/[lang]/*` + `Layout.astro` | Static HTML, SEO, i18n | content collections, `src/lib/*` | Mobile and design-review fixes only |
| `src/components/placement-test/RegistrationForm` (+ `RegistrationStepBasics/Details`) | Two-step intake, client-side validation, emits `placement:register` | `src/lib/placementApi.ts`, `src/lib/registrationValidation.ts` | Land finished branch, add contract test (see Pattern 6) |
| `TestRunner`, `ResultBooking`, `ApplicationForm` | Test loop, slot booking, application | `placementApi.ts` | Wire to real D1 in CI; no structural change |
| `AdminPanel.astro` | Staff UI: slots, bookings, questions, applications, results | `placementApi.ts` admin calls | Safe rendering, logout, CSRF header, 401 handling, results tab |
| `src/lib/placementApi.ts` | The only module that calls the worker | worker HTTP API | Adds `adminSession()`, `adminLogout()`, CSRF header injection, results calls |
| `placement-test-worker/src/index.ts` | Pipeline orchestration and route table | all worker modules | Becomes a thin middleware pipeline (Pattern 1) |
| `auth.ts` | Session issue, verify, revoke; login throttle | `db.ts` (sessions, attempts) | Rewritten: opaque server-side sessions |
| `csrf.ts` (new) | Origin allowlist check + CSRF token check | `auth.ts` AdminCtx | New, about 30 lines |
| `http.ts` (new) | `json()`, `readJson()` (400 on bad JSON), CORS | all routes | Replaces three duplicated `json()` copies |
| `routes/session.ts` | Registration validation (authoritative), test loop | `db.ts`, `scoring.ts`, `kids.ts` | Wizard server-side rules |
| `routes/application.ts` | Application submit, admin review | `db.ts` | Reduced to course and guardian per wizard spec |
| `routes/admin.ts` | Login, logout, slots, questions, bookings; add results | `auth.ts`, `db.ts` | Login throttle, logout, session info, results endpoints |
| `db.ts` | All SQL (prepared, bound) | D1 | Add session and attempts queries, paginated admin lists |
| `cms-oauth-worker/src/index.js` | GitHub code to token exchange only | GitHub, Decap popup | Signed `state`, pinned postMessage origin, narrower scope |
| `public/admin/{index.html,config.yml}` | Decap bootstrap and field config | cms-oauth-worker, GitHub API | Pin Decap version, reconcile config with zod schema |
| `.github/workflows/ci.yml` | Typecheck, unit, build, smoke on real local D1 | worker via `wrangler dev` | Dynamic slot or admin-API seeding, worker unit job, log upload `if: always()` |

## Recommended Project Structure (additions only)

```
placement-test-worker/
├── migrations/
│   ├── 0022_registration_fields.sql      # already on feature/registration-wizard
│   └── 0023_admin_sessions.sql           # NEW: admin_sessions, login_attempts, admin_users.disabled_at
├── scripts/
│   └── create-admin.ts                   # NEW: prints INSERT with bcrypt hash (no admin-management UI needed)
└── src/
    ├── http.ts                           # NEW: json(), readJson(), cors helpers
    ├── csrf.ts                           # NEW: originGuard(), csrfGuard()
    ├── auth.ts                           # REWRITTEN: createSession, resolveSession, revokeSession, throttle
    ├── validate.ts                       # NEW: tiny guards (isString, isInt range, isIsoDate), no new dependency
    ├── routes/results.ts                 # NEW: admin placement-result review (sessions list + detail)
    └── routes/*.test.ts                  # extend: admin auth, CSRF, throttle, results
src/lib/
├── placementApi.ts                       # adds csrf token holder + admin session calls
├── registrationValidation.ts             # from wizard branch
└── dom.ts                                # NEW: el()/text helpers so AdminPanel never uses innerHTML with data
tests/e2e/
├── helpers/adminApi.ts                   # NEW: log in via API, create future slot (kills the 2027-01-01 hard-code)
└── admin.spec.ts                         # NEW: login, logout, XSS payload renders inert, CSRF rejection
```

### Structure Rationale

- **Security logic lives in `auth.ts` and `csrf.ts`, not in each route.** The existing design already has the right seam (`admin: true` on the route table, one `requireAdmin` call in `index.ts`). Extend that seam instead of adding checks to handlers, so a new admin route is secure by default.
- **`validate.ts` is hand-rolled.** The worker has zero runtime dependencies except bcryptjs. Body shapes are small; a zod import would add bundle weight for about 10 guards. Revisit only if body schemas grow past that.
- **No admin-management UI.** `scripts/create-admin.ts` plus `disabled_at` covers onboarding and offboarding for a staff of a handful. A UI is speculative.

## Architectural Patterns

### Pattern 1: Ordered pipeline with typed context

**What:** `index.ts` runs fixed stages. Stage 3 yields an `AdminCtx` (`{ adminId, sessionId, csrfToken }`) that is passed to handlers, replacing the handlers' own `getSessionAdminId` calls (`application.ts` currently re-reads the cookie as "defence in depth").
**When:** Always, for every request.
**Trade-offs:** One extra D1 read per admin request (session lookup). Negligible at staff scale.

```typescript
// index.ts (sketch)
const guard = originGuard(req, env, route);        // unsafe methods: Origin must be in allowlist, absent Origin = reject
if (guard) return respond(guard);
let ctx: AdminCtx | null = null;
if (route.admin) {
  ctx = await resolveSession(req, env);            // D1 lookup by token hash; checks expires_at, revoked_at, admin disabled
  if (!ctx) return respond(json({ error: 'unauthorized' }, 401));
  if (UNSAFE.has(req.method)) {
    const bad = csrfGuard(req, ctx);               // x-csrf-token === ctx.csrfToken (constant time)
    if (bad) return respond(bad);
  }
}
return respond(await route.handler(req, env, params, ctx));
```

### Pattern 2: Opaque server-side sessions in D1 (replaces HMAC cookie)

**What:** Cookie holds a random 32-byte token. D1 stores only its SHA-256 hash, so a D1 read leak does not yield live sessions. Logout sets `revoked_at`. Disabling an admin, or a password change, revokes all of that admin's sessions in one `UPDATE`.
**When:** All admin auth. This single change satisfies "revocable sessions" and removes the NaN-TTL class of bug (no signed expiry to mis-parse). `ADMIN_COOKIE_SECRET` can then be retired.
**Trade-offs:** Stateful; costs a table and a read. The alternative (session-version counter on `admin_users`) is smaller but cannot do per-device logout.

```sql
-- 0023_admin_sessions.sql
ALTER TABLE admin_users ADD COLUMN disabled_at TEXT;
CREATE TABLE admin_sessions (
  token_hash  TEXT PRIMARY KEY,                       -- sha256(token), hex
  admin_id    TEXT NOT NULL REFERENCES admin_users(id),
  csrf_token  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT
);
CREATE INDEX idx_admin_sessions_admin ON admin_sessions(admin_id);
CREATE TABLE login_attempts (
  key          TEXT PRIMARY KEY,                      -- lower(username) + ':' + client ip
  failures     INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL,
  locked_until TEXT
);
```

Cookie: `__Host-elc_admin=<token>; HttpOnly; Secure; Path=/; Max-Age=<ttl>` plus `SameSite=None` (cross-site, see Decision D1) or `SameSite=Strict` (same-origin). The `__Host-` prefix forbids a `Domain` attribute and forces `Path=/`, which also kills the duplicate-cookie ambiguity flagged in CONCERNS.

### Pattern 3: CSRF = Origin allowlist + per-session token header

**What:** For `POST/PATCH/DELETE` on admin routes (including login): reject unless `Origin` is in `ALLOWED_ORIGINS` (absent Origin is a reject, not a pass), and require `x-csrf-token` equal to the session's token. The token is returned in the login response body and by `GET /api/admin/session` (so a page reload can recover it). The client keeps it in module memory only, never `localStorage`. Add `x-csrf-token` to `access-control-allow-headers`; a custom header also forces a CORS preflight, which a cross-site form cannot satisfy.
**When:** Needed even if cookies become same-site, as defence in depth. Cheap.
**Trade-offs:** Client must always go through `placementApi.ts` for admin calls (it already does).

### Pattern 4: Login throttle in D1, not the Rate Limiting binding

**What:** Count failures per `username + ip` (`cf-connecting-ip`) in `login_attempts`; after N failures within a window, return 429 with `locked_until` and skip bcrypt. Run a dummy `bcrypt.compare` for unknown usernames so response time does not enumerate accounts. Reset the counter on success.
**Why not the Workers Rate Limiting binding:** it is approximate, per Cloudflare location, and eventually consistent (docs say requests can exceed the limit while counts update; strict limits need Durable Objects). It is also a binding that the repo's fakeD1 unit-test strategy cannot exercise, whereas a D1 table is deterministic and testable today. Staff-scale login volume makes D1 writes trivial. (HIGH on the binding caveats, taken from Cloudflare docs; fetched this session.)
**Trade-offs:** Not a global DoS shield. A locked username can be locked by an attacker; acceptable for a handful of staff accounts, and the lock expires.

### Pattern 5: Never `innerHTML` with data

**What:** `AdminPanel.astro` builds rows with `document.createElement` + `textContent` through a small `dom.ts` helper. Mask national ID in list rows (last 4 digits), full value only on the detail view. Add one Playwright test that seeds an applicant named with an `<img onerror>` payload and asserts nothing executes.
**When:** All admin rendering of applicant-supplied fields (name, phone, email, nationality, guardian, free-text "other" fields from the wizard).
**Trade-offs:** More verbose than template strings; this is the point.

### Pattern 6: Mirrored client/worker validation with a contract test

**What:** The wizard spec deliberately duplicates regexes and enums (`src/lib/registrationValidation.ts` and the worker's `session.ts`), because the two do not share a build. Keep that, but add a root-level Vitest test that imports both and asserts equal regex sources and enum arrays. The worker remains authoritative; the client copy is UX only.
**When:** Anywhere a rule is mirrored. Prevents the drift the codebase map flagged under "Duplicate rule logic".

### Pattern 7: Test pyramid for D1 fidelity

**What:** (1) Unit and route tests on `fakeD1` (better-sqlite3 replaying every migration): fast, runs everywhere. (2) CI `placement-test-smoke` runs the real `wrangler dev --local` (Miniflare/workerd D1) with Playwright against the built site: this is the "real D1" layer and already exists. (3) One manual or scripted `wrangler d1 migrations apply --remote` against the real database before declaring the placement test done.
**Why:** The fakeD1 header says workerd crashes in the author's local sandbox, so `@cloudflare/vitest-pool-workers` is not usable there. CI on `ubuntu-latest` is not affected. Do not try to replace fakeD1 now; make the Playwright layer carry the real-D1 assurance and have it cover booking races (`bookSlotAtomic`) with a two-parallel-request test.
**Seeding:** Replace the hard-coded `2027-01-01` slot with a Playwright global setup that logs in through the real hardened admin API and creates a slot 30 days out. This removes the time bomb and exercises the new auth path on every CI run.

### Pattern 8: Signed OAuth state in a cookie (CMS worker)

**What:** `/auth` creates `state` (random), sets it in an `HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=600` cookie, and includes it in the GitHub authorize URL. `/callback` requires `query.state === cookie.state` (constant-time compare), clears the cookie, and only then exchanges the code. The popup and the worker share one origin, so the cookie is first-party to the worker; GitHub's redirect back is a top-level GET, which `Lax` allows. Then in `renderPostMessage`, only post the token when the opener's `e.origin` equals the configured CMS origin (`ALLOWED_ORIGIN` var, `https://elc.com.sa`; add localhost only behind a dev flag). Decap's protocol is: popup sends `authorizing:github` (no secret) to opener, opener replies, popup then sends the token. Pin the check at the reply step. Replace hard-coded `scope: repo,user` with a `GITHUB_SCOPE` var defaulting to `public_repo` (the repo is public per `gh repo view`). Drop `user`.
**Trade-offs:** No signing key is needed because the cookie is bound to the browser that started the flow; this is simpler than an HMAC-signed state and equally effective for login-CSRF.

## Data Flow

### Admin login and request (hardened)

```
AdminPanel ──POST /api/admin/login {username,password}──► worker
   Origin guard ─► throttle(login_attempts) ─► bcrypt ─► INSERT admin_sessions(token_hash, csrf)
   ◄── 200 {csrfToken} + Set-Cookie __Host-elc_admin
AdminPanel keeps csrfToken in memory
AdminPanel ──PATCH /api/admin/applications/:id  [cookie + x-csrf-token + Origin]──► worker
   Origin guard ─► resolveSession(D1) ─► csrf check ─► validate ─► handler ─► db.ts ─► D1
Logout ──POST /api/admin/logout──► UPDATE admin_sessions SET revoked_at ─► expired Set-Cookie
Reload  ──GET /api/admin/session──► {adminId, csrfToken} or 401 -> show login view
```

### Applicant journey (end to end on real D1)

```
RegistrationForm (step1 -> step2, 2 consents)
  ─► POST /api/session  (server re-validates every rule; computes students.name; stamps terms_* columns)
  ─► D1: students + test_sessions
TestRunner ◄─► POST /api/session/:id/answer  (scoring.ts/bands.ts/kids.ts; D1: responses)
  ─► DonePayload {level, levelName}
ResultBooking ─► GET /api/slots ─► POST /api/bookings (bookSlotAtomic, 409 = slot filled)
ApplicationForm (?session=) ─► POST /api/apply  (course + guardian only; unique per session)
Staff: AdminPanel ─► results tab (GET /api/admin/sessions, /:id) + applications (approve/reject)
```

`sessionId` is a bearer capability for the public routes (anyone holding it can continue that session). It must be an unguessable random id; confirm `crypto.randomUUID()` is used and never sequential. No public route may read applicant PII back; the only readers are `admin: true` routes.

### CMS edit flow

```
Staff ─► elc.com.sa/admin (Decap, pinned version) ─popup─► cms-oauth-worker /auth (sets state cookie)
 ─► GitHub consent ─► /callback (verify state, exchange code) ─postMessage(token, ALLOWED_ORIGIN)─► Decap
Decap ─► GitHub API (editorial_workflow: branch + PR on alibashuaib/elc-astro-rebuild)
Merge PR ─► CI build validates frontmatter against src/content.config.ts (zod)
(publish -> deploy webhook is out of scope: deploy.yml is dispatch-only until go-live)
```

### State Management

Server holds all state (D1). Browser holds only `sessionId` (applicant), an in-memory CSRF token (staff), and DOM state. No cross-tab or persisted client state is introduced.

## Decisions Required Early

### D1. Where the admin cookie lives (affects reliability, not just security)

Today the admin page on `elc.com.sa` (Hostinger) calls the Worker on `*.workers.dev` with a `SameSite=None; Secure` cookie. That is a third-party cookie. Safari blocks these by default and Firefox partitions or blocks them in some modes; Chrome's behaviour depends on user settings. Result: login can "succeed" and every following admin call 401s for some staff browsers. This is the likely cause of an unreliable "admin review of results" even after all hardening. MEDIUM confidence (browser policy changes; verify on the staff's actual browsers during the auth phase).

| Option | What it takes | Verdict |
|--------|---------------|---------|
| A. Serve the admin UI from the Worker itself (Workers static assets, same origin as the API) | `[assets]` in wrangler.toml, a minimal admin entry built from the existing AdminPanel, relative API base. Cookie becomes `SameSite=Strict`; admin needs no CORS; its own strict CSP via a headers file | Strongest; recommended if staff browsers include Safari |
| B. Custom API subdomain on `elc.com.sa` (same-site) | Needs the zone's DNS on Cloudflare (currently Hostinger). Workers custom domains require this | Only if DNS moves to Cloudflare anyway (go-live concern, not this milestone) |
| C. Keep cross-site cookie, add Origin + CSRF token | Pattern 1 to 4 only | Acceptable fallback; document "staff use Chrome/Edge" |

Recommendation: build Patterns 1 to 4 now (they work under every option and make the cookie `SameSite` a one-line config), then test on Safari. Choose A if C fails there. Do not block the auth phase on this.

### D2. Student application spec versus reality

`2026-09-06-student-application-design.md` specifies R2 document uploads and `/apply/:id/documents`. Migration 0021 dropped `application_documents` and `wrangler.toml` records that R2 was removed. The wizard spec then moves ID and email to `students`. Treat uploads as out of scope (storing ID-copy images is a new PII liability), and finish the application against the wizard spec's reduced shape (course + guardian). Update the spec note so "finished per spec" has one meaning.

### D3. Wizard branch timing

`feature/registration-wizard` (26 commits ahead of main, worktree at `.worktrees/registration-wizard`, migration `0022_registration_fields.sql`) is reviewed and complete. It touches `session.ts`, `application.ts`, `db.ts`, `types.ts`, `ApplicationForm`, `AdminPanel` and both e2e specs. Hardening touches `index.ts`, `auth.ts`, `admin.ts`, `placementApi.ts`, `AdminPanel`, `wrangler.toml`. Overlap is small (`AdminPanel`, `placementApi`). Land the wizard first so the hardening migration is `0023` with no number collision and `AdminPanel` is rewritten once against its final shape. Nothing is live, so merging earlier adds no real exposure.

## Suggested Build Order

Security precedes admin feature work. Dependencies are explicit.

1. **Foundations and unblockers (no behaviour change).** Real D1 `database_id` (it is an identifier, not a secret; commit it) and one remote `migrations apply` (check the `d1_migrations` seeding caveat in `wrangler.toml` first); pin `latest` deps to lockfile versions; `.gitattributes` and ignore `preview.*`; extract `http.ts` with `readJson()` returning 400 on malformed JSON (today `req.json()` throws and becomes a 500); commit or park the uncommitted mobile CSS; CI log upload `if: always()`.
   *Unblocks:* every later phase can be tested the same way in CI.
2. **Land `feature/registration-wizard`.** Rebase onto main, resolve `AdminPanel`/`placementApi` conflicts, run full CI. Delivers the registration wizard and the reduced application step. *Must precede 3 for migration numbering.*
3. **Admin auth core (worker side).** Migration 0023; `auth.ts` rewrite; `csrf.ts`; pipeline in `index.ts`; login throttle; `logout` and `session` routes; strict CORS (echo only allowed origins, add `Vary: Origin`, never fall back to the first allowed origin for a disallowed one); request body guards on admin routes (`capacity` integer range, ISO `startsAt`, string types on login). Tests: throttle, revoked session, disabled admin, missing Origin, wrong CSRF token, expired session. `scripts/create-admin.ts`.
   *Core value item. Everything in 4 and 6 depends on `AdminCtx`.*
4. **Admin client hardening.** `placementApi.ts` CSRF handling and 401 recovery; `AdminPanel` safe rendering via `dom.ts`, masked IDs, logout button; XSS and CSRF Playwright specs; resolve Decision D1 on real browsers.
   *Depends on 3. Closes the stored-XSS item.*
5. **CMS OAuth hardening (parallel with 3 and 4; separate package).** Pattern 8; add a Vitest test for `/auth` and `/callback` with a stubbed `fetch` (first test for this worker, plus a CI step); pin Decap's unpkg URL to an exact version (add SRI); update CSP `connect-src` only if origins change.
   *Independent of D1/admin work, so it can run concurrently.*
6. **Placement test end to end plus admin results.** Dynamic slot seeding through the admin API in Playwright global setup; real-D1 booking-race test; `routes/results.ts` (sessions list with pagination, detail with responses, joined to `students`) and a Results tab in `AdminPanel`; application approve/reject through the hardened pipeline.
   *Depends on 3 and 4 (new admin screens must be born safe).*
7. **CMS editing reliability.** After 5: reconcile `public/admin/config.yml` with `src/content.config.ts`, add a CI test that every zod field either appears in the Decap config or is knowingly excluded, and perform one real login-edit-save round trip.
8. **Mobile polish and full UI design review (AR and EN, phone and desktop), then fixes.** Independent of backend work; run last so the review sees final screens including the new Results tab. Use the existing Playwright setup with a mobile viewport project for AR+EN snapshot checks.

Parallelism: 5 alongside 3 and 4. 8 can start earlier for public pages, but its admin pass waits for 6.

## Anti-Patterns

### Anti-Pattern 1: Stateless signed cookie for sessions that must be revocable
**What people do:** HMAC `adminId.expires.sig` (the current code).
**Why it's wrong:** Offboarding or a stolen cookie cannot be undone until expiry; the NaN-TTL bug in `issueSessionCookie` was a symptom of hand-rolled expiry parsing.
**Do this instead:** Opaque token plus D1 row (Pattern 2).

### Anti-Pattern 2: Checking auth inside each handler
**What people do:** `application.ts` re-calls `getSessionAdminId` as "defence in depth".
**Why it's wrong:** Two code paths to keep in step; a new admin route can forget the check.
**Do this instead:** Single pipeline stage producing `AdminCtx`; handlers receive it.

### Anti-Pattern 3: `Access-Control-Allow-Credentials: true` on every response, with a fallback origin
**What people do:** `withCors` sets credentials and the first allowed origin even for disallowed callers.
**Why it's wrong:** Harmless today but one allowlist edit away from a credentialed wildcard-like mistake, and it hides origin bugs.
**Do this instead:** Echo the origin only when allowed; omit CORS headers otherwise; add `Vary: Origin`. Keep the `LOCAL_DEV === 'true'` gating exactly as is.

### Anti-Pattern 4: `innerHTML` with applicant data
**What people do:** Template-literal rows in `AdminPanel`.
**Why it's wrong:** Stored XSS in the one screen that shows national IDs.
**Do this instead:** Pattern 5.

### Anti-Pattern 5: Shipping tests that never see real SQLite-in-workerd
**What people do:** Trust fakeD1 alone for booking atomicity.
**Do this instead:** Pattern 7; keep the CI smoke job as the real-D1 gate and make it fail loudly with logs.

### Anti-Pattern 6: Adding a second source of truth for rules
**What people do:** Re-implement level or validation rules on the client.
**Do this instead:** Worker authoritative; client renders returned fields (`levelName`, `skipAvailable`); mirrored UX validation only with a contract test.

## Scaling Considerations

Realistic load is a handful of staff and low hundreds of applicants per intake. Nothing here needs scaling work.

| Concern | Now | If volume grows |
|---------|-----|-----------------|
| Admin list queries | Full-table reads (`listBookingsWithDetails` etc.) | Add `LIMIT/OFFSET` (do it for the new results endpoints from day one; add to existing lists in phase 6) |
| Session lookups | 1 D1 read per admin request | Fine; purge expired rows with a periodic cleanup, or lazily on login |
| Slot booking contention | Single conditional `UPDATE` in `bookSlotAtomic` | Race test in phase 6 is enough |
| Login throttle storage | One row per username+ip | Delete rows older than the window on write |
| Public POST abuse (`/api/session`, `/api/apply`) | Unthrottled | Reuse the `login_attempts` pattern keyed by IP only if spam appears |

## Integration Points

### External Services

| Service | Pattern | Notes |
|---------|---------|-------|
| Cloudflare D1 | Binding `DB`, wrangler migrations | Replace the all-zero id; `database_id` is an identifier, not a credential. Seed `d1_migrations` if the remote DB was built by the old per-file chain |
| GitHub OAuth | cms-oauth-worker | Secrets via `wrangler secret put`; add `ALLOWED_ORIGIN` and `GITHUB_SCOPE` as plain vars |
| GitHub API (Decap) | Browser to `api.github.com` | Already in CSP `connect-src` |
| Hostinger | Static host + `.htaccess` CSP | CSP `connect-src` lists the exact worker origins; any new admin origin (Decision D1 option A) needs a matching entry or the admin page moves entirely off Hostinger |
| Cloudflare cron/WAF | Not used | A WAF rate rule needs a zone, which `workers.dev` does not give you; skip |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Static site to worker | HTTPS JSON, `credentials: 'include'` only for admin calls | Public calls need no credentials; consider dropping `credentials: 'include'` on public requests so cookies never ride on them |
| Client validation to worker validation | Mirrored constants + contract test | Worker is authoritative |
| `routes/*` to `db.ts` | Direct function calls | All SQL stays in `db.ts`; no SQL in routes |
| Worker to CMS worker | None | Deliberately independent deploys and secrets |
| Decap config to zod schema | Shared field names | Enforced by CI test (phase 7) |
| Test layers | fakeD1 (unit) / wrangler local (CI smoke) / remote D1 (manual) | See Pattern 7 |

## Verify in Phase (open items, not yet confirmed)

- **Third-party cookie behaviour on staff browsers** (Decision D1): test login then a second admin call on Safari, Firefox, Chrome. MEDIUM.
- **Decap save semantics:** does saving an existing course keep frontmatter fields that are in the zod schema but absent from `config.yml` (`priceUnit`, `classTimes`, `intakeSchedule`, `hoursPerLevel`, `hoursPerDay`, `scheduleDays`, `durationUnit`, `draft`)? If Decap drops them, a routine CMS edit silently deletes data. LOW until tested with a real edit.
- **Decap media config:** `media_folder: src/assets/uploads` does not exist and `public_folder: /uploads` does not map to it, while the schema types `image` as a plain string. An uploaded image may not resolve in the built site. Test one upload.
- **`public_repo` scope sufficiency** for Decap `editorial_workflow` (branch creation and PRs) on a public repo, and that the editor's GitHub account has write access to the repo. MEDIUM; Decap docs distinguish `public_repo` and `repo`, confirm with a live login.
- **Production D1 state:** was the remote database created with the old per-file `d1 execute` chain (no `d1_migrations` table)? Unknown from the repo.
- **Wizard branch residuals:** the branch's final review commit exists, but confirm CI is green after rebase onto main (main moved 6+ commits; the branch holds its own `0022`).
- **`DROP COLUMN` in 0022** on real D1: SQLite permits dropping a column whose only CHECK is on itself, and better-sqlite3 accepted it in the branch tests, but run it once against `wrangler dev --local` and the remote DB before relying on it.

## Sources

- Codebase map: `.planning/codebase/{ARCHITECTURE,STRUCTURE,INTEGRATIONS,CONCERNS}.md` (HIGH, mapped 2026-11-04)
- Source read directly: `placement-test-worker/src/{index,auth}.ts`, `routes/{admin,application}.ts`, `wrangler.toml`, `package.json`, `src/test-utils/fakeD1.ts`, migrations 0001/0019/0021, `cms-oauth-worker/src/index.js`, `public/admin/{index.html,config.yml}`, `public/.htaccess`, `.github/workflows/ci.yml`, `src/content.config.ts` (HIGH)
- Specs: `docs/superpowers/specs/2026-09-06-student-application-design.md`, `2026-09-08-registration-wizard-design.md` (HIGH); `feature/registration-wizard` worktree inspected for migration 0022 and commit state
- Cloudflare Workers Rate Limiting binding docs (developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/): per-location, approximate, periods 10 or 60 s only, Wrangler >= 4.36.0 (HIGH, fetched this session)
- Decap OAuth postMessage protocol referenced in `cms-oauth-worker/src/index.js` header (decapcms.org custom OAuth client docs) (MEDIUM, not re-fetched)
- Browser third-party cookie behaviour and Decap save semantics: general platform knowledge, flagged for verification (MEDIUM/LOW)

---
*Architecture research for: ELC Astro rebuild, harden and finish*
*Researched: 2026-11-04*
