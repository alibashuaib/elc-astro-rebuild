# Registration Wizard (2-step) — Design Spec

## Problem

The current student registration step (`src/components/placement-test/RegistrationForm.astro`) is a single-page form collecting only name, phone, DOB, and (for kids) a guardian name. It's the first thing a visitor fills before the placement test starts.

The institute needs much richer intake at this step: full four-part legal name, national ID/Iqama/passport number, nationality, contact details, guardian information (with an age-gated requirement), how the student heard about the institute, and legally significant consent (terms & conditions, photo/video use) — all before the placement test proceeds.

This spec also removes the now-duplicate `email`/ID-type/number fields recently added to the post-test application step (PR #18, `feature/application-email-idtype`) — those are collected once, here, at registration.

## Non-goals

- No change to the placement-test question flow itself, scoring, or the slot-booking step.
- No payment collection — fee terms are informational text in the terms box, not a checkout flow.
- The application step (after the test) still exists for course confirmation; it no longer asks for ID or email since those now live at registration.
- Not building a general-purpose form builder — this is a purpose-built two-step wizard.

## Architecture

`RegistrationForm.astro` becomes a shell that owns:
- A visual stepper (1 → 2)
- Step-1/Step-2 visibility toggling (no page navigation — same SPA-ish in-page behavior as today)
- Client-side "Next" gating (Step 1 must fully validate before Step 2 is shown)
- The final submit, which dispatches the existing `placement:register` CustomEvent (consumed by the parent page exactly as today) after both steps validate and both consent checkboxes are checked

Two new sub-components carry the field markup, to keep files focused:
- `src/components/placement-test/RegistrationStepBasics.astro` — Step 1 fields
- `src/components/placement-test/RegistrationStepDetails.astro` — Step 2 fields + terms/consent

All three files share one `<script>` mounted in the shell (Astro islands don't share scope across separate `<script>` tags reliably for this kind of cross-step state, so validation/wizard logic stays centralized in `RegistrationForm.astro`, with the sub-components as pure markup+props).

## Data model

New migration on `placement-test-worker` (next number after `0020_application_email_idtype.sql`), altering `students`:

```sql
ALTER TABLE students ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN father_name TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN grandfather_name TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN family_name TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN id_number TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN nationality TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN email TEXT;
ALTER TABLE students ADD COLUMN education_level TEXT;
ALTER TABLE students ADD COLUMN address TEXT;
ALTER TABLE students ADD COLUMN guardian_relationship TEXT;
ALTER TABLE students ADD COLUMN guardian_relationship_other TEXT;
ALTER TABLE students ADD COLUMN guardian_phone TEXT;
ALTER TABLE students ADD COLUMN guardian_alt_phone TEXT;
ALTER TABLE students ADD COLUMN referral_source TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN referral_source_other TEXT;
ALTER TABLE students ADD COLUMN referral_social_channels TEXT; -- JSON array string, e.g. '["instagram","tiktok"]'
ALTER TABLE students ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE students ADD COLUMN media_consent_accepted_at TEXT;
ALTER TABLE students ADD COLUMN terms_version TEXT;
```

`students.name` (existing column) stays and is now computed server-side as `"${firstName} ${fatherName} ${grandfatherName} ${familyName}"` at insert time — every existing consumer (`ApplicationWithDetails.student_name`, AdminPanel display, etc.) keeps working unmodified.

`students.guardian_name` (existing column) is reused as-is for the guardian's name.

Defaults are empty string (not NULL) for the fields that are always required going forward, matching this codebase's existing migration convention (e.g. `0020`'s `applications.email`) — old rows before this migration simply have empty values in these columns, which is fine since no code reads historical rows through the new required-field lens.

### `applications` table (PR #18 follow-up)

Migration also drops the columns added by `0020_application_email_idtype.sql` that are now collected at registration instead:

```sql
-- id_type / id_number / email are now collected at registration (students
-- table) and no longer duplicated on the application.
-- SQLite can't drop multiple columns or columns with CHECK constraints in
-- older versions, but this project's compatibility_date is recent enough
-- for direct DROP COLUMN support in D1/SQLite ≥ 3.35.
ALTER TABLE applications DROP COLUMN email;
ALTER TABLE applications DROP COLUMN id_type;
ALTER TABLE applications DROP COLUMN id_number;
```

`handleSubmitApplication` (worker) drops the `email`/`idType`/`idNumber` validation and insert fields entirely; `ApplicationForm.astro` drops those three inputs (course + guardian name, if kids track, remain the only application-step fields, since guardian name can differ in context — e.g. a different contact — from the registration-time guardian; guardian requirement logic there is unchanged).

`ApplicationInput`/`ApplicationRow`/`ApplicationWithDetails` types lose `email`/`idType`/`idNumber`. `AdminPanel.astro`'s application summary line drops email/ID-type display (student ID/nationality now show from the student record — see Admin section below) and reads the underlying student's `id_number`/nationality from a join instead.

## Step 1 — البيانات الأساسية (minimum info, all required)

| Field | Input | Validation |
|---|---|---|
| الاسم الأول | text | Unicode letters (Arabic + Latin) + spaces/apostrophes/hyphens only, min 2 chars |
| اسم الأب | text | same |
| اسم الجد | text | same |
| اسم العائلة | text | same |
| رقم الجوال | tel, LTR | Saudi mobile: `05XXXXXXXX`, optional `+966` prefix accepted |
| تاريخ الميلاد | native date picker | max = today; computed age must be 4–100 |

DOB drives a live note directly under it: `«العمر التقديري: X سنة»` (English: "Estimated age: X years"), recomputed on every `input`/`change`, matching the existing under-11 auto-track note's pattern.

The existing track selector (kids/adults) and its "students under 11 default to kids" rule stay in Step 1, unchanged in behavior.

"Next" is disabled until every Step 1 field passes validation.

## Step 2 — البيانات التفصيلية

| Field | Input | Validation |
|---|---|---|
| رقم الهوية / الإقامة / الجواز | text, digits only | required, 7–15 digits |
| الجنسية | text + `<datalist>` | required; datalist options: سعودي، مصري، يمني، سوداني، سوري، أردني، فلسطيني، باكستاني، هندي، بنغلاديشي، فلبيني، إندونيسي، نيجيري، إثيوبي، تركي، بريطاني، أمريكي — free text also accepted (datalist doesn't restrict input) |
| البريد الإلكتروني | email | optional; format-validated only if filled |
| المرحلة الدراسية | select | optional: ابتدائي، متوسط، ثانوي، جامعي/كلية، دراسات عليا، تدريب مهني، غير ذلك |
| عنوان السكن | textarea | optional |
| بيانات ولي الأمر | see Guardian logic below | |
| كيف عرفت المعهد؟ | radio chips | required: صديق، إعلان ورقي، SMS، إنترنت، إعلان طريق، تواصل اجتماعي، أخرى |
| — إذا "تواصل اجتماعي" | checkbox chips | optional, multi-select: فيسبوك، X (تويتر)، يوتيوب، تيك توك، إنستقرام، سناب شات |
| — إذا "أخرى" | text | required: «حدد الطريقة» |
| الشروط والأحكام | scrollable box + 2 checkboxes | both required (see Terms section) |

### Guardian logic (critical)

Age computed from Step 1's DOB (same computation Step 1's live note uses).

- **Under 18**: guardian section auto-expanded; red badge «مطلوبة (أقل من 18 سنة)»; guardian name, relationship, and guardian mobile become `required`. Relationship options: أب، أم، شقيق/شقيقة، جد/جدة، وصي قانوني، أخرى — selecting أخرى reveals a required free-text field. جوال آخر (alternate phone) stays optional in both states.
- **18+**: guardian section starts collapsed behind a link-button «إضافة بيانات ولي الأمر (اختياري)» with a green badge «اختيارية للبالغين (18+)»; nothing in it is `required`.
- Toggling (either by age crossing 18 as DOB changes, or by the user manually opening the 18+ optional section) never clears already-entered values — the section is hidden/shown via `hidden`, not removed from the DOM, exactly like the current form's single guardian field already works.

### Terms & conditions

Rendered verbatim, numbered 1–16, in a scrollable box (`max-height` + `overflow-y: auto`), Arabic text exactly as given (see plan for the literal strings — omitted here to avoid transcription drift between spec and plan; the plan will carry the exact verbatim block). Below the list: a centered red warning line «عدم قراءتك للشروط لا يعني أنك غير مُلزم بها.»

Below the warning, two required checkboxes (exact wording per the request):
1. Acknowledgement of having read and having no objection to the terms.
2. Consent (as trainee or guardian) to photography/video for promotional/educational use, explicitly excluding adult female students' images/content.

**Bilingual terms handling**: Arabic is the legally authoritative text. The `/en/` locale renders a plain-language English rendering of the same 16 clauses for readability, with a visible note ("This is a summary translation; the Arabic version is legally binding.") — not a certified/legal translation. Both checkboxes' underlying `required` behavior and the server-side stamping are locale-independent.

On successful submit, the worker stamps `terms_accepted_at`, `media_consent_accepted_at` (both `datetime('now')`), and `terms_version` (a constant, e.g. `'2026-09-08'`, bumped manually if the clause text ever changes) onto the student row.

## Server-side validation (`handleStartSession`, `placement-test-worker/src/routes/session.ts`)

Every client-side rule above is re-validated server-side, 400 on failure:
- Four name parts: regex `^[\p{L}\s'’-]{2,}$` (Unicode letter class, so both Arabic and Latin names pass), with the `u` flag.
- Phone: `^(\+966|0)5\d{8}$` (accepts `05XXXXXXXX` or `+9665XXXXXXXX`).
- DOB: parses to a valid date, computed age (existing `computeTrack`-style exact calendar-year math) in `[4, 100]`.
- ID number: `^\d{7,15}$`.
- Nationality: non-empty after trim.
- Email: format-checked only if present, using the standard `^[^\s@]+@[^\s@]+\.[^\s@]+$` pattern (the same shape PR #18 used, now living solely in `session.ts` since the application step no longer collects email).
- Guardian fields: `guardianName`, `guardianRelationship`, `guardianPhone` all required (non-empty) iff computed age `< 18`; `guardianRelationshipOther` required iff `guardianRelationship === 'other'`.
- Referral source: one of the 7 enum values; `referralSourceOther` required iff `'other'`; `referralSocialChannels` (if present) must be a subset of the 6 known platform values.
- Both consent booleans must be `true`.

## Frontend components

- `src/components/placement-test/RegistrationForm.astro` — shell: stepper UI, step-visibility state, cross-step validation orchestration, submit handler (dispatches `placement:register` with the full field set, same event name/consumer as today), age→guardian-visibility wiring.
- `src/components/placement-test/RegistrationStepBasics.astro` — Step 1 markup (props: `locale`, `t`).
- `src/components/placement-test/RegistrationStepDetails.astro` — Step 2 markup including the terms box and datalist/chip markup (props: `locale`, `t`).
- `src/lib/registrationValidation.ts` — small shared module for the regexes/age-bounds/enum lists, imported by the shell's script, so the constants aren't duplicated between the three `.astro` files' inline scripts and (where mirrored) the worker. (The worker has its own copy server-side — Astro client code and Cloudflare Worker code don't share a build, so exact duplication of the simple regex/enum constants is intentional and each side gets a comment pointing at the other.)

## i18n

New `registration.*` key namespace (~60 keys) in `src/i18n/ui.ts`, en + ar, replacing the handful of `placementTest.form*` keys that the old single-step form used (those keys are removed since the new components don't reference them — `placementTest.stageDetails` and other page-chrome keys outside the form itself stay). `src/i18n/pages.ts` is unaffected (no new route — this is a component, not a page).

## Admin panel

`AdminPanel.astro`'s applications list currently shows `${a.email} — ... — ${idTypeLabel} #${a.id_number}` (from PR #18). Since those fields move to the student record, the list instead shows the joined student's ID/nationality: `listApplicationsWithDetails` (worker `db.ts`) selects `s.id_number`, `s.nationality` from `students` alongside the existing `s.name`/`s.phone` join, and the admin list line becomes `${a.student_name} (${a.phone}) — ${nationality} — ${idNumber} — ${a.course} — level ... — ${a.status}`. No new admin UI beyond that line change — full registration detail (guardian info, referral source, etc.) is out of scope for the admin list view in this pass; it's stored and queryable directly in D1 if ever needed.

## Testing

- `placement-test-worker/src/routes/session.test.ts` (or wherever `handleStartSession` is currently tested): new cases for every validation rule above — name regex (valid/invalid chars, too-short), phone formats, age boundaries (3, 4, 100, 101), ID-number digit count, guardian-required-under-18 (and not-required 18+), guardian "other" relationship free text, referral-source enum + its two conditional requirements, missing/false consent checkboxes.
- `placement-test-worker/src/routes/application.test.ts`: remove email/idType/idNumber assertions (PR #18 tests), since those fields no longer exist on the application endpoint.
- `tests/e2e/placement-test.spec.ts` / `tests/e2e/application.spec.ts`: update the registration step of both specs to walk Step 1 → Next → Step 2 → check both consent boxes → submit, with the new required fields filled, instead of the old 3-field form.

## Error handling

Same pattern as the rest of the placement flow: client-side validation blocks "Next"/"Submit" with inline per-field or step-level error text; a 400 from `handleStartSession` (a validation edge case the client missed, or a client/server drift) surfaces as a generic step-level error banner, matching `ApplicationForm.astro`'s existing `application-error` pattern.
