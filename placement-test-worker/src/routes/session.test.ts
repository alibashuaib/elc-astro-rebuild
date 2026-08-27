import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../test-utils/fakeD1';
import { handleStartSession, handleAnswer } from './session';
import { ADULT_BANDS } from '../bands';

function makeEnv() {
  return {
    DB: createFakeD1(),
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

  describe('answer submissions are bound to the question the session is on', () => {
    async function startAdultSession() {
      const res = await handleStartSession(
        new Request('http://x/api/session', {
          method: 'POST',
          body: JSON.stringify({ name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en' }),
        }),
        env as any
      );
      return (await res.json()) as any;
    }

    function answer(sessionId: string, questionId: string, selectedIndex: number) {
      return handleAnswer(
        new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId, selectedIndex }) }),
        env as any,
        sessionId
      );
    }

    async function countResponses(sessionId: string, questionId: string) {
      const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM responses WHERE session_id = ? AND question_id = ?`)
        .bind(sessionId, questionId)
        .first<{ n: number }>();
      return row!.n;
    }

    it('rejects re-answering a question the session has already moved past', async () => {
      const start = await startAdultSession();
      const firstQuestionId = start.questionId;
      await answer(start.sessionId, firstQuestionId, 0);

      const replay = await answer(start.sessionId, firstQuestionId, 0);

      expect(replay.status).toBe(400);
      expect(await countResponses(start.sessionId, firstQuestionId)).toBe(1);
    });

    it('rejects an answer for a question further ahead in the bank', async () => {
      const start = await startAdultSession();
      const ahead = await env.DB.prepare(
        `SELECT id FROM questions WHERE track = 'adults' AND active = 1 ORDER BY sequence ASC LIMIT 1 OFFSET 3`
      ).first<{ id: string }>();

      const res = await answer(start.sessionId, ahead!.id, 0);

      expect(res.status).toBe(400);
      expect(await countResponses(start.sessionId, ahead!.id)).toBe(0);
    });
  });

  it('honors an explicit track override even when it contradicts the DOB-derived track', async () => {
    const req = new Request('http://x/api/session', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Sam',
        phone: '+966500000000',
        dob: '1995-01-01', // would compute to 'adults'
        locale: 'en',
        track: 'kids',
      }),
    });
    const res = await handleStartSession(req, env as any);
    const data = (await res.json()) as any;
    expect(data.track).toBe('kids');
  });

  it('falls back to the DOB-derived track when track is omitted or invalid', async () => {
    const res = await handleStartSession(
      new Request('http://x/api/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en', track: 'not-a-real-track' }),
      }),
      env as any
    );
    const data = (await res.json()) as any;
    expect(data.track).toBe('adults');
  });

  it('walks the whole seeded adults bank (no early stop via scoring convergence) and returns a final level', async () => {
    // Answers each question with its real key, read from the DB -- the bank's
    // correct_index varies per question (migrations/0003_real_questions.sql), so
    // a hard-coded index would fail bands and stop the walk early.
    // scoring.ts's isDone is just a generous safety cap now, not an early-exit
    // (see its comment: "kids placement test missing the rest of the questions"
    // was the bug this replaced).
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
    while (!data.done && rounds < 80) {
      const key = await env.DB.prepare(`SELECT correct_index FROM questions WHERE id = ?`)
        .bind(data.questionId)
        .first<{ correct_index: number }>();
      const res = await handleAnswer(
        new Request('http://x', {
          method: 'POST',
          body: JSON.stringify({ questionId: data.questionId, selectedIndex: key!.correct_index }),
        }),
        env as any,
        sessionId
      );
      data = await res.json();
      rounds++;
    }
    expect(data.done).toBe(true);
    // Adults are scored by proficiency band (bands.ts), not scoring.ts's CEFR
    // ladder: an all-correct run passes every band, and passing the last one
    // (Hint A) places the student above the banded range.
    expect(data.level).toBe('Above Hint A');
    // Ends at the last banded question (ADULT_BANDS.at(-1).end), not at the
    // full 50-row bank -- sequence 35-50 isn't banded yet, so it isn't served.
    expect(rounds).toBe(34);
  });
});

describe('adults band placement (bands.ts, real question content)', () => {
  function makeRealAdultsEnv() {
    return {
      DB: createFakeD1(),
      ADMIN_SESSION_TTL_SECONDS: '43200',
      ADMIN_COOKIE_SECRET: 'test-secret',
    };
  }

  async function startAdultSession(env: ReturnType<typeof makeRealAdultsEnv>, phone: string) {
    const res = await handleStartSession(
      new Request('http://x/api/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Sam', phone, dob: '1995-01-01', locale: 'en' }),
      }),
      env as any
    );
    return (await res.json()) as any;
  }

  async function correctIndexFor(env: ReturnType<typeof makeRealAdultsEnv>, questionId: string): Promise<number> {
    const row = await env.DB.prepare(`SELECT correct_index FROM questions WHERE id = ?`).bind(questionId).first<{ correct_index: number }>();
    return row!.correct_index;
  }

  it('stops the session as soon as the first band (Fun A) fails, without asking further bands', async () => {
    const env = makeRealAdultsEnv();
    let data = await startAdultSession(env, '+966500000010');
    const sessionId = data.sessionId;
    const funA = ADULT_BANDS[0]; // { name: 'Fun A', start: 1, end: 5 }
    let rounds = 0;
    while (!data.done) {
      const wantWrong = rounds < 4; // 1 correct out of 5 = 20%, below 60% -> Fun A fails
      const correctIndex = await correctIndexFor(env, data.questionId);
      const selectedIndex = wantWrong ? (correctIndex + 1) % 4 : correctIndex;
      const res = await handleAnswer(
        new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId: data.questionId, selectedIndex }) }),
        env as any,
        sessionId
      );
      data = await res.json();
      rounds++;
    }
    expect(rounds).toBe(bandSize(funA)); // stopped right at the end of Fun A, never reached Fun B
    expect(data.level).toBe('Fun A');
  });

  it('passing every band places the student "Above Hint A" after exactly 34 questions (the reading-passage content at 35-50 is never served)', async () => {
    const env = makeRealAdultsEnv();
    let data = await startAdultSession(env, '+966500000011');
    const sessionId = data.sessionId;
    let rounds = 0;
    while (!data.done) {
      const correctIndex = await correctIndexFor(env, data.questionId);
      const res = await handleAnswer(
        new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId: data.questionId, selectedIndex: correctIndex }) }),
        env as any,
        sessionId
      );
      data = await res.json();
      rounds++;
    }
    expect(rounds).toBe(34);
    expect(data.level).toBe('Above Hint A');
  });

  it('passing Fun A (band 1) continues into Fun B instead of stopping', async () => {
    const env = makeRealAdultsEnv();
    let data = await startAdultSession(env, '+966500000012');
    const sessionId = data.sessionId;
    const funA = ADULT_BANDS[0];
    for (let i = 0; i < bandSize(funA); i++) {
      const correctIndex = await correctIndexFor(env, data.questionId);
      const res = await handleAnswer(
        new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId: data.questionId, selectedIndex: correctIndex }) }),
        env as any,
        sessionId
      );
      data = await res.json();
    }
    expect(data.done).toBe(false); // Fun A passed 5/5 -- session continues into Fun B, doesn't stop
    expect(data.questionNumber).toBe(bandSize(funA) + 1);
  });

  function bandSize(band: { start: number; end: number }): number {
    return band.end - band.start + 1;
  }
});

describe('text-type question grading', () => {
  function makeTextEnv() {
    return {
      DB: createFakeD1(),
      ADMIN_SESSION_TTL_SECONDS: '43200',
      ADMIN_COOKIE_SECRET: 'test-secret',
    };
  }

  // kids-A1-1 is the handwriting item "Write the capital letter for \"a\"."
  // with expected_answer 'A' -- see migrations/0005_kids_text_and_vocab_questions.sql.
  const KNOWN_TEXT_QUESTION_ID = 'kids-A1-1';

  async function startKidsSession(env: ReturnType<typeof makeTextEnv>, phone: string) {
    const startRes = await handleStartSession(
      new Request('http://x/api/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Kid', phone, dob: '2018-01-01', locale: 'en', track: 'kids' }),
      }),
      env as any
    );
    return ((await startRes.json()) as any).sessionId as string;
  }

  async function currentLevelIndex(env: ReturnType<typeof makeTextEnv>, sessionId: string): Promise<number> {
    const row = await env.DB.prepare(`SELECT current_level_index FROM test_sessions WHERE id = ?`)
      .bind(sessionId)
      .first<{ current_level_index: number }>();
    return row!.current_level_index;
  }

  it('grades an exact-match text answer as correct (level index moves up)', async () => {
    const env = makeTextEnv();
    const sessionId = await startKidsSession(env, '+966500000000');
    const before = await currentLevelIndex(env, sessionId);
    await handleAnswer(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ questionId: KNOWN_TEXT_QUESTION_ID, answerText: 'A' }),
      }),
      env as any,
      sessionId
    );
    const after = await currentLevelIndex(env, sessionId);
    expect(after).toBeGreaterThan(before);
  });

  it('is whitespace-tolerant', async () => {
    const env = makeTextEnv();
    const sessionId = await startKidsSession(env, '+966500000001');
    const before = await currentLevelIndex(env, sessionId);
    await handleAnswer(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ questionId: KNOWN_TEXT_QUESTION_ID, answerText: '  A  ' }),
      }),
      env as any,
      sessionId
    );
    const after = await currentLevelIndex(env, sessionId);
    expect(after).toBeGreaterThan(before);
  });

  it('is case-sensitive (lowercase does not match a capital-letter item)', async () => {
    const env = makeTextEnv();
    const sessionId = await startKidsSession(env, '+966500000002');
    const before = await currentLevelIndex(env, sessionId);
    await handleAnswer(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ questionId: KNOWN_TEXT_QUESTION_ID, answerText: 'a' }),
      }),
      env as any,
      sessionId
    );
    const after = await currentLevelIndex(env, sessionId);
    expect(after).toBeLessThan(before);
  });

  it('rejects a text-type answer submitted without answerText', async () => {
    const env = makeTextEnv();
    const startRes = await handleStartSession(
      new Request('http://x/api/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Kid', phone: '+966500000000', dob: '2018-01-01', locale: 'en', track: 'kids' }),
      }),
      env as any
    );
    const sessionId = ((await startRes.json()) as any).sessionId;
    const res = await handleAnswer(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ questionId: KNOWN_TEXT_QUESTION_ID, selectedIndex: 0 }),
      }),
      env as any,
      sessionId
    );
    expect(res.status).toBe(400);
  });
});

describe('kids placement level reflects the whole run, not its tail', () => {
  // Walks the entire kids bank, answering the first `correctCount` questions
  // with their real key and skipping the rest (a skip scores as incorrect).
  async function runKidsSession(correctCount: number) {
    const startRes = await handleStartSession(
      new Request('http://x/api/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Kid', phone: '+966500000000', dob: '2018-01-01', locale: 'en', track: 'kids' }),
      }),
      env as any
    );
    let data = (await startRes.json()) as any;
    const sessionId = data.sessionId;
    let answered = 0;

    while (!data.done && answered < 200) {
      const q = await env.DB.prepare(`SELECT type, correct_index, expected_answer FROM questions WHERE id = ?`)
        .bind(data.questionId)
        .first<{ type: string; correct_index: number; expected_answer: string | null }>();

      let answer: Record<string, unknown>;
      if (answered >= correctCount) answer = { skip: true };
      else if (q!.type === 'text') answer = { answerText: q!.expected_answer };
      else answer = { selectedIndex: q!.correct_index };

      const res = await handleAnswer(
        new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId: data.questionId, ...answer }) }),
        env as any,
        sessionId
      );
      data = await res.json();
      answered++;
    }
    return { level: data.level, levelName: data.levelName, answered };
  }

  it.each([
    [44, 'Super Minds 3A'],
    [37, 'Super Minds 3A'],
    [36, 'Super Minds 2B'],
    [30, 'Super Minds 2B'],
    [29, 'Super Minds 2A'],
    [22, 'Super Minds 2A'],
    [21, 'Super Minds 1B'],
    [15, 'Super Minds 1B'],
    [14, 'Super Minds 1A'],
    [8, 'Super Minds 1A'],
    [7, 'Pre-Starters'],
    [0, 'Pre-Starters'],
  ])('places a kid who gets %i of 44 right at %s', async (correct, expected) => {
    const { levelName, answered } = await runKidsSession(correct);
    expect(answered).toBe(44); // the whole bank is always served
    expect(levelName).toBe(expected);
  });
});
