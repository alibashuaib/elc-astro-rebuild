# ELC Astro Rebuild — Harden & Finish

## What This Is

The bilingual (Arabic/English) Astro rebuild of the English Learning Center (ELC) Jeddah website, plus two Cloudflare Workers: the placement-test/bookings API (D1) and the CMS OAuth worker. This project takes the existing build from "mostly there" to hardened and feature-complete: fix the security and reliability concerns found in the codebase map, and finish the half-built features (placement test, student application, registration wizard, CMS editing, mobile polish, design-review fixes). Everything is built and tested locally first; uploading to the domain is the final phase.

## Core Value

Applicant data and the admin side are safe: no stored XSS, no brute-forceable or CSRF-able admin, no leaky OAuth. If everything else slips, this must hold.

## Business Context

- **Customer**: Prospective ELC students/parents (AR + EN) and ELC staff who manage content and review applicants
- **Revenue model**: Site drives course enrolments (placement test → application → registration)
- **Success metric**: All CONCERNS.md items resolved or consciously accepted, tests green in CI, every page correct at phone width in AR + EN
- **Strategy notes**: Cutover from current WordPress site is out of scope here

## Requirements

### Validated

- ✓ Static Astro 7 site with `en`/`ar` locale routing (always prefixed) — existing
- ✓ Course pages with SEO schema (Course, Event, FAQ, breadcrumbs), alt text, cross-linking — existing
- ✓ Placement-test worker on Cloudflare Workers + D1 with 21 migrations, bcrypt-hashed admin credentials — existing (partly wired)
- ✓ CMS OAuth worker for GitHub login — existing (needs hardening)
- ✓ Playwright smoke tests, Vitest worker tests (fake D1), Lighthouse CI budgets — existing
- ✓ Mobile slim-down pass (#25) — existing

### Active

**Hardening**
- [ ] Admin login rate-limited against brute force
- [ ] State-changing admin routes protected against CSRF (Origin check / SameSite fix)
- [ ] Admin sessions revocable (logout invalidates server-side)
- [ ] CMS OAuth validates `state`, posts token only to the expected origin, minimal scope
- [ ] AdminPanel renders applicant data escaped (no stored XSS)
- [ ] D1 `database_id` real, not the all-zero placeholder
- [ ] `latest`-pinned deps (bcryptjs, wrangler, vitest, typescript…) pinned to exact versions
- [ ] Smoke test no longer depends on the hard-coded 2027-01-01 slot
- [ ] Test coverage for admin flows, placement test, and forms; tests pass in CI

**Finish features**
- [ ] Placement test works end to end against a real D1 DB, with admin review of results
- [ ] Student application finished per `docs/superpowers/specs/2026-09-06-student-application-design.md`
- [ ] Registration wizard finished per `docs/superpowers/specs/2026-09-08-registration-wizard-design.md`
- [ ] Staff can log into the CMS and edit content reliably
- [ ] Mobile polish: current uncommitted tweaks (course `h3`, WhatsApp FAB, course title) landed; every page checked at phone width in AR + EN
- [ ] Full UI design review run (AR + EN, mobile + desktop) and its findings fixed

**Deployment (last step)**
- [ ] After everything passes locally: remote D1 migrated, workers deployed, site uploaded to the domain, live smoke check passes (incl. Safari admin login)

### Out of Scope

- Turning the weekly review rebuild / push-triggered deploys back on — manual upload is enough for now
- New marketing features or content beyond the specs above — not part of harden & finish

## Context

- Codebase map: `.planning/codebase/` (STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS), mapped 2026-11-04 at `ac55aef`.
- Stack: Astro ^7.2.4 static output, TypeScript strict, Node >= 22.12, npm; Cloudflare Workers + D1 (wrangler); Playwright, Vitest with `@cloudflare/vitest-pool-workers`, Lighthouse CI.
- Integrations: Google Places, GTM, GitHub OAuth (CMS). CI in `.github/workflows/`; deploy is manual `workflow_dispatch` only, FTP secrets/server path unconfirmed.
- Existing specs/plans in `docs/superpowers/` for placement test, student application, registration wizard.
- Last commit before this project: `ac55aef` "checkpoint before full design review" — no review findings exist yet.
- Uncommitted work at init: mobile CSS in `CourseContentPanel.astro`, `WhatsAppButton.astro`, `pages/[lang]/courses/[slug].astro`.
- Separate known WP-site items (TikTok pixel, GTM workspace, local SEO) belong to the live WordPress site, not this repo.

## Constraints

- **Bilingual**: Every UI change must work in Arabic (RTL) and English — ELC serves both audiences
- **Hosting**: Static site + Cloudflare Workers/D1 — keep the existing platform, no new backend
- **Admin data**: Applicant data includes personal IDs — security fixes come before feature work on admin screens
- **Workflow**: Build and verify everything locally (`astro dev`/`preview` + `wrangler dev --local` D1) first; only then upload to the domain. "Done" for each phase = passes locally. Production-only checks (Safari cross-site admin cookie, Workers plan CPU limit for bcrypt, remote D1 migration) belong to the final Deployment phase.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build and test locally; deploy as the final phase | Owner's workflow: verify locally, then upload | — Pending |
| Applicant deletion = manual delete button in admin | Owner choice for PDPL; auto-retention deferred | — Pending |
| Arabic pages use Gregorian dates only | Owner choice | — Pending |
| Admin extras (CSV, notes, WhatsApp link…) deferred to v2 | Owner: "will come to it later" | — Pending |
| Run a fresh design review as a phase | No prior review findings exist | — Pending |
| Student application + registration wizard are unfinished | Per user; finish against existing specs | — Pending |
| "Done" = concerns fixed, tests green in CI, phone-width correct AR+EN | User-defined exit criteria | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-04 after initialization*
