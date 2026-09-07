import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { createFakeD1 } from '../test-utils/fakeD1';
import { createFakeR2 } from '../test-utils/fakeR2';
import {
  handleSubmitApplication, handleUploadDocument, handleAdminListApplications,
  handleAdminSetApplicationStatus, handleAdminGetDocument,
} from './application';
import { insertStudent, insertSession, completeSession, listApplicationDocuments } from '../db';
import { issueSessionCookie } from '../auth';

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
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="document-${documentId}"`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes)).toEqual([9, 9, 9]);
  });

  it('404s for a document id that does not belong to the application', async () => {
    const applicationId = await createApplication(adminEnv);
    const res = await handleAdminGetDocument(new Request('http://x'), adminEnv as any, applicationId, 'does-not-exist');
    expect(res.status).toBe(404);
  });
});
