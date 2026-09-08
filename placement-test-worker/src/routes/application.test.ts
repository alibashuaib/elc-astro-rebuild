import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { createFakeD1 } from '../test-utils/fakeD1';
import { handleSubmitApplication, handleAdminListApplications, handleAdminSetApplicationStatus } from './application';
import { insertStudent, insertSession, completeSession } from '../db';
import { issueSessionCookie } from '../auth';

function makeEnv() {
  return {
    DB: createFakeD1(),
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

const baseFields = { course: 'Adults General English', idNumber: '1234567890', idType: 'national_id', email: 'student@example.com' };

describe('POST /apply', () => {
  it('creates an application for a completed session', async () => {
    const sessionId = await completedSession();
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, ...baseFields }) }),
      env as any
    );
    expect(res.status).toBe(201);
    const { applicationId } = (await res.json()) as any;
    expect(typeof applicationId).toBe('string');
  });

  it('rejects a missing idNumber', async () => {
    const sessionId = await completedSession();
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, ...baseFields, idNumber: undefined }) }),
      env as any
    );
    expect(res.status).toBe(400);
  });

  it('rejects a missing email', async () => {
    const sessionId = await completedSession();
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, ...baseFields, email: undefined }) }),
      env as any
    );
    expect(res.status).toBe(400);
  });

  it('rejects a malformed email', async () => {
    const sessionId = await completedSession();
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, ...baseFields, email: 'not-an-email' }) }),
      env as any
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_email' });
  });

  it('rejects an invalid idType', async () => {
    const sessionId = await completedSession();
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, ...baseFields, idType: 'drivers_license' }) }),
      env as any
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_id_type' });
  });

  it('accepts iqama and passport as idType values', async () => {
    for (const idType of ['iqama', 'passport']) {
      const sessionId = await completedSession();
      const res = await handleSubmitApplication(
        new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, ...baseFields, idType }) }),
        env as any
      );
      expect(res.status).toBe(201);
    }
  });

  it('refuses a session that never completed', async () => {
    const studentId = await insertStudent(env as any, { name: 'A', phone: '1', dob: '2000-01-01', locale: 'en' });
    const sessionId = await insertSession(env as any, studentId, 'adults');
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, ...baseFields }) }),
      env as any
    );
    expect(res.status).toBe(400);
  });

  it('refuses a second application for the same session', async () => {
    const sessionId = await completedSession();
    const body = JSON.stringify({ sessionId, ...baseFields });
    await handleSubmitApplication(new Request('http://x', { method: 'POST', body }), env as any);
    const second = await handleSubmitApplication(new Request('http://x', { method: 'POST', body }), env as any);
    expect(second.status).toBe(409);
  });

  it('rejects a kids-track application with no guardian name', async () => {
    const sessionId = await completedSession('kids');
    const res = await handleSubmitApplication(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, ...baseFields, course: 'Kids General English' }) }),
      env as any
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'guardian_name_required' });
  });

  it('accepts a kids-track application with a guardian name', async () => {
    const sessionId = await completedSession('kids');
    const res = await handleSubmitApplication(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ sessionId, ...baseFields, course: 'Kids General English', guardianName: 'Parent Name' }),
      }),
      env as any
    );
    expect(res.status).toBe(201);
  });
});

function makeAdminEnv() {
  return {
    DB: createFakeD1(),
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
      new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId, ...baseFields }) }),
      env as any
    );
    return ((await res.json()) as any).applicationId as string;
  }

  it('lists applications with student, level, email and id-type details', async () => {
    const applicationId = await createApplication(adminEnv);
    const res = await handleAdminListApplications(new Request('http://x'), adminEnv as any);
    const data = (await res.json()) as any;
    expect(data.applications).toHaveLength(1);
    expect(data.applications[0].application_id).toBe(applicationId);
    expect(data.applications[0].student_name).toBe('A');
    expect(data.applications[0].estimated_level).toBe('B1');
    expect(data.applications[0].status).toBe('pending');
    expect(data.applications[0].email).toBe('student@example.com');
    expect(data.applications[0].id_type).toBe('national_id');
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
});
