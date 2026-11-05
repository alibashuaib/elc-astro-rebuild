---
phase: 01-foundations
verified: 2026-11-05T12:00:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - ".gitattributes"
  - ".github/workflows/ci.yml"
  - ".gitignore"
  - ".npmrc"
  - ".planning/phases/01-foundations/01-01-PLAN.md"
  - ".planning/phases/01-foundations/01-01-SUMMARY.md"
  - ".planning/phases/01-foundations/01-02-PLAN.md"
  - ".planning/phases/01-foundations/01-02-SUMMARY.md"
  - ".planning/phases/01-foundations/01-03-PLAN.md"
  - ".planning/phases/01-foundations/01-03-SUMMARY.md"
  - ".planning/phases/01-foundations/01-04-PLAN.md"
  - ".planning/phases/01-foundations/01-04-SUMMARY.md"
  - "package.json"
  - "placement-test-worker/.npmrc"
  - "placement-test-worker/package.json"
  - "placement-test-worker/src/http.ts"
  - "placement-test-worker/src/index.ts"
  - "placement-test-worker/src/malformed.test.ts"
  - "placement-test-worker/src/routes/admin.ts"
  - "placement-test-worker/src/routes/application.ts"
  - "placement-test-worker/src/routes/booking.ts"
  - "placement-test-worker/src/routes/session.ts"
  - "placement-test-worker/src/test-utils/fakeD1.ts"
  - "placement-test-worker/test/apply-migrations.ts"
  - "placement-test-worker/test/migrations.test.ts"
  - "placement-test-worker/vitest.config.ts"
  - "playwright.config.ts"
  - "scripts/check-pins.mjs"
  - "tests/e2e/global-setup.ts"
covered_digest: "v4:sha256:fea293b5f90a0a516e0b7abcebd22349e38e9413259f80ab3f4a6e66c850676e"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Push the branch and watch the first CI run on GitHub (Ubuntu)"
    expected: "build-and-audit runs `npm run check:pins` green; placement-test-smoke runs `npm run smoke` green (Playwright webServer + globalSetup on Linux)"
    why_human: "CI has never run on Ubuntu with the new path. Upload-time item per the local-first rule; does not fail the phase."
  - test: "Before any hand upload of dist/ (Phase 8), rebuild with the production PUBLIC_PLACEMENT_API_URL"
    expected: "dist/ does not contain http://localhost:8787 (review WR-01: the smoke global-setup builds dist/ against localhost)"
    why_human: "Production/upload-time concern; deferred to Phase 8 deployment."
---

# Phase 1: Foundations Verification Report

**Phase Goal:** Every package installs reproducibly and one local command proves the whole stack green, so each later phase has a trustworthy test bed.
**Verified:** 2026-11-05
**Status:** human_needed (all local must-haves pass; only upload-time CI/Ubuntu items remain)
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm ci` installs exact versions in root and `placement-test-worker`; `.npmrc` `save-exact=true`; a check fails on `latest`/`^`/`~` | VERIFIED | Root and worker package.json contain only exact versions (astro 7.2.4, sitemap 3.7.3, playwright 1.64.1; worker plugin 1.5.1, vitest 4.1.12, wrangler 4.157.0, TS 7.0.2 etc.). `npm ls` matches; wrangler resolves to a single copy. Both `.npmrc` files hold `save-exact=true`. `npm ci --dry-run` succeeds in both. `scripts/check-pins.mjs` exits 0 on the repo; run against a scratch package.json with `^`, `latest`, `~` it exits 1 and names each offender. It skips `cms-oauth-worker` (no package.json yet). Wired into `test:all` and CI `build-and-audit`. |
| 2 | Worker tests run on a real local D1 replaying every migration on an empty DB | VERIFIED | `vitest.config.ts` uses `cloudflareTest` with `readD1Migrations`; `test/apply-migrations.ts` calls `applyD1Migrations` and clears non-seed tables per test; `migrations.test.ts` asserts `d1_migrations` count equals the migration files read. Run: 11 test files, 184 tests passed inside workerd. `createFakeD1()` returns `env.DB`. Old local fallback files are gone (no `scripts/` dir in worker, no `dev:fallback`). README describes the real-D1 runtime. |
| 3 | Malformed JSON to any worker endpoint returns 400 JSON, never 500 | VERIFIED | `src/http.ts` `readJson` rejects empty, `{bad`, `null`, `[]`, `"s"` with `BadRequestError`; `index.ts` maps it to 400 `{"error":"invalid_json"}`. Exactly 9 `readJson` call sites (admin 4, application 2, booking 1, session 2); the only `req.json()` left is inside `readJson`. `handleAnswer` reads the body after the session lookup. Admin routes are gated by `requireAdmin` before the handler, so unauthenticated malformed bodies stay 401. `malformed.test.ts` table covers every route and passes in the 184. |
| 4 | One command runs worker tests plus Playwright smoke green; smoke needs no 2027-01-01 slot | VERIFIED | `npm run test:all` run in this checkout: exit 0 (check:pins, worker tests, worker typecheck, then Playwright 13/13 passed in 41s). Port 4322 and 8787 not LISTENING afterwards. `global-setup.ts` seeds `e2e-slot` at `+30 days` using `--local` only (no `--remote` anywhere). Local D1 has no slot dated 2027-01-01 (query returned empty). No `2027-01-01` string remains in tests, config, CI, or worker src. CI smoke job runs `npm run smoke` (same Playwright config). |
| 5 | `git status` clean of CRLF noise and `preview.*`/`.dev.vars`; mobile tweaks committed | VERIFIED | `git status --short` is empty. `.gitattributes` is exactly `* text=auto eol=lf`. `preview.log`/`preview.pid` are git-ignored, untracked, and still on disk; `.dev.vars` ignored via worker `.gitignore`. Mobile files committed in `d24f449` containing exactly the three paths (+15/-4). No LF/CRLF index/worktree mismatches in tracked files (only untracked/graphify metadata). Protected files (session.test.ts, application.test.ts, index.test.ts, application.spec.ts, wrangler.toml) have no diff since `1e299de`. |

**Score:** 5/5 truths verified, 0 behavior-unverified.

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `tests/e2e/global-setup.ts` | VERIFIED | Builds site, seeds `e2e-slot` +30 days (local D1), serves in-process on :4322, returns teardown |
| `playwright.config.ts` | VERIFIED | `globalSetup` and `webServer` (migrate then dev), both skipped with `SMOKE_BASE_URL` |
| `package.json` | VERIFIED | `test:worker`, `check:pins`, `test:all` present, exact pins |
| `placement-test-worker/package.json` | VERIFIED | `typecheck` script, exact pins |
| `.github/workflows/ci.yml` | VERIFIED | `check:pins` step; smoke job runs `npm run smoke` |
| `.gitattributes` / `.gitignore` | VERIFIED | As specified |
| `scripts/check-pins.mjs` | VERIFIED | Behavior confirmed both ways |
| `.npmrc` (root + worker) | VERIFIED | `save-exact=true` |
| `vitest.config.ts`, `apply-migrations.ts`, `migrations.test.ts`, `fakeD1.ts` | VERIFIED | Substantive and wired through `setupFiles`/`readD1Migrations`/`env.DB` |
| `src/http.ts`, `src/malformed.test.ts`, `src/index.ts` catch | VERIFIED | Wired, used by all 9 sites |

### Key Link Verification

| From | To | Status |
|------|----|--------|
| playwright.config.ts | tests/e2e/global-setup.ts | WIRED (`globalSetup`) |
| playwright.config.ts | worker `db:migrate:local` | WIRED (webServer command) |
| vitest.config.ts | test/apply-migrations.ts and migrations/ | WIRED |
| fakeD1.ts | `env.DB` | WIRED |
| routes/*.ts | http.ts `readJson` | WIRED (9 sites) |
| index.ts | `BadRequestError` | WIRED |
| package.json `test:all` | scripts/check-pins.mjs; ci.yml | WIRED |

### Probe Execution

No `probe-*.sh` declared by the plans. SKIPPED. `npm run test:all` serves as the end-to-end check (see above).

### Prohibitions

| Statement | Tier | Result |
|-----------|------|--------|
| No remote D1 writes from smoke setup (FND-04) | test | HELD: `global-setup.ts` uses only `--local`; grep finds no `--remote` |
| Do not touch the user's three mobile files beyond committing them (FND-05) | test | HELD: tree clean; commit `d24f449` touches exactly the three paths |
| Mobile commit equals the approved diff (MOB-01) | test | HELD on structure (3 paths, 15/4); the original approval hash was not re-computed here (see note) |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| FND-01 | 01-02, 01-03 | SATISFIED | Exact pins in both packages, `save-exact`, `check:pins` |
| FND-02 | 01-02 | SATISFIED | Real local D1 via `@cloudflare/vitest-plugin`; workerd runs on this machine so no fallback needed |
| FND-03 | 01-04 | SATISFIED | `readJson` on all 9 sites, 400 `invalid_json` |
| FND-04 | 01-01 | SATISFIED | Own +30-day slot, no 2027 slot needed |
| FND-05 | 01-01 | SATISFIED | `.gitattributes`, ignores, clean tree |
| FND-06 | 01-01, 01-03 | SATISFIED | `npm run test:all` green locally |
| MOB-01 | 01-03 | SATISFIED | Commit `d24f449` |

All 7 phase IDs appear in PLAN frontmatter and in REQUIREMENTS.md. No orphans: REQUIREMENTS.md maps only these 7 to Phase 1. The traceability table and checkboxes in REQUIREMENTS.md still read "Pending"/unchecked; this is bookkeeping for the orchestrator, not a code gap.

### Anti-Patterns Found

No TBD/FIXME/XXX markers or stubs in the covered files (reviewed the key ones). Advisory items from 01-REVIEW.md (none are phase must_haves, no criticals):

| ID | Impact | Handling |
|----|--------|----------|
| WR-01 | Smoke build leaves localhost API URL in `dist/` | Upload-time: rebuild for production before upload (Phase 8) |
| WR-02 | `{}` to login (valid JSON, wrong fields) still 500s | Field validation is AUTH-07 (Phase 4); not a malformed-JSON case, SC3 holds |
| WR-03 | `chevron-down` icon missing (pre-existing) | Design phases |
| WR-04 | No CI/execFileSync timeouts | Hardening, non-blocking |
| IN-01..03 | Minor harness/pin-policy notes | Non-blocking |

All seven review items remain `open` in 01-REVIEW-DISPOSITION.md.

### Human Verification Required

1. **First Ubuntu CI run.** Push and watch `build-and-audit` (`check:pins`) and `placement-test-smoke` (`npm run smoke`) go green on GitHub. Why human: CI-only, upload-time item.
2. **Production dist rebuild (WR-01).** Confirm no `localhost:8787` in `dist/` before hand upload. Why human: Phase 8 concern.

### Gaps Summary

No gaps. Every ROADMAP success criterion is backed by evidence from this checkout, including a fresh green `npm run test:all` (184 worker tests, typecheck, 13 Playwright smoke tests) with ports freed afterwards. Status is `human_needed` only because of the two upload-time items above, which per the local-first rule do not make the phase fail. Not independently re-run: a second consecutive `test:all`, and a destructive `npm ci` from a deleted `node_modules` (verified with `--dry-run` and `npm ls` instead).

---

_Verified: 2026-11-05_
_Verifier: Claude (gsd-verifier)_
