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
