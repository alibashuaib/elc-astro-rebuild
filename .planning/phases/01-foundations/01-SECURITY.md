---
phase: "01"
slug: foundations
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-05"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness to local D1 | Playwright globalSetup seeds a slot via wrangler | SQL, local database only |
| Repo to git history | Commits and ignore rules | Secrets (`.dev.vars`), logs |
| npm registry to repo | Root and worker installs | Third-party code |
| HTTP client to Worker | Request bodies parsed by `readJson` | Untrusted JSON |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | global-setup wrangler call | high | mitigate | `--local` only, scoped to `e2e-slot`, `execFileSync` without shell (global-setup.ts:18-26) | closed |
| T-01-02 | Information disclosure | .gitignore and commits | medium | mitigate | `preview.log`, `preview.pid`, `.dev.vars` ignored; none tracked | closed |
| T-01-03 | Denial of service (dev box) | smoke site server | low | mitigate | In-process `preview()`, teardown `server.stop()`; nothing left on 4322/8787 | closed |
| T-01-04 | Tampering | user's uncommitted mobile files | medium | mitigate | Touched only in d24f449 | closed |
| T-01-05 | Tampering | worker dependency ranges | high | mitigate | Exact pins, `.npmrc save-exact`, single wrangler 4.157.0 | closed |
| T-01-06 | Information disclosure | worker test bindings | medium | mitigate | Explicit test-only `ADMIN_COOKIE_SECRET` in vitest.config.ts | closed |
| T-01-07 | Elevation of privilege | test-only bindings | low | mitigate | `TEST_MIGRATIONS` only in vitest config; wrangler.toml unchanged | closed |
| T-01-08 | Tampering | root dependency ranges | high | mitigate | Exact pins; `check:pins` in `test:all` and CI | closed |
| T-01-09 | Tampering | MOB-01 commit | medium | mitigate | d24f449 has exactly the 3 approved files; diff hash matches | closed |
| T-01-10 | Tampering | `npx @lhci/cli@0.13.x` in CI | low | accept | Floating minor in a CI-only Lighthouse step | closed (accepted) |
| T-01-11 | Denial of service (CI) | first Ubuntu run of new steps | low | accept | Verified by UAT test 1 after push | closed (accepted) |
| T-01-SC-01 | Tampering | npm installs (plan 01-01) | high | mitigate | User approval recorded 2026-11-05; pins match approved list | closed |
| T-01-SC-02 | Tampering | worker npm installs (01-02) | high | mitigate | Same approval; exact pins, single lock entry | closed |
| T-01-SC-03 | Tampering | root npm installs (01-03) | high | mitigate | Same approval; exact pins | closed |
| T-01-SC-04 | Tampering | npm installs (01-04) | low | accept | Plan installs nothing; no package files touched | closed (accepted) |
| T-01-12 | Information disclosure | bad-body error path | medium | mitigate | Fixed `invalid_json` string, returns before `console.error` | closed |
| T-01-13 | Elevation of privilege | admin auth vs body read | medium | mitigate | `requireAdmin` runs before the handler; 401 test row | closed |
| T-01-14 | Tampering | valid-but-wrong JSON | low | mitigate | `readJson` rejects null, arrays, non-objects; tested | closed |

*Status: open · closed · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-10 | CI-only tool, floating minor, no deploy access | Plan 01-03 threat model (disposition: accept) | 2026-11-05 |
| AR-02 | T-01-11 | Cannot be tested before the first push; covered by UAT test 1 | Plan 01-03 threat model (disposition: accept) | 2026-11-05 |
| AR-03 | T-01-SC-04 | Plan 01-04 installs no packages | Plan 01-04 threat model (disposition: accept) | 2026-11-05 |

---

## Notes (not phase-1 threats)

- `placement-test-worker/package.json` `db:migrate:remote` and `README.md:54` use `--remote`. Both predate phase 1 and no test or CI path runs them. Every d1 command in `test:all`, globalSetup and webServer uses `--local`.
- `src/index.ts:97` returns `err.message` on the 500 path when `LOCAL_DEV === 'true'`. Pre-existing; check that `LOCAL_DEV` is never set in production.
- Audit was static (L1). Test results were not re-run by the auditor.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-05 | 18 | 18 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-05
