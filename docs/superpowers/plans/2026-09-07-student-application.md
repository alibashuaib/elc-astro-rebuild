# Student Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student who has completed the placement test and booked a slot submit a real, stored application (course choice, guardian info, ID number, ID/photo documents) tied to that test session, and let staff review/approve it in the admin panel.

**Architecture:** Extend the existing `placement-test-worker` (Cloudflare Worker + D1) with two new tables and a new R2 bucket binding for documents; add a new `/apply` Astro page + form component that calls new worker routes; add an "Applications" review card to the existing `AdminPanel.astro`.

**Tech Stack:** Astro (static, FTP-deployed), Cloudflare Workers + D1 (SQLite) + R2, TypeScript, Vitest (worker unit tests, using the project's `fakeD1` in-memory shim — real `wrangler dev`/workerd crashes in this sandbox, see `test-utils/fakeD1.ts`), Playwright (browser smoke e2e, run in CI only).

**Spec:** `docs/superpowers/specs/2026-09-06-student-application-design.md`

## Global Constraints

- New R2 binding name: `DOCS` (in `placement-test-worker/wrangler.toml` and `Env`).
- Document upload cap: 5 MB per file.
- Accepted document MIME types: `image/jpeg`, `image/png`, `application/pdf` only.
- One application per `test_sessions` row — enforced with `CREATE UNIQUE INDEX` on `applications.session_id`, and the submit route returns 409 on a second attempt.
- New worker routes live under `/api/apply*` and `/api/admin/applications*`, matching the router's `parts = pathname.split('/').filter(Boolean)` convention in `placement-test-worker/src/index.ts` (every pattern segment starts with `'api'`).
- All new admin routes are gated with `admin: true` in the `ROUTES` table (existing `requireAdmin` check in `index.ts`), same as every other `/api/admin/*` route.
- CORS: no change needed — `multipart/form-data` is a CORS-safelisted content type, and the existing `ALLOWED_ORIGINS`/method list in `index.ts` already covers `POST`/`PATCH`/`GET`.
- Bilingual copy: every new user-facing string gets both an `en` and an `ar` entry in `src/i18n/ui.ts` (the `t()` helper's type is `keyof typeof ui['en']`, so the two objects' key sets must match exactly or the build fails to typecheck).
- `AdminPanel.astro` is deliberately plain hardcoded English (see its own header comment) — the new Applications card follows that, no `t()` there.

---

## File Structure

**New files:**
- `placement-test-worker/migrations/0019_student_applications.sql` — `applications` + `application_documents` tables
- `placement-test-worker/src/test-utils/fakeR2.ts` — in-memory `R2Bucket` shim, same pattern as `fakeD1.ts`
- `placement-test-worker/src/routes/application.ts` — the 5 new route handlers
- `placement-test-worker/src/routes/application.test.ts` — their tests
- `src/pages/[lang]/apply.astro` — the application page shell
- `src/components/placement-test/ApplicationForm.astro` — the form
- `tests/e2e/application.spec.ts` — Playwright smoke test for the apply flow

**Modified files:**
- `placement-test-worker/src/types.ts` — `Env.DOCS`, `ApplicationRow`, `ApplicationDocumentRow`, `ApplicationWithDetails`
- `placement-test-worker/src/db.ts` — application data-access functions
- `placement-test-worker/src/auth.ts` — factor `getSessionAdminId` out of `verifyAdminSession`
- `placement-test-worker/src/auth.test.ts` — test for the new function
- `placement-test-worker/src/index.ts` — register the 5 new routes
- `placement-test-worker/wrangler.toml` — `[[r2_buckets]]` binding
- `placement-test-worker/scripts/local-dev.ts` — add the new migration + a fake `DOCS` binding to the fallback dev server's `env`
- `src/i18n/ui.ts` — `apply.*` keys, en + ar
- `src/i18n/pages.ts` — `apply` page meta + path
- `src/lib/placementApi.ts` — `submitApplication`, `uploadDocument`
- `src/components/placement-test/ResultBooking.astro` — "Continue to application" link
- `src/components/placement-test/AdminPanel.astro` — Applications card

---

### Task 1: D1 schema + types + R2 binding

**Files:**
- Create: `placement-test-worker/migrations/0019_student_applications.sql`
- Modify: `placement-test-worker/src/types.ts`
- Modify: `placement-test-worker/wrangler.toml`

**Interfaces:**
- Produces: `applications` table (`id`, `session_id` UNIQUE, `course`, `guardian_name`, `id_number`, `status`, `created_at`, `reviewed_at`, `reviewed_by`), `application_documents` table (`id`, `application_id`, `kind`, `r2_key`, `uploaded_at`); TypeScript types `ApplicationRow`, `ApplicationDocumentRow`; `Env.DOCS: R2Bucket`.

- [ ] **Step 1: Write the migration**

```sql
-- placement-test-worker/migrations/0019_student_applications.sql
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

- [ ] **Step 2: Verify the migration applies cleanly**

`test-utils/fakeD1.ts` auto-applies every `.sql` file in `migrations/` in filename order for every test's fresh in-memory DB, so any existing worker test now exercises this migration too.

Run: `cd placement-test-worker && npm test`
Expected: PASS (same test count as before this change — the migration adding two new empty tables shouldn't break anything already there).

- [ ] **Step 3: Add the TypeScript row types**

Add to `placement-test-worker/src/types.ts` (after `SessionRow`):

```ts
export interface ApplicationRow {
  id: string;
  session_id: string;
  course: string;
  guardian_name: string | null;
  id_number: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export type DocumentKind = 'id_copy' | 'photo' | 'other';

export interface ApplicationDocumentRow {
  id: string;
  application_id: string;
  kind: DocumentKind;
  r2_key: string;
  uploaded_at: string;
}
```

And add the R2 binding to `Env` (same file):

```ts
export interface Env {
  DB: D1Database;
  DOCS: R2Bucket; // uploaded application documents (ID copy, photo) — see migrations/0019
  ADMIN_SESSION_TTL_SECONDS: string;
  ADMIN_COOKIE_SECRET: string; // set via `wrangler secret put ADMIN_COOKIE_SECRET`
  /** 'true' only under local dev (see scripts/local-dev.ts) -- gates loopback CORS origins and verbose error messages. */
  LOCAL_DEV?: string;
}
```

- [ ] **Step 4: Add the R2 binding to wrangler.toml**

Add to `placement-test-worker/wrangler.toml` (after the `[[d1_databases]]` block):

```toml
[[r2_buckets]]
binding = "DOCS"
bucket_name = "elc-application-documents"
# Create with `wrangler r2 bucket create elc-application-documents` before the
# first deploy — unlike D1, R2 buckets aren't created by a migrations command.
```

- [ ] **Step 5: Typecheck and commit**

Run: `cd placement-test-worker && npx tsc --noEmit`
Expected: PASS (no type errors — `Env.DOCS` isn't consumed by any code yet, so nothing references it incorrectly).

```bash
git add placement-test-worker/migrations/0019_student_applications.sql placement-test-worker/src/types.ts placement-test-worker/wrangler.toml
git commit -m "feat: add applications schema, types, and R2 binding"
```

---

### Task 2: Factor `getSessionAdminId` out of `verifyAdminSession`

**Files:**
- Modify: `placement-test-worker/src/auth.ts`
- Modify: `placement-test-worker/src/auth.test.ts`

**Interfaces:**
- Consumes: nothing new (refactor of existing cookie-parsing logic).
- Produces: `getSessionAdminId(req: Request, env: Env): Promise<string | null>` — Task 5's admin routes use this to stamp `reviewed_by`.

- [ ] **Step 1: Write the failing test**

Add to `placement-test-worker/src/auth.test.ts` (new `describe` block at the end of the file):

```ts
import { getSessionAdminId } from './auth';

describe('getSessionAdminId', () => {
  it('returns the admin id from a valid cookie', async () => {
    const env = makeEnv();
    const cookie = await issueSessionCookie(env, 'a1');
    expect(await getSessionAdminId(requestWithCookie(cookie), env)).toBe('a1');
  });

  it('returns null when there is no cookie', async () => {
    const env = makeEnv();
    expect(await getSessionAdminId(new Request('http://x'), env)).toBeNull();
  });

  it('returns null for an expired cookie', async () => {
    const env = makeEnv({ ADMIN_SESSION_TTL_SECONDS: '1' });
    const cookie = await issueSessionCookie(env, 'a1');
    const realNow = Date.now;
    Date.now = () => realNow() + 2000;
    try {
      expect(await getSessionAdminId(requestWithCookie(cookie), env)).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd placement-test-worker && npx vitest run src/auth.test.ts`
Expected: FAIL — `getSessionAdminId` is not exported from `./auth`.

- [ ] **Step 3: Implement it**

In `placement-test-worker/src/auth.ts`, replace the body of `verifyAdminSession` — extract its cookie-parsing/signature-check logic into a new exported function that returns the admin id instead of a boolean, and have `verifyAdminSession` call it:

```ts
export async function getSessionAdminId(req: Request, env: Env): Promise<string | null> {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const [adminId, expiresStr, sig] = match[1].split('.');
  if (!adminId || !expiresStr || !sig) return null;
  const expires = parseInt(expiresStr, 10);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;
  const expectedSig = await sign(`${adminId}.${expiresStr}`, env.ADMIN_COOKIE_SECRET);
  return constantTimeEqual(expectedSig, sig) ? adminId : null;
}

export async function verifyAdminSession(req: Request, env: Env): Promise<boolean> {
  return (await getSessionAdminId(req, env)) !== null;
}
```

Delete the old body of `verifyAdminSession` (the cookie-parsing code that now lives in `getSessionAdminId`) — `constantTimeEqual` and `sign` stay as private helpers, unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd placement-test-worker && npx vitest run src/auth.test.ts`
Expected: PASS, including the pre-existing `verifyAdminSession` tests (unchanged behavior, just implemented via the new function).

- [ ] **Step 5: Commit**

```bash
git add placement-test-worker/src/auth.ts placement-test-worker/src/auth.test.ts
git commit -m "refactor: expose getSessionAdminId from the admin cookie check"
```

---

### Task 3: Fake R2 test util

**Files:**
- Create: `placement-test-worker/src/test-utils/fakeR2.ts`

**Interfaces:**
- Produces: `createFakeR2(): R2Bucket` — an in-memory `put`/`get` shim, same role as `createFakeD1()`. Task 4's tests bind it as `env.DOCS`.

- [ ] **Step 1: Write the shim**

```ts
// placement-test-worker/src/test-utils/fakeR2.ts
//
// In-memory R2Bucket-compatible shim, same rationale as fakeD1.ts: the real
// workerd runtime crashes on startup in this sandbox, so R2-touching route
// code is unit-tested against this instead. Implements only what this
// project's code calls: bucket.put(key, body, { httpMetadata }) and
// bucket.get(key) -> { body, httpEtag, writeHttpMetadata(headers) } | null.
//
// Production code never imports this file — Env.DOCS stays typed as the real
// R2Bucket everywhere outside tests.

interface StoredObject {
  data: ArrayBuffer;
  contentType?: string;
}

export function createFakeR2(): R2Bucket {
  const store = new Map<string, StoredObject>();

  return {
    async put(key: string, value: ArrayBuffer | ArrayBufferView, options?: { httpMetadata?: { contentType?: string } }) {
      const data = ArrayBuffer.isView(value)
        ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
        : value;
      store.set(key, { data, contentType: options?.httpMetadata?.contentType });
      return { key } as any;
    },
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        body: new Response(entry.data).body,
        httpEtag: `"${key}"`,
        writeHttpMetadata(headers: Headers) {
          if (entry.contentType) headers.set('content-type', entry.contentType);
        },
      } as any;
    },
  } as unknown as R2Bucket;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd placement-test-worker && npx tsc --noEmit`
Expected: PASS (the file isn't imported anywhere yet, but it must still typecheck on its own — `@cloudflare/workers-types` provides the `R2Bucket`/`ArrayBufferView` ambient types this project already depends on).

- [ ] **Step 3: Commit**

```bash
git add placement-test-worker/src/test-utils/fakeR2.ts
git commit -m "test: add in-memory R2 shim for worker unit tests"
```

---

### Task 4: `db.ts` application functions + student-facing routes

**Files:**
- Modify: `placement-test-worker/src/db.ts`
- Create: `placement-test-worker/src/routes/application.ts`
- Create: `placement-test-worker/src/routes/application.test.ts`

**Interfaces:**
- Consumes: `Env`, `ApplicationRow`, `ApplicationDocumentRow`, `DocumentKind` (Task 1); `createFakeR2` (Task 3); `getSession`, `insertStudent`, `insertSession`, `completeSession` (existing `db.ts`).
- Produces (`db.ts`): `insertApplication(env, input: { sessionId, course, guardianName, idNumber }): Promise<string>`, `getApplicationBySession(env, sessionId): Promise<ApplicationRow | null>`, `getApplicationById(env, id): Promise<ApplicationRow | null>`, `insertApplicationDocument(env, applicationId, kind: DocumentKind, r2Key): Promise<string>`, `listApplicationDocuments(env, applicationId): Promise<ApplicationDocumentRow[]>`, `getApplicationDocument(env, applicationId, documentId): Promise<ApplicationDocumentRow | null>`.
- Produces (`routes/application.ts`): `handleSubmitApplication(req, env): Promise<Response>`, `handleUploadDocument(req, env, applicationId): Promise<Response>` — consumed by Task 5's `index.ts` wiring and Task 8's `placementApi.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// placement-test-worker/src/routes/application.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../test-utils/fakeD1';
import { createFakeR2 } from '../test-utils/fakeR2';
import { handleSubmitApplication, handleUploadDocument } from './application';
import { insertStudent, insertSession, completeSession, listApplicationDocuments } from '../db';

function makeEnv() {
  return {
    DB: createFakeD1(),
    DOCS: createFakeR2(),
  };
}

let env: ReturnType<typeof makeEnv>;
beforeEach(() => {
  env = makeEnv();
});

async function completedSession(track: 'kids' | 'adults' = 'adults') {
  const studentId = await insertStudent(env as any, { name: 'A', phone: '1', dob: '2000-01-01', locale: 'en' });
  const sessionId = await insertSession(env as any, studentId, track);
  await completeSession(env as any, sessionId, 'B1');
  return sessionId;
}

describe('POST /apply', () => {
  it('creates an application for a completed session', async () => {
    const sessionId = await completedSession();
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, course: 'Adults General English', idNumber: '1234567890' }) }),
      env as any
    );
    expect(res.status).toBe(201);
    const { applicationId } = (await res.json()) as any;
    expect(typeof applicationId).toBe('string');
  });

  it('rejects a missing idNumber', async () => {
    const sessionId = await completedSession();
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, course: 'Adults General English' }) }),
      env as any
    );
    expect(res.status).toBe(400);
  });

  it('refuses a session that never completed', async () => {
    const studentId = await insertStudent(env as any, { name: 'A', phone: '1', dob: '2000-01-01', locale: 'en' });
    const sessionId = await insertSession(env as any, studentId, 'adults');
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, course: 'Adults General English', idNumber: '1234567890' }) }),
      env as any
    );
    expect(res.status).toBe(400);
  });

  it('refuses a second application for the same session', async () => {
    const sessionId = await completedSession();
    const body = JSON.stringify({ sessionId, course: 'Adults General English', idNumber: '1234567890' });
    await handleSubmitApplication(new Request('http://x', { method: 'POST', body }), env as any);
    const second = await handleSubmitApplication(new Request('http://x', { method: 'POST', body }), env as any);
    expect(second.status).toBe(409);
  });
});

describe('POST /apply/:id/documents', () => {
  async function createApplication() {
    const sessionId = await completedSession();
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, course: 'Adults General English', idNumber: '1234567890' }) }),
      env as any
    );
    return ((await res.json()) as any).applicationId as string;
  }

  it('stores an uploaded document in R2 and records it in D1', async () => {
    const applicationId = await createApplication();
    const form = new FormData();
    form.set('kind', 'id_copy');
    form.set('file', new File([new Uint8Array([1, 2, 3])], 'id.png', { type: 'image/png' }));

    const res = await handleUploadDocument(new Request('http://x', { method: 'POST', body: form }), env as any, applicationId);
    expect(res.status).toBe(201);

    const docs = await listApplicationDocuments(env as any, applicationId);
    expect(docs).toHaveLength(1);
    expect(docs[0].kind).toBe('id_copy');
    const stored = await env.DOCS.get(docs[0].r2_key);
    expect(stored).not.toBeNull();
  });

  it('rejects an unsupported file type', async () => {
    const applicationId = await createApplication();
    const form = new FormData();
    form.set('kind', 'id_copy');
    form.set('file', new File([new Uint8Array([1, 2, 3])], 'id.txt', { type: 'text/plain' }));
    const res = await handleUploadDocument(new Request('http://x', { method: 'POST', body: form }), env as any, applicationId);
    expect(res.status).toBe(400);
  });

  it('rejects a file over 5MB', async () => {
    const applicationId = await createApplication();
    const form = new FormData();
    form.set('kind', 'photo');
    form.set('file', new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' }));
    const res = await handleUploadDocument(new Request('http://x', { method: 'POST', body: form }), env as any, applicationId);
    expect(res.status).toBe(413);
  });

  it('404s for an unknown application id', async () => {
    const form = new FormData();
    form.set('kind', 'id_copy');
    form.set('file', new File([new Uint8Array([1])], 'id.png', { type: 'image/png' }));
    const res = await handleUploadDocument(new Request('http://x', { method: 'POST', body: form }), env as any, 'does-not-exist');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd placement-test-worker && npx vitest run src/routes/application.test.ts`
Expected: FAIL — `./application` has no exports yet (module not found).

- [ ] **Step 3: Add the db.ts functions**

Add to `placement-test-worker/src/db.ts` (near `insertResponse`, after the existing session functions):

```ts
export interface ApplicationInput {
  sessionId: string;
  course: string;
  guardianName: string | null;
  idNumber: string;
}

export async function insertApplication(env: Env, input: ApplicationInput): Promise<string> {
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO applications (id, session_id, course, guardian_name, id_number) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, input.sessionId, input.course, input.guardianName, input.idNumber).run();
  return id;
}

export async function getApplicationBySession(env: Env, sessionId: string): Promise<ApplicationRow | null> {
  const row = await env.DB.prepare(`SELECT * FROM applications WHERE session_id = ?`).bind(sessionId).first<ApplicationRow>();
  return row ?? null;
}

export async function getApplicationById(env: Env, id: string): Promise<ApplicationRow | null> {
  const row = await env.DB.prepare(`SELECT * FROM applications WHERE id = ?`).bind(id).first<ApplicationRow>();
  return row ?? null;
}

export async function insertApplicationDocument(env: Env, applicationId: string, kind: DocumentKind, r2Key: string): Promise<string> {
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO application_documents (id, application_id, kind, r2_key) VALUES (?, ?, ?, ?)`
  ).bind(id, applicationId, kind, r2Key).run();
  return id;
}

export async function listApplicationDocuments(env: Env, applicationId: string): Promise<ApplicationDocumentRow[]> {
  const { results } = await env.DB.prepare(`SELECT * FROM application_documents WHERE application_id = ?`)
    .bind(applicationId)
    .all<ApplicationDocumentRow>();
  return results ?? [];
}

export async function getApplicationDocument(env: Env, applicationId: string, documentId: string): Promise<ApplicationDocumentRow | null> {
  const row = await env.DB.prepare(`SELECT * FROM application_documents WHERE id = ? AND application_id = ?`)
    .bind(documentId, applicationId)
    .first<ApplicationDocumentRow>();
  return row ?? null;
}
```

Add `ApplicationRow`, `ApplicationDocumentRow`, `DocumentKind` to the `import type { ... } from './types'` line at the top of `db.ts`.

- [ ] **Step 4: Write the route handlers**

```ts
// placement-test-worker/src/routes/application.ts
import type { Env, DocumentKind } from '../types';
import {
  getSession, getApplicationBySession, getApplicationById, insertApplication, insertApplicationDocument,
} from '../db';

const ALLOWED_DOC_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const DOC_KINDS: DocumentKind[] = ['id_copy', 'photo', 'other'];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export async function handleSubmitApplication(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ sessionId: string; course: string; guardianName?: string; idNumber: string }>();
  if (!body.sessionId || !body.course || !body.idNumber) {
    return json({ error: 'sessionId, course and idNumber are required' }, 400);
  }
  const session = await getSession(env, body.sessionId);
  if (!session || session.status !== 'completed') {
    return json({ error: 'session_not_completed' }, 400);
  }
  const existing = await getApplicationBySession(env, body.sessionId);
  if (existing) return json({ error: 'already_applied' }, 409);
  const applicationId = await insertApplication(env, {
    sessionId: body.sessionId,
    course: body.course,
    guardianName: body.guardianName ?? null,
    idNumber: body.idNumber,
  });
  return json({ applicationId }, 201);
}

export async function handleUploadDocument(req: Request, env: Env, applicationId: string): Promise<Response> {
  const application = await getApplicationById(env, applicationId);
  if (!application) return json({ error: 'not_found' }, 404);

  const form = await req.formData();
  const kind = form.get('kind');
  const file = form.get('file');
  if (typeof kind !== 'string' || !DOC_KINDS.includes(kind as DocumentKind)) {
    return json({ error: 'invalid_kind' }, 400);
  }
  if (!(file instanceof File)) return json({ error: 'file_required' }, 400);
  if (!ALLOWED_DOC_TYPES.has(file.type)) return json({ error: 'unsupported_type' }, 400);
  if (file.size > MAX_DOC_BYTES) return json({ error: 'file_too_large' }, 413);

  const r2Key = `applications/${applicationId}/${kind}-${crypto.randomUUID()}`;
  await env.DOCS.put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  const documentId = await insertApplicationDocument(env, applicationId, kind as DocumentKind, r2Key);
  return json({ documentId }, 201);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd placement-test-worker && npx vitest run src/routes/application.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Typecheck and commit**

Run: `cd placement-test-worker && npx tsc --noEmit`
Expected: PASS.

```bash
git add placement-test-worker/src/db.ts placement-test-worker/src/routes/application.ts placement-test-worker/src/routes/application.test.ts
git commit -m "feat: add student-facing apply and document upload routes"
```

---

### Task 5: Admin application routes + `index.ts` wiring

**Files:**
- Modify: `placement-test-worker/src/db.ts`
- Modify: `placement-test-worker/src/routes/application.ts`
- Modify: `placement-test-worker/src/routes/application.test.ts`
- Modify: `placement-test-worker/src/index.ts`

**Interfaces:**
- Consumes: `getSessionAdminId` (Task 2); `handleSubmitApplication`, `handleUploadDocument` (Task 4).
- Produces: `listApplicationsWithDetails(env, status): Promise<ApplicationWithDetails[]>`, `setApplicationStatus(env, id, status, reviewedBy): Promise<void>` (`db.ts`); `handleAdminListApplications(req, env): Promise<Response>`, `handleAdminSetApplicationStatus(req, env, applicationId): Promise<Response>`, `handleAdminGetDocument(req, env, applicationId, documentId): Promise<Response>` (`routes/application.ts`) — consumed by Task 12's `AdminPanel.astro`.

- [ ] **Step 1: Write the failing tests**

Add to `placement-test-worker/src/routes/application.test.ts`:

```ts
import bcrypt from 'bcryptjs';
import { handleAdminListApplications, handleAdminSetApplicationStatus, handleAdminGetDocument } from './application';
import { issueSessionCookie } from '../auth';

function makeAdminEnv() {
  return {
    DB: createFakeD1(),
    DOCS: createFakeR2(),
    ADMIN_SESSION_TTL_SECONDS: '43200',
    ADMIN_COOKIE_SECRET: 'test-secret-do-not-use-in-prod',
  };
}

describe('admin application routes', () => {
  let adminEnv: ReturnType<typeof makeAdminEnv>;
  let adminCookie: string;

  beforeEach(async () => {
    adminEnv = makeAdminEnv();
    const hash = await bcrypt.hash('correct-horse', 10);
    await adminEnv.DB.prepare(`INSERT INTO admin_users (id, username, password_hash) VALUES ('a1', 'staff', ?)`).bind(hash).run();
    adminCookie = (await issueSessionCookie(adminEnv as any, 'a1')).split(';')[0];
  });

  async function createApplication(env: typeof adminEnv) {
    const studentId = await insertStudent(env as any, { name: 'A', phone: '1', dob: '2000-01-01', locale: 'en' });
    const sessionId = await insertSession(env as any, studentId, 'adults');
    await completeSession(env as any, sessionId, 'B1');
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, course: 'Adults General English', idNumber: '1234567890' }) }),
      env as any
    );
    return ((await res.json()) as any).applicationId as string;
  }

  it('lists applications with student and level details', async () => {
    const applicationId = await createApplication(adminEnv);
    const res = await handleAdminListApplications(new Request('http://x'), adminEnv as any);
    const data = (await res.json()) as any;
    expect(data.applications).toHaveLength(1);
    expect(data.applications[0].application_id).toBe(applicationId);
    expect(data.applications[0].student_name).toBe('A');
    expect(data.applications[0].estimated_level).toBe('B1');
    expect(data.applications[0].status).toBe('pending');
  });

  it('filters applications by status', async () => {
    const applicationId = await createApplication(adminEnv);
    await handleAdminSetApplicationStatus(
      new Request('http://x', { method: 'PATCH', headers: { cookie: adminCookie }, body: JSON.stringify({ status: 'approved' }) }),
      adminEnv as any,
      applicationId
    );
    const pending = (await (await handleAdminListApplications(new Request('http://x?status=pending'), adminEnv as any)).json()) as any;
    expect(pending.applications).toHaveLength(0);
    const approved = (await (await handleAdminListApplications(new Request('http://x?status=approved'), adminEnv as any)).json()) as any;
    expect(approved.applications).toHaveLength(1);
  });

  it('records who approved an application', async () => {
    const applicationId = await createApplication(adminEnv);
    const res = await handleAdminSetApplicationStatus(
      new Request('http://x', { method: 'PATCH', headers: { cookie: adminCookie }, body: JSON.stringify({ status: 'approved' }) }),
      adminEnv as any,
      applicationId
    );
    expect(res.status).toBe(200);
    const list = (await (await handleAdminListApplications(new Request('http://x'), adminEnv as any)).json()) as any;
    expect(list.applications[0].status).toBe('approved');
  });

  it('rejects an invalid status value', async () => {
    const applicationId = await createApplication(adminEnv);
    const res = await handleAdminSetApplicationStatus(
      new Request('http://x', { method: 'PATCH', headers: { cookie: adminCookie }, body: JSON.stringify({ status: 'maybe' }) }),
      adminEnv as any,
      applicationId
    );
    expect(res.status).toBe(400);
  });

  it('streams a stored document back with its content type', async () => {
    const applicationId = await createApplication(adminEnv);
    const form = new FormData();
    form.set('kind', 'photo');
    form.set('file', new File([new Uint8Array([9, 9, 9])], 'p.jpg', { type: 'image/jpeg' }));
    const uploadRes = await handleUploadDocument(new Request('http://x', { method: 'POST', body: form }), adminEnv as any, applicationId);
    const { documentId } = (await uploadRes.json()) as any;

    const res = await handleAdminGetDocument(new Request('http://x'), adminEnv as any, applicationId, documentId);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes)).toEqual([9, 9, 9]);
  });

  it('404s for a document id that does not belong to the application', async () => {
    const applicationId = await createApplication(adminEnv);
    const res = await handleAdminGetDocument(new Request('http://x'), adminEnv as any, applicationId, 'does-not-exist');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd placement-test-worker && npx vitest run src/routes/application.test.ts`
Expected: FAIL — `handleAdminListApplications` etc. not exported yet.

- [ ] **Step 3: Add the db.ts functions**

Add to `placement-test-worker/src/db.ts`:

```ts
export interface ApplicationWithDetails {
  application_id: string;
  student_name: string;
  phone: string;
  estimated_level: string | null;
  course: string;
  guardian_name: string | null;
  id_number: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  documents: Array<{ id: string; kind: DocumentKind }>;
}

export async function listApplicationsWithDetails(env: Env, status: string | null): Promise<ApplicationWithDetails[]> {
  const sql = `SELECT a.id AS application_id, s.name AS student_name, s.phone AS phone, ts.estimated_level AS estimated_level,
      a.course AS course, a.guardian_name AS guardian_name, a.id_number AS id_number, a.status AS status, a.created_at AS created_at
    FROM applications a
    JOIN test_sessions ts ON ts.id = a.session_id
    JOIN students s ON s.id = ts.student_id
    ${status ? 'WHERE a.status = ?' : ''}
    ORDER BY a.created_at DESC`;
  const stmt = status ? env.DB.prepare(sql).bind(status) : env.DB.prepare(sql);
  const { results } = await stmt.all<Omit<ApplicationWithDetails, 'documents'>>();
  const rows = results ?? [];
  const withDocs: ApplicationWithDetails[] = [];
  for (const row of rows) {
    const docs = await listApplicationDocuments(env, row.application_id);
    withDocs.push({ ...row, documents: docs.map((d) => ({ id: d.id, kind: d.kind })) });
  }
  return withDocs;
}

export async function setApplicationStatus(env: Env, id: string, status: 'approved' | 'rejected', reviewedBy: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE applications SET status = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`
  ).bind(status, reviewedBy, id).run();
}
```

- [ ] **Step 4: Add the admin route handlers**

Add to `placement-test-worker/src/routes/application.ts` (imports grow to include `getSessionAdminId` from `'../auth'` and `listApplicationsWithDetails`, `setApplicationStatus`, `getApplicationDocument` from `'../db'`):

```ts
export async function handleAdminListApplications(req: Request, env: Env): Promise<Response> {
  const status = new URL(req.url).searchParams.get('status');
  return json({ applications: await listApplicationsWithDetails(env, status) });
}

export async function handleAdminSetApplicationStatus(req: Request, env: Env, applicationId: string): Promise<Response> {
  const { status } = await req.json<{ status: string }>();
  if (status !== 'approved' && status !== 'rejected') return json({ error: 'invalid_status' }, 400);
  const adminId = await getSessionAdminId(req, env);
  if (!adminId) return json({ error: 'unauthorized' }, 401); // defence in depth -- index.ts's requireAdmin already gates this route
  await setApplicationStatus(env, applicationId, status, adminId);
  return json({ ok: true });
}

export async function handleAdminGetDocument(_req: Request, env: Env, applicationId: string, documentId: string): Promise<Response> {
  const doc = await getApplicationDocument(env, applicationId, documentId);
  if (!doc) return new Response('not found', { status: 404 });
  const object = await env.DOCS.get(doc.r2_key);
  if (!object) return new Response('not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  return new Response(object.body, { headers });
}
```

- [ ] **Step 5: Wire the 5 routes into `index.ts`**

In `placement-test-worker/src/index.ts`, extend the import from `./routes/application`:

```ts
import {
  handleSubmitApplication, handleUploadDocument, handleAdminListApplications,
  handleAdminSetApplicationStatus, handleAdminGetDocument,
} from './routes/application';
```

Add to the `ROUTES` array (after the existing `admin/questions` routes):

```ts
  { method: 'POST', pattern: ['api', 'apply'], handler: (req, env) => handleSubmitApplication(req, env) },
  { method: 'POST', pattern: ['api', 'apply', ':applicationId', 'documents'], handler: (req, env, [applicationId]) => handleUploadDocument(req, env, applicationId) },
  { method: 'GET', pattern: ['api', 'admin', 'applications'], admin: true, handler: (req, env) => handleAdminListApplications(req, env) },
  { method: 'PATCH', pattern: ['api', 'admin', 'applications', ':applicationId'], admin: true, handler: (req, env, [applicationId]) => handleAdminSetApplicationStatus(req, env, applicationId) },
  { method: 'GET', pattern: ['api', 'admin', 'applications', ':applicationId', 'documents', ':documentId'], admin: true, handler: (req, env, [applicationId, documentId]) => handleAdminGetDocument(req, env, applicationId, documentId) },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd placement-test-worker && npx vitest run`
Expected: PASS — full suite, including the new `application.test.ts` (15 tests total in that file) and every pre-existing test file.

- [ ] **Step 7: Typecheck and commit**

Run: `cd placement-test-worker && npx tsc --noEmit`
Expected: PASS.

```bash
git add placement-test-worker/src/db.ts placement-test-worker/src/routes/application.ts placement-test-worker/src/routes/application.test.ts placement-test-worker/src/index.ts
git commit -m "feat: add admin application review routes"
```

---

### Task 6: Update the local-dev fallback server

**Files:**
- Modify: `placement-test-worker/scripts/local-dev.ts`

**Interfaces:**
- Consumes: `createFakeR2` (Task 3).
- Produces: nothing new — this only keeps `npm run dev:fallback` working with the new schema/binding.

- [ ] **Step 1: Add the migration and the DOCS binding**

In `placement-test-worker/scripts/local-dev.ts`, add `'0019_student_applications.sql'` to the `migrations` array (after `'0018_kids_3d_action_illustrations.sql'`), add the import, and add `DOCS` to the `env` object:

```ts
import { createFakeR2 } from '../src/test-utils/fakeR2.ts';
```

```ts
const migrations = [
  // ...unchanged earlier entries...
  '0018_kids_3d_action_illustrations.sql',
  '0019_student_applications.sql',
].map((file) => path.join(workerRoot, 'migrations', file));

const env = {
  DB: createFakeD1(migrations),
  DOCS: createFakeR2(),
  ADMIN_COOKIE_SECRET: 'local-development-only',
  ADMIN_SESSION_TTL_SECONDS: '43200',
  LOCAL_DEV: 'true',
} as any;
```

- [ ] **Step 2: Verify the fallback server still starts**

Run: `cd placement-test-worker && npm run dev:fallback` (background it or run for a few seconds, then Ctrl+C)
Expected: server starts on port 8787 with no thrown error (confirms the migrations array resolves and `createFakeR2()` is a valid `Env.DOCS`).

- [ ] **Step 3: Commit**

```bash
git add placement-test-worker/scripts/local-dev.ts
git commit -m "chore: wire the applications migration and DOCS binding into local-dev fallback"
```

---

### Task 7: i18n copy + page metadata

**Files:**
- Modify: `src/i18n/ui.ts`
- Modify: `src/i18n/pages.ts`

**Interfaces:**
- Produces: `apply.*` translation keys (both `en` and `ar`); `pageMeta.apply`, `PATHS.apply = 'apply'` — consumed by Task 9 (`ApplicationForm.astro`), Task 10 (`apply.astro`), Task 11 (`ResultBooking.astro`).

- [ ] **Step 1: Add the `apply.*` keys to the `en` block**

In `src/i18n/ui.ts`, add after the `'placementTest.false': 'False',` line:

```ts
    'apply.heading': 'Complete your application',
    'apply.intro': 'You’re almost done — confirm your course and add a few more details so admissions can process your enrollment.',
    'apply.course': 'Course',
    'apply.chooseCourse': 'Select a course',
    'apply.guardianName': 'Guardian name',
    'apply.idNumber': 'National ID / passport number',
    'apply.idCopy': 'ID or passport copy',
    'apply.photo': 'Photo',
    'apply.submit': 'Submit application',
    'apply.submittedHeading': 'Application received',
    'apply.submittedIntro': 'Thanks — admissions will review your application and contact you on WhatsApp.',
    'apply.alreadyApplied': 'You’ve already submitted an application for this test session.',
    'apply.missingSession': 'We couldn’t find your placement test session. Please start from the placement test page.',
    'apply.backToTest': 'Back to placement test',
    'apply.error': 'Something went wrong — please try again.',
    'apply.continueButton': 'Continue to application',
```

- [ ] **Step 2: Add the matching `ar` keys**

In the same file's `ar` block, add after the corresponding `'placementTest.false': 'خطأ',` line (match wherever the `en` false-key sits in `ar`):

```ts
    'apply.heading': 'أكمل طلب التسجيل',
    'apply.intro': 'أوشكت على الانتهاء — أكّد الدورة وأضف بعض التفاصيل ليتمكن فريق القبول من إتمام تسجيلك.',
    'apply.course': 'الدورة',
    'apply.chooseCourse': 'اختر دورة',
    'apply.guardianName': 'اسم ولي الأمر',
    'apply.idNumber': 'رقم الهوية الوطنية / جواز السفر',
    'apply.idCopy': 'صورة الهوية أو جواز السفر',
    'apply.photo': 'صورة شخصية',
    'apply.submit': 'إرسال الطلب',
    'apply.submittedHeading': 'تم استلام طلبك',
    'apply.submittedIntro': 'شكراً — سيراجع فريق القبول طلبك ويتواصل معك عبر واتساب.',
    'apply.alreadyApplied': 'لقد أرسلت طلباً لهذه الجلسة من قبل.',
    'apply.missingSession': 'لم نتمكن من العثور على جلسة اختبار تحديد المستوى. يرجى البدء من صفحة الاختبار.',
    'apply.backToTest': 'العودة إلى اختبار تحديد المستوى',
    'apply.error': 'حدث خطأ ما — يرجى المحاولة مرة أخرى.',
    'apply.continueButton': 'متابعة إلى الطلب',
```

- [ ] **Step 3: Add the `apply` page entry to `pages.ts`**

In `src/i18n/pages.ts`, add to the `pageMeta` object (after the `placementTest` entry, before `terms`):

```ts
  apply: {
    en: {
      title: 'Apply — ELC English Courses in Jeddah',
      description: 'Complete your ELC enrollment application after your placement test result.',
      crumb: 'Apply',
      hero: { title: 'Apply', subtitle: 'Confirm your course and finish your enrollment application.' },
    },
    ar: {
      title: 'التقديم — معهد صرح المعرفة',
      description: 'أكمل طلب التسجيل في معهد صرح المعرفة بعد نتيجة اختبار تحديد المستوى.',
      crumb: 'التقديم',
      hero: { title: 'التقديم', subtitle: 'أكّد دورتك وأكمل طلب التسجيل.' },
    },
  },
```

And add to the `PATHS` map:

```ts
  apply: 'apply',
```

- [ ] **Step 4: Typecheck**

Run: `npx astro check` (or `npx tsc --noEmit` if `astro check` isn't configured — check `package.json` first; use whichever the project already runs)
Expected: PASS — `pageMeta` satisfies `Record<string, Record<Locale, PageMeta>>`, and every `ui.en`/`ui.ar` key set still matches (`useTranslations`'s `t()` type is `keyof typeof ui['en']`, so a key present in one locale but not the other fails the build, not just this check).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/ui.ts src/i18n/pages.ts
git commit -m "feat: add apply page copy and route metadata"
```

---

### Task 8: `placementApi.ts` client functions

**Files:**
- Modify: `src/lib/placementApi.ts`

**Interfaces:**
- Consumes: `POST /api/apply`, `POST /api/apply/:id/documents` (Task 4).
- Produces: `submitApplication(sessionId: string, fields: { course: string; guardianName?: string; idNumber: string }): Promise<{ applicationId: string } | { error: string }>`, `uploadDocument(applicationId: string, kind: 'id_copy' | 'photo' | 'other', file: File): Promise<{ documentId: string } | { error: string }>` — consumed by Task 9's `ApplicationForm.astro`.

- [ ] **Step 1: Add the functions**

Add to `src/lib/placementApi.ts`, after `createBooking`:

```ts
export interface ApplicationFields {
  course: string;
  guardianName?: string;
  idNumber: string;
}

export function submitApplication(sessionId: string, fields: ApplicationFields) {
  // 409 means this session already has an application -- the caller shows
  // "already applied" instead of treating it as a transport failure.
  return request<{ applicationId: string } | { error: string }>('/api/apply', {
    method: 'POST',
    body: JSON.stringify({ sessionId, ...fields }),
    expectedErrors: [409],
  });
}

export async function uploadDocument(
  applicationId: string,
  kind: 'id_copy' | 'photo' | 'other',
  file: File
): Promise<{ documentId: string } | { error: string }> {
  const form = new FormData();
  form.set('kind', kind);
  form.set('file', file);
  const res = await fetch(`${BASE}/api/apply/${applicationId}/documents`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  const data = (await res.json()) as { documentId: string } | { error: string };
  if (!res.ok && !('error' in data)) throw new Error(`document upload failed: ${res.status}`);
  return data;
}
```

Note: `uploadDocument` doesn't go through the shared `request()` helper — that helper always sets `content-type: application/json`, which would break the browser's automatic `multipart/form-data; boundary=...` header for a `FormData` body.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json` (or `npx astro check`, matching whichever the project already runs — confirm via `package.json`)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/placementApi.ts
git commit -m "feat: add submitApplication and uploadDocument client calls"
```

---

### Task 9: `ApplicationForm.astro`

**Files:**
- Create: `src/components/placement-test/ApplicationForm.astro`

**Interfaces:**
- Consumes: `submitApplication`, `uploadDocument` (Task 8); `apply.*` i18n keys (Task 7); `CollectionEntry<'courses'>[]` (existing `astro:content`, same shape `register.astro` already passes to `RegistrationExperience.astro`).
- Produces: an Astro component with `Props { locale: Locale; t: ReturnType<typeof useTranslations>; sessionId: string | null; courses: CollectionEntry<'courses'>[] }` — consumed by Task 10's `apply.astro`.

- [ ] **Step 1: Write the component**

```astro
---
// src/components/placement-test/ApplicationForm.astro
import type { CollectionEntry } from 'astro:content';
import type { Locale, useTranslations } from '../../i18n/ui';

export interface Props {
  locale: Locale;
  t: ReturnType<typeof useTranslations>;
  sessionId: string | null;
  courses: CollectionEntry<'courses'>[];
}
const { locale, t, sessionId, courses } = Astro.props;
---

{!sessionId && (
  <section class="card">
    <p>{t('apply.missingSession')}</p>
    <a class="btn btn-primary" href={`/${locale}/placement-test/`}>{t('apply.backToTest')}</a>
  </section>
)}

{sessionId && (
  <form
    id="application-form"
    class="card"
    data-locale={locale}
    data-session-id={sessionId}
    data-already-applied-message={t('apply.alreadyApplied')}
    data-error-message={t('apply.error')}
  >
    <header class="card-heading">
      <h2>{t('apply.heading')}</h2>
      <p class="card-intro">{t('apply.intro')}</p>
    </header>
    <div class="form-grid">
      <label>
        <span>{t('apply.course')}</span>
        <select name="course" required>
          <option value="">{t('apply.chooseCourse')}</option>
          {courses.map((course) => <option value={course.data.title}>{course.data.title}</option>)}
        </select>
      </label>
      <label id="guardian-field" hidden>
        <span>{t('apply.guardianName')}</span>
        <input name="guardianName" type="text" autocomplete="name" />
      </label>
      <label>
        <span>{t('apply.idNumber')}</span>
        <input name="idNumber" type="text" required />
      </label>
      <label>
        <span>{t('apply.idCopy')}</span>
        <input name="idCopy" type="file" accept="image/jpeg,image/png,application/pdf" required />
      </label>
      <label>
        <span>{t('apply.photo')}</span>
        <input name="photo" type="file" accept="image/jpeg,image/png" required />
      </label>
    </div>
    <button type="submit" class="btn btn-primary">{t('apply.submit')}</button>
    <p id="application-error" class="form-error" role="alert" hidden></p>
  </form>
)}

<section id="application-done" class="card" hidden>
  <h2>{t('apply.submittedHeading')}</h2>
  <p>{t('apply.submittedIntro')}</p>
</section>

<script>
  import { submitApplication, uploadDocument } from '../../lib/placementApi';

  const form = document.getElementById('application-form') as HTMLFormElement | null;
  if (form) {
    const errorEl = document.getElementById('application-error') as HTMLElement;
    const doneEl = document.getElementById('application-done') as HTMLElement;
    const sessionId = form.dataset.sessionId!;
    const alreadyAppliedMessage = form.dataset.alreadyAppliedMessage!;
    const errorMessage = form.dataset.errorMessage!;

    // Kids track sessions need a guardian name; there's no track flag on this
    // form, so infer it the same way the rest of the funnel would show it --
    // by asking the worker via the session the student already has. Simpler:
    // always show the field but only require it when the placement result
    // (recorded earlier in this browser tab via sessionStorage, see
    // ResultBooking.astro) was a kids-track session.
    const guardianField = document.getElementById('guardian-field') as HTMLElement;
    const guardianInput = guardianField.querySelector('input') as HTMLInputElement;
    if (sessionStorage.getItem('placement:track') === 'kids') {
      guardianField.hidden = false;
      guardianInput.required = true;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorEl.hidden = true;
      const data = new FormData(form);
      const course = String(data.get('course') ?? '');
      const guardianName = String(data.get('guardianName') ?? '') || undefined;
      const idNumber = String(data.get('idNumber') ?? '');
      const idCopy = data.get('idCopy') as File;
      const photo = data.get('photo') as File;

      const result = await submitApplication(sessionId, { course, guardianName, idNumber });
      if ('error' in result) {
        errorEl.textContent = result.error === 'already_applied' ? alreadyAppliedMessage : errorMessage;
        errorEl.hidden = false;
        return;
      }

      await Promise.all([
        uploadDocument(result.applicationId, 'id_copy', idCopy),
        uploadDocument(result.applicationId, 'photo', photo),
      ]);

      form.hidden = true;
      doneEl.hidden = false;
      doneEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
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
  .card-heading h2 { margin: 0 0 0.45rem; color: var(--color-navy); font-size: clamp(1.45rem, 4vw, 2rem); }
  .card-intro { max-width: 38rem; margin: 0; color: var(--color-ink-muted); font-size: 0.92rem; }
  .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  .card label { display: flex; flex-direction: column; gap: 0.45rem; color: var(--color-navy); font-size: 0.88rem; font-weight: 700; }
  .card input, .card select {
    width: 100%;
    min-height: 3.25rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 0.85rem;
    color: var(--color-ink);
    background: var(--color-bg-raised);
    font: inherit;
  }
  .card input:focus, .card select:focus {
    outline: 3px solid rgb(182 23 51 / 0.12);
    border-color: var(--color-primary);
  }
  .card .btn { justify-content: center; width: 100%; min-height: 3.5rem; margin-top: 0.25rem; }
  .form-error {
    margin: -0.5rem 0 0;
    padding: 0.75rem 0.9rem;
    border-radius: 0.85rem;
    color: var(--color-primary-text);
    background: rgb(182 23 51 / 0.09);
    font-size: 0.88rem;
    font-weight: 700;
    text-align: center;
  }
  @media (max-width: 580px) {
    .form-grid { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 2: Record the placement track in sessionStorage**

`ApplicationForm.astro`'s guardian-field logic reads `sessionStorage.getItem('placement:track')`, which doesn't exist yet. Add it where the track is already known — `src/components/placement-test/RegistrationForm.astro`'s submit handler, right before it dispatches `placement:register`:

Modify `src/components/placement-test/RegistrationForm.astro`'s submit listener (find the `form.addEventListener('submit', ...)` block near the end of its `<script>`):

```ts
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    sessionStorage.setItem('placement:track', String(data.track ?? 'adults'));
    document.dispatchEvent(
      new CustomEvent('placement:register', { detail: { ...data, locale: form.dataset.locale } })
    );
  });
```

(Only the added `sessionStorage.setItem(...)` line changes; everything else in that handler stays as-is.)

- [ ] **Step 3: Verify the build picks up the new component**

Run: `npx astro build`
Expected: build succeeds (the component isn't referenced by any page yet in this task, so this just confirms it's syntactically valid Astro/TypeScript — Task 10 wires it in and gets a real render check).

- [ ] **Step 4: Commit**

```bash
git add src/components/placement-test/ApplicationForm.astro src/components/placement-test/RegistrationForm.astro
git commit -m "feat: add ApplicationForm component"
```

---

### Task 10: `/apply` page

**Files:**
- Create: `src/pages/[lang]/apply.astro`

**Interfaces:**
- Consumes: `ApplicationForm` (Task 9); `apply` page meta (Task 7); same `Layout`/`PageHero`/`breadcrumbSchema`/`localePaths`/`meta`/`trail` pattern as `src/pages/[lang]/register.astro`.

- [ ] **Step 1: Write the page**

```astro
---
// src/pages/[lang]/apply.astro
import { getCollection } from 'astro:content';
import Layout from '../../layouts/Layout.astro';
import PageHero from '../../components/PageHero.astro';
import ApplicationForm from '../../components/placement-test/ApplicationForm.astro';
import { breadcrumbSchema } from '../../lib/schema';
import { localePaths, meta, trail, heroKicker } from '../../i18n/pages';
import { useTranslations, type Locale } from '../../i18n/ui';

export const getStaticPaths = localePaths;

const locale = Astro.params.lang as Locale;
const t = useTranslations(locale);
const { title, description, hero } = meta('apply', locale);
const sessionId = Astro.url.searchParams.get('session');

const courses = await getCollection('courses', (e) => e.id.startsWith(`${locale}/`) && !e.data.draft);
---

<Layout
  locale={locale}
  path="/apply"
  title={title}
  description={description}
  jsonLd={breadcrumbSchema(trail(locale, ['apply']))}
>
  <PageHero kicker={heroKicker[locale]} title={hero!.title} subtitle={hero!.subtitle} />
  <main class="container apply-wrap">
    <ApplicationForm locale={locale} t={t} sessionId={sessionId} courses={courses} />
  </main>
</Layout>

<style>
  .apply-wrap {
    max-width: 54rem;
    margin-inline: auto;
    padding-block: clamp(2rem, 5vw, 5rem);
  }
</style>
```

- [ ] **Step 2: Verify it builds**

Run: `npx astro build`
Expected: PASS — both `/en/apply/index.html` and `/ar/apply/index.html` appear under `dist/`.

Run: `find dist -name apply -o -path '*apply/index.html'` (or `dir dist\en\apply` on Windows) to confirm.

- [ ] **Step 3: Commit**

```bash
git add src/pages/\[lang\]/apply.astro
git commit -m "feat: add the /apply page"
```

---

### Task 11: Link from `ResultBooking.astro` to `/apply`

**Files:**
- Modify: `src/components/placement-test/ResultBooking.astro`

**Interfaces:**
- Consumes: `/apply?session=<id>` route (Task 10); `apply.continueButton` i18n key (Task 7).
- Produces: nothing new for later tasks — this is the funnel's last edit.

- [ ] **Step 1: Add the link, shown once a slot is booked**

In `src/components/placement-test/ResultBooking.astro`, add a new element after the existing `#pt-whatsapp` link in the template:

```astro
  <a id="pt-whatsapp" class="btn btn-primary" hidden target="_blank" rel="noopener">
    {t('placementTest.whatsappConfirm')}
  </a>
  <a id="pt-apply" class="btn btn-outline" hidden href="#">
    {t('apply.continueButton')}
  </a>
```

In the `<script>` block, capture the new element alongside `waLink`:

```ts
  const waLink = document.getElementById('pt-whatsapp') as HTMLAnchorElement;
  const applyLink = document.getElementById('pt-apply') as HTMLAnchorElement;
```

And inside the slot-button click handler, right after `waLink.hidden = false;`, point the apply link at the current session and reveal it:

```ts
        waLink.href = `https://wa.me/${whatsappNumber}?text=${text}`;
        waLink.hidden = false;
        applyLink.href = `/${locale}/apply?session=${detail.sessionId}`;
        applyLink.hidden = false;
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `npx astro build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/placement-test/ResultBooking.astro
git commit -m "feat: link from the booked test slot to the application form"
```

---

### Task 12: Applications card in `AdminPanel.astro`

**Files:**
- Modify: `src/components/placement-test/AdminPanel.astro`

**Interfaces:**
- Consumes: `GET /api/admin/applications`, `PATCH /api/admin/applications/:id`, `GET /api/admin/applications/:id/documents/:docId` (Task 5).

- [ ] **Step 1: Add the card markup**

In `src/components/placement-test/AdminPanel.astro`, add a new `<div class="card">` inside `#admin-dashboard`, after the "Question bank" card:

```astro
  <div class="card">
    <h2>Applications</h2>
    <label>
      Filter by status
      <select id="application-status-filter">
        <option value="">All</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
    </label>
    <ul id="application-list" class="admin-list"></ul>
  </div>
```

- [ ] **Step 2: Load and render applications**

Extend `loadAll()`'s `Promise.all` to also fetch applications, and add a render function. Replace the existing `loadAll` function's opening lines and add the new rendering block at the end of the function (before its closing `}`):

```ts
  async function loadAll() {
    const [{ slots }, { bookings }, { questions }, { applications }] = await Promise.all([
      api('/api/admin/slots'),
      api('/api/admin/bookings'),
      api('/api/admin/questions'),
      api(`/api/admin/applications${statusFilter.value ? `?status=${statusFilter.value}` : ''}`),
    ]);
```

(Everything else already inside `loadAll` — the slot/booking/question rendering — stays unchanged.)

Add, right before `loadAll`'s closing brace:

```ts
    const applicationList = document.getElementById('application-list')!;
    applicationList.innerHTML = '';
    applications.forEach((a: any) => {
      const li = document.createElement('li');
      const summary = document.createElement('span');
      summary.textContent = `${a.student_name} (${a.phone}) — ${a.course} — level ${a.estimated_level ?? '—'} — ${a.status}`;
      li.appendChild(summary);

      a.documents.forEach((doc: any) => {
        const link = document.createElement('a');
        link.href = `${BASE}/api/admin/applications/${a.application_id}/documents/${doc.id}`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.className = 'btn btn-outline';
        link.textContent = doc.kind;
        li.appendChild(link);
      });

      if (a.status === 'pending') {
        const approve = document.createElement('button');
        approve.type = 'button';
        approve.className = 'btn btn-primary';
        approve.textContent = 'Approve';
        approve.addEventListener('click', async () => {
          await api(`/api/admin/applications/${a.application_id}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
          loadAll();
        });
        const reject = document.createElement('button');
        reject.type = 'button';
        reject.className = 'btn btn-outline';
        reject.textContent = 'Reject';
        reject.addEventListener('click', async () => {
          await api(`/api/admin/applications/${a.application_id}`, { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) });
          loadAll();
        });
        li.appendChild(approve);
        li.appendChild(reject);
      }

      applicationList.appendChild(li);
    });
  }
```

Add the filter element reference near the top of the `<script>` block (alongside where `trackSelect`/`levelSelect` are declared) and its change listener:

```ts
  const statusFilter = document.getElementById('application-status-filter') as HTMLSelectElement;
  statusFilter.addEventListener('change', loadAll);
```

- [ ] **Step 2: Verify the build succeeds**

Run: `npx astro build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/placement-test/AdminPanel.astro
git commit -m "feat: add applications review card to the admin panel"
```

---

### Task 13: Playwright e2e — book a slot, apply, see confirmation

**Files:**
- Create: `tests/e2e/application.spec.ts`

**Interfaces:**
- Consumes: the full flow built in Tasks 9–12, running against the real built site + real Worker (via `wrangler dev`), same as `tests/e2e/placement-test.spec.ts`.

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/application.spec.ts
import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

function failOnConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`${err.name}: ${err.message}`));
  return errors;
}

test('adult student completes the placement test, books a slot, and submits an application', async ({ page }) => {
  const errors = failOnConsoleErrors(page);

  await page.goto('/en/placement-test/');
  await page.getByLabel('Full name').fill('Application Smoke Test');
  await page.getByLabel('WhatsApp number').fill('+966500000001');
  await page.getByLabel('Date of birth').fill('1995-01-01'); // well over 11, stays on the adults track
  await page.getByRole('button', { name: 'Start test' }).click();

  // Answer every adults-track question with the first available option until
  // the result card appears -- the adults bank runs a fixed sequential walk
  // (see placement-test-worker/src/db.ts/pickNextQuestion), so this always
  // terminates.
  const resultCard = page.locator('#placement-result');
  for (let i = 0; i < 100 && !(await resultCard.isVisible()); i++) {
    const option = page.locator('#pt-options button').first();
    if (await option.isVisible().catch(() => false)) {
      await option.click();
    } else {
      const skip = page.getByRole('button', { name: /skip/i });
      if (await skip.isVisible().catch(() => false)) await skip.click();
    }
    await page.waitForTimeout(150);
  }
  await expect(resultCard).toBeVisible({ timeout: 20_000 });

  const slotButton = page.locator('#pt-slots button').first();
  await expect(slotButton).toBeVisible({ timeout: 10_000 });
  await slotButton.click();

  const applyLink = page.locator('#pt-apply');
  await expect(applyLink).toBeVisible();
  await applyLink.click();

  await expect(page.getByRole('heading', { name: 'Complete your application' })).toBeVisible();
  await page.getByLabel('Course').selectOption({ index: 1 });
  await page.getByLabel('National ID / passport number').fill('1234567890');
  await page.getByLabel('ID or passport copy').setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: Buffer.from([1, 2, 3]) });
  await page.getByLabel('Photo').setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([4, 5, 6]) });
  await page.getByRole('button', { name: 'Submit application' }).click();

  await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible({ timeout: 10_000 });

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
```

- [ ] **Step 2: Run it locally against a running Worker + preview build**

This mirrors the `placement-test-smoke` CI job in `.github/workflows/ci.yml` (it will pick up the new spec file automatically — Playwright runs every `*.spec.ts` under `testDir`):

```bash
cd placement-test-worker && npm run db:migrate:local && npm run dev &
cd .. && npx astro build
PUBLIC_PLACEMENT_API_URL=http://localhost:8787 npx astro preview --port 4322 &
SMOKE_BASE_URL=http://localhost:4322 npx playwright test tests/e2e/application.spec.ts
```

Expected: PASS. If `wrangler dev` fails to start in your environment (the sandboxed dev environment this plan was written in can't run real `workerd` — see `test-utils/fakeD1.ts`'s header comment), this step runs in CI instead; note that in the task's completion report rather than skip the test.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/application.spec.ts
git commit -m "test: add e2e coverage for the booking-to-application flow"
```

---

## Self-Review Notes

- **Spec coverage:** every spec section has a task — data model (Task 1), worker routes (Tasks 4–5), frontend apply page/form (Tasks 9–10), `ResultBooking` link (Task 11), admin review UI (Task 12), error handling (409 duplicate in Task 4, incomplete-upload tolerance is inherent since the application row is created before documents in Task 4's design), testing (Tasks 4, 5, 13).
- **Type consistency checked:** `DocumentKind` (Task 1) is used identically in `db.ts`, `routes/application.ts`, and `AdminPanel.astro`'s document `kind` strings (`'id_copy' | 'photo' | 'other'`) throughout. `ApplicationWithDetails.documents` (Task 5) matches what `AdminPanel.astro` (Task 12) iterates (`a.documents.forEach((doc) => ...)` using `doc.id`/`doc.kind`).
- **No placeholders:** Task 9's error copy is threaded through `data-already-applied-message`/`data-error-message` attributes populated by `t()`, matching `ResultBooking.astro`'s `data-message-template` convention, instead of hardcoding bilingual fallback strings in the client script.
