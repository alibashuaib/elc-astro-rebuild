import type { Env, StudentInput } from '../types';
import { computeTrack, insertStudent, insertSession, getSession, updateSessionScoring, completeSession, pickNextQuestion, insertResponse, getPassage, countActiveQuestions } from '../db';
import { initialState, applyAnswer, isDone, finalLevel, finalLevelName, LEVELS_BY_TRACK, STAGE_NAMES_BY_TRACK } from '../scoring';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// Case-sensitive only for the handful of items that explicitly test
// capitalization itself (e.g. "write the capital letter") -- see
// migrations/0012_case_insensitive_grading.sql and questions.case_sensitive.
// Every other text-type answer is graded case-insensitively so a student
// isn't marked wrong for harmless casing (e.g. typing "tv" instead of "TV").
// Whitespace is always normalized regardless.
function normalizeAnswer(s: string, caseSensitive: boolean): string {
  const trimmed = s.trim().replace(/\s+/g, ' ');
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

// Kids-only override on top of the adaptive level estimate: a perfect run
// (every question answered correctly) is reported as 'Super Minds 3A'
// regardless of where the adaptive walk ended up, and a run with zero
// correct answers is reported at the bottom of the ladder ('Pre-Starters').
// User-requested floor/ceiling for the two extreme outcomes -- everything
// in between still uses the normal adaptive estimate. A skip counts as "not
// correct" here (same as scoring.ts treats it), so it breaks the "perfect
// run" case but not the "zero correct" one.
const KIDS_PERFECT_INDEX = 2; // LEVELS_BY_TRACK.kids[2] / STAGE_NAMES_BY_TRACK.kids[2] = 'A1+' / 'Super Minds 3A'
const KIDS_ZERO_INDEX = 0; // '-A1' / 'Pre-Starters'

async function kidsLevelOverrideIndex(env: Env, sessionId: string): Promise<number | null> {
  const row = await env.DB
    .prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS correctCount FROM responses WHERE session_id = ?`)
    .bind(sessionId)
    .first<{ total: number; correctCount: number }>();
  if (!row || row.total === 0) return null;
  if (row.correctCount === row.total) return KIDS_PERFECT_INDEX;
  if (row.correctCount === 0) return KIDS_ZERO_INDEX;
  return null;
}

// Questions are served in fixed order (see migrations/0006_fixed_sequential_order.sql
// and db.ts/pickNextQuestion) -- `levelIndex` here is only the CEFR scoring
// state's current estimate, used to label the session if the whole track's
// bank runs out before scoring naturally concludes (see isDone/finalLevel in
// scoring.ts); it no longer selects which question comes next.
async function nextQuestionPayload(env: Env, sessionId: string, track: string, levelIndex: number, excludeIds: string[]) {
  const q = await pickNextQuestion(env, track as any, excludeIds);
  if (!q) {
    // bank exhausted (asked every question in the track): end the session at the current estimate rather than error
    const finalIndex = track === 'kids' ? (await kidsLevelOverrideIndex(env, sessionId)) ?? levelIndex : levelIndex;
    const level = LEVELS_BY_TRACK[track as 'kids' | 'adults'][finalIndex];
    const levelName = STAGE_NAMES_BY_TRACK[track as 'kids' | 'adults'][finalIndex];
    await completeSession(env, sessionId, level);
    return { done: true, level, levelName };
  }
  const passage = q.passage_id ? await getPassage(env, q.passage_id) : null;
  const total = await countActiveQuestions(env, track as 'kids' | 'adults');
  return {
    done: false,
    questionId: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.type === 'mcq' ? JSON.parse(q.options) : undefined,
    imageUrl: q.image_url ?? undefined,
    passage: passage ? { id: passage.id, title: passage.title, body: passage.body } : undefined,
    // Fixed sequential walk-through over this same active bank (see pickNextQuestion),
    // so "excludeIds so far + this one" is exactly this question's 1-based position in it.
    questionNumber: excludeIds.length + 1,
    total,
  };
}

export async function handleStartSession(req: Request, env: Env): Promise<Response> {
  const body = await req.json<StudentInput>();
  if (!body.name || !body.phone || !body.dob || !body.locale) {
    return json({ error: 'name, phone, dob, and locale are required' }, 400);
  }
  const track = body.track === 'kids' || body.track === 'adults' ? body.track : computeTrack(body.dob);
  const studentId = await insertStudent(env, body);
  const sessionId = await insertSession(env, studentId, track);
  const state = initialState();
  const first = await nextQuestionPayload(env, sessionId, track, state.currentLevelIndex, []);
  return json({ sessionId, track, ...first });
}

export async function handleAnswer(req: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await getSession(env, sessionId);
  if (!session || session.status !== 'in_progress') {
    return json({ error: 'session not found or already completed' }, 404);
  }
  const body = await req.json<{ questionId: string; selectedIndex?: number; answerText?: string; skip?: boolean }>();
  const q = await env.DB
    .prepare(`SELECT type, correct_index, expected_answer, case_sensitive FROM questions WHERE id = ?`)
    .bind(body.questionId)
    .first<{ type: 'mcq' | 'text'; correct_index: number; expected_answer: string | null; case_sensitive: number }>();
  if (!q) return json({ error: 'unknown question' }, 400);

  const skipped = body.skip === true;
  let correct: boolean;
  if (skipped) {
    // A student who doesn't understand the question can skip it instead of
    // guessing. Scored the same as a wrong answer -- the level estimate has
    // no third "unknown" outcome to give it -- but recorded distinctly (see
    // migrations/0011_skip_question.sql) so admin reporting can tell
    // "answered wrong" apart from "never attempted".
    correct = false;
  } else if (q.type === 'text') {
    if (typeof body.answerText !== 'string') return json({ error: 'answerText is required for this question' }, 400);
    correct =
      q.expected_answer !== null &&
      normalizeAnswer(body.answerText, !!q.case_sensitive) === normalizeAnswer(q.expected_answer, !!q.case_sensitive);
  } else {
    if (typeof body.selectedIndex !== 'number') return json({ error: 'selectedIndex is required for this question' }, 400);
    correct = q.correct_index === body.selectedIndex;
  }
  await insertResponse(env, sessionId, body.questionId, body.selectedIndex ?? null, correct, body.answerText ?? null, skipped);

  const priorState = {
    currentLevelIndex: session.current_level_index,
    step: session.step,
    recentLevels: JSON.parse(session.recent_levels) as number[],
    questionsAsked: session.questions_asked,
  };
  const nextState = applyAnswer(priorState, correct);

  // `correct` is omitted from a skipped answer's response -- there's nothing to
  // give feedback on, and the frontend uses its absence to skip showing the
  // correct/incorrect banner (see TestRunner.astro's showFeedback).
  const feedback = skipped ? {} : { correct };

  if (isDone(nextState)) {
    // In practice this only fires via scoring.ts's 200-question safety cap
    // (the real end-of-test path is nextQuestionPayload's bank-exhausted
    // branch above), but apply the same kids perfect/zero override here too
    // for consistency if it's ever reached.
    const override = session.track === 'kids' ? await kidsLevelOverrideIndex(env, sessionId) : null;
    const level = override !== null ? LEVELS_BY_TRACK.kids[override] : finalLevel(nextState, session.track);
    const levelName = override !== null ? STAGE_NAMES_BY_TRACK.kids[override] : finalLevelName(nextState, session.track);
    await updateSessionScoring(env, sessionId, {
      current_level_index: nextState.currentLevelIndex,
      step: nextState.step,
      recent_levels: JSON.stringify(nextState.recentLevels),
      questions_asked: nextState.questionsAsked,
    });
    await completeSession(env, sessionId, level);
    return json({ done: true, level, levelName, ...feedback });
  }

  await updateSessionScoring(env, sessionId, {
    current_level_index: nextState.currentLevelIndex,
    step: nextState.step,
    recent_levels: JSON.stringify(nextState.recentLevels),
    questions_asked: nextState.questionsAsked,
  });

  const askedIds = (
    await env.DB.prepare(`SELECT question_id FROM responses WHERE session_id = ?`).bind(sessionId).all<{ question_id: string }>()
  ).results?.map((r) => r.question_id) ?? [];

  const next = await nextQuestionPayload(env, sessionId, session.track, nextState.currentLevelIndex, askedIds);
  return json({ ...next, ...feedback });
}
