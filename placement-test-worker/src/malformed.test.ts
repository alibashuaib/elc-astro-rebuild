import { describe, it, expect } from 'vitest';
import { createFakeD1 } from './test-utils/fakeD1';
import worker from './index';

const BAD_BODIES = ['', '{bad', 'null', '[]', '"s"'];
const VALID_START = { name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en' };

function makeEnv() {
  return {
    DB: createFakeD1(),
    ADMIN_SESSION_TTL_SECONDS: '43200',
    ADMIN_COOKIE_SECRET: 'test-secret',
  };
}

async function send(env: ReturnType<typeof makeEnv>, method: string, path: string, body: string, cookie?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  return worker.fetch(new Request(`http://x${path}`, { method, headers, body }), env as any);
}

async function expectInvalidJson(res: Response) {
  expect(res.status).toBe(400);
  expect(res.headers.get('content-type')).toContain('application/json');
  expect(((await res.json()) as any).error).toBe('invalid_json');
}

describe('malformed JSON bodies on student routes', () => {
  it('control: a valid start body still returns 200 with a sessionId', async () => {
    const res = await send(makeEnv(), 'POST', '/api/session', JSON.stringify(VALID_START));
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).sessionId).toBeDefined();
  });

  for (const bad of BAD_BODIES) {
    const label = JSON.stringify(bad);

    it(`POST /api/session ${label} -> 400`, async () => {
      await expectInvalidJson(await send(makeEnv(), 'POST', '/api/session', bad));
    });

    it(`POST /api/session/:id/answer ${label} -> 400`, async () => {
      const env = makeEnv();
      const start = (await (await send(env, 'POST', '/api/session', JSON.stringify(VALID_START))).json()) as any;
      await expectInvalidJson(await send(env, 'POST', `/api/session/${start.sessionId}/answer`, bad));
    });

    it(`POST /api/bookings ${label} -> 400`, async () => {
      await expectInvalidJson(await send(makeEnv(), 'POST', '/api/bookings', bad));
    });

    it(`POST /api/apply ${label} -> 400`, async () => {
      await expectInvalidJson(await send(makeEnv(), 'POST', '/api/apply', bad));
    });
  }
});
