import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '../test-utils/fakeD1';
import { handleStartSession, handleAnswer } from './session';
import { ADULT_BANDS } from '../bands';
import { KIDS_CAPITAL_QUESTION_IDS, KIDS_SMALL_QUESTION_IDS } from '../db';

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

  it('stops the moment the first band becomes unwinnable, placing below it', async () => {
    const env = makeRealAdultsEnv();
    let data = await startAdultSession(env, '+966500000010');
    const sessionId = data.sessionId;
    const funA = ADULT_BANDS[0]; // { name: 'Fun A', start: 1, end: 5 }
    let rounds = 0;
    while (!data.done) {
      const wantWrong = rounds < 4; // three wrong answers make the 50% band unreachable
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
    // Fun A needs 3 of 5. After 3 wrong the band is already lost, so the test
    // ends there rather than serving the remaining two questions.
    expect(rounds).toBe(3);
    expect(rounds).toBeLessThan(bandSize(funA));
    expect(data.level).toBe('Pre Fun'); // nothing below the first band
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

  it('passes an adult band with exactly 50% correct', async () => {
    const env = makeRealAdultsEnv();
    let data = await startAdultSession(env, '+966500000013');
    const sessionId = data.sessionId;

    // Clear Fun A, then answer exactly 2 of the 4 Fun B questions correctly.
    for (let sequence = 1; sequence <= 9; sequence++) {
      const correctIndex = await correctIndexFor(env, data.questionId);
      const selectedIndex = sequence <= 7 ? correctIndex : (correctIndex === 0 ? 1 : 0);
      const res = await handleAnswer(
        new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId: data.questionId, selectedIndex }) }),
        env as any,
        sessionId
      );
      data = await res.json();
    }

    expect(data.done).toBe(false);
    expect(data.questionNumber).toBe(10); // continued into Lint A
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


  // Randomization means the session may be served any item from the
  // capital-letter block, so these read the real key of whatever came up
  // instead of assuming kids-A1-1. Hard-coding it made them flaky.
  async function servedTextQuestion(env: ReturnType<typeof makeTextEnv>, phone: string) {
    const startRes = await handleStartSession(
      new Request('http://x/api/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Kid', phone, dob: '2018-01-01', locale: 'en', track: 'kids' }),
      }),
      env as any
    );
    const data = (await startRes.json()) as any;
    const q = await env.DB.prepare(`SELECT type, expected_answer FROM questions WHERE id = ?`)
      .bind(data.questionId)
      .first<{ type: string; expected_answer: string | null }>();
    expect(q!.type).toBe('text');
    return { sessionId: data.sessionId as string, questionId: data.questionId as string, expected: q!.expected_answer! };
  }

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
    const { sessionId, questionId, expected } = await servedTextQuestion(env, '+966500000000');
    const before = await currentLevelIndex(env, sessionId);
    await handleAnswer(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ questionId, answerText: expected }),
      }),
      env as any,
      sessionId
    );
    const after = await currentLevelIndex(env, sessionId);
    expect(after).toBeGreaterThan(before);
  });

  it('is whitespace-tolerant', async () => {
    const env = makeTextEnv();
    const { sessionId, questionId, expected } = await servedTextQuestion(env, '+966500000001');
    const before = await currentLevelIndex(env, sessionId);
    await handleAnswer(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ questionId, answerText: `  ${expected}  ` }),
      }),
      env as any,
      sessionId
    );
    const after = await currentLevelIndex(env, sessionId);
    expect(after).toBeGreaterThan(before);
  });

  it('is case-sensitive (lowercase does not match a capital-letter item)', async () => {
    const env = makeTextEnv();
    const { sessionId, questionId, expected } = await servedTextQuestion(env, '+966500000002');
    const before = await currentLevelIndex(env, sessionId);
    await handleAnswer(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ questionId, answerText: expected.toLowerCase() }),
      }),
      env as any,
      sessionId
    );
    const after = await currentLevelIndex(env, sessionId);
    expect(after).toBeLessThan(before);
  });

  // Regression test for the gap 0016_fix_kids_letter_case_sensitivity.sql
  // closed: 0012_case_insensitive_grading.sql's id list covered only 9 of
  // the 12 "write the capital/small letter" items, silently leaving
  // kids-A2-3/A2-4/A2-5 graded case-insensitively despite explicitly
  // testing letter case. Asserts all 12 as a group so a future migration
  // can't reintroduce the same gap by missing one id off a list.
  it('marks every "write the capital/small letter" item case-sensitive', async () => {
    const env = makeTextEnv();
    const { results } = await env.DB.prepare(
      `SELECT id, case_sensitive FROM questions WHERE track = 'kids' AND prompt LIKE 'Write the % letter for%'`
    ).all<{ id: string; case_sensitive: number }>();
    expect(results.length).toBe(12);
    for (const row of results) {
      expect(row.case_sensitive, `${row.id} should be case-sensitive`).toBe(1);
    }
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

  it.each([
    ['kids-A1-1', 'A', 'a'],
    ['kids-A1-7', 'a', 'A'],
    ['kids-A2-6', '1,2,3,4,5,6,7', '1,3,2,4,5,6,7'],
    ['kids-A2-7', '3', '4'],
    ['kids-B1-1', '5', '4'],
    ['kids-B1-2', '6', '7'],
  ])('grades button answer text for %s correctly', async (questionId, correctAnswer, wrongAnswer) => {
    const q = await env.DB.prepare(`SELECT type, expected_answer, case_sensitive FROM questions WHERE id = ?`)
      .bind(questionId)
      .first<{ type: string; expected_answer: string; case_sensitive: number }>();

    expect(q).toMatchObject({ type: 'text', expected_answer: correctAnswer });

    async function grade(answerText: string, phone: string) {
      const start = await handleStartSession(
        new Request('http://x/api/session', {
          method: 'POST',
          body: JSON.stringify({ name: 'Kid', phone, dob: '2018-01-01', locale: 'en', track: 'kids' }),
        }),
        env as any
      );
      const sessionId = ((await start.json()) as any).sessionId as string;
      await env.DB.prepare(`UPDATE test_sessions SET current_question_id = ? WHERE id = ?`).bind(questionId, sessionId).run();
      const response = await handleAnswer(
        new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId, answerText }) }),
        env as any,
        sessionId
      );
      return (await response.json()) as any;
    }

    expect((await grade(correctAnswer, `correct-${questionId}`)).correct).toBe(true);
    expect((await grade(wrongAnswer, `wrong-${questionId}`)).correct).toBe(false);
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
    return { level: data.level, levelName: data.levelName, yle: data.yle, answered };
  }

  it.each([
    [35, 'Super Minds 3A'],
    [30, 'Super Minds 3A'],
    [29, 'Super Minds 2B'],
    [24, 'Super Minds 2B'],
    [23, 'Super Minds 2A'],
    [18, 'Super Minds 2A'],
    [17, 'Super Minds 1B'],
    [12, 'Super Minds 1B'],
    [11, 'Super Minds 1A'],
    [6, 'Super Minds 1A'],
    [5, 'Pre-Starters'],
    [0, 'Pre-Starters'],
  ])('places a kid who gets %i of 35 right at %s', async (correct, expected) => {
    const { levelName, answered } = await runKidsSession(correct);
    expect(answered).toBe(35); // sampled letter blocks and one combined number activity
    expect(levelName).toBe(expected);
  });

  it.each([
    [35, 'Movers'],
    [30, 'Movers'],
    [29, 'Starters'],
    [6, 'Starters'],
  ])('retains Cambridge YLE level for a kid who gets %i of 35 right', async (correct, expected) => {
    expect((await runKidsSession(correct)).yle).toBe(expected);
  });

  it('omits the Cambridge YLE level below Starters', async () => {
    expect((await runKidsSession(0)).yle).toBeUndefined();
  });

});

describe('kids question order is randomized within each exercise block', () => {
  it('serves varying samples of three questions from each letter block per session', async () => {
    const capitalIds = new Set<string>(KIDS_CAPITAL_QUESTION_IDS);
    const smallIds = new Set<string>(KIDS_SMALL_QUESTION_IDS);
    const capitalSamples = new Set<string>();
    const smallSamples = new Set<string>();
    for (let attempt = 0; attempt < 10; attempt++) {
      const attemptEnv = makeEnv();
      const res = await handleStartSession(
        new Request('http://x/api/session', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Kid',
            phone: `+9665000001${attempt}`,
            dob: '2018-01-01',
            locale: 'en',
            track: 'kids',
          }),
        }),
        attemptEnv as any
      );
      let data = (await res.json()) as any;
      const sessionId = data.sessionId;
      const capitalSample: string[] = [];
      for (let question = 0; question < 3; question++) {
        expect(capitalIds.has(data.questionId)).toBe(true);
        capitalSample.push(data.questionId);
        const answer = await handleAnswer(
          new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId: data.questionId, skip: true }) }),
          attemptEnv as any,
          sessionId
        );
        data = await answer.json();
      }
      expect(new Set(capitalSample).size).toBe(3);
      expect(smallIds.has(data.questionId)).toBe(true);

      const smallSample: string[] = [];
      for (let question = 0; question < 3; question++) {
        expect(smallIds.has(data.questionId)).toBe(true);
        smallSample.push(data.questionId);
        const answer = await handleAnswer(
          new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId: data.questionId, skip: true }) }),
          attemptEnv as any,
          sessionId
        );
        data = await answer.json();
      }
      expect(new Set(smallSample).size).toBe(3);
      expect(capitalIds.has(data.questionId)).toBe(false);
      expect(smallIds.has(data.questionId)).toBe(false);
      expect(data.questionId).toBe('kids-A2-6');
      expect(data.prompt).toBe('Complete the number sequence from 1 to 7.');
      expect(data.questionNumber).toBe(7);
      expect(data.total).toBe(35);
      capitalSamples.add([...capitalSample].sort().join(','));
      smallSamples.add([...smallSample].sort().join(','));
    }
    expect(capitalSamples.size).toBeGreaterThan(1);
    expect(smallSamples.size).toBeGreaterThan(1);
  });

  // The replay guard used to re-derive the pending question by calling
  // pickNextQuestion again, which is only valid while the walk is deterministic.
  // Under randomization that returns a different row than the one served, so
  // every legitimate kids answer would have been rejected with 400.
  it('accepts every answer of a full randomized kids walk-through', async () => {
    const env2 = makeEnv();
    const start = await handleStartSession(
      new Request('http://x/api/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Kid', phone: '+966500000000', dob: '2018-01-01', locale: 'en', track: 'kids' }),
      }),
      env2 as any
    );
    let data = (await start.json()) as any;
    const sessionId = data.sessionId;
    let answered = 0;
    const answeredIds: string[] = [];
    while (!data.done && answered < 200) {
      answeredIds.push(data.questionId);
      const res = await handleAnswer(
        new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId: data.questionId, skip: true }) }),
        env2 as any,
        sessionId
      );
      expect(res.status).toBe(200);
      data = await res.json();
      answered++;
    }
    expect(answered).toBe(35); // sampled letter blocks plus one number activity
    expect(answeredIds.filter((id) => KIDS_CAPITAL_QUESTION_IDS.includes(id as typeof KIDS_CAPITAL_QUESTION_IDS[number]))).toHaveLength(3);
    expect(answeredIds.filter((id) => KIDS_SMALL_QUESTION_IDS.includes(id as typeof KIDS_SMALL_QUESTION_IDS[number]))).toHaveLength(3);
    expect(answeredIds.filter((id) => ['kids-A2-6', 'kids-A2-7', 'kids-B1-1', 'kids-B1-2'].includes(id))).toEqual(['kids-A2-6']);
    expect(data.levelName).toBe('Pre-Starters'); // all skipped
  });

  it('still rejects a question the session is not on', async () => {
    const env2 = makeEnv();
    const start = await handleStartSession(
      new Request('http://x/api/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Kid', phone: '+966500000000', dob: '2018-01-01', locale: 'en', track: 'kids' }),
      }),
      env2 as any
    );
    const data = (await start.json()) as any;
    const other = await env2.DB.prepare(
      `SELECT id FROM questions WHERE track='kids' AND active=1 AND id != ? LIMIT 1`
    ).bind(data.questionId).first<{ id: string }>();

    const res = await handleAnswer(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId: other!.id, skip: true }) }),
      env2 as any,
      data.sessionId
    );
    expect(res.status).toBe(400);
  });
});

describe('adults get one skip per band', () => {
  async function startAdults(env2: ReturnType<typeof makeEnv>) {
    const res = await handleStartSession(
      new Request('http://x/api/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en' }),
      }),
      env2 as any
    );
    return (await res.json()) as any;
  }

  function answer(env2: any, sessionId: string, questionId: string, body: Record<string, unknown>) {
    return handleAnswer(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ questionId, ...body }) }),
      env2,
      sessionId
    );
  }

  async function keyFor(env2: ReturnType<typeof makeEnv>, questionId: string) {
    const q = await env2.DB.prepare(`SELECT correct_index FROM questions WHERE id = ?`)
      .bind(questionId)
      .first<{ correct_index: number }>();
    return { selectedIndex: q!.correct_index };
  }

  it('keeps the skip on offer while the band can still be passed', async () => {
    const env2 = makeEnv();
    let data = await startAdults(env2);
    const sessionId = data.sessionId;

    // Fun A is 5 questions needing 3. Two skips still leave 3 winnable.
    expect(data.skipAvailable).toBe(true);
    data = await (await answer(env2, sessionId, data.questionId, { skip: true })).json();
    expect(data.skipAvailable).toBe(true);
    data = await (await answer(env2, sessionId, data.questionId, { skip: true })).json();
    // Two skipped, three left, three needed -- a third skip would end it, so it
    // is no longer offered.
    expect(data.skipAvailable).toBe(false);
  });

  it('ends the test at the previous band once skipping makes the band unwinnable', async () => {
    const env2 = makeEnv();
    let data = await startAdults(env2);
    const sessionId = data.sessionId;

    // Clear Fun A, then skip Fun B (4 questions, needs 2) into the ground.
    while (!data.done && data.skipAvailable !== false) {
      const res = await answer(env2, sessionId, data.questionId, await keyFor(env2, data.questionId));
      data = await res.json();
    }
    let guard = 0;
    while (!data.done && guard++ < 40) {
      const res = await answer(env2, sessionId, data.questionId, { skip: true });
      if (res.status !== 200) break;
      data = await res.json();
    }
    expect(data.done).toBe(true);
    // Placed at the last band actually cleared, never at the one just failed.
    expect(data.level).not.toBe('Pre Fun');
  });

  it('still lets kids skip as often as they need', async () => {
    const env2 = makeEnv();
    const res = await handleStartSession(
      new Request('http://x/api/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Kid', phone: '+966500000000', dob: '2018-01-01', locale: 'en', track: 'kids' }),
      }),
      env2 as any
    );
    let data = (await res.json()) as any;
    const sessionId = data.sessionId; // only the start payload carries it
    for (let i = 0; i < 5; i++) {
      const r = await answer(env2, sessionId, data.questionId, { skip: true });
      expect(r.status).toBe(200);
      data = await r.json();
      expect(data.skipAvailable).toBe(true);
    }
  });
});
