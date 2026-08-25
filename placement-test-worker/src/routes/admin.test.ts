import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../test-utils/fakeD1';
import bcrypt from 'bcryptjs';
import { handleAdminLogin, handleAdminCreateSlot, handleAdminListSlots } from './admin';
import { verifyAdminSession } from '../auth';
import path from 'node:path';

function makeEnv() {
  return {
    DB: createFakeD1([
      path.join(__dirname, '../../migrations/0001_init.sql'),
      path.join(__dirname, '../../migrations/0002_seed_questions.sql'),
    ]),
    ADMIN_SESSION_TTL_SECONDS: '43200',
    ADMIN_COOKIE_SECRET: 'test-secret-do-not-use-in-prod',
  };
}

let env: ReturnType<typeof makeEnv>;
beforeEach(async () => {
  env = makeEnv();
  const hash = await bcrypt.hash('correct-horse', 10);
  await env.DB.prepare(`INSERT INTO admin_users (id, username, password_hash) VALUES ('a1', 'staff', ?)`).bind(hash).run();
});

describe('admin routes', () => {
  it('rejects bad credentials', async () => {
    const res = await handleAdminLogin(new Request('http://x', { method: 'POST', body: JSON.stringify({ username: 'staff', password: 'wrong' }) }), env as any);
    expect(res.status).toBe(401);
  });

  it('accepts good credentials and issues a verifiable session cookie', async () => {
    const res = await handleAdminLogin(new Request('http://x', { method: 'POST', body: JSON.stringify({ username: 'staff', password: 'correct-horse' }) }), env as any);
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie')!;
    const cookieValue = cookie.split(';')[0];
    const req2 = new Request('http://x', { headers: { cookie: cookieValue } });
    expect(await verifyAdminSession(req2, env as any)).toBe(true);
  });

  it('creates and lists slots', async () => {
    await handleAdminCreateSlot(new Request('http://x', { method: 'POST', body: JSON.stringify({ startsAt: '2099-01-01T10:00:00Z', capacity: 4 }) }), env as any);
    const res = await handleAdminListSlots(new Request('http://x'), env as any);
    const data = await res.json() as any;
    expect(data.slots).toHaveLength(1);
    expect(data.slots[0].capacity).toBe(4);
  });
});
