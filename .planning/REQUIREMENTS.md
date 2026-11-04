# Requirements: ELC Astro Rebuild — Harden & Finish

**Defined:** 2026-11-04
**Core Value:** Applicant data and the admin side are safe: no stored XSS, no brute-forceable or CSRF-able admin, no leaky OAuth.

All requirements except Deployment are verified **locally** (`astro dev`/`preview` + `wrangler dev --local` D1). Deployment is the last phase and runs only after everything passes locally.

## v1 Requirements

### Foundations

- [ ] **FND-01**: Every dependency (root, `placement-test-worker`, `cms-oauth-worker`) is pinned to an exact version; no `latest` or caret ranges; `.npmrc` has `save-exact=true`
- [ ] **FND-02**: Worker tests run on real local D1 via `@cloudflare/vitest-plugin`, replaying all migrations on an empty DB (fallback: keep `fakeD1` if workerd won't run on this Windows machine)
- [ ] **FND-03**: Malformed JSON bodies get a 400, not a 500 (shared `readJson()`)
- [ ] **FND-04**: Smoke tests create their own future test slot instead of relying on the hard-coded 2027-01-01 slot
- [ ] **FND-05**: `.gitattributes` fixes CRLF noise; `preview.log`/`preview.pid`/`.dev.vars` are git-ignored
- [ ] **FND-06**: One command runs the full local test suite (worker tests + Playwright smoke) green

### Registration Wizard & Application

- [ ] **WIZ-01**: `feature/registration-wizard` is merged into `main` with migration `0022` applied cleanly on local D1 and all tests green
- [ ] **WIZ-02**: Guardian field shows correctly even when the apply link is opened on another device (worker returns the track; no reliance on `sessionStorage`)
- [ ] **WIZ-03**: A missing guardian name shows a clear field error in AR and EN, not a generic error
- [ ] **WIZ-04**: Applications store the course slug, so renaming a course in the CMS doesn't break matching
- [ ] **WIZ-05**: ID and phone fields accept Arabic-Indic digits (٠-٩) and validate Saudi ID/Iqama format in the worker
- [ ] **WIZ-06**: Specs get as-built notes (document upload removed; placement test uses ELC ladders; wizard supersedes application spec for ID/email)

### Admin Security (worker)

- [ ] **AUTH-01**: Admin sessions are stored server-side in D1 (opaque token, only its hash stored) and expire
- [ ] **AUTH-02**: Admin can log out, and a logged-out session cookie is rejected afterwards
- [ ] **AUTH-03**: A disabled admin account is locked out immediately
- [ ] **AUTH-04**: Repeated wrong passwords lock that username for a time window (D1 counter, checked before bcrypt)
- [ ] **AUTH-05**: Unknown username and wrong password return the same response and similar timing
- [ ] **AUTH-06**: Every state-changing admin route rejects requests without an allowed Origin, without a CSRF token, or with a non-JSON content type
- [ ] **AUTH-07**: Admin inputs are validated (slot capacity integer range, ISO start time, login field types)
- [ ] **AUTH-08**: Slot booking is atomic: a failed booking never leaks slot capacity, and capacity N never accepts N+1 bookings

### Admin Panel (client + features)

- [ ] **ADM-01**: Admin panel renders all applicant/student data as text only (no `innerHTML` with data); a hostile name like `<img onerror>` shows as plain text
- [ ] **ADM-02**: A CI check fails if `innerHTML`/`insertAdjacentHTML`/`outerHTML` is used in components without a `// safe:` marker
- [ ] **ADM-03**: National IDs are masked in admin lists
- [ ] **ADM-04**: Admin has a logout button, and an expired session sends staff back to login with a clear message
- [ ] **ADM-05**: Staff can open an applicant detail view (guardian, referral source, consent timestamps)
- [ ] **ADM-06**: Staff can search applicants and lists are paginated
- [ ] **ADM-07**: Staff can change an application's status after approve/reject, with a confirm step
- [ ] **ADM-08**: Staff can delete an applicant and their personal data (with confirm)
- [ ] **ADM-09**: Staff can edit a test slot and cancel a booking

### Placement Test

- [ ] **PT-01**: A student can take the placement test end to end on local D1 (adult bands and kids ladder) and get a result
- [ ] **PT-02**: Staff can see test results in admin: per-session band/score, answers, and abandoned sessions (paginated)
- [ ] **PT-03**: An automated test covers the full flow: test → result → booking → application

### CMS

- [ ] **CMS-01**: CMS OAuth worker checks `state` against a browser-bound cookie and rejects missing/wrong/replayed state
- [ ] **CMS-02**: CMS OAuth worker sends the token only to `https://elc.com.sa` and requests `public_repo` scope only
- [ ] **CMS-03**: `cms-oauth-worker` has its own package, tests, and CI job
- [ ] **CMS-04**: Decap CMS is pinned to an exact version (self-hosted or with integrity hash), not floating on unpkg
- [ ] **CMS-05**: CMS course editor includes all course fields (price unit, duration unit, hours per level/day, schedule days, class times, intake schedule)
- [ ] **CMS-06**: CMS image uploads go to the folder the site actually uses
- [ ] **CMS-07**: A test fails if a content schema field is missing from the CMS config; editing a course in the CMS keeps all existing fields and the site still builds

### Mobile & RTL

- [ ] **MOB-01**: Current uncommitted mobile tweaks (course `h3`, WhatsApp button, course title) are landed
- [ ] **MOB-02**: Playwright runs mobile (Chromium + WebKit) and desktop projects in both AR and EN
- [ ] **MOB-03**: No page scrolls horizontally at 360px and 390px width in AR or EN
- [ ] **MOB-04**: WhatsApp button never covers form buttons (wizard Next/Submit) on phones
- [ ] **MOB-05**: Arabic pages show Gregorian dates (never Hijri); slot times shown in Asia/Riyadh time

### Design Review

- [ ] **DSGN-01**: A full UI review (AR + EN, mobile + desktop) is written up with must-fix vs later items
- [ ] **DSGN-02**: All must-fix items are fixed; the rest are on a written defer list

### Deployment (last step — only after everything above passes locally)

- [ ] **DEP-01**: Real D1 `database_id` set; remote D1 exported/backed up and checked, then all migrations applied remotely
- [ ] **DEP-02**: Both workers deployed; admin login works in Safari/iPhone and Chrome against the deployed worker (if Safari blocks the cross-site cookie, serve admin from the worker)
- [ ] **DEP-03**: bcrypt login works within the Workers plan CPU limit on the deployed worker
- [ ] **DEP-04**: Deploy pipeline works (FTP secrets and server path confirmed) and the built site is uploaded to the domain
- [ ] **DEP-05**: Live smoke check passes on the domain: placement test → booking → application, CMS login → edit → save, AR + EN on phone

## v2 Requirements

### Admin extras (owner: "will come to it later")

- **EXT-01**: CSV export of applicants
- **EXT-02**: Admin notes and rejection reason per applicant
- **EXT-03**: One-click WhatsApp follow-up link per applicant
- **EXT-04**: Placement result page links to recommended course
- **EXT-05**: Referral/funnel report

### Deferred features

- **DEF-01**: Adult reading-passage bands (questions 35–50 seeded, not served) — needs owner band definitions
- **DEF-02**: Automatic deletion of abandoned sessions after a retention period
- **DEF-03**: Resume an unfinished test; kids audio; admin account management UI

## Out of Scope

| Feature | Reason |
|---------|--------|
| Document upload on applications | Removed on purpose in `66a74d8` |
| Applicant login / accounts | Not needed for the funnel |
| Automated email or WhatsApp Business notifications | Staff follow up manually |
| Proctoring, IRT/adaptive scoring | ELC's own ladders are the scoring model |
| Showing raw scores to students | Students see placement result only |
| Payments | Paid in-centre |
| Form builder, page builder, admin i18n | Overkill for staff size |
| Weekly auto-rebuild / push-triggered deploys | Manual upload is enough for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| (filled by roadmap) | | |

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 0 (pending roadmap)

---
*Requirements defined: 2026-11-04*
*Last updated: 2026-11-04 after initial definition*
