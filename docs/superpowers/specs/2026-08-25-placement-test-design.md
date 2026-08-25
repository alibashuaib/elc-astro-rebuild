# Remote Placement Test + In-Center Oral Test Booking

**Status**: Approved for planning
**Date**: 2026-08-25

## Problem

ELC currently runs placement testing entirely in-person at the center. The
goal is to let a prospective student complete the written portion (grammar
and vocabulary, adaptive, CEFR-aligned) from home, get an immediate estimated
level, then book a time slot at the center for the oral portion that
confirms/finalizes placement. Both kids and adults need this, as two
separate tracks.

## Non-goals

- Listening/reading/writing-sample sections (grammar & vocabulary MCQ only,
  per decision).
- Full LMS or student portal — this is a single-purpose funnel: test → book
  → WhatsApp confirmation.
- Real question content — a placeholder/fabricated item bank ships now;
  the real bank is supplied later and swapped in without a schema change.
- Payment/paid registration — placement testing is free, as today.
- Anti-cheating/proctoring — the written test is a rough placement input;
  the oral test at the center is the actual gate, so integrity controls
  beyond a session timer are out of scope.

## Architecture

The site stays static (Astro, FTP-deployed to Hostinger). One new backend
component is added: a Cloudflare Worker + D1 database, following the same
pattern already established by `cms-oauth-worker/`. No change to hosting,
deploy pipeline, or the rest of the static site.

```
Browser (Astro pages)
  │  fetch() JSON
  ▼
Cloudflare Worker  (placement-test-worker/)
  │  SQL
  ▼
D1 database (SQLite, Cloudflare-managed)
```

New Astro pages (both `en`/`ar`, matching existing i18n routing):
- `/{locale}/placement-test` — registration form → test → result → booking
- `/{locale}/placement-test/admin` — staff slot + question-bank management
  (password-gated)

## Data model (D1)

```sql
students (
  id, name, phone, guardian_name NULL, dob, locale, created_at
)

test_sessions (
  id, student_id, track ENUM('kids','adults'), status ENUM('in_progress','completed','abandoned'),
  estimated_level TEXT NULL,  -- 'A1'..'C2'
  started_at, completed_at NULL
)

questions (
  id, track ENUM('kids','adults'), level TEXT,  -- CEFR tag this item targets
  prompt, options JSON,  -- ["...", "...", "...", "..."]
  correct_index INT, active BOOLEAN DEFAULT true
)

responses (
  id, session_id, question_id, selected_index, correct BOOLEAN, answered_at
)

slots (
  id, starts_at, capacity, booked_count DEFAULT 0
)

bookings (
  id, session_id, slot_id, status ENUM('confirmed','cancelled'), created_at
)

admin_users (
  id, username, password_hash
)
```

Fields for kids (`guardian_name`, guardian's `phone`) reuse the same
`students` row — `phone` is always the WhatsApp contact number, which is
the guardian's number when `track = 'kids'`.

## Test flow

1. **Registration** — full form: student name, phone (WhatsApp), DOB,
   guardian name (shown only if computed age < 16), locale. Track
   (`kids`/`adults`) is auto-derived from DOB, no manual picker.
2. **Adaptive test** — starts at a mid-anchor level (B1). Each answer moves
   the working estimate up or down one level step on correct/incorrect,
   with step size shrinking as the session progresses (coarse-to-fine, a
   simple staircase algorithm — not full IRT). Ends after a fixed ceiling
   of 25 questions or once 4 consecutive answers keep the estimate within
   the same level band, whichever comes first. Question selection per step
   pulls a random `active` item from `questions` matching the current
   level + track, no immediate repeats within a session.
3. **Result** — final level (A1–C2) shown with a one-line description ("can
   understand simple everyday expressions..."). No raw score exposed —
   matches how the center would present a placement, not a percentage.
4. **Booking** — fetch open `slots` (starts_at in future, booked_count <
   capacity), student picks one; Worker does the increment inside a
   transaction to avoid double-booking a full slot; on success, insert
   `bookings` row.
5. **Confirmation** — a `wa.me` link is generated client-side (same pattern
   as `RegistrationExperience.astro`) prefilled with name, level, and
   chosen slot time, opened for the student to send. No WhatsApp Business
   API — this keeps the zero-backend-cost property of the existing
   registration flow, just adds the Worker for test/booking state.

## Adaptive scoring — precise rule

CEFR levels are ordered `A1 < A2 < B1 < B2 < C1 < C2` (indices 0-5).

- `current = 2` (B1) at start, `step = 2`.
- Correct answer: `current = min(5, current + step)`.
- Incorrect answer: `current = max(0, current - step)`.
- After each answer, `step = max(1, step - 1)` for the *next* answer (so
  step sequence is 2,1,1,1... after the first move) — this converges
  quickly without overshooting past the ends.
- Stop condition: 25 questions asked, OR last 4 recorded `current` values
  are identical.
- Final level = last `current` value mapped back to its CEFR label.

This is intentionally simple and auditable — a staff member can look at
one student's `responses` row-by-row and see exactly why the algorithm
landed where it did. Unit tests pin down this exact sequence behavior
against fixed correct/incorrect input sequences.

## Admin page

Single password-protected route, session via signed cookie issued by the
Worker (username/password checked against `admin_users.password_hash`,
bcrypt). No self-service password reset in v1 — one shared staff account,
password rotated manually if needed (matches the low-stakes, single-location
nature of the center).

Capabilities:
- Slots: create/edit/delete `slots` rows (date, time, capacity).
- Bookings: list upcoming bookings with student name/phone/level/slot.
- Question bank: list/add/edit/deactivate `questions` (no delete, to
  preserve historical `responses` referential integrity — deactivated
  items just stop being selected for new sessions).

## Placeholder question bank

Ships with ~6 fabricated MCQ items per level per track (72 total: 6 levels
× 2 tracks × 6 items) — clearly placeholder content (simple, generic
grammar/vocab items), inserted via a D1 seed migration. Swapping in the
real bank later is a data operation (INSERT/UPDATE via the admin page or a
new seed file), not a schema or code change.

## Error handling

- Test session interrupted (browser closed mid-test): `test_sessions.status`
  stays `in_progress`; no resume-from-where-you-left-off in v1 — student
  starts a fresh session if they return. Abandoned sessions are visible to
  staff but don't block anything.
- Slot fills between page load and booking submit: Worker rejects with a
  409, frontend re-fetches slot list and asks the student to pick again.
- Worker/D1 unavailable: registration form shows a friendly error and a
  fallback WhatsApp link to contact the center directly, so the funnel
  never dead-ends even if the backend is down.

## Testing

- Unit tests (Vitest, matching the project's existing tooling) for the
  adaptive scoring function: fixed input sequences → exact expected level,
  including edge cases (all correct → C2, all incorrect → A1, oscillating
  → mid-level convergence).
- Unit tests for slot-booking concurrency: two simultaneous bookings against
  a slot with `capacity - booked_count = 1` — exactly one succeeds.
- Integration tests for Worker endpoints against local D1 (Miniflare).
- Manual QA pass: full flow kids + adults, en + ar, on the admin page.

## Open items carried forward (not blockers for this spec)

- Real question bank content — user will supply.
- Whether kids under a certain age need a simplified UI (larger touch
  targets, read-aloud prompts) beyond the separate track — not raised as a
  requirement; can be a fast-follow if needed once the placeholder bank is
  replaced with real content.
