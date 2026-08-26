import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../test-utils/fakeD1';
import { handleCreateBooking, handleListSlots } from './booking';
import { createSlot, insertStudent, insertSession } from '../db';
import path from 'node:path';

function makeEnv() {
  return {
    DB: createFakeD1([
      path.join(__dirname, '../../migrations/0001_init.sql'),
      path.join(__dirname, '../../migrations/0002_seed_questions.sql'),
      path.join(__dirname, '../../migrations/0004_add_text_question_type.sql'),
      path.join(__dirname, '../../migrations/0006_fixed_sequential_order.sql'),
      path.join(__dirname, '../../migrations/0007_elc_level_ladders.sql'),
    ]),
  };
}

let env: ReturnType<typeof makeEnv>;
beforeEach(() => {
  // Fresh in-memory D1 (re-runs migrations + the 72-row placeholder seed) per test.
  env = makeEnv();
});

describe('booking routes', () => {
  // Note on concurrency: better-sqlite3 (used by the fakeD1 shim) is synchronous under the
  // hood, so Promise.all([...]) here does not produce genuine OS-thread-level interleaving —
  // each async wrapper's synchronous body runs to completion before the event loop advances to
  // the next microtask, so the two calls execute sequentially rather than truly racing. This is
  // fine and expected: the test still correctly exercises the atomic
  // `UPDATE ... WHERE booked_count < capacity` guard in bookSlotAtomic (the second call
  // correctly observes the slot already full from the first call's effect), which is the actual
  // behavior worth verifying — real D1's per-statement atomicity guarantees are what the
  // production code relies on, not OS-thread races.
  it('only one of two simultaneous bookings succeeds when capacity is 1', async () => {
    const slotId = await createSlot(env as any, '2099-01-01T10:00:00Z', 1);
    const studentA = await insertStudent(env as any, { name: 'A', phone: '1', dob: '2000-01-01', locale: 'en' });
    const studentB = await insertStudent(env as any, { name: 'B', phone: '2', dob: '2000-01-01', locale: 'en' });
    const sessionA = await insertSession(env as any, studentA, 'adults');
    const sessionB = await insertSession(env as any, studentB, 'adults');

    const [resA, resB] = await Promise.all([
      handleCreateBooking(new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: sessionA, slotId }) }), env as any),
      handleCreateBooking(new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: sessionB, slotId }) }), env as any),
    ]);
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  // Fix 6 regression coverage: starts_at is stored ISO-8601 with a 'T' separator
  // (`new Date(...).toISOString()`, e.g. AdminPanel.astro's slot form), and listOpenSlots
  // must compare against "now" formatted the same way, not datetime('now')'s space-separated
  // format — otherwise the string comparison at date/time boundaries is unreliable.
  it('excludes a slot a few seconds in the past and includes one a few seconds in the future', async () => {
    const past = new Date(Date.now() - 5_000).toISOString();
    const future = new Date(Date.now() + 5_000).toISOString();
    await createSlot(env as any, past, 4);
    const futureId = await createSlot(env as any, future, 4);

    const res = await handleListSlots(new Request('http://x'), env as any);
    const data = (await res.json()) as any;
    expect(data.slots.map((s: any) => s.id)).toEqual([futureId]);
  });
});
