# Student Application After Placement Test

**Status**: Approved for planning
**Date**: 2026-09-06

## Problem

Once a prospective student finishes the placement test and books a test
slot (existing `ResultBooking.astro` flow), there is no way to actually
submit an application to enroll — only a WhatsApp message with contact
details, nothing stored, nothing for admissions to review in one place.
This adds a real, stored application step tied to that placement-test
result, plus an admin view to approve or reject applications.

## Non-goals

- Payment collection — enrollment fees stay off-platform, as today.
- Applicant login / editing a submitted application — one-time submission;
  corrections go through admissions directly.
- Automated notifications (email/WhatsApp) on status change — a manual
  admin-panel review loop ships first; notifications are a follow-up.
- Replacing the existing WhatsApp-based `/register` page — that stays as
  today's general lead-capture form. This feature is specific to the
  placement-test funnel.

## Architecture

The site stays static (Astro, FTP-deployed to Hostinger); no new hosting
or deploy pipeline. This extends the existing `placement-test-worker`
(Cloudflare Worker + D1) rather than standing up a new backend — the
application is meaningless without the `test_sessions` row it's linked
to, and a second worker would mean cross-worker joins for no benefit.

One new binding is added: an R2 bucket for uploaded documents (ID copy,
photo). The worker gets `DOCS` in its bindings; D1 stores only the R2
object key, not file bytes.

```
Browser (Astro /apply page)
  │  fetch() JSON + multipart upload
  ▼
Cloudflare Worker  (placement-test-worker/, extended)
  │  SQL              │  R2 put/get
  ▼                    ▼
D1 (applications,   R2 bucket (DOCS)
 application_documents)
```

New Astro page (both `en`/`ar`):
- `/{locale}/apply?session=<sessionId>` — application form, reached via a
  link/button shown after a test slot is booked in `ResultBooking.astro`

Extended:
- `/{locale}/placement-test/admin` — new "Applications" tab alongside the
  existing slots/questions/bookings tabs

## Data model (D1)

New migration in `placement-test-worker/migrations/`:

```sql
CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES test_sessions(id),
  course TEXT NOT NULL,
  guardian_name TEXT,          -- kids track only, NULL for adults
  id_number TEXT NOT NULL,     -- national ID / passport number
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES admin_users(id)
);

CREATE TABLE application_documents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  kind TEXT NOT NULL CHECK (kind IN ('id_copy','photo','other')),
  r2_key TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_applications_session ON applications(session_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_application_documents_application ON application_documents(application_id);
```

`session_id` links the application back to the student's identity (name,
phone, dob, guardian_name already on `students`) and placement result
(`estimated_level` on `test_sessions`), so the form only asks for what
isn't already known: course choice, guardian confirmation, ID number, and
documents.

## API (worker)

New `placement-test-worker/src/routes/application.ts`, following the
existing style of `routes/booking.ts`:

- `POST /apply` — body `{ sessionId, course, guardianName?, idNumber }` →
  creates the `applications` row, returns `{ applicationId }`. 400 if
  `sessionId`/`course`/`idNumber` missing, or if `sessionId` doesn't
  reference a completed session.
- `POST /apply/:id/documents` — multipart form upload (`kind`, `file`) →
  streams to R2 under key `applications/<applicationId>/<kind>-<uuid>`,
  writes an `application_documents` row. 413 if file exceeds a size cap
  (5 MB), 400 for unsupported MIME types (accept image/jpeg, image/png,
  application/pdf only).
- `GET /admin/applications?status=` — list with student/session details
  joined in, gated by existing `requireAdmin`.
- `PATCH /admin/applications/:id` — body `{ status }` (`approved` |
  `rejected`) → sets `status`, `reviewed_at`, `reviewed_by` from the
  authenticated admin session.
- `GET /admin/applications/:id/documents/:docId` — streams a document
  back from R2 for staff viewing, gated by `requireAdmin`.

## Frontend

- `src/pages/[lang]/apply.astro` — thin page shell (locale, meta), same
  pattern as `placement-test/index.astro`
- `src/components/placement-test/ApplicationForm.astro` — the form itself
  (course select, conditional guardian field for kids track, ID number,
  two file inputs), styled consistently with `RegistrationForm.astro`.
  Reads `sessionId` from the query string; if absent, shows a message
  directing the student back to the placement test.
- `src/lib/placementApi.ts` gains `submitApplication(sessionId, fields)`
  and `uploadDocument(applicationId, kind, file)`.
- `ResultBooking.astro` gets a new "Continue to application" link/button
  shown once a slot is booked, pointing at `/apply?session=<id>`.
- `AdminPanel.astro` gains an "Applications" tab: table of applications
  (student name, course, level, status, submitted date), a detail view
  with document links, and approve/reject buttons calling the new PATCH
  route.
- Bilingual copy (en/ar) added to `i18n/ui.ts` following the existing
  `placementTest.*` key structure.

## Error handling

- Duplicate submission: a `session_id` can have at most one application
  (enforced with a unique index on `applications.session_id`); a second
  `POST /apply` for the same session returns 409, and the frontend shows
  "You've already applied" instead of a blank form.
- Upload failures (network drop mid-upload, oversized file) surface as an
  inline form error; the application record itself is already created at
  that point, so the student can retry the upload without resubmitting
  the whole form. The admin view flags applications with fewer than the
  expected document count as "incomplete" rather than treating it as an
  error state.

## Testing

Matches existing conventions:
- Vitest unit tests for the new DB functions and routes:
  `application.test.ts` (worker routes) alongside `booking.test.ts`,
  extending `test-utils/fakeD1.ts` as needed; a fake R2 binding stub for
  upload tests.
- Playwright e2e: extend `tests/e2e/placement-test.spec.ts` (or a new
  `application.spec.ts`) to cover slot booking → apply → confirmation,
  including the guardian-field toggle for the kids track.
- Admin route tests for list/approve/reject, reusing the existing admin
  auth test setup in `admin.test.ts`.
