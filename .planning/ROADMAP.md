# Roadmap: ELC Astro Rebuild

## Milestones

- 🚧 **v1.0 Harden & Finish** - Phases 1-8 (in progress)

## Overview

The bilingual ELC site and its two Cloudflare Workers already mostly exist. This milestone first makes the build reproducible and testable on one local command, then runs the full design review early so its findings guide the rest of the work. It lands the registration wizard (migration 0022), rebuilds admin security and the admin client as one slice (migration 0023), hardens and completes the CMS, proves the placement-test funnel end to end with staff review tools, and finishes with a mobile/RTL pass that closes every remaining design must-fix. Phases 1-7 are verified locally (`astro dev`/`preview` + `wrangler dev --local` D1). Deployment to the domain is the final phase and starts only after all local verification passes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundations** - Exact pins, real local D1 tests, one green local test command, clean working tree
- [ ] **Phase 2: Design Review** - Full UI review written up early (AR + EN, mobile + desktop) with must-fix vs later items
- [ ] **Phase 3: Registration Wizard & Application** - Merge the wizard branch (migration 0022) and fix guardian, slug, and Arabic-digit issues
- [ ] **Phase 4: Secure Admin** - Server-side sessions, logout, throttle, CSRF/Origin guard, and XSS-safe admin client (migration 0023)
- [ ] **Phase 5: CMS Hardening & Editing** - Hardened OAuth worker in its own package, pinned Decap, complete course fields
- [ ] **Phase 6: Placement Test End to End & Admin Tools** - Full test-to-application funnel on local D1, atomic booking, staff results and applicant management
- [ ] **Phase 7: Mobile, RTL & Design Fixes** - Every page correct at phone width in AR + EN, all remaining design must-fixes done
- [ ] **Phase 8: Deployment** - Remote D1 migrated, workers deployed, site uploaded, live smoke check passes

## Phase Details

### Phase 1: Foundations
**Goal**: Every package installs reproducibly and one local command proves the whole stack green, so each later phase has a trustworthy test bed.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06, MOB-01
**Success Criteria** (what must be TRUE):
  1. `npm ci` installs exact versions in the root and `placement-test-worker`, `.npmrc` has `save-exact=true`, and a check fails if any `package.json` (including `cms-oauth-worker` once it gets one in Phase 5) contains `latest`, `^`, or `~`.
  2. Worker tests run against a real local D1 that replays every migration on an empty database (or `fakeD1` is kept with the workerd-on-Windows failure written down).
  3. Sending a malformed JSON body to any worker endpoint returns 400 with a JSON error, never 500.
  4. One command runs worker tests plus Playwright smoke green locally, and the smoke tests pass with no 2027-01-01 slot in the database because they create their own future slot.
  5. `git status` shows no CRLF-only changes and no `preview.log`/`preview.pid`/`.dev.vars`, and the pending mobile tweaks (course `h3`, WhatsApp button, course title) are committed.
**Plans:** 4/4 plans executed

Plans:
- [x] 01-01-PLAN.md — Tracer: `npm run test:all` (worker tests + Playwright smoke on its own +30-day slot, CI on the same path), LF `.gitattributes` + ignores, one blocking checkpoint (install versions + mobile files final)
- [x] 01-02-PLAN.md — Worker tests on real local D1 via `@cloudflare/vitest-plugin` with exact worker pins; dead local fallback removed
- [x] 01-03-PLAN.md — Commit the mobile tweaks exactly as approved; exact root pins + `save-exact`; `check:pins` in `test:all` and CI
- [x] 01-04-PLAN.md — TDD: shared `readJson()` so malformed JSON is a 400 on all 9 body-reading routes

### Phase 2: Design Review
**Goal**: The owner has a written, prioritised list of what looks or works wrong across the site, so later phases fix the right things while they are touching those screens.
**Mode:** mvp
**Depends on**: Phase 1 (clean tree and a green local suite give the review a stable base)
**Requirements**: DSGN-01
**Success Criteria** (what must be TRUE):
  1. A written UI review exists covering every page type in AR and EN, on mobile and desktop, including the registration wizard (reviewed from `feature/registration-wizard`) and the admin screens as they stand today.
  2. Each finding is tagged must-fix or later, and names the screen and the phase that will fix it (3 Wizard, 4 Admin, 5 CMS, 6 Placement/Admin tools, 7 Mobile/RTL, or deferred).
  3. The owner has read the list and confirmed which items are must-fix.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Registration Wizard & Application
**Goal**: Applicants can finish the registration wizard and application in Arabic and English on `main`, and their data is stored in a form that survives content changes.
**Mode:** mvp
**Depends on**: Phase 1 (Phase 2 findings for wizard screens are fixed here)
**Requirements**: WIZ-01, WIZ-02, WIZ-03, WIZ-04, WIZ-05, WIZ-06
**Success Criteria** (what must be TRUE):
  1. `feature/registration-wizard` is merged into `main`; migration 0022 applies cleanly to a fresh local D1 and to a copy of the existing local DB, and the full local suite is green.
  2. An applicant who opens the apply link on a different device (empty `sessionStorage`) still sees the guardian field when their track needs it, and leaving the guardian name blank shows a field error in AR and EN.
  3. An applicant can enter ID and phone numbers in Arabic-Indic digits (٠-٩) and submit; an ID that fails the Saudi ID/Iqama format is rejected by the worker with a field error.
  4. A submitted application stores the course slug, so renaming the course title in content does not break the match.
  5. The student-application and registration-wizard specs carry as-built notes (document upload removed, ELC ladders, wizard supersedes the application spec for ID/email).
  6. Every Phase 2 must-fix item assigned to the wizard is fixed.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Secure Admin
**Goal**: Staff log in and out of an admin that cannot be brute-forced, CSRF'd, hijacked by a stale session, or turned into a stored-XSS vector by applicant data.
**Mode:** mvp
**Depends on**: Phase 3 (migration 0022 lands first so admin auth is 0023, and AdminPanel is rewritten once)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, ADM-01, ADM-02, ADM-03, ADM-04
**Success Criteria** (what must be TRUE):
  1. Staff can log in and press a logout button; replaying the old session cookie afterwards returns 401, an expired session sends staff back to login with a clear message, and disabling an admin account cuts off its live session immediately.
  2. Repeated wrong passwords lock that username for the time window (rejected before bcrypt runs), and an unknown username and a wrong password get the same response with similar timing.
  3. A table-driven test over every state-changing admin route shows rejection for no Origin, `Origin: null`, a lookalike origin (`elc.com.sa.evil.com`), a missing or wrong CSRF token, and a `text/plain` body.
  4. An applicant named `<img src=x onerror=alert(1)>` shows as plain text everywhere in the admin panel (Playwright payload test), national IDs are masked in lists, and CI fails if `innerHTML`/`insertAdjacentHTML`/`outerHTML` appears in components without a `// safe:` marker.
  5. Invalid admin input (non-integer or out-of-range slot capacity, non-ISO start time, wrong-typed login fields) gets a 400 with a clear error.
  6. Every Phase 2 must-fix item assigned to the existing admin screens is fixed.
**Plans**: TBD
**UI hint**: yes

### Phase 5: CMS Hardening & Editing
**Goal**: Staff sign in to Decap CMS through an OAuth flow that cannot leak or misdirect the token, and can edit every course field without breaking the site build.
**Mode:** mvp
**Depends on**: Phase 1 (separate package; no code dependency on Phases 3-4)
**Requirements**: CMS-01, CMS-02, CMS-03, CMS-04, CMS-05, CMS-06, CMS-07
**Success Criteria** (what must be TRUE):
  1. `cms-oauth-worker` has its own package, tests, and CI job, and its tests show a callback with missing, wrong, or replayed `state` (bound to a browser cookie) is rejected.
  2. The OAuth popup posts the token only to `https://elc.com.sa` (never `'*'` or the sender's origin), and the GitHub authorize request asks for `public_repo` scope only.
  3. The CMS loads Decap at an exact pinned version (self-hosted or with an integrity hash), not a floating unpkg URL.
  4. Editing a course in the CMS locally exposes every course field (price unit, duration unit, hours per level/day, schedule days, class times, intake schedule), keeps all existing fields on save, and uploaded images land in the folder the site serves.
  5. A test fails when a content-schema field is missing from the CMS config, and `astro build` succeeds after a CMS edit.
**Plans**: TBD

### Phase 6: Placement Test End to End & Admin Tools
**Goal**: A student can go from placement test to result to booking to application on local D1, and staff can review results and manage applicants, slots, and bookings in the hardened admin.
**Mode:** mvp
**Depends on**: Phase 4 (new admin screens are built on the hardened session/CSRF pipeline); Phase 3 (application is the end of the funnel)
**Requirements**: PT-01, PT-02, PT-03, AUTH-08, ADM-05, ADM-06, ADM-07, ADM-08, ADM-09
**Success Criteria** (what must be TRUE):
  1. A student can take the placement test on local D1 on both the adult bands and the kids ladder, see a result, book a slot, and submit an application, and an automated test covers that whole flow.
  2. Booking is atomic: a slot with capacity N accepts exactly N of N+1 bookings, and a forced booking failure leaves the slot's booked count unchanged.
  3. Staff can open a Results view with per-session band/score, answers, and abandoned sessions, paginated.
  4. Staff can search applicants, page through lists, open an applicant detail view (guardian, referral source, consent timestamps), change status after approve/reject with a confirm step, and delete an applicant and their personal data with a confirm step.
  5. Staff can edit a test slot and cancel a booking, and the freed place can be booked again.
  6. Every Phase 2 must-fix item assigned to the placement test, result, or booking screens is fixed.
**Plans**: TBD
**UI hint**: yes

### Phase 7: Mobile, RTL & Design Fixes
**Goal**: Every page reads and works correctly on phones and desktop in Arabic and English, and every must-fix item from the design review is closed.
**Mode:** mvp
**Depends on**: Phase 6 (the new admin views exist before the final sweep)
**Requirements**: MOB-02, MOB-03, MOB-04, MOB-05, DSGN-02
**Success Criteria** (what must be TRUE):
  1. Playwright runs mobile Chromium, mobile WebKit, and desktop projects in both AR and EN locally, and all pass.
  2. No page scrolls horizontally at 360px or 390px width in AR or EN, checked automatically on every route.
  3. On a phone, the WhatsApp button never covers the wizard Next/Submit buttons or any other form button.
  4. Arabic pages show Gregorian dates only (never Hijri), and slot times display in Asia/Riyadh time whatever the device timezone.
  5. Every must-fix item from the Phase 2 review is fixed (none left open) and the rest are on a written defer list.
**Plans**: TBD
**UI hint**: yes

### Phase 8: Deployment
**Goal**: The locally verified build is live on the domain, with both workers deployed and the funnel, admin, and CMS working for real users on real devices.
**Mode:** mvp
**Depends on**: Phase 7 (and all local verification from Phases 1-7 passing)
**Requirements**: DEP-01, DEP-02, DEP-03, DEP-04, DEP-05
**Success Criteria** (what must be TRUE):
  1. The real D1 `database_id` is set; the remote D1 was exported and checked before migrating, and all migrations (including 0022 and 0023) are applied remotely.
  2. Both workers are deployed; staff can log into admin on iPhone Safari and on Chrome against the deployed worker (admin is served from the worker if Safari blocks the cross-site cookie), and bcrypt login completes within the Workers plan CPU limit.
  3. The deploy pipeline (confirmed FTP secrets and server path) uploads the built site to the domain.
  4. A live smoke check on the domain passes on a phone in AR and EN: placement test, booking, and application, plus CMS login, edit, and save.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations | 4/4 | In Progress | - |
| 2. Design Review | 0/TBD | Not started | - |
| 3. Registration Wizard & Application | 0/TBD | Not started | - |
| 4. Secure Admin | 0/TBD | Not started | - |
| 5. CMS Hardening & Editing | 0/TBD | Not started | - |
| 6. Placement Test End to End & Admin Tools | 0/TBD | Not started | - |
| 7. Mobile, RTL & Design Fixes | 0/TBD | Not started | - |
| 8. Deployment | 0/TBD | Not started | - |
