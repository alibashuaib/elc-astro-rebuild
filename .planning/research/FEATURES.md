# Feature Research

**Domain:** Bilingual (AR/EN) language-school funnel: online placement test, post-test application, registration intake wizard, staff applicant review, staff-editable content (ELC Jeddah)
**Researched:** 2026-11-04
**Confidence:** MEDIUM overall. Spec-vs-built comparison is HIGH (read the specs and the code directly). "What language schools typically do" is MEDIUM (domain knowledge, no competitor teardown was run). The Saudi PDPL notes are LOW to MEDIUM (secondary sources only; verify with the official text before relying on them).

**Scope note:** This is a harden-and-finish milestone for an existing build, not a greenfield feature hunt. Most of this file answers "what is specced, what is built, what is missing". Where the build intentionally diverged from its spec, that is called out so requirements are written against reality, not the stale spec.

---

## Ground truth: what is actually built (main vs branch)

Read before trusting any spec. Four facts change the requirements:

1. **The registration wizard is finished but unmerged.** It lives on branch `feature/registration-wizard` (also checked out at `.worktrees/registration-wizard`): 22 files, migration `0022_registration_fields.sql`, `RegistrationStepBasics/Details.astro`, `registrationValidation.ts`, `registrationRules.ts`, server-side validation in `handleStartSession`, terms (16 Arabic clauses plus English summary), consent timestamps, updated e2e specs. `main` still has the old single-step form (name, phone, DOB, track) and the interim PR #18 application fields (email, ID type, ID number). So "finish the wizard" is mostly "merge, reconcile with `main`, verify, add the gaps listed below", not "build".
2. **Application document upload was deliberately removed.** Commit `66a74d8` ("remove document uploads") deleted the R2 `DOCS` binding, the upload and document-view routes and `application_documents`. The student-application spec (R2, 5 MB cap, ID copy and photo, document viewer) is therefore superseded on this point. Requirements should say "no document upload" unless the owner reverses the decision.
3. **The placement algorithm in the spec is not what shipped.** The spec describes a 25-question adaptive CEFR staircase (A1 to C2, 72 placeholder items). The build uses ELC's own ladders and fixed-order banks: adults are scored in bands (Fun A/B, Lint A/B/D/E, Hint A; 50% pass per band; 34 banded questions; questions 35 to 50 and the two reading passages are seeded but never served), and kids are scored by share correct on a Super Minds ladder. It also supports text-answer questions, picture questions, skip, and reading passages. The old staircase code (`scoring.ts` `applyAnswer`) still runs but is vestigial. The spec should be rewritten to match the build, not the reverse.
4. **The admin panel is a thin CRUD page**, English-only, at `/en/placement-test/admin` only. It has no logout, no student detail view and no results view.

---

## Feature Landscape

### Table Stakes (users expect these)

Missing any of these makes the funnel feel broken or unsafe. Status column reflects the repo as of `ac55aef` plus the unmerged branch.

#### A. Placement test (student side)

| Feature | Why expected | Complexity | Status / notes |
|---------|--------------|------------|----------------|
| Free, no-login test reachable from the course pages | Language-school funnels are lead capture; login kills conversion | LOW | Built |
| Separate kids and adults tracks, auto-derived from DOB | Different content and ladders | LOW | Built (`computeTrack`, under-11 forced to kids) |
| Result as a level label, not a raw percentage | Schools place students, they do not grade them | LOW | Built (`levelName`, kids `yle`) |
| Per-answer progress ("question N of total") | Users abandon tests with no sense of length | LOW | Built (`questionNumber`, `total`; adults total is 34, not 50) |
| Skip / "I don't know" | Avoids random guessing that distorts placement | LOW | Built; skip scores as wrong and is recorded distinctly |
| Server-side answer grading and "is this the question you were served" check | Stops client tampering and replay | MED | Built (`current_question_id`, migration 0014) |
| Friendly failure when the backend is down, with a WhatsApp fallback so the funnel never dead-ends | Free-tier worker or D1 outage must not lose the lead | LOW | **Specced, unverified.** Check that `RegistrationForm`/`TestRunner` show a WhatsApp fallback on fetch failure; `startSession` errors are only generic. Add if missing |
| Bilingual (AR RTL / EN) test UI at phone width | Core constraint of the project | MED | Built; needs the planned phone-width audit |
| Mobile-friendly large touch targets for kids | Kids test is taken on parents' phones | LOW | Spec said "fast-follow if needed"; fold into the mobile polish pass |

#### B. Booking the in-center oral test

| Feature | Why expected | Complexity | Status / notes |
|---------|--------------|------------|----------------|
| Show only future slots with remaining capacity | Basic correctness | LOW | Built (`listOpenSlots`) |
| No double-booking under concurrency; 409 handled as a normal "pick again" | Capacity is physical (a room) | MED | Built (`bookSlotAtomic`), but **tested only against the hand-written fake D1**. Needs a real-D1 test (the project already plans `@cloudflare/vitest-pool-workers`) |
| WhatsApp confirmation link with name, level, slot | The center runs on WhatsApp; no backend cost | LOW | Built |
| Staff creates and deletes slots; list of upcoming bookings | Staff must control capacity | LOW | Built for create/delete/list. **Missing: edit slot** (spec said create/edit/delete), **validation** of `startsAt`/`capacity`, **booking cancel** (schema has `cancelled`, no route or button) |
| Booking never depends on the smoke test's fixed 2027-01-01 slot | CI reliability | LOW | Open concern, in PROJECT.md Active list |

#### C. Registration wizard (intake before the test)

| Feature | Why expected | Complexity | Status / notes |
|---------|--------------|------------|----------------|
| Two-step intake: basics (4-part name, mobile, DOB) then details (ID, nationality, guardian, referral, consent) | Saudi institutes need 4-part legal names and ID for certificates and the Manzoma register | MED | **Built on branch only** |
| Age-gated guardian section (required under 18, optional 18+) with relationship and guardian mobile | Legal for minors; matches the spec's "critical" logic | MED | Built on branch |
| Terms and conditions (Arabic authoritative, English summary) plus two consent checkboxes, with timestamp and terms version stamped server-side | Evidence of consent; media consent is legally sensitive | MED | Built on branch. Verify the 16 Arabic clauses match the owner's source text (they live in `RegistrationStepDetails.astro` as arrays, not i18n) |
| Every client rule re-validated on the server | Trust boundary; client can be bypassed | MED | Built on branch (`registrationRules.ts`, `session.ts`). Client and Worker copies of the regexes must be kept in sync (intentional duplication) |
| Referral source capture ("how did you hear about us") | Marketing attribution | LOW | Built on branch (stored; not visible anywhere in admin, see gaps) |
| Live estimated-age note, Next gating, per-field inline errors, step-level error banner | Standard wizard behavior | LOW | Built on branch |
| Application step no longer re-asks ID and email | Avoid double entry | LOW | Built on branch (drops columns from `applications`, with backfill in 0022) |

#### D. Student application (after the test)

| Feature | Why expected | Complexity | Status / notes |
|---------|--------------|------------|----------------|
| Application tied to a completed test session (course choice, guardian for kids) | Admissions needs level plus identity in one record | LOW | Built (`POST /api/apply`, unique per session, 409 `already_applied`) |
| "Continue to application" shown after a slot is booked | Funnel continuity | LOW | Built (`ResultBooking.astro`) |
| Clear duplicate-submission message | Parents double-tap | LOW | Built |
| Guardian name required for kids even when the link is opened on another device | The form decides this from `sessionStorage('placement:track')`, so a link opened on another device or from WhatsApp hides the field and the server then answers `guardian_name_required`, which the UI shows as a generic error | LOW | **Bug-shaped gap.** Have the Worker return the track for a session (or accept it in the apply link) and map `guardian_name_required` to a field-level message |
| Confirmation screen saying what happens next (center will contact you) | Reduces "did it work?" WhatsApps | LOW | Built (`apply.submittedIntro`); confirm the copy states the next step and timeframe |

#### E. Staff applicant review and admin

| Feature | Why expected | Complexity | Status / notes |
|---------|--------------|------------|----------------|
| Login with rate limiting, CSRF protection, server-revocable sessions, working logout | Applicant data includes national IDs. **This is the project's stated Core Value** | MED | Not built (see CONCERNS.md). Note: there is currently **no logout route or button at all** |
| Applicant data rendered escaped | Stored-XSS prevention | LOW | **Likely already safe, verify.** The application list builds rows with `textContent`; the only `innerHTML` in `AdminPanel.astro` is a loop over constant level labels. CONCERNS.md overstates this. Fix the one `innerHTML` anyway and add a regression test with a hostile name |
| Application list with status filter; approve / reject | Core review loop | LOW | Built |
| **Reversible status changes and a confirm step** | Buttons only appear for `pending`, so a misclick on Approve/Reject cannot be undone from the UI | LOW | Missing. Allow re-opening to `pending`, or at least a confirm dialog |
| Applicant detail view: full registration record, guardian, referral, consent timestamps and terms version, test level | Staff need the data they collected; consent evidence must be retrievable | MED | Missing (the wizard spec explicitly deferred it). The list line shows name, phone, course, level, status (after the wizard merge also ID and nationality) |
| Search by name / phone / ID | A list with no search stops being usable after a few weeks | LOW | Missing; status filter only |
| Pagination or date window on admin lists | Unbounded `SELECT` of all rows | LOW | Missing (CONCERNS.md) |
| Staff can see test results (per-student answers, band scores, abandoned sessions) | The spec says abandoned sessions are visible to staff, and PROJECT.md requires "admin review of results". An oral tester needs the written result in front of them | MED | **Missing.** No route lists sessions or responses; only `estimated_level` appears on bookings and applications |
| Admin UI in the staff language | Staff are Arabic speakers | LOW | English-only by design ("staff tool"). Accept; do not spend on i18n |

#### F. Staff CMS editing (Decap)

| Feature | Why expected | Complexity | Status / notes |
|---------|--------------|------------|----------------|
| Staff can edit course price, schedule, FAQs and body in both languages, with preview before publish | The reason a CMS exists; prices and intake dates change most | MED | Partly built: `public/admin/config.yml` with `editorial_workflow`, `i18n: multiple_folders`, courses and blog collections |
| **Every field the site renders is editable** | Otherwise staff still need a developer for the common change | MED | **Missing fields.** `content.config.ts` has `priceUnit`, `durationUnit`, `hoursPerLevel`, `hoursPerDay`, `scheduleDays`, `classTimes[]` and `intakeSchedule[]` (start dates, which also feed Event schema), none of which appear in `config.yml`. Also verify that saving a course in Decap does not drop these unknown frontmatter keys (could not confirm; test on a copy) |
| Image uploads that actually resolve | A broken image after publish is the first thing staff will hit | LOW | **Likely broken.** `media_folder: src/assets/uploads` and `public_folder: /uploads`, but that folder does not exist, existing images are `/images/courses/*.jpg` under `public/`, and `image` is a plain string in the schema. Point both folders at `public/images/...` |
| Level options match the site | Avoid inconsistent data | LOW | CMS offers CEFR A1 to C2, the courses schema matches it; the placement ladders are ELC's own (A0 to C1, Fun/Lint/Hint). Decide whether course `level` should follow the ELC ladder |
| Safe login | GitHub token passes through the OAuth worker | MED | Not built: state validation, pinned postMessage origin, minimal scope (CONCERNS.md). **Also: `index.html` loads `decap-cms@^3.0.0` from unpkg with no pinned version and no SRI on the page that handles the GitHub token.** Pin the exact version and add `integrity`, or self-host |
| Clear "who can edit" story | Staff need a GitHub account with write access to the repo | LOW | Document it. Decap's `github` backend gives every editor repo write access, so access control equals repo access |
| Saving a CMS entry results in a live site | The "reliably" in "edit content reliably" | MED | **Blocked by deploy being manual-only** (`workflow_dispatch`). Out of scope for this milestone, but the requirement should say "CMS save produces a merged change on `main` and a successful CI build", with go-live wiring deferred |

---

### Differentiators (competitive advantage)

None of these are expected. Pick the cheap ones; the Core Value is safety, not novelty.

| Feature | Value proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| ELC-specific level ladders (Fun/Lint/Hint, Super Minds) with a level description on the result | Competitors show generic CEFR; ELC's result maps straight to a class the center actually runs | LOW | Built. Add a one-line description per level (the spec promised this) and a "recommended course" link |
| Result page links to the matching course page | Turns a test result into a course choice; reduces the free-text course pick on the application | MED | Not built. Also fixes a latent bug: the application stores the **localized course title string**, so renaming a course in the CMS breaks matching. Store the course slug instead |
| CSV export of applications or bookings | Staff already keep registers in Excel and re-key data into the Manzoma register; export removes retyping | LOW | Not built. Most valuable differentiator per hour of work. Must be admin-gated and include only the fields staff need |
| Referral-source and funnel report (tests started, completed, booked, applied, approved) | The owner runs ad campaigns; this shows which source converts | MED | Data is captured on the branch (`referral_source`), nothing reads it. A single admin page with counts is enough; no charting library |
| Admin notes and rejection reason on an application | Gives staff context when several people share the one login | LOW | Add `notes` column. Low cost, medium value |
| Pre-filled WhatsApp message from the admin ("Hi X, we received your application") | Manual follow-up is the real "notification" system | LOW | One link per row; avoids building notifications |
| Resume an interrupted test | Parents' phones lock mid-test | MED | `current_question_id` makes this feasible, but the spec explicitly excluded it. Defer unless abandoned-session numbers justify it |
| Simplified kids UI (read-aloud prompts, bigger targets) | Differentiated kids experience | HIGH | Content-dependent (audio). Defer |
| Real-D1 integration tests for booking concurrency and the full migration chain | Quality, not a user feature | MED | Listed under hardening, but also the only way to trust the 22-migration seed chain |

---

### Anti-Features (commonly requested, deliberately not built)

| Feature | Why requested | Why problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Document upload (ID copy, photo) on the application | The old spec had it; "admissions will want ID" | It was removed on purpose. It brings R2, MIME and size validation, virus risk, retention, and a second place holding national-ID images, directly against the Core Value | ID number is collected at registration. Staff verify the physical ID at the oral test in the center |
| Applicant login / editable submitted application | "Let students check status" | Needs accounts, password reset, a portal. Contradicts the spec's one-time submission | Corrections via WhatsApp; staff edit in D1 or a future admin edit |
| Automated email / WhatsApp Business API notifications | "Tell them when approved" | Cost, template approval, a consent trail. Explicit spec non-goal | Pre-filled `wa.me` link from the admin row (see differentiators) |
| Proctoring, anti-cheating, timers, tab-switch detection | Written test is taken at home | The oral test in the center is the real gate; the spec says so. Proctoring harms conversion and is unreliable on phones | Keep the oral test as the authority; keep server-side question-order enforcement |
| True IRT / fully adaptive engine | "Modern placement tests are adaptive" | The spec's own staircase was already replaced by banded fixed order, which staff can audit row by row. IRT needs a calibrated item bank ELC does not have | Keep banded scoring; extend `ADULT_BANDS` data when the reading bands are ready |
| Raw score or percentage shown to the student | Curiosity | Misreads as pass/fail; the center places students, it does not grade them | Level name plus description only |
| Payment / enrolment fee collection | Funnel ends at "registration" | Out of scope in all three specs; adds PCI and refunds | Fees stay in the terms text and the center |
| Generic form builder / configurable wizard fields | "Staff might want to change fields" | Explicit non-goal. A purpose-built two-step wizard is simpler and testable | Change fields via code and migration |
| Multi-role admin / per-user permissions / self-service password reset | "Staff turnover" | One shared account is the documented model. RBAC is out of proportion | Make rotation and revoking a session easy (server-side revocation, and a documented way to rotate the password hash) |
| Page-builder / WYSIWYG for site layout in the CMS | "Let staff change anything" | Breaks the structured-content model that makes schema.org output automatic | CMS edits structured fields only; layout changes go through code |
| Staff-editable testimonials | "Add reviews easily" | Deliberately excluded to avoid fabricated quotes; reviews come from Google | Keep as is |
| Full i18n of the admin panel | Staff speak Arabic | Staff-only, low traffic, doubles maintenance | Keep English |
| Collecting full PII before the student has committed to the test | Wizard requires everything up front | Every abandoner leaves a row with national ID, address and guardian data | Do not remove (the owner wants it), but add a retention rule (see Pitfalls note below) |

---

## Feature Dependencies

```
Admin hardening (rate limit, CSRF/Origin check, revocable session, logout)
    └──requires first──> any new admin screen
                              ├── Applicant detail view
                              ├── Results / sessions view
                              ├── CSV export
                              └── Notes / re-open status

Merge feature/registration-wizard
    ├──requires──> reconcile with main (application.ts, ApplicationForm, AdminPanel, ui.ts, TestRunner, tests, local-dev.ts)
    ├──requires──> run migration 0022 against the real D1 (needs the real database_id)
    ├──enables───> Applicant detail view (students table now holds the data)
    ├──enables───> Referral funnel report
    └──requires──> Application route/form already trimmed (done on branch)

Real D1 binding (non-placeholder database_id)
    └──requires first──> end-to-end placement test, booking-concurrency test, migration-chain test

Course slug stored on application ──enhances──> Result page → recommended course link
Worker returns session track ──fixes──> ApplicationForm guardian-field bug

CMS fields added for intakeSchedule/classTimes ──requires──> verifying Decap does not drop unknown keys
CMS image folder fix ──requires──> decision on where uploaded images live
CMS save → live site ──conflicts with (this milestone)──> manual-only deploy (go-live is out of scope)

Document upload (R2) ──conflicts──> removed-by-decision / Core Value; do not plan
```

### Dependency notes

- **Admin hardening comes before every new admin feature.** PROJECT.md already states "security fixes come before feature work on admin screens". The detail view, export and results view all expose national IDs.
- **The wizard merge must happen before the applicant detail view.** Without it, ID and nationality are still on `applications` (old shape) and the admin line item changes shape mid-milestone.
- **Placement-test migrations are append-only.** The wizard's `0022` must stay numbered after `0021`; any other branch adding a migration (check the other unmerged feature branches) will collide.
- **A stale spec is a requirement risk.** The placement-test spec describes a different algorithm than the shipped one. Requirements should reference the code and migration chain, not the spec's staircase and 72-item placeholder bank.

---

## MVP Definition (for the "harden and finish" milestone)

### Launch With (this milestone)

- [ ] Admin hardening complete (rate limit, Origin/CSRF, revocable session plus logout, escaped rendering with a regression test) — Core Value
- [ ] Real D1 database id and a real-D1 end-to-end run of: register, test, result, book, apply, admin approve — proves the funnel works
- [ ] Merge and verify `feature/registration-wizard` on top of current `main`; run migration 0022 against a copy first
- [ ] Application: fix the guardian-field/track dependency; store course slug rather than the localized title; field-level error mapping
- [ ] Admin: applicant detail view (registration record, guardian, referral, consent stamps), search, re-openable status with confirm, booking cancel, slot edit, input validation on slot create
- [ ] Admin: a results view (per-session band scores / answers, plus abandoned sessions) so the oral tester sees the written result
- [ ] CMS: add the missing course fields, fix image folders, pin or self-host Decap with integrity, harden the OAuth worker (state, origin, scope); confirm unknown keys survive a save
- [ ] Spec hygiene: update the three specs (or add a short "as-built" note) so they reflect banded scoring and no document upload
- [ ] Mobile polish and design review fixes already in the Active list

### Add After Validation (v1.x)

- [ ] CSV export of applications and bookings — once staff say retyping into the register is the pain
- [ ] Admin notes and rejection reason — once more than one person uses the shared login
- [ ] Referral/funnel report — once real traffic exists
- [ ] Result page linking to the recommended course
- [ ] Pre-filled WhatsApp follow-up link from admin rows

### Future Consideration (v2+)

- [ ] Reading-passage bands for adults (questions 35 to 50 exist but are unserved; needs the owner's band definitions)
- [ ] Resume-interrupted-test
- [ ] Kids read-aloud / audio prompts
- [ ] Admin account management UI (create, disable, rotate) — currently a direct D1 write

---

## Feature Prioritization Matrix

| Feature | User value | Implementation cost | Priority |
|---------|------------|---------------------|----------|
| Admin hardening (rate limit, CSRF, revocation, logout) | HIGH | MEDIUM | P1 |
| Real-D1 end-to-end funnel proof | HIGH | MEDIUM | P1 |
| Merge and verify registration wizard | HIGH | MEDIUM | P1 |
| Applicant detail view (registration record, consent) | HIGH | MEDIUM | P1 |
| Results / sessions view for staff | HIGH | MEDIUM | P1 |
| Re-openable status plus confirm | MEDIUM | LOW | P1 |
| Application guardian/track fix and course-slug storage | MEDIUM | LOW | P1 |
| CMS missing fields, image folder fix, Decap pin plus SRI | HIGH | LOW to MEDIUM | P1 |
| CMS OAuth worker hardening | HIGH | MEDIUM | P1 |
| Booking cancel, slot edit and validation | MEDIUM | LOW | P2 |
| Admin search and pagination | MEDIUM | LOW | P2 |
| WhatsApp fallback when backend is down (verify) | MEDIUM | LOW | P2 |
| Spec as-built updates | MEDIUM | LOW | P2 |
| CSV export | MEDIUM | LOW | P2 |
| Admin notes / rejection reason | LOW to MEDIUM | LOW | P2 |
| Referral/funnel report | MEDIUM | MEDIUM | P3 |
| Result → recommended course | MEDIUM | MEDIUM | P3 |
| Resume test; kids audio; adult reading bands | LOW to MEDIUM | MEDIUM to HIGH | P3 |

**Priority key:** P1 must have for this milestone; P2 should have, add when possible; P3 later.

---

## Spec vs build checklist (what is unfinished)

Legend: DONE = on `main`; BRANCH = only on `feature/registration-wizard`; DIVERGED = built differently, spec is stale; GAP = specced or required, not built.

### Placement test spec (2026-08-25)

| Spec item | State | Detail |
|-----------|-------|--------|
| Worker plus D1, `/placement-test` page, admin page | DONE | Router, 12 migrations of content, e2e smoke test |
| Registration form to test to result to booking to WhatsApp | DONE | |
| Adaptive staircase, 25 questions, A1 to C2 | DIVERGED | Replaced by banded adults and share-correct kids; `scoring.ts` staircase is vestigial |
| 72 placeholder items | DIVERGED | Real bank seeded by migrations (50 adult, about 44 kids); admin can add MCQ only |
| Result with a one-line description | PARTIAL | Level and stage name shown; verify description text exists |
| Admin: slots create/edit/delete | PARTIAL | No edit |
| Admin: bookings list | DONE | No cancel, confirmed only |
| Admin: question bank list/add/edit/deactivate | PARTIAL | No edit; MCQ only; no text, picture or passage authoring; cannot set order |
| Abandoned sessions visible to staff | GAP | |
| Worker-down friendly error plus WhatsApp fallback | UNVERIFIED | |
| Concurrency test for last-seat booking | PARTIAL | Exists against fake D1 only |
| Staff password rotation, shared account | DONE (by design) | No account-management route |

### Student application spec (2026-09-06)

| Spec item | State | Detail |
|-----------|-------|--------|
| `applications` table, unique per session, 409 on duplicate | DONE | |
| `POST /api/apply` with session-completed check, kids guardian check | DONE | |
| R2 documents: upload route, 5 MB cap, MIME checks, admin document viewer, "incomplete" flag | DIVERGED, removed on purpose | Do not rebuild without an explicit owner decision |
| ID number on the application | DIVERGED | Moved to the students table by the wizard (BRANCH) |
| Admin Applications tab: list plus approve/reject | DONE | |
| Admin detail view with documents | GAP | Documents gone; detail view itself still missing |
| `ResultBooking` "Continue to application" | DONE | |
| Playwright e2e booking to apply | DONE | Depends on the hard-coded 2027-01-01 slot |

### Registration wizard spec (2026-09-08)

| Spec item | State | Detail |
|-----------|-------|--------|
| Migration adding student columns, drop application columns | BRANCH | `0022_registration_fields.sql` (spec said 0020; real numbering is 0022) |
| Step 1 / Step 2 components, shell, stepper, Next gating | BRANCH | |
| Guardian logic, referral logic, terms box, two consents | BRANCH | |
| Server-side validation of all rules; terms stamped with version | BRANCH | |
| `registration.*` i18n keys | BRANCH | |
| Admin line shows student ID and nationality | BRANCH | |
| Tests (session, application, e2e) | BRANCH | Not run on current `main` |
| Merged into `main` | GAP | The single biggest "unfinished" item |
| Full registration detail in admin | GAP (spec deferred) | Recommended for this milestone, see above |

### Staff CMS (no spec; PROJECT.md requirement)

| Item | State |
|------|-------|
| Decap config, GitHub backend, editorial workflow, en/ar folders | DONE |
| Missing course fields (intake dates, class times, units, schedule) | GAP |
| Image folder config | LIKELY BROKEN |
| OAuth state/origin/scope hardening | GAP |
| Pinned and integrity-checked Decap script | GAP |
| Publish path (deploy) | OUT OF SCOPE here |

---

## Competitor and domain notes

No competitor teardown was run in this pass (Confidence: MEDIUM, from general domain knowledge). Typical patterns for language-school online placement tests (for example the public tests from Cambridge, British Council, EF and commercial schools):

- Free, short (15 to 45 min), grammar and vocabulary heavy, often adaptive, ending in a CEFR label, then a speaking check with a teacher. ELC's design (written online plus oral in center) matches that norm.
- Lead capture before the result is standard. ELC collects far more than most (national ID, address) because it feeds a regulatory register. That is a feature for the center, but it raises the data-protection stakes (below).
- Applications at small Gulf institutes usually run through WhatsApp and a staff spreadsheet. A stored application plus a review list is already ahead; export to spreadsheet is the natural bridge.

**Data-protection note (LOW to MEDIUM confidence, verify with counsel or the official SDAIA text):** Saudi Arabia's PDPL is in force. Secondary sources describe explicit consent, guardian consent for minors, retention limits, a right to withdraw consent, and rules on transferring data out of the Kingdom (the Worker and D1 run on Cloudflare, so storage location should be checked). The wizard's consent stamps cover the first two. Retention and deletion are not implemented: abandoned sessions keep full PII indefinitely. Worth a short requirement ("a staff-run delete/anonymize path and a retention rule"), not a compliance project.

## Sources

- Repo: `docs/superpowers/specs/2026-08-25-placement-test-design.md`, `2026-09-06-student-application-design.md`, `2026-09-08-registration-wizard-design.md`
- Repo code read: `placement-test-worker/src/{index,auth,scoring,bands,db}.ts`, `routes/{session,application,admin}.ts`, `migrations/0019` and `0021`, `src/components/placement-test/{AdminPanel,ApplicationForm,ResultBooking}.astro`, `src/content.config.ts`, `public/admin/{config.yml,index.html}`
- Git: `feature/registration-wizard` (`git diff --stat main...`, migration `0022`, `registrationValidation.ts`, `RegistrationStepDetails.astro`), commit `66a74d8` message (document uploads removed)
- `.planning/PROJECT.md`, `.planning/codebase/{ARCHITECTURE,CONCERNS,STRUCTURE}.md`
- Web (LOW confidence, vendor/consultancy blogs, not the official text): search results on Saudi PDPL consent, minors, retention and cross-border rules, e.g. dpo-consulting.com, decube.io, securiti.ai
- Domain norms for language placement tests: general knowledge, not source-verified

---
*Feature research for: bilingual language-school placement, application, registration, admin and CMS funnel*
*Researched: 2026-11-04*
