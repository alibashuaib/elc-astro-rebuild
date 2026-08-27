import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../test-utils/fakeD1';
import bcrypt from 'bcryptjs';
import { handleAdminLogin, handleAdminCreateSlot, handleAdminListSlots, handleAdminDeleteSlot } from './admin';
import { verifyAdminSession } from '../auth';
import { createSlot, insertStudent, insertSession, bookSlotAtomic } from '../db';

function makeEnv() {
  return {
    DB: createFakeD1(),
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

  it('ignores a cookie whose name merely ends with the session cookie name', async () => {
    const res = await handleAdminLogin(new Request('http://x', { method: 'POST', body: JSON.stringify({ username: 'staff', password: 'correct-horse' }) }), env as any);
    const cookieValue = res.headers.get('set-cookie')!.split(';')[0];
    const spoofedHeader = `foo=bar; xelc_admin_session=malicious; ${cookieValue}`;
    const req2 = new Request('http://x', { headers: { cookie: spoofedHeader } });
    expect(await verifyAdminSession(req2, env as any)).toBe(true);

    const onlySpoofedHeader = `foo=bar; xelc_admin_session=malicious`;
    const req3 = new Request('http://x', { headers: { cookie: onlySpoofedHeader } });
    expect(await verifyAdminSession(req3, env as any)).toBe(false);
  });

  it('creates and lists slots', async () => {
    await handleAdminCreateSlot(new Request('http://x', { method: 'POST', body: JSON.stringify({ startsAt: '2099-01-01T10:00:00Z', capacity: 4 }) }), env as any);
    const res = await handleAdminListSlots(new Request('http://x'), env as any);
    const data = await res.json() as any;
    expect(data.slots).toHaveLength(1);
    expect(data.slots[0].capacity).toBe(4);
  });

  it('deletes a slot with no bookings', async () => {
    const slotId = await createSlot(env as any, '2099-01-01T10:00:00Z', 4);
    const res = await handleAdminDeleteSlot(new Request('http://x', { method: 'DELETE' }), env as any, slotId);
    expect(res.status).toBe(200);
    const list = await (await handleAdminListSlots(new Request('http://x'), env as any)).json() as any;
    expect(list.slots).toHaveLength(0);
  });

  it('refuses to delete a slot with a confirmed booking', async () => {
    const slotId = await createSlot(env as any, '2099-01-01T10:00:00Z', 4);
    const studentId = await insertStudent(env as any, { name: 'A', phone: '1', dob: '2000-01-01', locale: 'en' });
    const sessionId = await insertSession(env as any, studentId, 'adults');
    await bookSlotAtomic(env as any, slotId, sessionId);

    const res = await handleAdminDeleteSlot(new Request('http://x', { method: 'DELETE' }), env as any, slotId);
    expect(res.status).toBe(409);
    const data = await res.json() as any;
    expect(data.error).toBe('slot_has_bookings');

    const list = await (await handleAdminListSlots(new Request('http://x'), env as any)).json() as any;
    expect(list.slots).toHaveLength(1);
  });
});
