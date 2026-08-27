import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from './test-utils/fakeD1';
import bcrypt from 'bcryptjs';
import worker from './index';

function makeEnv() {
  return {
    DB: createFakeD1(),
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

  // Loopback origins exist so `astro dev` (which picks whatever port is free)
  // can call the Worker without hard-coding one. In production that same rule
  // let any page served from the visitor's own machine make credentialed
  // cross-origin calls to the live admin API, so it is now gated on LOCAL_DEV.
  describe('loopback CORS origins', () => {
    function preflightFrom(origin: string, envOverrides: Record<string, unknown> = {}) {
      return worker.fetch(
        new Request('http://x/api/session', { method: 'OPTIONS', headers: { origin } }),
        { ...(env as any), ...envOverrides }
      );
    }

    it('echoes a loopback origin back when running locally', async () => {
      const res = await preflightFrom('http://localhost:4321', { LOCAL_DEV: 'true' });
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:4321');
    });

    it.each(['http://localhost:4321', 'http://127.0.0.1:8788'])(
      'does not echo %s back in production',
      async (origin) => {
        const res = await preflightFrom(origin);
        expect(res.headers.get('access-control-allow-origin')).toBe('https://elc.com.sa');
      }
    );

    it('still echoes the production site origin back', async () => {
      const res = await preflightFrom('https://elc.com.sa');
      expect(res.headers.get('access-control-allow-origin')).toBe('https://elc.com.sa');
    });
  });

  it('returns 404 for an unknown path', async () => {
    const req = new Request('http://x/api/nonexistent', { method: 'GET' });
    const res = await worker.fetch(req, env as any);
    expect(res.status).toBe(404);
  });
});
