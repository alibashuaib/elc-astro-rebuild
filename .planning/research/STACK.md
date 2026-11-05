# Technology Stack (Harden and Finish milestone)

**Project:** ELC Astro Rebuild (Astro 7 static site, `placement-test-worker` on Workers + D1, `cms-oauth-worker`)
**Researched:** 2026-11-04
**Scope:** Only what is needed for the hardening and finish tasks. The existing stack (Astro, Workers, D1, Playwright, Lighthouse CI) is mapped in `.planning/codebase/STACK.md` and is not re-researched.
**Overall confidence:** HIGH on versions (checked against the npm registry today) and on Cloudflare platform behavior (checked against official docs); MEDIUM on three items flagged below.

## Headline decisions

1. **No new runtime dependencies for security.** Rate limiting, CSRF, sessions, OAuth state and XSS fixes are all done with the Workers Rate Limiting binding, D1, Web Crypto and plain DOM APIs. Only optional new runtime dep: a validator (Zod).
2. **`@cloudflare/vitest-pool-workers` is dead. Use `@cloudflare/vitest-plugin`.** npm marks the old package deprecated ("renamed to @cloudflare/vitest-plugin. This package will not receive future updates"). Current repo has `vitest-pool-workers: latest` (0.22.0) and, in fact, no vitest config at all, so the Workers pool is not used today; tests run in plain Node against `fakeD1`.
3. **Pin everything to exact versions** from the table below. They are mutually compatible (checked via peer deps).
4. **Biggest non-obvious risk:** the admin cookie is `SameSite=None` and cross-site (`elc.com.sa` to `*.workers.dev`). Safari blocks third-party cookies, so admin login can silently fail there. See "Cross-site cookie risk".

## Recommended Stack

### Pinned versions (replace every `latest`)

| Package | Pin to | Currently | Confidence | Why |
|---|---|---|---|---|
| `wrangler` | `4.157.0` | `latest` (installed 4.125.0) | HIGH | Current npm latest. Rate limiting binding needs >= 4.36.0. `@cloudflare/vitest-plugin@1.5.1` depends on exactly this wrangler, so pinning the same avoids two wranglers in the tree. |
| `@cloudflare/workers-types` | `5.20261104.1` | `latest` (installed 5.20260825.1) | HIGH | Current latest. The plugin peers `^5.20261103.1`, so the old installed one would warn. |
| `@cloudflare/vitest-plugin` | `1.5.1` | n/a (replaces `vitest-pool-workers` 0.22.0) | HIGH | Official successor; peers `vitest ^4.1.0 \|\| ^5.0.0`. Codemod exists: `npx @cloudflare/codemods vitest:pool-workers-to-vitest-plugin`. |
| `vitest` | `4.1.12` | `latest` (installed 4.1.11; npm latest is 5.1.0) | HIGH on compat, MEDIUM on choice | Stay on 4.x for this milestone: the suite passes on 4.1.11 today, the plugin supports it, and moving the test runner AND the major version at once doubles the debugging surface. Plugin also supports 5.x, so bump later as its own small task. |
| `typescript` | `7.0.2` | `latest` (installed 7.0.2) | HIGH | Already what CI runs. Just freeze it. |
| `bcryptjs` | `3.0.3` | `latest` (installed 3.0.3) | HIGH | Freeze to what produced the existing hashes. Last published April 2026, stable. Existing hashes stay valid, no rehash needed. |
| `@playwright/test` | `1.64.1` | `^1.62.1` (installed 1.63.0) | HIGH | Current latest. Drop the caret so the CI browser cache key and local runs match. |
| `better-sqlite3` | `13.0.3` | `^13.0.3` | HIGH | Already exact in practice. Becomes removable once `fakeD1` is retired (see Testing). |

Use `npm install --save-exact` and set `save-exact=true` in an `.npmrc` so a future `npm i` does not re-introduce carets. `npm ci` already enforces the lockfile; pinning stops a *regenerated* lockfile from jumping majors (bcryptjs, vitest, typescript all had that exposure).

### Core platform features (no dependency)

| Need | Use | Why | Confidence |
|---|---|---|---|
| Login brute-force, coarse gate | **Workers Rate Limiting binding** (`[[ratelimits]]`, `env.LOGIN_LIMITER.limit({ key })`) | Native, zero-latency, no D1 write on every attempt. Docs: `limit` per Cloudflare location, `period` must be 10 or 60, counts are eventually consistent and **explicitly permissive/approximate**, so it is a first gate, not an authority. | HIGH (official docs) |
| Login brute-force, authoritative | **D1 table `login_attempts`** keyed by normalized username, atomic `INSERT ... ON CONFLICT DO UPDATE`, lockout after N failures in a window | The binding is per-location and approximate; with only a handful of admins an exact per-account counter in D1 is cheap and deterministic to test. Check both **before** calling bcrypt, so attackers cannot burn Worker CPU. | HIGH (pattern), MEDIUM on thresholds |
| CSRF | **Exact `Origin` allowlist check** on every non-GET `/api/*` route (reject if missing or not in `ALLOWED_ORIGINS`), reusing `isAllowedOrigin` already in `src/index.ts`; plus require `Content-Type: application/json` | The browser always sends `Origin` on cross-origin POST/PATCH/DELETE, and a forged cross-site request cannot set it. Reuses the existing allowlist, ~10 lines, in the one shared `fetch` handler (not per route). Do NOT rely on `Sec-Fetch-Site`: legitimate calls from `elc.com.sa` to `workers.dev` are also `cross-site`. | HIGH |
| Revocable sessions | **D1 table `admin_sessions`** (`id_hash`, `admin_id`, `expires_at`, `created_at`); cookie holds an opaque 256-bit random token from `crypto.getRandomValues`; store only its SHA-256 (`crypto.subtle.digest`); logout and "disable admin" delete rows | Replaces the stateless HMAC cookie so logout, offboarding and password change are immediate. Opaque tokens beat session-version counters because you can also revoke one device. D1 (not KV) because KV is eventually consistent and a revoked session could survive. `ADMIN_COOKIE_SECRET` and the regex cookie parser can then be deleted. | HIGH |
| Cookie hardening | Name `__Host-elc_admin_session`; keep `HttpOnly; Secure; Path=/; SameSite=None` while cross-site; parse with split-on-`;` exact-name match | `__Host-` forbids `Domain` and forces `Secure` and `Path=/`, so sibling subdomains cannot plant a duplicate cookie (the ambiguity noted in CONCERNS). Compatible with `SameSite=None`. | HIGH |
| Timing-safe compare | `crypto.subtle.timingSafeEqual` (Workers extension) | Replaces the hand-rolled `constantTimeEqual`. Only needed for CMS state compare once sessions are hashed lookups. | HIGH (documented in Workers Web Crypto page) |
| CMS OAuth `state` | **Random state bound to the browser by a short-lived cookie** (`__Host-oauth_state`, `HttpOnly; Secure; SameSite=Lax; Max-Age=600`), compared in `/callback`, cleared on every callback | The current "sign the state" suggestion in CONCERNS is not enough: an HMAC-signed state that is not tied to the initiating browser still permits login CSRF. Cookie-bound state is the pattern from RFC 9700 (OAuth 2.0 Security BCP). Lax is fine because GitHub's redirect to `/callback` is a top-level GET. No new secret needed. | HIGH |
| CMS OAuth PKCE (optional add) | `code_challenge` (S256) on `/auth`, `code_verifier` on token exchange | GitHub added PKCE for OAuth apps on 2025-07-14 (S256 only), recommended but not required. Cheap extra since the verifier can live in the same state cookie. Optional, do after state works. | MEDIUM (GitHub changelog; behavior not exercised) |
| CMS OAuth scope | `public_repo` instead of `repo,user`; **hard-code server-side and ignore any `scope` query param from Decap** | `alibashuaib/elc-astro-rebuild` is a **public** repo (verified via `gh`), and `public_repo` covers branches, commits and PRs on public repos, which is what Decap `editorial_workflow` needs. Drops access to all private repos of the staff member. Decap's own docs only say users need push access; the scope guidance comes from community proxies, so verify with one real login. | MEDIUM |
| CMS OAuth postMessage origin | Compare `e.origin` to the constant `https://elc.com.sa` (plus loopback only if you add a `LOCAL_DEV` var) before sending the token. The first `authorizing:github` handshake message must stay `'*'` (no secret, opener origin not yet known); only the **token-bearing** reply is pinned | Token goes only to the CMS origin, not whoever opened the popup. | HIGH |
| XSS-safe admin rendering | Build nodes with `document.createElement` + `textContent`/`value`, and `replaceChildren()`; for the few remaining template strings use a 5-line `escapeHtml` in `src/lib/` | Native and enough: the admin list shows plain text (names, emails, IDs), no rich HTML. The site CSP has `script-src 'unsafe-inline'` (needed for Astro inline scripts), so CSP will **not** stop an injected inline payload; output encoding is the only real fix. | HIGH |

### Supporting libraries

| Library | Version | Purpose | When to use |
|---|---|---|---|
| `zod` | `4.6.7` | Validate request bodies at trust boundaries (admin login types, slot `startsAt`/`capacity`, application email/ID) | Add when you touch each route for the finish-features work. Pick it over Valibot for ecosystem familiarity; bundle size is irrelevant at this route count. Skip entirely if you prefer 10-line hand guards, the CONCERNS gap is real either way. Confidence MEDIUM (preference, not necessity). |
| `@axe-core/playwright` | `4.14.0` | Automated accessibility scan inside Playwright specs (labels, contrast, `lang`/`dir`) | Run in the AR+EN, mobile+desktop design-review matrix. Peers `playwright-core >=1`, so no conflict. HIGH on version. |
| `@msw/cloudflare` | check at install | Mock outbound `fetch` (GitHub token endpoint) in `cms-oauth-worker` tests | Official docs recommend it for outbound mocking in the vitest plugin. Alternative with no dependency: `vi.stubGlobal('fetch', ...)`. Prefer the stub for a 2-endpoint worker. LOW (not verified). |

### Testing stack

| Layer | Use | Details |
|---|---|---|
| Worker unit/route tests against **real D1 semantics** | `vitest` 4.1.12 + `@cloudflare/vitest-plugin` 1.5.1 | `vitest.config.ts`: `readD1Migrations('./migrations')` in Node, pass as a test-only binding `TEST_MIGRATIONS` via `cloudflareTest({ wrangler: { configPath: './wrangler.toml' }, miniflare: { bindings: { TEST_MIGRATIONS } } })`, and a setup file calling `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` (imported from `cloudflare:test`). Call routes with `exports.default.fetch(...)` and read bindings from `env` (both from `cloudflare:workers`). Pattern taken from the official fixture `fixtures/vitest-plugin-examples/d1` in cloudflare/workers-sdk. Each test file gets isolated storage. HIGH. |
| Migration chain replay | Same setup | `applyD1Migrations` on an empty DB for all 21 migrations *is* the missing "replay the chain" test from CONCERNS, for free. |
| `bookSlotAtomic` race | One test with `Promise.all` of N bookings against capacity-1 slot | Only meaningful on real D1 (workerd), not `fakeD1`. |
| Retire `fakeD1` | Once the plugin suite covers the same files, delete `test-utils/fakeD1.ts` and `better-sqlite3` + `@types/better-sqlite3` + the `allowScripts` entry | Two parallel test harnesses is the cost of keeping it. Caveat: `fakeD1.ts` says workerd crashed on startup in the *previous sandbox*; GitHub `ubuntu-latest` already runs `wrangler dev` (workerd) in the smoke job, so CI should work. Verify on the user's Windows machine in the first plan before deleting anything. MEDIUM. |
| Test speed | Seed test admins with `bcrypt.hash(pw, 4)` | Tests currently hash at cost 10. Production cost stays as-is. |
| Rate limiter in tests | Override `LOGIN_LIMITER` with a stub `{ limit: async () => ({ success: true }) }`; test lockout via the D1 counter | The binding is approximate by design, so do not assert exact counts on it. |
| CMS OAuth worker | Same plugin, second `vitest.config.ts` in `cms-oauth-worker/` (it has no package.json or tests today; needs its own `npm ci` step in CI) | Assert: `/auth` sets the state cookie and redirects with matching `state`; `/callback` with missing or wrong state returns 400 and never calls the token URL; scope is `public_repo`. |
| E2E | `@playwright/test` 1.64.1 against `wrangler dev --local` | Seed the bookable slot with a computed future date in the CI step (`date -u -d '+30 days'`), not 2027-01-01. |

### Playwright RTL and mobile matrix

Use projects in `playwright.config.ts`, no new package:

| Project | Config | Why |
|---|---|---|
| `ar-mobile` | `{ ...devices['iPhone 14'] (or current closest descriptor), locale: 'ar-SA' }` | Phone width + WebKit engine is the primary real-world AR audience (and the Safari cookie risk). |
| `en-mobile` | `{ ...devices['Pixel 7'], locale: 'en-US' }` | Chromium mobile. |
| `ar-desktop` / `en-desktop` | `devices['Desktop Chrome']` | Desktop pass for the design review. |

Assertions that catch RTL and mobile regressions without pixel baselines:
- `document.documentElement.dir === 'rtl'` and `lang` on `/ar/*`.
- No horizontal overflow: `document.documentElement.scrollWidth <= window.innerWidth`.
- Touch target and FAB position checks via bounding boxes (WhatsApp FAB must sit on the inline-end side in RTL).
- `axe` scan per page.

Avoid `toHaveScreenshot()` as a gate: baselines differ between the developer's Windows machine and `ubuntu-latest`. If used at all, generate and compare only in CI (Linux), and keep it for the design-review phase, not the regression suite. Install `webkit` too (`npx playwright install --with-deps chromium webkit`) so the Safari engine is exercised. Note: the installed `playwright-core` ships device descriptors, confirm exact `iPhone`/`Pixel` names with `npx playwright --version` and the `devices` object at implementation time (could not be listed from the on-disk file during research).

## Cross-site cookie risk (decision needed before the sessions work)

`placement-test-worker` lives on `*.workers.dev`; the admin UI lives on `elc.com.sa`. They are different *sites*, so the session cookie is third-party. Chrome and Firefox (partitioned) tolerate it; **Safari blocks third-party cookies by default**, so admin login would appear to succeed and every later call would 401. Options, best first:

| Option | Effect | Cost |
|---|---|---|
| A. Put the Worker on a custom domain under `elc.com.sa` (e.g. `api.elc.com.sa`) | Same-site, so `SameSite=Strict`, CSRF risk collapses, Safari works | Workers Custom Domains need the zone on Cloudflare. `elc.com.sa` currently uses `dns-parking.com` nameservers (Hostinger), so this means moving DNS, a go-live-adjacent decision. LOW feasibility now. |
| B. Serve the admin page from the Worker itself (Workers static assets) | Same-origin, first-party cookie | Admin stops being an Astro page on elc.com.sa. Medium refactor. |
| C. Keep cookie + `Origin` check + JSON-only (the milestone's stated plan) and make the session store transport-agnostic so a `Authorization: Bearer` token (kept in memory/sessionStorage) can be added if Safari testing fails | Works everywhere, immune to CSRF by construction | Token is readable by XSS (HttpOnly lost), mitigated by the XSS fixes above. |

Recommendation: do C now (D1 opaque session ids make the Bearer variant a 5-line change), **test admin login in WebKit in the Playwright matrix in the first hardening phase**, and treat A as a go-live task. Confidence MEDIUM: Safari behavior is well known but not verified against this deployment.

## Other platform constraints that affect the plan

- **bcryptjs CPU cost on Workers.** Workers Free allows 10 ms CPU per HTTP request; Paid defaults to 30 s (official limits page). Pure-JS bcrypt at cost 10 is far above 10 ms, so admin login only works reliably on the **Paid plan**. Confirm the account plan before relying on login. Do **not** swap to native PBKDF2 casually: secondary sources report Workers caps PBKDF2 at 100,000 iterations (below the OWASP 600,000 guidance) and Cloudflare's docs do not state it, so it is unverified. Keep bcryptjs; rate limiting before bcrypt protects the CPU budget. MEDIUM-LOW.
- **Rate limiting binding pricing/quotas** are not stated on the docs page fetched. Verify it is not billed on Free before depending on it. Counters are per location, so a distributed attacker is only throttled per colo; that is why the D1 per-account counter is the authority.
- **Rate limiting key choice.** Docs advise against IP-only keys. Use `login:${normalizedUsername}` for the binding and also a second check keyed on `CF-Connecting-IP` for credential stuffing across usernames. D1 lockout is per username only.
- **Binding config:** `[[ratelimits]] name = "LOGIN_LIMITER", namespace_id = "<unique positive int string>", [ratelimits.simple] limit = 5, period = 60`. `namespace_id` is account-unique; bindings sharing it share counters.
- **Rate-limit monitoring:** the binding does not show in the dashboard; log `429`s (Workers Logs) or write to Analytics Engine.
- **D1 `database_id`:** `wrangler d1 create placement-test` prints the real id; commit it (D1 ids are identifiers, not secrets), or keep the placeholder out of the deployed config via `wrangler.toml` env sections. Both are fine. HIGH.
- **Types:** `wrangler types` can generate `Env` from `wrangler.toml` so new bindings (`LOGIN_LIMITER`) cannot drift from the hand-written `Env` interface. Keep `@cloudflare/workers-types` for runtime types. MEDIUM (preference).

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Rate limiting | Binding + D1 per-account counter | Durable Object per user | Exact but adds a DO class, migration and wrangler config for ~3 admins. Revisit only if lockout accuracy matters more than simplicity. |
| Rate limiting | Binding + D1 counter | Cloudflare WAF rate-limiting rules | WAF rules need the hostname on a Cloudflare zone; `workers.dev` is not. |
| Rate limiting | Binding + D1 counter | Turnstile CAPTCHA on login | Extra widget, sitekey, CSP changes, third-party script, for 3 admins. Not worth it. |
| Sessions | Opaque token in D1 | Signed JWT (`jose`) | Same revocation problem as today's HMAC cookie; adds a dependency. |
| Sessions | D1 | Workers KV | Eventual consistency; a revoked session can still validate for up to ~60 s or more. |
| Sessions | Opaque token in D1 | Session-version counter on `admin_users` | Works but revokes all devices at once and still needs a D1 read; the sessions table costs the same and is more flexible. |
| Framework | Existing hand-rolled router | Hono (`4.13.16`) with `csrf`/`secureHeaders` middleware | Would be a rewrite of `index.ts`, outside "harden and finish". |
| Sanitizing | `textContent` / `escapeHtml` | DOMPurify (`3.4.17`) | Needed only for rendering untrusted *HTML*; this UI renders untrusted *text*. |
| CSRF | Origin allowlist + JSON-only | CSRF tokens (double submit) | More moving parts and a readable-cookie problem across origins. Origin check is the OWASP-sanctioned defense-in-depth for this shape. |
| OAuth state | Cookie-bound random state | HMAC-signed state | Does not bind to the browser, login CSRF stays possible. |
| Worker testing | `@cloudflare/vitest-plugin` | `unstable_dev` / raw Miniflare | `unstable_dev` is marked unstable in the docs; the plugin runs in-workerd with `applyD1Migrations`. |
| Worker testing | Real D1 via plugin | Keep growing `fakeD1` (better-sqlite3) | Cannot reproduce D1 batch/atomicity semantics, the exact gap flagged in CONCERNS. |
| Test runner version | `vitest` 4.1.12 now | `vitest` 5.1.0 | Supported by the plugin, but defer: change one variable at a time. |
| Visual testing | axe + geometry assertions | Playwright screenshot baselines | OS font rendering differences make Windows-local vs Linux-CI baselines flaky; Arabic shaping makes it worse. |

## Installation

```bash
# placement-test-worker (exact versions)
cd placement-test-worker
npm uninstall @cloudflare/vitest-pool-workers
npm install --save-exact bcryptjs@3.0.3
npm install -D --save-exact wrangler@4.157.0 @cloudflare/workers-types@5.20261104.1 \
  @cloudflare/vitest-plugin@1.5.1 vitest@4.1.12 typescript@7.0.2
# optional, only if adopting validation
npm install --save-exact zod@4.6.7

# root
npm install -D --save-exact @playwright/test@1.64.1 @axe-core/playwright@4.14.0
echo "save-exact=true" >> .npmrc

# cms-oauth-worker needs its own package.json + lockfile to get tests and a CI step
cd ../cms-oauth-worker
npm init -y && npm install -D --save-exact wrangler@4.157.0 vitest@4.1.12 @cloudflare/vitest-plugin@1.5.1
```

## What NOT to use

- `@cloudflare/vitest-pool-workers` (deprecated and renamed).
- `"latest"` or `^` ranges on anything in the Worker packages.
- IP-only rate-limit keys, or the rate limiting binding as the *only* brute-force control.
- `localStorage` for any Bearer fallback token (use in-memory or `sessionStorage`).
- `innerHTML` with any interpolated applicant field; `DOMPurify` as a substitute for not rendering HTML.
- Signing `state` without binding it to the browser.
- `repo,user` OAuth scope on a public repo.
- Cookie `Domain=` attributes or an unprefixed cookie name.

## Open questions for the roadmap

1. Is the Cloudflare account on **Workers Paid**? (Decides whether bcryptjs login is viable; also quotas for the rate limiting binding.)
2. Will `elc.com.sa` DNS ever move to Cloudflare? (Enables option A; otherwise stay on C.)
3. Does workerd run on the user's Windows machine (the old `fakeD1` note says it crashed in one sandbox)? Gate the `fakeD1` deletion on this.
4. One real GitHub login with `public_repo` to confirm Decap editorial workflow still opens PRs.

## Sources

- Cloudflare Workers Rate Limiting binding docs, https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ (HIGH, official)
- Cloudflare Workers limits, https://developers.cloudflare.com/workers/platform/limits/ (HIGH, official)
- Cloudflare Workers Web Crypto, https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ (HIGH, official)
- Cloudflare Vitest integration, configuration, test APIs and plugin migration guide, https://developers.cloudflare.com/workers/testing/vitest-integration/ (HIGH, official)
- Official D1 + plugin fixture (`vitest.config.ts`, `test/apply-migrations.ts`, `test/routes.test.ts`), cloudflare/workers-sdk `fixtures/vitest-plugin-examples/d1` (HIGH)
- Cloudflare D1 local development, https://developers.cloudflare.com/d1/best-practices/local-development/ (HIGH, official)
- Cloudflare Workers Custom Domains (zone required), https://developers.cloudflare.com/workers/configuration/routing/custom-domains/ (HIGH)
- GitHub changelog, PKCE for OAuth apps (2025-07-14), https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/ (MEDIUM, via search summary)
- npm registry queries on 2026-11-04 for all versions, deprecation notice and peer dependencies (HIGH)
- Community reports of the 100k PBKDF2 cap on Workers, https://lord.technology/2024/02/21/hashing-passwords-on-cloudflare-workers.html (LOW, unconfirmed by Cloudflare docs)
- Community Decap OAuth proxies for scope and state patterns, https://github.com/ConnorPrettyman/decap-proxy (LOW, reference pattern only)
- RFC 9700 (OAuth 2.0 Security Best Current Practice) for state/PKCE guidance (HIGH, from background knowledge, not re-fetched)
- Local repo inspection: `placement-test-worker/src/{auth,index,types}.ts`, `cms-oauth-worker/src/index.js`, `public/admin/*`, `public/.htaccess` CSP, `wrangler.toml` files, `gh repo view` (public), `nslookup elc.com.sa` (dns-parking.com)
