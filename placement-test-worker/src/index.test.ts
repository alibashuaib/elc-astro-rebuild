import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from './test-utils/fakeD1';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import worker from './index';

function makeEnv() {
  return {
    DB: createFakeD1([
      path.join(__dirname, '../migrations/0001_init.sql'),
      path.join(__dirname, '../migrations/0002_seed_questions.sql'),
    ]),
    ADMIN_SESSION_TTL_SECONDS: '43200',
    ADMIN_COOKIE_SECRET: 'test-secret',
  };
}

let env: ReturnType<typeof makeEnv>;
beforeEach(() => {
  env = makeEnv();
});

describe('router', () => {
  it('handles OPTIONS preflight with CORS headers and 204', async () => {
    const req = new Request('http://x/api/session', { method: 'OPTIONS' });
    const res = await worker.fetch(req, env as any);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('dispatches POST /api/session to handleStartSession', async () => {
    const req = new Request('http://x/api/session', {
      method: 'POST',
      body: JSON.stringify({ name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en' }),
    });
    const res = await worker.fetch(req, env as any);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.sessionId).toBeDefined();
    expect(data.prompt).toBeDefined();
  });

  it('returns 401 for GET /api/admin/slots with no auth cookie', async () => {
    const req = new Request('http://x/api/admin/slots', { method: 'GET' });
    const res = await worker.fetch(req, env as any);
    expect(res.status).toBe(401);
  });

  it('logs in and allows a follow-up authenticated request to a gated route', async () => {
    const hash = await bcrypt.hash('correct-horse', 10);
    await env.DB.prepare(`INSERT INTO admin_users (id, username, password_hash) VALUES ('a1', 'staff', ?)`).bind(hash).run();

    const loginReq = new Request('http://x/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff', password: 'correct-horse' }),
    });
    const loginRes = await worker.fetch(loginReq, env as any);
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get('set-cookie');
    expect(cookie).toBeTruthy();
    const cookieValue = cookie!.split(';')[0];

    const slotsReq = new Request('http://x/api/admin/slots', {
      method: 'GET',
      headers: { cookie: cookieValue },
    });
    const slotsRes = await worker.fetch(slotsReq, env as any);
    expect(slotsRes.status).toBe(200);
    const data = (await slotsRes.json()) as any;
    expect(data.slots).toBeDefined();
  });

  it('returns 404 for an unknown path', async () => {
    const req = new Request('http://x/api/nonexistent', { method: 'GET' });
    const res = await worker.fetch(req, env as any);
    expect(res.status).toBe(404);
  });
});
