import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../test-utils/fakeD1';
import { handleStartSession, handleAnswer } from './session';
import path from 'node:path';

function makeEnv() {
  return {
    DB: createFakeD1([
      path.join(__dirname, '../../migrations/0001_init.sql'),
      path.join(__dirname, '../../migrations/0002_seed_questions.sql'),
    ]),
    ADMIN_SESSION_TTL_SECONDS: '43200',
    ADMIN_COOKIE_SECRET: 'test-secret',
  };
}

let env: ReturnType<typeof makeEnv>;
beforeEach(() => {
  // Fresh in-memory D1 (re-runs migrations + the 72-row placeholder seed) per test.
  env = makeEnv();
});

describe('session routes', () => {
  it('starts a session for an adult and returns the first question', async () => {
    const req = new Request('http://x/api/session', {
      method: 'POST',
      body: JSON.stringify({ name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en' }),
    });
    const res = await handleStartSession(req, env as any);
    const data = (await res.json()) as any;
    expect(data.track).toBe('adults');
    expect(data.done).toBe(false);
    expect(data.prompt).toBeDefined();
  });

  it('completes after 25 questions and returns a final level', async () => {
    // Seeded questions all have correct_index: 1 (see migrations/0002_seed_questions.sql),
    // so always answering index 1 is always correct.
    const startRes = await handleStartSession(
      new Request('http://x/api/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en' }),
      }),
      env as any
    );
    let data = (await startRes.json()) as any;
    const sessionId = data.sessionId;
    let rounds = 0;
    while (!data.done && rounds < 30) {
      const res = await handleAnswer(
        new Request('http://x', {
          method: 'POST',
          body: JSON.stringify({ questionId: data.questionId, selectedIndex: 1 }), // always correct
        }),
        env as any,
        sessionId
      );
      data = await res.json();
      rounds++;
    }
    expect(data.done).toBe(true);
    expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(data.level);
    expect(rounds).toBeLessThanOrEqual(25);
  });
});
