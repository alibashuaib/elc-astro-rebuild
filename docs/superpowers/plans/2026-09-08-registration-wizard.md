# Registration Wizard (2-step) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-step registration form with a 2-step wizard collecting full legal name, ID, nationality, contact/guardian details, referral source, and legal consent — and remove the now-duplicate email/ID fields from the post-test application step.

**Architecture:** `RegistrationForm.astro` becomes a stepper shell around two new sub-components (`RegistrationStepBasics.astro`, `RegistrationStepDetails.astro`). All new fields are re-validated server-side in `handleStartSession`. `applications` drops `email`/`id_type`/`id_number` (now collected once, at registration, on `students`).

**Tech Stack:** Astro (static), Cloudflare Worker + D1, existing `src/i18n/ui.ts` dictionary pattern.

**Spec:** `docs/superpowers/specs/2026-09-08-registration-wizard-design.md`

## Global Constraints

- Branch: continue on `feature/application-email-idtype` (already has PR #18's email/idType additions to `applications`, which this plan removes again as part of the same coherent change).
- Name-part regex (client + server): `^[\p{L}\s'’-]{2,}$` with the Unicode `u` flag — Arabic and Latin letters, spaces, straight/curly apostrophe, hyphen, minimum 2 characters.
- Phone regex (client + server): `^(\+966|0)5\d{8}$`.
- ID number regex (client + server): `^\d{7,15}$`.
- Age bounds: computed age must be in `[4, 100]` inclusive.
- Referral source enum: `friend | paper_ad | sms | internet | road_ad | social | other`.
- Social channel enum: `facebook | twitter | youtube | tiktok | instagram | snapchat`.
- Guardian relationship enum: `father | mother | sibling | grandparent | legal_guardian | other`.
- Education level enum: `primary | intermediate | secondary | university | postgraduate | vocational | other`.
- `TERMS_VERSION` constant: `'2026-09-08'`.
- i18n: every new key added to `ui.en` gets the matching key in `ui.ar` (and vice versa) — `keyof typeof ui['en']` typing breaks the build otherwise. New keys live under a `registration.*` prefix.
- AdminPanel stays plain hardcoded English (no i18n) — established convention.
- No placeholder/TBD code — every step below is complete, working code to transcribe.

---

### Task 1: Migration + type changes

**Files:**
- Create: `placement-test-worker/migrations/0021_registration_fields.sql`
- Modify: `placement-test-worker/src/types.ts`

**Interfaces:**
- Produces: `StudentInput` gets 17 new **optional** fields (kept optional so every other test file's minimal `insertStudent(env, { name, phone, dob, locale })` call sites keep compiling/working — required-ness is enforced in `handleStartSession`, Task 5).
- Produces: `ApplicationRow`/`ApplicationWithDetails` (db.ts, Task 2) lose `email`/`id_type`/`id_number`; `SessionRow`/`db.ts` gain nothing new here.

- [ ] **Step 1: Write the migration**

```sql
-- placement-test-worker/migrations/0021_registration_fields.sql
-- Registration wizard: richer student intake, plus dropping the
-- email/id_type/id_number columns applications gained in 0020 -- those are
-- now collected once, here, at registration.
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
ALTER TABLE students ADD COLUMN referral_social_channels TEXT;
ALTER TABLE students ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE students ADD COLUMN media_consent_accepted_at TEXT;
ALTER TABLE students ADD COLUMN terms_version TEXT;

ALTER TABLE applications DROP COLUMN email;
ALTER TABLE applications DROP COLUMN id_type;
ALTER TABLE applications DROP COLUMN id_number;
```

- [ ] **Step 2: Update `types.ts`**

In `placement-test-worker/src/types.ts`, replace the `StudentInput` interface:

```ts
export interface StudentInput {
  name: string;
  phone: string;
  dob: string; // ISO date
  guardianName?: string;
  locale: 'en' | 'ar';
  track?: Track; // explicit choice from the registration form; falls back to age-based computeTrack(dob) if omitted/invalid
  // Registration wizard fields (all optional on this type -- handleStartSession
  // enforces required-ness; insertStudent just persists whatever it's given,
  // so existing minimal test fixtures elsewhere keep compiling).
  firstName?: string;
  fatherName?: string;
  grandfatherName?: string;
  familyName?: string;
  idNumber?: string;
  nationality?: string;
  email?: string;
  educationLevel?: string;
  address?: string;
  guardianRelationship?: string;
  guardianRelationshipOther?: string;
  guardianPhone?: string;
  guardianAltPhone?: string;
  referralSource?: string;
  referralSourceOther?: string;
  referralSocialChannels?: string[];
  termsAccepted?: boolean;
  mediaConsentAccepted?: boolean;
}
```

Remove the `IdType` type and the `email`/`id_type`/`id_number` fields from `ApplicationRow`:

```ts
export interface ApplicationRow {
  id: string;
  session_id: string;
  course: string;
  guardian_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}
```

- [ ] **Step 3: Run the migration locally and commit**

```bash
cd placement-test-worker
npm run db:migrate:local
git add migrations/0021_registration_fields.sql src/types.ts
git commit -m "feat: add registration migration + types for wizard fields"
```

---

### Task 2: `db.ts` — insertStudent, listApplicationsWithDetails, ApplicationInput

**Files:**
- Modify: `placement-test-worker/src/db.ts`

**Interfaces:**
- Consumes: `StudentInput` (Task 1), `Env`.
- Produces: `insertStudent(env, input): Promise<string>` (unchanged signature, new persisted columns). `listApplicationsWithDetails` rows gain `id_number`/`nationality` from the joined student, lose `email`/`id_type`.
- Consumes for `ApplicationInput`: Task 3 (application.ts) constructs this without `email`/`idType`/`idNumber`.

- [ ] **Step 1: Rewrite `insertStudent`**

```ts
const TERMS_VERSION = '2026-09-08';

export async function insertStudent(env: Env, input: StudentInput): Promise<string> {
  const id = newId();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO students (
      id, name, phone, dob, guardian_name, locale,
      first_name, father_name, grandfather_name, family_name,
      id_number, nationality, email, education_level, address,
      guardian_relationship, guardian_relationship_other, guardian_phone, guardian_alt_phone,
      referral_source, referral_source_other, referral_social_channels,
      terms_accepted_at, media_consent_accepted_at, terms_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.name,
    input.phone,
    input.dob,
    input.guardianName ?? null,
    input.locale,
    input.firstName ?? '',
    input.fatherName ?? '',
    input.grandfatherName ?? '',
    input.familyName ?? '',
    input.idNumber ?? '',
    input.nationality ?? '',
    input.email ?? null,
    input.educationLevel ?? null,
    input.address ?? null,
    input.guardianRelationship ?? null,
    input.guardianRelationshipOther ?? null,
    input.guardianPhone ?? null,
    input.guardianAltPhone ?? null,
    input.referralSource ?? '',
    input.referralSourceOther ?? null,
    input.referralSocialChannels ? JSON.stringify(input.referralSocialChannels) : null,
    input.termsAccepted ? now : null,
    input.mediaConsentAccepted ? now : null,
    input.termsAccepted ? TERMS_VERSION : null
  ).run();
  return id;
}
```

(Note: `input.name` continues to be whatever the caller passes; Task 5 will have `handleStartSession` assemble it from the four name parts before calling `insertStudent`, so existing direct callers elsewhere — `booking.test.ts`, `admin.test.ts`, `application.test.ts` — that pass `name: 'A'` directly are unaffected.)

- [ ] **Step 2: Update `ApplicationInput` and `insertApplication`**

```ts
export interface ApplicationInput {
  sessionId: string;
  course: string;
  guardianName: string | null;
}

export async function insertApplication(env: Env, input: ApplicationInput): Promise<string> {
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO applications (id, session_id, course, guardian_name) VALUES (?, ?, ?, ?)`
  ).bind(id, input.sessionId, input.course, input.guardianName).run();
  return id;
}
```

- [ ] **Step 3: Update `ApplicationWithDetails` and `listApplicationsWithDetails`**

```ts
export interface ApplicationWithDetails {
  application_id: string;
  student_name: string;
  phone: string;
  estimated_level: string | null;
  course: string;
  guardian_name: string | null;
  id_number: string;
  nationality: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export async function listApplicationsWithDetails(env: Env, status: string | null): Promise<ApplicationWithDetails[]> {
  const sql = `SELECT a.id AS application_id, s.name AS student_name, s.phone AS phone, ts.estimated_level AS estimated_level,
      a.course AS course, a.guardian_name AS guardian_name, s.id_number AS id_number, s.nationality AS nationality,
      a.status AS status, a.created_at AS created_at
    FROM applications a
    JOIN test_sessions ts ON ts.id = a.session_id
    JOIN students s ON s.id = ts.student_id
    ${status ? 'WHERE a.status = ?' : ''}
    ORDER BY a.created_at DESC`;
  const stmt = status ? env.DB.prepare(sql).bind(status) : env.DB.prepare(sql);
  const { results } = await stmt.all<ApplicationWithDetails>();
  return results ?? [];
}
```

- [ ] **Step 4: Run worker tests (expect failures in application.test.ts — Task 4 fixes those), commit**

```bash
cd placement-test-worker
npm test 2>&1 | tail -40
git add src/db.ts
git commit -m "feat: persist registration fields, drop email/id fields from applications"
```

---

### Task 3: `application.ts` route — drop email/idType/idNumber

**Files:**
- Modify: `placement-test-worker/src/routes/application.ts`

**Interfaces:**
- Consumes: `insertApplication`/`ApplicationInput` (Task 2).

- [ ] **Step 1: Rewrite `handleSubmitApplication`**

Replace the whole file's top (imports + `handleSubmitApplication`) with:

```ts
import type { Env } from '../types';
import { getSession, getApplicationBySession, insertApplication, listApplicationsWithDetails, setApplicationStatus } from '../db';
import { getSessionAdminId } from '../auth';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export async function handleSubmitApplication(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ sessionId: string; course: string; guardianName?: string }>();
  if (!body.sessionId || !body.course) {
    return json({ error: 'sessionId and course are required' }, 400);
  }
  const session = await getSession(env, body.sessionId);
  if (!session || session.status !== 'completed') {
    return json({ error: 'session_not_completed' }, 400);
  }
  if (session.track === 'kids' && !body.guardianName?.trim()) {
    return json({ error: 'guardian_name_required' }, 400);
  }
  const existing = await getApplicationBySession(env, body.sessionId);
  if (existing) return json({ error: 'already_applied' }, 409);
  const applicationId = await insertApplication(env, {
    sessionId: body.sessionId,
    course: body.course,
    guardianName: body.guardianName ?? null,
  });
  return json({ applicationId }, 201);
}

export async function handleAdminListApplications(req: Request, env: Env): Promise<Response> {
  const status = new URL(req.url).searchParams.get('status');
  return json({ applications: await listApplicationsWithDetails(env, status) });
}

export async function handleAdminSetApplicationStatus(req: Request, env: Env, applicationId: string): Promise<Response> {
  const { status } = await req.json<{ status: string }>();
  if (status !== 'approved' && status !== 'rejected') return json({ error: 'invalid_status' }, 400);
  const adminId = await getSessionAdminId(req, env);
  if (!adminId) return json({ error: 'unauthorized' }, 401);
  await setApplicationStatus(env, applicationId, status, adminId);
  return json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add placement-test-worker/src/routes/application.ts
git commit -m "feat: drop email/idType/idNumber from the application route"
```

---

### Task 4: `application.test.ts` — remove email/idType assertions

**Files:**
- Modify: `placement-test-worker/src/routes/application.test.ts`

**Interfaces:**
- Consumes: Task 3's `handleSubmitApplication` (no `email`/`idType`/`idNumber` in the body it accepts).

- [ ] **Step 1: Remove the now-invalid fields and tests**

In `baseFields`, remove `idType` and `email`:

```ts
const baseFields = { course: 'Adults General English', idNumber: undefined, idType: undefined, email: undefined };
```

Actually simplest: delete the `baseFields` const entirely and inline `{ course: 'Adults General English' }` at each of its 6 call sites (`sessionId, ...baseFields` → `sessionId, course: 'Adults General English'`).

Delete these five tests entirely (they test fields that no longer exist): `'rejects a missing idNumber'`, `'rejects a missing email'`, `'rejects a malformed email'`, `'rejects an invalid idType'`, `'accepts iqama and passport as idType values'`.

In `'lists applications with student, level, email and id-type details'`, rename to `'lists applications with student and level details'` and remove the `expect(data.applications[0].email)...` / `expect(data.applications[0].id_type)...` assertions (the student-level `id_number`/`nationality` join is covered by Task 6's `session.test.ts`/fixture work, not here).

- [ ] **Step 2: Run tests, commit**

```bash
cd placement-test-worker
npm test 2>&1 | tail -40
git add src/routes/application.test.ts
git commit -m "test: drop email/idType assertions from application.test.ts"
```

---

### Task 5: `session.ts` — full registration validation

**Files:**
- Create: `placement-test-worker/src/registrationRules.ts`
- Modify: `placement-test-worker/src/routes/session.ts`

**Interfaces:**
- Produces: `computeAge(dob): number`, `NAME_RE`, `PHONE_RE`, `ID_NUMBER_RE`, `REFERRAL_SOURCES`, `SOCIAL_CHANNELS`, `GUARDIAN_RELATIONSHIPS` — all exported from `registrationRules.ts`, importable by `session.ts` (Task 6's tests may import them too).
- Consumes: `StudentInput` (Task 1), `insertStudent` (Task 2).

- [ ] **Step 1: Write `registrationRules.ts`**

```ts
// placement-test-worker/src/registrationRules.ts
// Shared between handleStartSession's server-side validation and its tests.
// The Astro frontend keeps its own copy in src/lib/registrationValidation.ts
// (client code and the Worker don't share a build) -- each side's file
// points at the other in a comment so the two never drift silently.

export const NAME_RE = /^[\p{L}\s'’-]{2,}$/u;
export const PHONE_RE = /^(\+966|0)5\d{8}$/;
export const ID_NUMBER_RE = /^\d{7,15}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const REFERRAL_SOURCES = ['friend', 'paper_ad', 'sms', 'internet', 'road_ad', 'social', 'other'] as const;
export const SOCIAL_CHANNELS = ['facebook', 'twitter', 'youtube', 'tiktok', 'instagram', 'snapchat'] as const;
export const GUARDIAN_RELATIONSHIPS = ['father', 'mother', 'sibling', 'grandparent', 'legal_guardian', 'other'] as const;

/** Exact calendar-year age, matching db.ts's computeTrack/isUnderEleven math. */
export function computeAge(dob: string): number {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return NaN;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age--;
  return age;
}
```

- [ ] **Step 2: Rewrite `handleStartSession`**

```ts
import {
  NAME_RE, PHONE_RE, ID_NUMBER_RE, EMAIL_RE,
  REFERRAL_SOURCES, SOCIAL_CHANNELS, GUARDIAN_RELATIONSHIPS, computeAge,
} from '../registrationRules';

export async function handleStartSession(req: Request, env: Env): Promise<Response> {
  const body = await req.json<StudentInput>();

  const namesValid = [body.firstName, body.fatherName, body.grandfatherName, body.familyName]
    .every((part) => typeof part === 'string' && NAME_RE.test(part));
  if (!namesValid) return json({ error: 'invalid_name' }, 400);
  if (!body.phone || !PHONE_RE.test(body.phone)) return json({ error: 'invalid_phone' }, 400);
  if (!body.dob) return json({ error: 'dob is required' }, 400);
  const age = computeAge(body.dob);
  if (!Number.isFinite(age) || age < 4 || age > 100) return json({ error: 'invalid_age' }, 400);
  if (!body.idNumber || !ID_NUMBER_RE.test(body.idNumber)) return json({ error: 'invalid_id_number' }, 400);
  if (!body.nationality?.trim()) return json({ error: 'nationality_required' }, 400);
  if (body.email && !EMAIL_RE.test(body.email)) return json({ error: 'invalid_email' }, 400);
  if (!body.locale) return json({ error: 'locale is required' }, 400);

  if (age < 18) {
    if (!body.guardianName?.trim() || !body.guardianRelationship || !body.guardianPhone?.trim()) {
      return json({ error: 'guardian_details_required' }, 400);
    }
  }
  if (body.guardianRelationship && !GUARDIAN_RELATIONSHIPS.includes(body.guardianRelationship as any)) {
    return json({ error: 'invalid_guardian_relationship' }, 400);
  }
  if (body.guardianRelationship === 'other' && !body.guardianRelationshipOther?.trim()) {
    return json({ error: 'guardian_relationship_other_required' }, 400);
  }

  if (!body.referralSource || !REFERRAL_SOURCES.includes(body.referralSource as any)) {
    return json({ error: 'invalid_referral_source' }, 400);
  }
  if (body.referralSource === 'other' && !body.referralSourceOther?.trim()) {
    return json({ error: 'referral_source_other_required' }, 400);
  }
  if (body.referralSocialChannels?.some((c) => !SOCIAL_CHANNELS.includes(c as any))) {
    return json({ error: 'invalid_social_channel' }, 400);
  }

  if (!body.termsAccepted || !body.mediaConsentAccepted) {
    return json({ error: 'consent_required' }, 400);
  }

  const fullName = [body.firstName, body.fatherName, body.grandfatherName, body.familyName].join(' ');
  const requestedTrack = body.track === 'kids' || body.track === 'adults' ? body.track : computeTrack(body.dob);
  const track = isUnderEleven(body.dob) ? 'kids' : requestedTrack;
  const studentId = await insertStudent(env, { ...body, name: fullName });
  const sessionId = await insertSession(env, studentId, track);
  const state = initialState();
  const first = await nextQuestionPayload(env, sessionId, track, state.currentLevelIndex, []);
  return json({ sessionId, track, ...first });
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd placement-test-worker
npx tsc --noEmit
git add src/registrationRules.ts src/routes/session.ts
git commit -m "feat: full server-side registration validation in handleStartSession"
```

---

### Task 6: `session.test.ts` + `index.test.ts` — fixture + new test cases

**Files:**
- Create: `placement-test-worker/src/test-utils/fixtures.ts`
- Modify: `placement-test-worker/src/routes/session.test.ts`
- Modify: `placement-test-worker/src/index.test.ts`

**Interfaces:**
- Consumes: `registrationRules.ts` (Task 5), `StudentInput` (Task 1).
- Produces: `validRegistration(overrides?): Record<string, unknown>` — a complete, valid registration body, importable by both test files.

- [ ] **Step 1: Write the fixture**

```ts
// placement-test-worker/src/test-utils/fixtures.ts
/** A complete, valid /api/session registration body. Override individual
 * fields per test -- every field not overridden passes every validation
 * rule in handleStartSession (see registrationRules.ts). */
export function validRegistration(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Sam',
    fatherName: 'Ali',
    grandfatherName: 'Mohammed',
    familyName: 'Alharbi',
    name: 'Sam Ali Mohammed Alharbi',
    phone: '+966500000000',
    dob: '1995-01-01',
    idNumber: '1234567890',
    nationality: 'سعودي',
    locale: 'en',
    referralSource: 'friend',
    termsAccepted: true,
    mediaConsentAccepted: true,
    ...overrides,
  };
}
```

- [ ] **Step 2: Migrate `session.test.ts` call sites**

Add the import at the top:

```ts
import { validRegistration } from '../test-utils/fixtures';
```

Replace every inline registration body literal with a `validRegistration({...})` call, per this mapping (grep `name: 'Sam'` / `name: 'Kid'` in the file to find every occurrence — there are 15 across the file):

- `{ name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en' }` → `validRegistration()`
- `{ name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en', track: 'not-a-real-track' }` → `validRegistration({ track: 'not-a-real-track' })`
- `{ name: 'Sam', phone, dob: '1995-01-01', locale: 'en' }` (where `phone` is a helper parameter) → `validRegistration({ phone })`
- The multi-line `{ name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en', track: 'kids' }` (the "honors an explicit track override" test) → `validRegistration({ track: 'kids' })`
- `{ name: 'Kid', phone, dob: '2018-01-01', locale: 'en', track: 'kids' }` → `validRegistration({ phone, dob: '2018-01-01', track: 'kids' })`
- `{ name: 'Kid', phone: '+966500000000', dob: '2018-01-01', locale: 'en', track: 'kids' }` → `validRegistration({ dob: '2018-01-01', track: 'kids' })`
- The `phone: \`+9665000001${attempt}\`` template in the "varies which capital-letter item comes first" test → `validRegistration({ dob: '2018-01-01', track: 'kids', phone: \`+96650000${String(attempt).padStart(4, '0')}\` })` (the old template produced only an 8-digit tail, one short of `PHONE_RE`'s required 9; this padStart form keeps 10 unique valid numbers for attempts 0-9)

- [ ] **Step 3: Migrate `index.test.ts`'s one call site**

```ts
import { validRegistration } from './test-utils/fixtures';
// ...
body: JSON.stringify(validRegistration()),
```

- [ ] **Step 4: Add new validation test cases to `session.test.ts`**

```ts
describe('registration validation', () => {
  it('rejects a name part with digits', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ firstName: 'Sam1' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
  });

  it('rejects a name part shorter than 2 characters', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ familyName: 'A' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
  });

  it('accepts an Arabic name', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ firstName: 'سامي' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(200);
  });

  it('rejects a malformed phone number', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ phone: '0501234' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
  });

  it('accepts a local-format Saudi phone number', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ phone: '0512345678' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(200);
  });

  it('rejects age below 4', async () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 3);
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ dob: dob.toISOString().slice(0, 10) })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
  });

  it('rejects age above 100', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ dob: '1900-01-01' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
  });

  it('rejects an ID number with letters', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ idNumber: '12345AB' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
  });

  it('rejects an ID number shorter than 7 digits', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ idNumber: '123456' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
  });

  it('rejects a missing nationality', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ nationality: '' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
  });

  it('rejects a malformed email when one is provided', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ email: 'not-an-email' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
  });

  it('accepts no email at all', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration()) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(200);
  });

  it('requires guardian details for a student under 18', async () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 15);
    const req = new Request('http://x/api/session', {
      method: 'POST',
      body: JSON.stringify(validRegistration({ dob: dob.toISOString().slice(0, 10), track: 'kids' })),
    });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'guardian_details_required' });
  });

  it('accepts a student under 18 with full guardian details', async () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 15);
    const req = new Request('http://x/api/session', {
      method: 'POST',
      body: JSON.stringify(validRegistration({
        dob: dob.toISOString().slice(0, 10),
        track: 'kids',
        guardianName: 'Parent Name',
        guardianRelationship: 'father',
        guardianPhone: '+966500000099',
      })),
    });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(200);
  });

  it('does not require guardian details for an adult', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration()) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(200);
  });

  it('requires guardianRelationshipOther when relationship is other', async () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 15);
    const req = new Request('http://x/api/session', {
      method: 'POST',
      body: JSON.stringify(validRegistration({
        dob: dob.toISOString().slice(0, 10),
        track: 'kids',
        guardianName: 'Parent Name',
        guardianRelationship: 'other',
        guardianPhone: '+966500000099',
      })),
    });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'guardian_relationship_other_required' });
  });

  it('rejects an invalid referral source', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ referralSource: 'carrier-pigeon' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
  });

  it('requires referralSourceOther when referral source is other', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ referralSource: 'other' })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'referral_source_other_required' });
  });

  it('accepts social channels alongside a social referral source', async () => {
    const req = new Request('http://x/api/session', {
      method: 'POST',
      body: JSON.stringify(validRegistration({ referralSource: 'social', referralSocialChannels: ['instagram', 'tiktok'] })),
    });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(200);
  });

  it('rejects an unknown social channel', async () => {
    const req = new Request('http://x/api/session', {
      method: 'POST',
      body: JSON.stringify(validRegistration({ referralSource: 'social', referralSocialChannels: ['myspace'] })),
    });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
  });

  it('rejects missing terms acceptance', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ termsAccepted: false })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'consent_required' });
  });

  it('rejects missing media consent', async () => {
    const req = new Request('http://x/api/session', { method: 'POST', body: JSON.stringify(validRegistration({ mediaConsentAccepted: false })) });
    const res = await handleStartSession(req, env as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'consent_required' });
  });
});
```

- [ ] **Step 5: Run tests, fix any drift, commit**

```bash
cd placement-test-worker
npm test 2>&1 | tail -60
git add src/test-utils/fixtures.ts src/routes/session.test.ts src/index.test.ts
git commit -m "test: registration validation fixture + new coverage"
```

---

### Task 7: i18n keys

**Files:**
- Modify: `src/i18n/ui.ts`

**Interfaces:**
- Produces: every `registration.*` key consumed by Tasks 9-11.

- [ ] **Step 1: Remove the old single-step form keys**

Delete these from both the `en` and `ar` blocks: `placementTest.formHeading`, `placementTest.formIntro`, `placementTest.formName`, `placementTest.formPhone`, `placementTest.formDob`, `placementTest.formGuardian`, `placementTest.formSubmit`. Keep `placementTest.formTrack`, `placementTest.formTrackKids`, `placementTest.formTrackAdults` (the track selector stays, now living inside `RegistrationStepBasics.astro`) and every other `placementTest.*` key untouched.

- [ ] **Step 2: Add the `registration.*` keys to `ui.en`**

```ts
    'registration.stepBasics': 'Basic details',
    'registration.stepDetails': 'Additional details',
    'registration.step1Of2': 'Step 1 of 2',
    'registration.step2Of2': 'Step 2 of 2',
    'registration.heading': 'Let’s find the right test for you',
    'registration.intro': 'Tell us a little about the student. We’ll use this to select the correct question path.',
    'registration.firstName': 'First name',
    'registration.fatherName': 'Father’s name',
    'registration.grandfatherName': 'Grandfather’s name',
    'registration.familyName': 'Family name',
    'registration.phone': 'WhatsApp number',
    'registration.dob': 'Date of birth',
    'registration.estimatedAgePrefix': 'Estimated age:',
    'registration.estimatedAgeSuffix': 'years',
    'registration.next': 'Next',
    'registration.back': 'Back',
    'registration.idNumber': 'National ID / Iqama / passport number',
    'registration.nationality': 'Nationality',
    'registration.email': 'Email address',
    'registration.educationLevel': 'Education level',
    'registration.educationLevelChoose': 'Select (optional)',
    'registration.educationPrimary': 'Primary school',
    'registration.educationIntermediate': 'Intermediate school',
    'registration.educationSecondary': 'Secondary school',
    'registration.educationUniversity': 'University / college',
    'registration.educationPostgraduate': 'Postgraduate studies',
    'registration.educationVocational': 'Vocational training',
    'registration.educationOther': 'Other',
    'registration.address': 'Home address',
    'registration.guardianHeading': 'Guardian details',
    'registration.guardianRequiredBadge': 'Required (under 18)',
    'registration.guardianOptionalBadge': 'Optional for adults (18+)',
    'registration.guardianAddLink': 'Add guardian details (optional)',
    'registration.guardianName': 'Guardian name',
    'registration.guardianRelationship': 'Relationship',
    'registration.guardianRelationshipChoose': 'Select',
    'registration.relationFather': 'Father',
    'registration.relationMother': 'Mother',
    'registration.relationSibling': 'Sibling',
    'registration.relationGrandparent': 'Grandparent',
    'registration.relationLegalGuardian': 'Legal guardian',
    'registration.relationOther': 'Other',
    'registration.guardianRelationshipOther': 'Specify relationship',
    'registration.guardianPhone': 'Guardian’s mobile number',
    'registration.guardianAltPhone': 'Alternate mobile number',
    'registration.referralHeading': 'How did you hear about the institute?',
    'registration.referralFriend': 'A friend',
    'registration.referralPaperAd': 'Printed ad',
    'registration.referralSms': 'SMS',
    'registration.referralInternet': 'Internet',
    'registration.referralRoadAd': 'Roadside ad',
    'registration.referralSocial': 'Social media',
    'registration.referralOther': 'Other',
    'registration.referralSocialFacebook': 'Facebook',
    'registration.referralSocialTwitter': 'X (Twitter)',
    'registration.referralSocialYoutube': 'YouTube',
    'registration.referralSocialTiktok': 'TikTok',
    'registration.referralSocialInstagram': 'Instagram',
    'registration.referralSocialSnapchat': 'Snapchat',
    'registration.referralOtherSpecify': 'Please specify',
    'registration.termsHeading': 'Terms & conditions',
    'registration.termsWarning': 'Not reading the terms does not mean you are not bound by them.',
    'registration.consentTerms': 'I acknowledge that I have read all the terms and conditions shown above, have no objection to any of them, and agree to abide by them.',
    'registration.consentMedia': 'I agree (as the trainee or their guardian) to the trainee being photographed or filmed for the institute’s promotional or educational purposes, with the assurance that adult female students will not be photographed or have any related content used.',
    'registration.submit': 'Start test',
    'registration.error': 'Something went wrong — please check your details and try again.',
```

Include the 16-clause terms text (see Task 10) directly in `RegistrationStepDetails.astro` rather than as i18n keys — legal text this long doesn't need `t()` indirection; it's written once per locale directly in the component's markup (see Task 10 for exactly why and how).

- [ ] **Step 3: Add the matching `registration.*` keys to `ui.ar`**

```ts
    'registration.stepBasics': 'البيانات الأساسية',
    'registration.stepDetails': 'البيانات التفصيلية',
    'registration.step1Of2': 'الخطوة 1 من 2',
    'registration.step2Of2': 'الخطوة 2 من 2',
    'registration.heading': 'لنحدد الاختبار المناسب لك',
    'registration.intro': 'أخبرنا قليلاً عن الطالب لنختار مسار الأسئلة المناسب.',
    'registration.firstName': 'الاسم الأول',
    'registration.fatherName': 'اسم الأب',
    'registration.grandfatherName': 'اسم الجد',
    'registration.familyName': 'اسم العائلة',
    'registration.phone': 'رقم الواتساب',
    'registration.dob': 'تاريخ الميلاد',
    'registration.estimatedAgePrefix': 'العمر التقديري:',
    'registration.estimatedAgeSuffix': 'سنة',
    'registration.next': 'التالي',
    'registration.back': 'رجوع',
    'registration.idNumber': 'رقم الهوية / الإقامة / الجواز',
    'registration.nationality': 'الجنسية',
    'registration.email': 'البريد الإلكتروني',
    'registration.educationLevel': 'المرحلة الدراسية',
    'registration.educationLevelChoose': 'اختر (اختياري)',
    'registration.educationPrimary': 'ابتدائي',
    'registration.educationIntermediate': 'متوسط',
    'registration.educationSecondary': 'ثانوي',
    'registration.educationUniversity': 'جامعي / كلية',
    'registration.educationPostgraduate': 'دراسات عليا',
    'registration.educationVocational': 'تدريب مهني',
    'registration.educationOther': 'غير ذلك',
    'registration.address': 'عنوان السكن',
    'registration.guardianHeading': 'بيانات ولي الأمر',
    'registration.guardianRequiredBadge': 'مطلوبة (أقل من 18 سنة)',
    'registration.guardianOptionalBadge': 'اختيارية للبالغين (18+)',
    'registration.guardianAddLink': 'إضافة بيانات ولي الأمر (اختياري)',
    'registration.guardianName': 'اسم ولي الأمر',
    'registration.guardianRelationship': 'صلة القرابة',
    'registration.guardianRelationshipChoose': 'اختر',
    'registration.relationFather': 'أب',
    'registration.relationMother': 'أم',
    'registration.relationSibling': 'شقيق/شقيقة',
    'registration.relationGrandparent': 'جد/جدة',
    'registration.relationLegalGuardian': 'وصي قانوني',
    'registration.relationOther': 'أخرى',
    'registration.guardianRelationshipOther': 'حدد صلة القرابة',
    'registration.guardianPhone': 'جوال ولي الأمر',
    'registration.guardianAltPhone': 'جوال آخر',
    'registration.referralHeading': 'كيف عرفت المعهد؟',
    'registration.referralFriend': 'صديق',
    'registration.referralPaperAd': 'إعلان ورقي',
    'registration.referralSms': 'SMS',
    'registration.referralInternet': 'إنترنت',
    'registration.referralRoadAd': 'إعلان طريق',
    'registration.referralSocial': 'تواصل اجتماعي',
    'registration.referralOther': 'أخرى',
    'registration.referralSocialFacebook': 'فيسبوك',
    'registration.referralSocialTwitter': 'X (تويتر)',
    'registration.referralSocialYoutube': 'يوتيوب',
    'registration.referralSocialTiktok': 'تيك توك',
    'registration.referralSocialInstagram': 'إنستقرام',
    'registration.referralSocialSnapchat': 'سناب شات',
    'registration.referralOtherSpecify': 'حدد الطريقة',
    'registration.termsHeading': 'الشروط والأحكام',
    'registration.termsWarning': 'عدم قراءتك للشروط لا يعني أنك غير مُلزم بها.',
    'registration.consentTerms': 'أقر بأنني اطّلعت على جميع الشروط والأحكام الموضحة أعلاه وليس لدي اعتراض على أي منها، وأتعهد بالالتزام بها.',
    'registration.consentMedia': 'أوافق (بصفتي المتدرب/ة أو ولي الأمر) على تصوير المتدرب/ة بالصور أو مقاطع الفيديو لأغراض دعائية أو تعليمية للمعهد، مع التأكيد على عدم تصوير البنات البالغات أو استخدام أي محتوى يخصهن.',
    'registration.submit': 'ابدأ الاختبار',
    'registration.error': 'حدث خطأ ما — يرجى مراجعة بياناتك والمحاولة مرة أخرى.',
```

- [ ] **Step 2: Build to confirm key-parity typing holds, commit**

```bash
npx astro build 2>&1 | tail -20
git add src/i18n/ui.ts
git commit -m "feat: add registration.* i18n keys, remove old single-step form keys"
```

---

### Task 8: Shared client-side validation module

**Files:**
- Create: `src/lib/registrationValidation.ts`

**Interfaces:**
- Produces: same constants as `registrationRules.ts` (Task 5), for the frontend. Consumed by Tasks 9-11.

- [ ] **Step 1: Write the module**

```ts
// src/lib/registrationValidation.ts
// Client-side mirror of placement-test-worker/src/registrationRules.ts --
// kept as a plain duplicate (client and Worker code don't share a build);
// update both together if a rule ever changes.

export const NAME_RE = /^[\p{L}\s'’-]{2,}$/u;
export const PHONE_RE = /^(\+966|0)5\d{8}$/;
export const ID_NUMBER_RE = /^\d{7,15}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const REFERRAL_SOURCES = ['friend', 'paper_ad', 'sms', 'internet', 'road_ad', 'social', 'other'] as const;
export const SOCIAL_CHANNELS = ['facebook', 'twitter', 'youtube', 'tiktok', 'instagram', 'snapchat'] as const;
export const GUARDIAN_RELATIONSHIPS = ['father', 'mother', 'sibling', 'grandparent', 'legal_guardian', 'other'] as const;
export const EDUCATION_LEVELS = ['primary', 'intermediate', 'secondary', 'university', 'postgraduate', 'vocational', 'other'] as const;

/** Exact calendar-year age -- same math as placement-test-worker/src/db.ts's computeTrack. */
export function computeAge(dob: string): number {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return NaN;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age--;
  return age;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/registrationValidation.ts
git commit -m "feat: add client-side registration validation module"
```

---

### Task 9: `RegistrationStepBasics.astro`

**Files:**
- Create: `src/components/placement-test/RegistrationStepBasics.astro`

**Interfaces:**
- Consumes: `Locale`, `useTranslations` (from `../../i18n/ui`).
- Produces: markup with `id`s `step-basics`, `first-name`/`father-name`/`grandfather-name`/`family-name`/`phone`/`dob` inputs, `#estimated-age-note`, the existing track-toggle markup (moved here verbatim from the old `RegistrationForm.astro`), and a `#step1-next` button — all read/wired by Task 11's shell script.

- [ ] **Step 1: Write the component**

```astro
---
import type { Locale, useTranslations } from '../../i18n/ui';

export interface Props {
  locale: Locale;
  t: ReturnType<typeof useTranslations>;
}
const { t } = Astro.props;
---

<div id="step-basics">
  <fieldset class="track-field">
    <legend>{t('placementTest.formTrack')}</legend>
    <div class="track-toggle">
      <label class="track-pill">
        <input required name="track" type="radio" value="adults" checked />
        <span>{t('placementTest.formTrackAdults')}</span>
      </label>
      <label class="track-pill">
        <input required name="track" type="radio" value="kids" />
        <span>{t('placementTest.formTrackKids')}</span>
      </label>
    </div>
    <p id="age-track-rule" class="age-track-rule" hidden></p>
  </fieldset>
  <div class="form-grid">
    <label>
      <span>{t('registration.firstName')}</span>
      <input required name="firstName" type="text" autocomplete="given-name" />
    </label>
    <label>
      <span>{t('registration.fatherName')}</span>
      <input required name="fatherName" type="text" />
    </label>
    <label>
      <span>{t('registration.grandfatherName')}</span>
      <input required name="grandfatherName" type="text" />
    </label>
    <label>
      <span>{t('registration.familyName')}</span>
      <input required name="familyName" type="text" autocomplete="family-name" />
    </label>
    <label>
      <span>{t('registration.phone')}</span>
      <input class="numeric" required name="phone" type="tel" autocomplete="tel" inputmode="tel" dir="ltr" />
    </label>
    <label>
      <span>{t('registration.dob')}</span>
      <input required name="dob" type="date" />
      <p id="estimated-age-note" class="age-track-rule" hidden></p>
    </label>
  </div>
  <button type="button" id="step1-next" class="btn btn-primary">{t('registration.next')}</button>
</div>

<style>
  .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  #step-basics label { display: flex; flex-direction: column; gap: 0.45rem; color: var(--color-navy); font-size: 0.88rem; font-weight: 700; }
  #step-basics input {
    width: 100%;
    min-height: 3.25rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 0.85rem;
    color: var(--color-ink);
    background: var(--color-bg-raised);
    font: inherit;
  }
  #step-basics input:focus {
    outline: 3px solid rgb(182 23 51 / 0.12);
    border-color: var(--color-primary);
  }
  #step1-next { justify-content: center; width: 100%; min-height: 3.5rem; margin-top: 1.25rem; }
  .track-field { display: grid; gap: 0.6rem; margin: 0 0 1rem; padding: 0; border: none; }
  .track-field legend { padding: 0; color: var(--color-navy); font-size: 0.88rem; font-weight: 700; }
  .age-track-rule {
    margin: 0;
    padding: 0.65rem 0.8rem;
    border-radius: 0.8rem;
    color: #1a6f48;
    background: rgb(53 168 111 / 0.12);
    font-size: 0.82rem;
    font-weight: 700;
    text-align: center;
  }
  .card label.track-pill:has(input:disabled) { opacity: 0.45; cursor: not-allowed; }
  .track-toggle { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
  .card label.track-pill {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 3.5rem;
    padding: 0.7rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 1rem;
    color: var(--color-ink-muted);
    background: var(--color-surface-soft);
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: background var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease), color var(--motion-fast) var(--ease);
  }
  .track-pill input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
  .card label.track-pill:has(input:checked) {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;
    box-shadow: 0 8px 20px rgb(182 23 51 / 0.18);
  }
  .card label.track-pill:has(input:focus-visible) { outline: 3px solid rgb(182 23 51 / 0.12); outline-offset: 2px; }
  @media (max-width: 580px) {
    .form-grid { grid-template-columns: 1fr; }
    .track-toggle { grid-template-columns: 1fr; }
  }
</style>
```

(This component is pure markup + scoped style, per the spec — its inputs are read and validated by `RegistrationForm.astro`'s single shared script, Task 11. The `.card`-prefixed selectors above intentionally match the class the shell (Task 11) puts on its outer `<form>`, so `:has()` specificity still wins the same way it did in the original single-file component.)

- [ ] **Step 2: Commit**

```bash
git add src/components/placement-test/RegistrationStepBasics.astro
git commit -m "feat: add RegistrationStepBasics component"
```

---

### Task 10: `RegistrationStepDetails.astro`

**Files:**
- Create: `src/components/placement-test/RegistrationStepDetails.astro`

**Interfaces:**
- Consumes: `Locale`, `useTranslations`.
- Produces: markup with `id`s `step-details`, `id-number`/`nationality`/`email`/`education-level`/`address` inputs, `#guardian-section` (+ its fields), `#referral-*` chip groups, `#terms-box`, `#consent-terms`/`#consent-media` checkboxes, `#step2-back`/`#step2-submit` buttons — all wired by Task 11's shell script.

- [ ] **Step 1: Write the component**

```astro
---
import type { Locale, useTranslations } from '../../i18n/ui';

export interface Props {
  locale: Locale;
  t: ReturnType<typeof useTranslations>;
}
const { locale, t } = Astro.props;

const termsAr = [
  'يجب على المتدرب/ة سداد كامل الرسوم الدراسية قبل بداية الدورة.',
  'يحق للمتدرب/ة استرداد كامل الرسوم في الحالات التالية: عدم وجود المستوى الدراسي المحدد، أو الانسحاب قبل بداية الدورة بأسبوع.',
  'يتم خصم ٥٠٪ من الرسوم الدراسية عند انسحاب المتدرب/ة خلال أول ثلاثة أيام من بدء الدورة.',
  'لا يحق للمتدرب/ة الانسحاب من الدورة أو استرجاع الرسوم أو أي جزء منها بعد مرور ثلاثة أيام من بدء الدورة.',
  'لا يحق للمتدرب/ة استرداد الرسوم أو المطالبة بالتعويض في حالة الانقطاع عن الدورة.',
  'لا يحق للمتدرب/ة المطالبة بخصم الاستمرارية في حال انقطاعه أو توقفه مدة ٣ أشهر من تاريخ انتهاء الدورة.',
  'يتم دفع مبلغ (٢٠٠ ريال) في حال فقدان حقيبة المتدرب/ة الدراسية.',
  'يتم دفع مبلغ (١٠٠ ريال) رسوم إعادة الاختبار النهائي.',
  'في حالة عدم اجتياز المتدرب/ة يحق له الحصول على خصم ٥٠٪ من القيمة الأساسية للدورة عند الإعادة.',
  'تخضع باقات العروض الموسمية للالتزام بالمدة المحددة، ولا يسمح بالتأجيل أو الإيقاف لأي سبب كان بعد بدء الباقة.',
  'يلتزم المتدرب/ة بالحضور في المواعيد المحددة للدورة بنسبة لا تقل عن ٨٠٪ من الساعات المقررة، وفي حال تجاوز نسبة الغياب الحد المسموح به لا يتم إصدار شهادة للمتدرب.',
  'في حالة انقطاع المتدرب/ة عن الدراسة لأكثر من شهرين يتم إعادة تقييم مستواه.',
  'في حال عدم قيام المتدرب/ة باستلام الشهادة بعد مضي ٦ أشهر من تاريخ انتهاء الدورة، لا يحق له المطالبة بها.',
  'يلتزم المتدرب/ة بالانضباط بسلوك التعلم، ويحق للمعهد إيقافه في حال صدور سلوك مخالف.',
  'يلتزم المتدرب/ة بالاستخدام الأمثل للأثاث والأدوات والأجهزة الموجودة، ويتحمل قيمة ما يتسبب في إتلافه.',
  'يوافق ولي أمر المتدرب/ة على تصوير البنين والبنات بالصور أو مقاطع الفيديو لأغراض دعائية أو تعليمية للمعهد، مع التأكيد على عدم تصوير البنات البالغات أو استخدام أي محتوى يخصهن.',
];

// Plain-language English rendering for readability only -- Arabic (above)
// is the legally authoritative text; see the note rendered under the box.
const termsEn = [
  'The trainee must pay the full course fees before the course begins.',
  'The trainee is entitled to a full refund if: the specified course level doesn’t run, or they withdraw at least a week before the course starts.',
  '50% of the course fees is deducted if the trainee withdraws within the first three days after the course starts.',
  'The trainee may not withdraw from the course or reclaim any part of the fees after three days have passed since the course started.',
  'The trainee is not entitled to a refund or compensation in case of dropping out of the course.',
  'The trainee may not claim a continuity discount if they drop out or pause for 3 months from the course’s end date.',
  'A fee of 200 SAR applies if the trainee’s course bag/kit is lost.',
  'A fee of 100 SAR applies for retaking the final exam.',
  'A trainee who does not pass is entitled to a 50% discount off the base course price when repeating it.',
  'Seasonal offer packages are bound to their stated duration; no postponement or pause is allowed for any reason once the package has started.',
  'The trainee must attend at least 80% of the scheduled course hours; exceeding the allowed absence rate means no certificate will be issued.',
  'If the trainee is absent from study for more than two months, their level will be reassessed.',
  'If the trainee does not collect their certificate within 6 months of the course’s end date, they forfeit the right to claim it.',
  'The trainee must maintain disciplined learning conduct; the institute may suspend a trainee for improper conduct.',
  'The trainee must make proper use of the furniture, tools, and equipment provided, and is liable for the cost of any damage they cause.',
  'The trainee’s guardian agrees to the trainee (male or female) being photographed or filmed for the institute’s promotional or educational purposes, with the assurance that adult female students will not be photographed or have any related content used.',
];

const terms = locale === 'ar' ? termsAr : termsEn;
---

<div id="step-details" hidden>
  <div class="form-grid">
    <label>
      <span>{t('registration.idNumber')}</span>
      <input required name="idNumber" type="text" inputmode="numeric" />
    </label>
    <label>
      <span>{t('registration.nationality')}</span>
      <input required name="nationality" type="text" list="nationality-options" />
      <datalist id="nationality-options">
        <option value="سعودي" /><option value="مصري" /><option value="يمني" /><option value="سوداني" />
        <option value="سوري" /><option value="أردني" /><option value="فلسطيني" /><option value="باكستاني" />
        <option value="هندي" /><option value="بنغلاديشي" /><option value="فلبيني" /><option value="إندونيسي" />
        <option value="نيجيري" /><option value="إثيوبي" /><option value="تركي" /><option value="بريطاني" />
        <option value="أمريكي" />
      </datalist>
    </label>
    <label>
      <span>{t('registration.email')}</span>
      <input name="email" type="email" autocomplete="email" />
    </label>
    <label>
      <span>{t('registration.educationLevel')}</span>
      <select name="educationLevel">
        <option value="">{t('registration.educationLevelChoose')}</option>
        <option value="primary">{t('registration.educationPrimary')}</option>
        <option value="intermediate">{t('registration.educationIntermediate')}</option>
        <option value="secondary">{t('registration.educationSecondary')}</option>
        <option value="university">{t('registration.educationUniversity')}</option>
        <option value="postgraduate">{t('registration.educationPostgraduate')}</option>
        <option value="vocational">{t('registration.educationVocational')}</option>
        <option value="other">{t('registration.educationOther')}</option>
      </select>
    </label>
  </div>
  <label class="full-width">
    <span>{t('registration.address')}</span>
    <textarea name="address" rows="2"></textarea>
  </label>

  <fieldset id="guardian-section" class="guardian-fieldset">
    <legend>
      {t('registration.guardianHeading')}
      <span id="guardian-badge" class="badge"></span>
    </legend>
    <button type="button" id="guardian-toggle" class="btn btn-outline" hidden>{t('registration.guardianAddLink')}</button>
    <div id="guardian-fields" class="form-grid">
      <label>
        <span>{t('registration.guardianName')}</span>
        <input name="guardianName" type="text" autocomplete="name" />
      </label>
      <label>
        <span>{t('registration.guardianRelationship')}</span>
        <select name="guardianRelationship">
          <option value="">{t('registration.guardianRelationshipChoose')}</option>
          <option value="father">{t('registration.relationFather')}</option>
          <option value="mother">{t('registration.relationMother')}</option>
          <option value="sibling">{t('registration.relationSibling')}</option>
          <option value="grandparent">{t('registration.relationGrandparent')}</option>
          <option value="legal_guardian">{t('registration.relationLegalGuardian')}</option>
          <option value="other">{t('registration.relationOther')}</option>
        </select>
      </label>
      <label id="guardian-relationship-other-field" hidden>
        <span>{t('registration.guardianRelationshipOther')}</span>
        <input name="guardianRelationshipOther" type="text" />
      </label>
      <label>
        <span>{t('registration.guardianPhone')}</span>
        <input name="guardianPhone" type="tel" dir="ltr" />
      </label>
      <label>
        <span>{t('registration.guardianAltPhone')}</span>
        <input name="guardianAltPhone" type="tel" dir="ltr" />
      </label>
    </div>
  </fieldset>

  <fieldset class="referral-fieldset">
    <legend>{t('registration.referralHeading')}</legend>
    <div class="chip-group" id="referral-source-group">
      <label class="chip"><input required type="radio" name="referralSource" value="friend" /><span>{t('registration.referralFriend')}</span></label>
      <label class="chip"><input required type="radio" name="referralSource" value="paper_ad" /><span>{t('registration.referralPaperAd')}</span></label>
      <label class="chip"><input required type="radio" name="referralSource" value="sms" /><span>{t('registration.referralSms')}</span></label>
      <label class="chip"><input required type="radio" name="referralSource" value="internet" /><span>{t('registration.referralInternet')}</span></label>
      <label class="chip"><input required type="radio" name="referralSource" value="road_ad" /><span>{t('registration.referralRoadAd')}</span></label>
      <label class="chip"><input required type="radio" name="referralSource" value="social" /><span>{t('registration.referralSocial')}</span></label>
      <label class="chip"><input required type="radio" name="referralSource" value="other" /><span>{t('registration.referralOther')}</span></label>
    </div>
    <div class="chip-group" id="referral-social-group" hidden>
      <label class="chip"><input type="checkbox" name="referralSocialChannels" value="facebook" /><span>{t('registration.referralSocialFacebook')}</span></label>
      <label class="chip"><input type="checkbox" name="referralSocialChannels" value="twitter" /><span>{t('registration.referralSocialTwitter')}</span></label>
      <label class="chip"><input type="checkbox" name="referralSocialChannels" value="youtube" /><span>{t('registration.referralSocialYoutube')}</span></label>
      <label class="chip"><input type="checkbox" name="referralSocialChannels" value="tiktok" /><span>{t('registration.referralSocialTiktok')}</span></label>
      <label class="chip"><input type="checkbox" name="referralSocialChannels" value="instagram" /><span>{t('registration.referralSocialInstagram')}</span></label>
      <label class="chip"><input type="checkbox" name="referralSocialChannels" value="snapchat" /><span>{t('registration.referralSocialSnapchat')}</span></label>
    </div>
    <label id="referral-other-field" class="full-width" hidden>
      <span>{t('registration.referralOtherSpecify')}</span>
      <input name="referralSourceOther" type="text" />
    </label>
  </fieldset>

  <fieldset class="terms-fieldset">
    <legend>{t('registration.termsHeading')}</legend>
    <ol id="terms-box" class="terms-box">
      {terms.map((clause) => <li>{clause}</li>)}
    </ol>
    {locale !== 'ar' && <p class="terms-translation-note">This is a plain-language summary translation; the Arabic version above is legally binding.</p>}
    <p class="terms-warning">{t('registration.termsWarning')}</p>
    <label class="consent-check">
      <input required type="checkbox" name="termsAccepted" />
      <span>{t('registration.consentTerms')}</span>
    </label>
    <label class="consent-check">
      <input required type="checkbox" name="mediaConsentAccepted" />
      <span>{t('registration.consentMedia')}</span>
    </label>
  </fieldset>

  <div class="step2-actions">
    <button type="button" id="step2-back" class="btn btn-outline">{t('registration.back')}</button>
    <button type="submit" id="step2-submit" class="btn btn-primary">{t('registration.submit')}</button>
  </div>
</div>

<style>
  .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  #step-details label, #step-details .full-width { display: flex; flex-direction: column; gap: 0.45rem; color: var(--color-navy); font-size: 0.88rem; font-weight: 700; }
  #step-details input, #step-details select, #step-details textarea {
    width: 100%;
    min-height: 3.25rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 0.85rem;
    color: var(--color-ink);
    background: var(--color-bg-raised);
    font: inherit;
  }
  #step-details textarea { min-height: 5rem; resize: vertical; }
  fieldset { margin: 1.5rem 0 0; padding: 1rem; border: 1px solid var(--color-border); border-radius: 1rem; }
  legend { padding: 0 0.4rem; color: var(--color-navy); font-size: 0.9rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; }
  .badge { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.72rem; font-weight: 800; }
  .badge.required { color: #7a1c1c; background: rgb(182 23 51 / 0.12); }
  .badge.optional { color: #1a6f48; background: rgb(53 168 111 / 0.12); }
  .chip-group { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .chip { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.9rem; border: 1px solid var(--color-border); border-radius: 999px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
  .chip:has(input:checked) { border-color: var(--color-primary); background: var(--color-primary); color: #fff; }
  .terms-box { max-height: 16rem; overflow-y: auto; margin: 0.75rem 0; padding: 1rem 1.5rem; border: 1px solid var(--color-border); border-radius: 0.85rem; background: var(--color-surface-soft); font-size: 0.85rem; line-height: 1.7; display: grid; gap: 0.5rem; }
  .terms-translation-note { margin: 0 0 0.75rem; font-size: 0.78rem; font-style: italic; color: var(--color-ink-muted); }
  .terms-warning { margin: 0 0 1rem; padding: 0.65rem 0.8rem; border-radius: 0.8rem; color: var(--color-primary-text); background: rgb(182 23 51 / 0.09); font-size: 0.85rem; font-weight: 800; text-align: center; }
  .consent-check { display: flex; align-items: flex-start; gap: 0.6rem; margin-top: 0.75rem; font-size: 0.85rem; font-weight: 600; color: var(--color-ink); }
  .consent-check input { width: auto; min-height: auto; margin-top: 0.2rem; }
  .step2-actions { display: grid; grid-template-columns: 1fr 2fr; gap: 0.75rem; margin-top: 1.5rem; }
  .step2-actions .btn { justify-content: center; min-height: 3.5rem; }
  @media (max-width: 580px) {
    .form-grid { grid-template-columns: 1fr; }
    .step2-actions { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/placement-test/RegistrationStepDetails.astro
git commit -m "feat: add RegistrationStepDetails component with terms and guardian/referral logic"
```

---

### Task 11: `RegistrationForm.astro` shell rewrite

**Files:**
- Modify: `src/components/placement-test/RegistrationForm.astro`

**Interfaces:**
- Consumes: `RegistrationStepBasics.astro`, `RegistrationStepDetails.astro` (Tasks 9-10), `registrationValidation.ts` (Task 8).
- Produces: same `placement:register` CustomEvent contract as today (consumed by `TestRunner.astro`, unchanged) — root element keeps `id="placement-registration"`, error element keeps `id="placement-registration-error"`.

- [ ] **Step 1: Rewrite the component**

```astro
---
// src/components/placement-test/RegistrationForm.astro
import type { Locale, useTranslations } from '../../i18n/ui';
import RegistrationStepBasics from './RegistrationStepBasics.astro';
import RegistrationStepDetails from './RegistrationStepDetails.astro';

export interface Props {
  locale: Locale;
  t: ReturnType<typeof useTranslations>;
}
const { locale, t } = Astro.props;
---

<form id="placement-registration" class="card" data-locale={locale}>
  <header class="card-heading">
    <span class="step-number" aria-hidden="true" id="step-number">01</span>
    <div>
      <p class="card-eyebrow" id="step-eyebrow">{t('registration.step1Of2')}</p>
      <h2>{t('registration.heading')}</h2>
      <p class="card-intro">{t('registration.intro')}</p>
    </div>
  </header>

  <RegistrationStepBasics locale={locale} t={t} />
  <RegistrationStepDetails locale={locale} t={t} />

  <p id="placement-registration-error" class="form-error" role="alert" hidden>{t('registration.error')}</p>
</form>

<script>
  import { computeAge, NAME_RE, PHONE_RE, ID_NUMBER_RE, EMAIL_RE } from '../../lib/registrationValidation';

  const form = document.getElementById('placement-registration') as HTMLFormElement;
  const errorEl = document.getElementById('placement-registration-error') as HTMLElement;
  const stepNumber = document.getElementById('step-number') as HTMLElement;
  const stepEyebrow = document.getElementById('step-eyebrow') as HTMLElement;
  const stepBasics = document.getElementById('step-basics') as HTMLElement;
  const stepDetails = document.getElementById('step-details') as HTMLElement;

  const dobInput = form.querySelector<HTMLInputElement>('input[name="dob"]')!;
  const adultsInput = form.querySelector<HTMLInputElement>('input[name="track"][value="adults"]')!;
  const kidsInput = form.querySelector<HTMLInputElement>('input[name="track"][value="kids"]')!;
  const ageRule = document.getElementById('age-track-rule') as HTMLElement;
  const estimatedAgeNote = document.getElementById('estimated-age-note') as HTMLElement;
  const isAr = form.dataset.locale === 'ar';

  function selectedTrack(): string {
    return form.querySelector<HTMLInputElement>('input[name="track"]:checked')?.value ?? 'adults';
  }

  function isUnderEleven(dob: string): boolean {
    return computeAge(dob) < 11;
  }

  function updateEstimatedAge() {
    const age = computeAge(dobInput.value);
    if (!Number.isFinite(age) || !dobInput.value) {
      estimatedAgeNote.hidden = true;
      return;
    }
    const prefix = isAr ? 'العمر التقديري:' : 'Estimated age:';
    const suffix = isAr ? 'سنة' : 'years';
    estimatedAgeNote.textContent = `${prefix} ${age} ${suffix}`;
    estimatedAgeNote.hidden = false;
    updateGuardianRequirement(age);
  }

  function enforceAgeTrack() {
    const forcedKids = isUnderEleven(dobInput.value);
    adultsInput.disabled = forcedKids;
    ageRule.hidden = !forcedKids;
    ageRule.textContent = isAr
      ? 'يتم اختيار اختبار الأطفال تلقائيًا للطلاب دون سن 11 عامًا.'
      : 'Students under 11 are automatically assigned to the Kids test.';
    if (forcedKids) kidsInput.checked = true;
    updateEstimatedAge();
  }

  dobInput.addEventListener('input', enforceAgeTrack);
  dobInput.addEventListener('change', enforceAgeTrack);

  // --- Guardian section (age-gated requirement) ---
  const guardianSection = document.getElementById('guardian-section') as HTMLFieldSetElement;
  const guardianBadge = document.getElementById('guardian-badge') as HTMLElement;
  const guardianToggle = document.getElementById('guardian-toggle') as HTMLButtonElement;
  const guardianFields = document.getElementById('guardian-fields') as HTMLElement;
  const guardianNameInput = form.querySelector<HTMLInputElement>('input[name="guardianName"]')!;
  const guardianRelationshipSelect = form.querySelector<HTMLSelectElement>('select[name="guardianRelationship"]')!;
  const guardianPhoneInput = form.querySelector<HTMLInputElement>('input[name="guardianPhone"]')!;
  const guardianRelationshipOtherField = document.getElementById('guardian-relationship-other-field') as HTMLElement;
  const guardianRelationshipOtherInput = form.querySelector<HTMLInputElement>('input[name="guardianRelationshipOther"]')!;

  let guardianManuallyOpened = false;

  function updateGuardianRequirement(age: number) {
    const required = Number.isFinite(age) && age < 18;
    guardianBadge.textContent = required
      ? (isAr ? 'مطلوبة (أقل من 18 سنة)' : 'Required (under 18)')
      : (isAr ? 'اختيارية للبالغين (18+)' : 'Optional for adults (18+)');
    guardianBadge.className = `badge ${required ? 'required' : 'optional'}`;
    guardianToggle.hidden = required;
    guardianFields.hidden = !required && !guardianManuallyOpened;
    guardianNameInput.required = required;
    guardianRelationshipSelect.required = required;
    guardianPhoneInput.required = required;
  }

  guardianToggle.addEventListener('click', () => {
    guardianManuallyOpened = true;
    guardianFields.hidden = false;
  });

  guardianRelationshipSelect.addEventListener('change', () => {
    const isOther = guardianRelationshipSelect.value === 'other';
    guardianRelationshipOtherField.hidden = !isOther;
    guardianRelationshipOtherInput.required = isOther;
  });

  // --- Referral source (conditional chips) ---
  const referralSocialGroup = document.getElementById('referral-social-group') as HTMLElement;
  const referralOtherField = document.getElementById('referral-other-field') as HTMLElement;
  const referralOtherInput = form.querySelector<HTMLInputElement>('input[name="referralSourceOther"]')!;
  form.querySelectorAll<HTMLInputElement>('input[name="referralSource"]').forEach((input) => {
    input.addEventListener('change', () => {
      referralSocialGroup.hidden = input.value !== 'social' || !input.checked;
      const isOther = input.value === 'other' && input.checked;
      if (isOther) {
        referralOtherField.hidden = false;
        referralOtherInput.required = true;
      } else if (input.checked) {
        referralOtherField.hidden = true;
        referralOtherInput.required = false;
      }
    });
  });

  // --- Step navigation ---
  function namePartsValid(): boolean {
    return ['firstName', 'fatherName', 'grandfatherName', 'familyName'].every((name) => {
      const input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      return NAME_RE.test(input.value);
    });
  }

  function step1Valid(): boolean {
    const phone = form.querySelector<HTMLInputElement>('input[name="phone"]')!;
    const age = computeAge(dobInput.value);
    return namePartsValid() && PHONE_RE.test(phone.value) && Number.isFinite(age) && age >= 4 && age <= 100;
  }

  const step1Next = document.getElementById('step1-next') as HTMLButtonElement;
  const step2Back = document.getElementById('step2-back') as HTMLButtonElement;

  step1Next.addEventListener('click', () => {
    if (!step1Valid()) {
      form.reportValidity();
      return;
    }
    stepBasics.hidden = true;
    stepDetails.hidden = false;
    stepNumber.textContent = '02';
    stepEyebrow.textContent = form.dataset.locale === 'ar' ? 'الخطوة 2 من 2' : 'Step 2 of 2';
  });

  step2Back.addEventListener('click', () => {
    stepDetails.hidden = true;
    stepBasics.hidden = false;
    stepNumber.textContent = '01';
    stepEyebrow.textContent = form.dataset.locale === 'ar' ? 'الخطوة 1 من 2' : 'Step 1 of 2';
  });

  // --- Submit ---
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    errorEl.hidden = true;

    const idNumberInput = form.querySelector<HTMLInputElement>('input[name="idNumber"]')!;
    const nationalityInput = form.querySelector<HTMLInputElement>('input[name="nationality"]')!;
    if (!ID_NUMBER_RE.test(idNumberInput.value) || !nationalityInput.value.trim()) {
      form.reportValidity();
      return;
    }
    const emailInput = form.querySelector<HTMLInputElement>('input[name="email"]')!;
    if (emailInput.value && !EMAIL_RE.test(emailInput.value)) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const referralSocialChannels = formData.getAll('referralSocialChannels');
    const data: Record<string, unknown> = Object.fromEntries(formData.entries());
    data.referralSocialChannels = referralSocialChannels;
    data.termsAccepted = form.querySelector<HTMLInputElement>('input[name="termsAccepted"]')!.checked;
    data.mediaConsentAccepted = form.querySelector<HTMLInputElement>('input[name="mediaConsentAccepted"]')!.checked;

    sessionStorage.setItem('placement:track', String(data.track ?? 'adults'));
    document.dispatchEvent(new CustomEvent('placement:register', { detail: { ...data, locale: form.dataset.locale } }));
  });

  updateGuardianRequirement(NaN);
</script>

<style>
  .card {
    display: grid;
    gap: 1.5rem;
    padding: clamp(1.25rem, 4vw, 2.5rem);
    border: 1px solid var(--color-border);
    border-radius: 1.75rem;
    background: var(--color-bg-raised);
    box-shadow: var(--shadow-md);
  }
  .card-heading { display: grid; grid-template-columns: auto 1fr; gap: 1rem; align-items: start; padding-bottom: 1.25rem; border-bottom: 1px solid var(--color-border); }
  .step-number { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; border-radius: 0.85rem; color: #fff; background: var(--color-primary); box-shadow: 0 8px 20px rgb(182 23 51 / 0.2); font-family: var(--font-mono); font-size: 0.78rem; font-weight: 700; }
  .card-eyebrow { margin: 0 0 0.25rem; color: var(--color-primary-text); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .card-heading h2 { margin: 0 0 0.45rem; color: var(--color-navy); font-size: clamp(1.45rem, 4vw, 2rem); }
  .card-intro { max-width: 38rem; margin: 0; color: var(--color-ink-muted); font-size: 0.92rem; }
  .form-error { margin: -0.5rem 0 0; padding: 0.75rem 0.9rem; border-radius: 0.85rem; color: var(--color-primary-text); background: rgb(182 23 51 / 0.09); font-size: 0.88rem; font-weight: 700; text-align: center; }
  @media (max-width: 580px) {
    .card-heading { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 2: Build, commit**

```bash
npx astro build 2>&1 | tail -30
git add src/components/placement-test/RegistrationForm.astro
git commit -m "feat: rewrite RegistrationForm as a 2-step wizard shell"
```

---

### Task 12: `ApplicationForm.astro` — drop email/idType/idNumber

**Files:**
- Modify: `src/components/placement-test/ApplicationForm.astro`
- Modify: `src/lib/placementApi.ts`
- Modify: `src/i18n/ui.ts`

**Interfaces:**
- Consumes: Task 3's `handleSubmitApplication` (no `email`/`idType`/`idNumber` field).

- [ ] **Step 1: `placementApi.ts`**

```ts
export interface ApplicationFields {
  course: string;
  guardianName?: string;
}
```

(Remove `email`/`idType`/`idNumber` from the interface; `submitApplication`'s body is `{ sessionId, ...fields }`, unchanged otherwise.)

- [ ] **Step 2: `ApplicationForm.astro`**

Remove the `email`, `idType`, and `idNumber` `<label>` blocks from the form markup. Remove `email`/`idType`/`idNumber` reads from the submit handler's `FormData` extraction, and remove them from the `submitApplication(sessionId, { course, guardianName, email, idType, idNumber })` call — it becomes `submitApplication(sessionId, { course, guardianName })`.

- [ ] **Step 3: `ui.ts`**

Remove `apply.email`, `apply.idType`, `apply.idTypeNational`, `apply.idTypeIqama`, `apply.idTypePassport`, `apply.idNumber` from both `en` and `ar` blocks (these were added in PR #18 and are no longer used).

- [ ] **Step 4: Build, commit**

```bash
npx astro build 2>&1 | tail -20
git add src/components/placement-test/ApplicationForm.astro src/lib/placementApi.ts src/i18n/ui.ts
git commit -m "feat: drop email/idType/idNumber from ApplicationForm (moved to registration)"
```

---

### Task 13: `AdminPanel.astro` — id_number/nationality from the student join

**Files:**
- Modify: `src/components/placement-test/AdminPanel.astro`

**Interfaces:**
- Consumes: `ApplicationWithDetails` (Task 2) — `id_number`/`nationality` instead of `email`/`id_type`.

- [ ] **Step 1: Update the summary line**

Replace:

```ts
    const idTypeLabels: Record<string, string> = { national_id: 'National ID', iqama: 'Iqama', passport: 'Passport' };
    applications.forEach((a: any) => {
      const li = document.createElement('li');
      const summary = document.createElement('span');
      const idTypeLabel = idTypeLabels[a.id_type] ?? a.id_type;
      summary.textContent = `${a.student_name} (${a.phone}) — ${a.email} — ${a.course} — level ${a.estimated_level ?? '—'} — ${idTypeLabel} #${a.id_number} — ${a.status}`;
      li.appendChild(summary);
```

with:

```ts
    applications.forEach((a: any) => {
      const li = document.createElement('li');
      const summary = document.createElement('span');
      summary.textContent = `${a.student_name} (${a.phone}) — ${a.nationality} — ID ${a.id_number} — ${a.course} — level ${a.estimated_level ?? '—'} — ${a.status}`;
      li.appendChild(summary);
```

- [ ] **Step 2: Build, commit**

```bash
npx astro build 2>&1 | tail -20
git add src/components/placement-test/AdminPanel.astro
git commit -m "feat: show student ID/nationality instead of email/idType in AdminPanel"
```

---

### Task 14: e2e test updates

**Files:**
- Modify: `tests/e2e/placement-test.spec.ts`
- Modify: `tests/e2e/application.spec.ts`

**Interfaces:**
- Consumes: `RegistrationForm.astro`/`RegistrationStepBasics.astro`/`RegistrationStepDetails.astro` (Tasks 9-11) — field labels via `t('registration.*')`, English strings.

- [ ] **Step 1: Update `placement-test.spec.ts`'s registration fill-in**

Find every place the spec fills the old 3-field registration (`page.getByLabel('Full name')`, `'WhatsApp number'`, `'Date of birth'`) and replace with the 2-step walk:

```ts
await page.goto('/en/placement-test/');
await page.getByLabel('First name').fill('Application');
await page.getByLabel('Father’s name').fill('Smoke');
await page.getByLabel('Grandfather’s name').fill('Test');
await page.getByLabel('Family name').fill('User');
await page.getByLabel('WhatsApp number').fill('+966500000001');
await page.getByLabel('Date of birth').fill('1995-01-01');
await page.getByRole('button', { name: 'Next' }).click();
await page.getByLabel('National ID / Iqama / passport number').fill('1234567890');
await page.getByLabel('Nationality').fill('Saudi');
await page.getByRole('radio', { name: 'A friend' }).check();
await page.getByLabel(/I acknowledge that I have read/).check();
await page.getByLabel(/I agree \(as the trainee or their guardian\)/).check();
await page.getByRole('button', { name: 'Start test' }).click();
```

Apply the same replacement to the kids-track spec (`'the registration form assigns under-11 students to the kids track'`), keeping its DOB choice (already under 11, so the kids track auto-selects — unchanged) and adding the guardian fields it doesn't currently fill:

```ts
await page.getByLabel('Guardian name').fill('Parent Name');
await page.getByLabel('Relationship').selectOption('father');
await page.getByLabel('Guardian’s mobile number').fill('+966500000098');
```
(guardian section is auto-expanded and required for this DOB, per Task 11's `updateGuardianRequirement`)

- [ ] **Step 2: Update `application.spec.ts`'s registration fill-in**

Same Step-1/Step-2 walk as above (adult track), replacing lines 16-20 of the current file. The application-step fill-in later in the file (course + submit) stays as-is minus the now-removed email/idType/idNumber fields (Task 12 already removed those inputs, so this spec's fill-ins for them — added when PR #18 landed — must be deleted): remove the `Email address`/`ID type`/`ID number` fill lines, keep the course select + submit.

- [ ] **Step 3: Run the full smoke suite locally against a live worker+preview stack (see Task 15's exact commands), commit**

```bash
git add tests/e2e/placement-test.spec.ts tests/e2e/application.spec.ts
git commit -m "test: update e2e specs for the 2-step registration wizard"
```

---

### Task 15: Final integration verification

**Files:** none (verification only)

- [ ] **Step 1: Worker unit tests + typecheck**

```bash
cd placement-test-worker
npm test 2>&1 | tail -60
npx tsc --noEmit
```

Expected: all tests pass (previous 135 plus this plan's new/changed cases), clean typecheck.

- [ ] **Step 2: Static build**

```bash
cd ..
npx astro build 2>&1 | tail -20
```

Expected: 40 pages built, no errors.

- [ ] **Step 3: Full e2e smoke run against a live local stack**

```bash
cd placement-test-worker
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
npx wrangler d1 execute placement-test --local --command "INSERT INTO slots (id, starts_at, capacity, booked_count) VALUES ('e2e-smoke-slot', '2027-01-01T10:00:00.000Z', 5, 0)"
nohup npm run dev > /tmp/wrangler-verify.log 2>&1 &
```

Wait for `curl -sf http://localhost:8787/api/slots` to succeed, then:

```bash
cd ..
PUBLIC_PLACEMENT_API_URL=http://localhost:8787 npx astro build
nohup npx astro preview --port 4322 > /tmp/preview-verify.log 2>&1 &
```

Wait for `curl -sf http://localhost:4322/en/placement-test/` to succeed, then:

```bash
SMOKE_BASE_URL=http://localhost:4322 ./node_modules/.bin/playwright.cmd test 2>&1 | tail -60
```

Expected: all 3 e2e specs pass, 0 console errors. Stop the worker/preview background processes afterward.

- [ ] **Step 4: Manual sanity check of the guardian toggle**

In the running local preview, open `/en/placement-test/`, enter a DOB making the student 15, confirm the guardian section auto-expands with the red "Required" badge and the three fields become required; change DOB to make them 25, confirm the section collapses behind the optional toggle without losing any already-typed guardian values.

This task has no code changes of its own — it's the gate before moving to `superpowers:finishing-a-development-branch`.
