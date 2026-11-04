# Walking Skeleton — ELC Astro Rebuild

**Phase:** 1
**Generated:** 2026-11-04

This is a brownfield project: the site, both Workers and the D1 schema (21 migrations) already exist. Phase 1 does not scaffold anything new. It turns the existing end-to-end path into one reproducible, locally runnable proof that every later phase builds on.

## Capability Proven End-to-End

A student opens the freshly built bilingual site, takes the placement test, books a slot that the test harness created 30 days ahead, and submits an application, all against the local placement-test Worker and its local D1, proven by one command: `npm run test:all`.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Astro 7, static output, `en`/`ar` locale routing always prefixed (pinned `astro` 7.2.4, the lockfile version) | Existing site; static output keeps hosting a plain upload. Upgrades happen deliberately, not via a floating range |
| API | Cloudflare Worker `placement-test-worker` (wrangler 4.157.0), one `fetch` router in `src/index.ts`, handlers in `src/routes/*` | Existing; no new backend allowed (PROJECT constraint) |
| Data layer | Cloudflare D1, schema owned by `placement-test-worker/migrations/NNNN_name.sql`, applied with `wrangler d1 migrations apply` (tracked in `d1_migrations`) | Same files feed local dev, tests and remote deploy, so schema drift between them is impossible |
| Request bodies | Shared `readJson()` in `src/http.ts`; bad JSON is a 400 `{ error: 'invalid_json' }` from one catch in `index.ts` | One choke point; field validation is added on top in Phases 3-4 |
| Auth | Existing signed HMAC admin cookie (unchanged in Phase 1) | Phase 4 replaces it with server-side D1 sessions, logout, throttle and CSRF/Origin checks |
| Worker tests | Vitest 4.1.12 + `@cloudflare/vitest-plugin` 1.5.1 inside workerd on a real local D1; all migrations replayed per test file; generic `beforeEach` empties every non-seed table; `createFakeD1()` kept as the name, returns `env.DB` | Real D1 semantics (`batch()` atomicity for Phase 6); no test-file churn against `feature/registration-wizard` |
| End-to-end tests | Playwright 1.64.1; `webServer` starts the Worker (migrate then `wrangler dev` on :8787); `globalSetup` builds the site against it, seeds slot `e2e-slot` at now+30 days, serves `dist/` with Astro's in-process `preview()` on :4322 | Same config locally and in CI; no date bomb; no orphaned preview process on Windows |
| Supply chain | Exact versions only, `save-exact=true` in each package's `.npmrc`, committed lockfiles, `npm ci`, `scripts/check-pins.mjs` first in `test:all` and in CI | Reproducible installs; a floating range fails the build |
| Repo hygiene | `.gitattributes` `* text=auto eol=lf`; `preview.log`, `preview.pid`, `.dev.vars` ignored | No CRLF noise from the Windows dev box; secrets never staged |
| Deployment target | Phases 1-7: local full stack only (`npm run test:all`, `astro dev`/`preview`, `wrangler dev --local`). Phase 8: remote D1 migrate, `wrangler deploy`, FTP upload of `dist/` | Owner's workflow: verify everything locally, then upload |
| Directory layout | Root = Astro site (`src/`, `public/`, `tests/e2e/`, `scripts/`); `placement-test-worker/` = own npm package (`src/`, `test/`, `migrations/`); `cms-oauth-worker/` = OAuth worker (gets its own package in Phase 5) | Existing layout; each Worker keeps its own lockfile |

## Stack Touched in Phase 1

- [x] Project scaffold — existing; Phase 1 pins its packages and adds `test:worker` / `test:all` / `check:pins` scripts
- [x] Routing — `/en/placement-test/`, `/en/contact/`, course pages exercised by the smoke specs
- [x] Database — real reads and writes on local D1: session start, answers, slot listing, booking, application insert (smoke), plus every worker unit test on real D1
- [x] UI — placement test, slot button, application form wired to the Worker (`tests/e2e/application.spec.ts`)
- [x] Deployment — documented local full-stack run command: `npm run test:all` (pin check, worker tests + typecheck, Playwright smoke). Live deploy is Phase 8

## Out of Scope (Deferred to Later Slices)

- Registration wizard merge and migration 0022 (Phase 3)
- Admin sessions, logout, throttle, CSRF/Origin guard, XSS-safe admin client, migration 0023 (Phase 4)
- `cms-oauth-worker` package, tests, CI job, OAuth hardening, Decap pin (Phase 5)
- Atomic booking test on real D1, placement funnel e2e, admin results/applicant tools (Phase 6)
- Playwright mobile/desktop and AR/EN projects, 360/390px overflow checks (Phase 7)
- Remote D1 `database_id`, remote migrations, worker deploys, FTP upload (Phase 8)
- Bumping astro past the lockfile version (Dependabot PRs exist; not part of FND-01)
- The floating `npx @lhci/cli@0.13.x` in CI (outside any package.json; known exception)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without changing the decisions above:

- Phase 2: owner has a written, prioritised design review (AR + EN, mobile + desktop)
- Phase 3: applicants finish the registration wizard and application on `main` (migration 0022)
- Phase 4: staff log in and out of an admin that resists brute force, CSRF, stale sessions and stored XSS (migration 0023)
- Phase 5: staff edit every course field in Decap CMS through a hardened OAuth flow
- Phase 6: placement test -> result -> booking -> application on local D1 with atomic booking and staff review tools
- Phase 7: every page correct at phone width in AR + EN; all design must-fixes closed
- Phase 8: the locally verified build is live on the domain with both Workers deployed
