# Project Research Summary

**Project:** ELC Astro Rebuild, Harden and Finish milestone
**Domain:** Bilingual (AR RTL / EN) language-school funnel: placement test, booking, application, registration wizard, staff admin, Decap CMS
**Researched:** 2026-11-04
**Confidence:** MEDIUM-HIGH overall. Code-level findings HIGH. Platform behaviour (Safari cookies, Workers CPU plan limits, rate-limit binding) MEDIUM and must be checked in its phase.

## Executive Summary

ELC is a lead-capture funnel: free online placement test, then in-centre oral test booking, application, and registration. Most of the product exists. The milestone is to harden the admin and CMS surfaces that hold applicant national IDs, then finish the half-built features. Do not add a new backend, framework, or runtime security dependencies. Use Workers platform primitives, D1, Web Crypto, and plain DOM APIs.

Recommended order: (1) foundations (real D1 `database_id`, exact pins, CI on real workerd D1); (2) land `feature/registration-wizard` so migration `0022` is in place before admin auth becomes `0023`; (3) rebuild admin auth as one pipeline (opaque server-side sessions in D1, Origin allowlist plus CSRF token on mutating routes, D1 login throttle, real logout); (4) admin client hardening; (5) CMS OAuth hardening, in parallel with 3 and 4 as a separate package; (6) placement-test end to end plus admin results; (7) CMS editing reliability; (8) mobile and RTL; (9) design review last.

Key risks: the admin cookie is cross-site (`elc.com.sa` to `*.workers.dev`), so Safari may silently block login. This decision comes first. CSRF and throttle fixes can pass unit tests and still fail in a real browser or on the deployed Worker. Booking capacity is not atomic (`bookSlotAtomic` increments, then inserts separately), so it needs `db.batch()` and a real-D1 test. XSS sinks exist beyond the ones CONCERNS.md names (`TestRunner`, `SearchOverlay`, `ResultBooking`), so ban the sink rather than fix grep hits.

## Key Findings

### Stack
- Pin all `latest` and caret ranges to exact versions (`--save-exact`, `.npmrc` `save-exact=true`).
- Replace deprecated `@cloudflare/vitest-pool-workers` with `@cloudflare/vitest-plugin` 1.5.1 (vitest 4.1.12, wrangler 4.157.0, workers-types 5.20261104.1, typescript 7.0.2, bcryptjs 3.0.3 frozen, @playwright/test 1.64.1, @axe-core/playwright 4.14.0).
- Optional `zod` 4.6.7; ARCHITECTURE prefers hand-rolled guards. Pick one.
- Web Crypto for opaque tokens (`getRandomValues`, `subtle.digest`, `subtle.timingSafeEqual`).

### Features
- **Must have:** admin hardening (throttle, Origin + CSRF, revocable sessions, logout, escaped rendering with regression test); real-D1 end-to-end funnel proof; merge and verify the registration wizard (run 0022 on a copy first); guardian/track fix (Worker returns track; map `guardian_name_required` to a field error); store course slug not localized title; admin applicant detail view, search, reversible status with confirm, booking cancel, slot edit and validation; admin results view (per-session band scores, answers, abandoned sessions); CMS missing course fields (`priceUnit`, `durationUnit`, `hoursPerLevel`, `hoursPerDay`, `scheduleDays`, `classTimes`, `intakeSchedule`), image folder fix, Decap pin with integrity, OAuth hardening, unknown-key survival test; spec as-built notes; mobile polish and design review.
- **Should have:** CSV export (admin-gated); admin notes and rejection reason; `wa.me` follow-up link; result to course link; referral funnel report.
- **Defer:** adult reading-passage bands (questions 35 to 50 seeded, not served); resume test; kids audio; admin account UI.
- **Anti-features (do not build):** document upload (removed in `66a74d8`), applicant login, automated email or WhatsApp Business notifications, proctoring, IRT, raw score to students, payments, form builder, page builder, admin i18n, staff-editable testimonials.
- **Spec drift:** placement-test spec describes a 25-question staircase; the build uses banded adults and share-correct kids. Requirements must cite code and migrations, not the spec.

### Architecture
Same three runtime units (static site on Hostinger, placement worker on Workers + D1, CMS OAuth worker). All security sits in one pipeline stage in `index.ts` that produces `AdminCtx`.
- `index.ts` pipeline: CORS and Origin guard, route match, auth to `AdminCtx`, CSRF on unsafe methods, body validation, handler.
- `auth.ts` rewritten: opaque 256-bit token in cookie; D1 stores SHA-256 hash in `admin_sessions`; logout and disable set `revoked_at`.
- `csrf.ts` new: exact Origin allowlist (absent Origin rejected), `Content-Type: application/json`, per-session CSRF token held in client memory only.
- D1 `login_attempts`: atomic upsert keyed by normalized username, checked before bcrypt, dummy hash for unknown users, reset on success.
- `http.ts`: one `json()`, `readJson()` returning 400 on malformed JSON.
- `routes/results.ts` new: paginated sessions and detail joined to `students`.
- `AdminPanel.astro` plus `src/lib/dom.ts`: `createElement` and `textContent` only; masked IDs in lists.
- CMS worker: cookie-bound `state` (`__Host-oauth_state`, HttpOnly, Secure, SameSite=Lax, Max-Age=600); token only to `https://elc.com.sa`; scope `public_repo`; `Cache-Control: no-store`.

### Critical Pitfalls
1. **Cross-site cookie and Safari.** Login can return 200 while Safari drops the cookie. Decide first; add WebKit project and one iPhone login.
2. **CSRF bypass and preflight.** `text/plain` form can post JSON-shaped bodies; `req.json()` ignores Content-Type; substring Origin checks match `elc.com.sa.evil.com`; custom headers must be in `access-control-allow-headers`. Enforce centrally; table-driven negatives over all mutating admin routes.
3. **Throttle.** Binding is approximate and per-location; read-then-write races; throttling after bcrypt burns CPU; username-only keys allow lockout DoS. Use atomic D1 upsert before bcrypt; same response and timing for unknown and wrong user.
4. **XSS beyond named lines.** Ban `innerHTML|insertAdjacentHTML|outerHTML` in `src/components/**` unless marked `// safe:`; Playwright payload test per admin-displayed field. CSP `'unsafe-inline'` does not help.
5. **Non-atomic booking.** Use `db.batch()` with conditional insert; real-D1 test with forced insert failure must leave `booked_count` unchanged.
6. **OAuth.** Signed state without browser binding is login-CSRF-able. `postMessage` to `e.origin` or `'*'` leaks token. Use `new Response` with `Set-Cookie` (not `Response.redirect`). Add tests to `cms-oauth-worker`, which has none.
7. **D1 mix-ups.** Remote DB built by old per-file chain has no `d1_migrations`; export and check before `--remote` apply; always pass `--local` or `--remote`.
8. **Date bombs and Hijri.** CI seed hard-codes `2027-01-01`; `ar-SA` defaults to Hijri; slot times need `timeZone: 'Asia/Riyadh'`.
9. **Arabic digits and PII.** Normalize `٠-٩` before validating; mask IDs in lists; never log bodies; never persist IDs in storage.
10. **Mobile/RTL.** `playwright.config.ts` has no projects; add mobile Chromium, mobile WebKit, desktop in AR and EN; `scrollWidth <= innerWidth` on every route.

## Implications for Roadmap

### Phase 1: Foundations and Unblockers
- **Rationale:** every later phase is tested in CI; database id is a precondition.
- **Delivers:** real `database_id` committed; `d1_migrations` check and one `--remote` apply after export; exact pins with `npm ci` everywhere; `@cloudflare/vitest-plugin` replacing deprecated pool; `.gitattributes`; ignore `preview.*` and `.dev.vars`; `http.ts` with `readJson()`; CI log upload `if: always()`; "no slots" a hard failure.
- **Avoids:** pitfalls 7, 8, 12, 13.

### Phase 2: Land the Registration Wizard
- **Rationale:** branch owns migration 0022; landing it first keeps admin auth at 0023 and lets AdminPanel be rewritten once.
- **Delivers:** rebase onto main; resolve AdminPanel and placementApi conflicts; run 0022 on a copy first; CI green; Worker returns track; `guardian_name_required` mapped to field error; course slug stored.
- **Avoids:** pitfall 7 (destructive DROP COLUMN; export first) and pitfall 10 (hidden-required submit, Arabic digits).

### Phase 3: Admin Auth Core (worker side)
- **Rationale:** Core Value. Every admin screen depends on `AdminCtx`. Cookie decision is a gate.
- **Delivers:** Decision D1 recorded; migration 0023 (`admin_sessions`, `login_attempts`, `admin_users.disabled_at`); rewritten `auth.ts`; `csrf.ts`; pipeline in `index.ts`; D1 throttle; logout and session routes; exact-match CORS with `Vary: Origin`; body guards (login types, capacity integer range, ISO `startsAt`); `scripts/create-admin.ts`; `ALLOWED_ORIGINS` shared with CSP check.
- **Tests:** replayed cookie after logout returns 401; real requests hit 429; unknown and wrong user same body and timing; negatives (no Origin, `Origin: null`, lookalike, `text/plain`) on every mutating route; disabled admin locked out; expired session rejected.
- **Avoids:** pitfalls 1, 2, 3, 5, 15, 16.

### Phase 4: Admin Client Hardening
- **Rationale:** depends on Phase 3; closes stored-XSS.
- **Delivers:** `placementApi.ts` CSRF header and 401 recovery; AdminPanel built with `dom.ts`; masked national IDs; logout button; error codes mapped to AR and EN messages; grep or lint CI rule on `innerHTML`; Playwright XSS payload per field and CSRF rejection in a real browser.
- **Avoids:** pitfalls 4, 10.

### Phase 5: CMS OAuth Hardening (parallel with 3 and 4)
- **Rationale:** separate package and deploy.
- **Delivers:** own `package.json`, lockfile, Vitest config, CI job; cookie-bound state; `Response` with `Set-Cookie`; constant targetOrigin `https://elc.com.sa`; `GITHUB_SCOPE` defaulting to `public_repo`, drop `user`; escaped JSON in popup HTML; `no-store`; Decap pinned exactly with SRI or self-hosted; drop unpkg from CSP once self-hosted. Tests: missing, wrong, replayed state; no cookie; no `'*'` token target.
- **Avoids:** pitfall 6.

### Phase 6: Placement Test End to End and Admin Results
- **Rationale:** new admin screens born on hardened pipeline.
- **Delivers:** Playwright global setup logging in via admin API and creating a slot 30 days out; `bookSlotAtomic` with `db.batch()`; real-D1 concurrency (N+1 vs capacity N) and forced-failure test; `routes/results.ts` with pagination and Results tab; applicant detail view; search; reversible status with confirm; booking cancel; slot edit; pagination on lists; admin notes if time allows.
- **Avoids:** pitfalls 7, 9, 14 (no `TestRunner` refactor before characterization tests).

### Phase 7: CMS Editing Reliability
- **Rationale:** depends on Phase 5.
- **Delivers:** reconcile `config.yml` with `content.config.ts`; add missing course fields; fix media folders to `public/images/...`; CI test that every zod field is in Decap config or knowingly excluded; CSP test tying `.htaccess` `connect-src` to Worker origins; one real login, edit, and save round trip in both locales with successful `astro build`.
- **Avoids:** pitfalls 6 (Decap writes zod rejects), 17.

### Phase 8: Mobile and RTL Polish
- **Rationale:** config first, then fixes; admin pass waits for Phase 6.
- **Delivers:** Playwright projects (mobile Chromium Pixel 7, mobile WebKit iPhone 14, desktop) by locale; overflow invariant at 360 and 390 px; logical CSS properties; FAB vs wizard Next button check; uncommitted mobile tweaks landed; bidi wrapping; Arabic font check; Arabic date decision; manual iPhone pass.
- **Avoids:** pitfalls 9, 11.

### Phase 9: Full UI Design Review
- **Rationale:** last, so it sees final screens.
- **Delivers:** triage (must-fix: broken layout, unreadable, inaccessible, wrong language; later otherwise); page-by-page fixes; written defer list; time-boxed.
- **Avoids:** pitfall 18.

### Phase Ordering Rationale
- 1 before everything (test layer and pins). 2 before 3 (migration numbering, single AdminPanel rewrite). 3 before 4 and 6 (AdminCtx dependency). 5 parallel with 3 and 4 (separate package). 6 after 3 and 4 (new screens born safe). 8 and 9 last.

### Research Flags
- **Needs research:** Phase 3 (cookie spike in real browser; rate-limit binding syntax and quota if used; Workers plan CPU limit before relying on bcryptjs; `Partitioned` cookie support). Phase 5 (Decap OAuth handshake; `public_repo` with editorial workflow via real login). Phase 6 (`db.batch()` semantics; whether workerd runs on owner's Windows machine). Phase 2 (`DROP COLUMN` on real D1). Phase 7 (Decap unknown-key save behaviour). Phase 8 (Safari behaviour; Saudi ID checksum vectors).
- **Standard patterns:** Phase 1 (pinning, CI wiring, official vitest-plugin codemod). Phase 4 (`createElement` plus `textContent`, Playwright payload tests). Phase 9 (triage process).

## Decisions Required
- **D1. Admin cookie strategy (blocks Phase 3).** A. Serve admin from the Worker (same origin, SameSite=Strict, Safari-safe; medium refactor). B. API subdomain on `elc.com.sa` (needs DNS move; go-live, LOW feasibility now). C. Keep cross-site cookie with Origin and CSRF; document Chromium and Firefox only; bearer fallback in memory or sessionStorage if WebKit fails. **Recommendation:** build Patterns (Origin, CSRF, D1 sessions, throttle) now, which work under all three; test WebKit early; choose A if C fails in Safari; treat B as a go-live task.
- **D2. Login throttle** (researcher disagreement, reconciled below).
- **D3. Wizard timing.** Land first (Phase 2). Nothing live, no added exposure.
- **D4. Application scope.** Uploads stay removed (`66a74d8`). Finish application against reduced wizard shape (course and guardian). Update spec note.

### Login Throttling Reconciliation
Researchers disagreed. STACK: binding as coarse gate plus D1 counter as authority. ARCHITECTURE: D1 only (binding approximate, not testable with fake D1). PITFALLS: same two layers as STACK, binding not an exact counter.

**Recommendation:**
1. The D1 `login_attempts` counter is mandatory and authoritative: key by normalized username, one atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, check before bcrypt, reset on success, expire the window. This is the only deterministic, testable lockout.
2. The Rate Limiting binding is optional as a cheap burst gate (username key plus `CF-Connecting-IP`). Skip it if plan or quota is unclear. Never assert exact counts on it; stub in tests.
3. Do not key lockout on IP alone; do not trust `X-Forwarded-For`.

Net: keep STACK and PITFALLS layering but demote the binding to optional; the D1 counter carries the guarantee, per ARCHITECTURE.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH versions; MEDIUM choices | npm checked 2026-11-04; cookie and bcrypt plan limits MEDIUM and open |
| Features | HIGH gaps; MEDIUM norms | Specs and code read directly; PDPL LOW to MEDIUM |
| Architecture | HIGH integration points; MEDIUM platform | Code read directly; cookie behaviour and Decap save semantics to verify |
| Pitfalls | MEDIUM-HIGH | Code findings HIGH; Safari, CPU, binding, `batch`, `Response.redirect` MEDIUM from background knowledge |

**Overall:** MEDIUM-HIGH. Four platform questions (plan, Safari, binding, `batch`) must be verified in their phases.

### Gaps to Address
- Workers plan (Paid vs Free): decides bcryptjs viability (10 ms CPU on Free). Confirm before Phase 3. Do not swap to PBKDF2 casually (100k cap unverified).
- Safari third-party cookies: iPhone and WebKit run against deployed Worker (Phase 3).
- `elc.com.sa` DNS on Hostinger (`dns-parking.com`): option B depends on move.
- workerd on Windows: `fakeD1.ts` says it crashed in an earlier sandbox. Verify before deleting fakeD1 (Phase 1).
- Remote D1 state: built with old per-file chain? Check before any `--remote` apply.
- `DROP COLUMN` on real D1 (0022): run on local and a remote copy.
- Decap `public_repo`: one real login (Phase 5).
- Decap save semantics with unknown keys: real edit test (Phase 7).
- bcryptjs login never exercised on a deploy: test in Phase 3.
- `db.batch()` atomicity on real workerd (Phase 6).
- Saudi ID checksum: verify against test vectors; do not invent.
- Arabic calendar: owner decides Hijri, Gregorian, or both.
- PDPL retention and deletion: no rule or delete path; abandoned sessions keep PII indefinitely. Decide before wizard ships.
- Spec drift: add as-built notes; wizard supersedes application spec for ID and email.

## Open Questions for the Owner (single list)
1. Cookie strategy A, B, or C (Phase 3, blocking). Recommendation: C now with WebKit test; A if Safari fails.
2. Is the Cloudflare account on Workers Paid? (Phase 3, blocking; decides bcryptjs login.)
3. Will `elc.com.sa` DNS move to Cloudflare before go-live?
4. Which browsers do staff use, including iPhone or Mac Safari?
5. Document uploads: stay removed, or reverse the decision?
6. PDPL: owner, retention period for abandoned sessions and applicants, deletion or anonymization path (before Phase 2).
7. Rate-limit binding: use as optional first gate, or D1 only?
8. Remote D1: built with old per-file chain? (Phase 1.)
9. Does workerd run on your Windows machine? Decides fakeD1 deletion.
10. Zod or hand-rolled validation (Phase 3).
11. Arabic dates: Hijri, Gregorian, or both; DOB as day, month, year selects? (Phase 8.)
12. Admin language: English-only confirmed, or a minimal Arabic label pass?
13. Admin notes and rejection reason: this milestone or v1.x? (Phase 6.)
14. CSV export: now or v1.x?
15. Decap: exact pin with SRI, or self-host through npm? Recommendation: self-host.
16. Permission to run a real CMS edit on a test branch (Phase 7).
17. Results view: which fields visible; are abandoned sessions shown by default?
18. Dependabot or Renovate, so exact pins get updated?
19. Pagination defaults (for example 50 rows per page, date window)?
20. Google Reviews: keep as-is with a no-key test path and masked screenshots?

## Sources
- Cloudflare docs: Rate Limiting binding, Workers limits, Web Crypto, Vitest integration, D1 local development, Custom Domains.
- cloudflare/workers-sdk `fixtures/vitest-plugin-examples/d1`.
- npm registry queries 2026-11-04.
- Local repo: `placement-test-worker/src/{auth,index,db,types,scoring,bands}.ts`, routes, migrations 0019 and 0021, `cms-oauth-worker/src/index.js`, `public/admin/*`, `public/.htaccess`, `wrangler.toml`, `playwright.config.ts`, `.github/workflows/ci.yml`, `src/content.config.ts`, specs in `docs/superpowers/specs/`, `feature/registration-wizard` (migration 0022).
- GitHub changelog PKCE (2025-07-14); RFC 9700; Decap backends overview (MEDIUM).
- LOW: community PBKDF2 cap article (lord.technology); decap-proxy (reference only); Saudi PDPL secondary sources (verify with SDAIA text and counsel).

---
*Research completed: 2026-11-04. Ready for roadmap: yes, after resolving D1 (cookie strategy) and confirming the Workers plan.*
