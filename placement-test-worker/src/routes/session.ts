import type { Env, StudentInput } from '../types';
import { computeTrack, insertStudent, insertSession, getSession, updateSessionScoring, completeSession, pickNextQuestion, insertResponse, getPassage, countActiveQuestions, countBandCorrect, listAnsweredQuestionIds } from '../db';
import { initialState, applyAnswer, isDone, finalLevel, finalLevelName, LEVELS_BY_TRACK, STAGE_NAMES_BY_TRACK } from '../scoring';
import { ADULT_BANDS, bandForSequence, isLastBand, evaluateBand, placementLevel } from '../bands';

// Adults-only: the last question number this track actually serves. The
// bank has 50 real questions (see migrations/0003_real_questions.sql), but
// only the first 34 (sequence 1-34) are banded (see bands.ts) -- the rest
// (35-50, the two reading passages) aren't part of the test yet, so the
// frontend's "question N of total" should read against 34, not 50.
const ADULT_BANDED_QUESTION_COUNT = ADULT_BANDS.at(-1)!.end;

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
  // Adults only serves its banded prefix (see ADULT_BANDED_QUESTION_COUNT) --
  // report progress against that, not the track's full 50-question bank.
  const total = track === 'adults' ? ADULT_BANDED_QUESTION_COUNT : await countActiveQuestions(env, track as 'kids' | 'adults');
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

  // Grade only the question this session is actually on. The walk-through is a
  // deterministic pass over the track's active bank in `sequence` order (see
  // db.ts/pickNextQuestion), so "the first unanswered question" *is* the one the
  // student was last served -- no extra state needed to know what's pending.
  // Without this check the handler graded whatever `questionId` the client sent,
  // so a student could re-submit an easy question they'd already cleared (or skip
  // ahead to one they knew), inflating `questionNumber`, adding duplicate rows to
  // `responses`, and skewing the adults band counts in countBandCorrect.
  const askedIds = await listAnsweredQuestionIds(env, sessionId);
  const q = await pickNextQuestion(env, session.track, askedIds);
  if (!q || q.id !== body.questionId) {
    return json({ error: 'not the question this session is on' }, 400);
  }

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
  // Everything answered *including* the response just written -- the two
  // branches below both advance past it, and re-reading `responses` to learn
  // what we already know costs a round-trip per answer for nothing.
  const answeredIds = [...askedIds, q.id];

  const priorState = {
    currentLevelIndex: session.current_level_index,
    step: session.step,
    recentLevels: JSON.parse(session.recent_levels) as number[],
    questionsAsked: session.questions_asked,
  };
  const nextState = applyAnswer(priorState, correct);

  // Persisted identically on every path below (band boundary, safety cap, and
  // the ordinary next-question case), so it happens once here rather than being
  // repeated in each branch.
  await updateSessionScoring(env, sessionId, {
    current_level_index: nextState.currentLevelIndex,
    step: nextState.step,
    recent_levels: JSON.stringify(nextState.recentLevels),
    questions_asked: nextState.questionsAsked,
  });

  // `correct` is omitted from a skipped answer's response -- there's nothing to
  // give feedback on, and the frontend uses its absence to skip showing the
  // correct/incorrect banner (see TestRunner.astro's showFeedback).
  const feedback = skipped ? {} : { correct };

  // Adults band-boundary check (see bands.ts): once the last question of a
  // band has been answered, evaluate that band immediately. A failed band
  // ends the session right there -- the student is placed at that band and
  // never asked the remaining ones. A passed band either continues into the
  // next one, or, if it was the last band in the table (Hint A), ends the
  // session at "Above Hint A" (the un-banded reading-passage content past
  // sequence 34 isn't served -- see ADULT_BANDED_QUESTION_COUNT).
  if (session.track === 'adults') {
    const band = bandForSequence(q.sequence);
    if (band && q.sequence === band.end) {
      const correctCount = await countBandCorrect(env, sessionId, band.start, band.end);
      const result = evaluateBand(band, correctCount);
      if (!result.passed || isLastBand(band)) {
        // Bands are evaluated one at a time and the walk stops at the first
        // failure, so this single result is the whole placement input.
        const level = placementLevel([result]);
        await completeSession(env, sessionId, level);
        return json({ done: true, level, levelName: level, ...feedback });
      }
      const next = await nextQuestionPayload(env, sessionId, session.track, nextState.currentLevelIndex, answeredIds);
      return json({ ...next, ...feedback });
    }
  }

  if (isDone(nextState)) {
    // In practice this only fires via scoring.ts's 200-question safety cap
    // (the real end-of-test path is nextQuestionPayload's bank-exhausted
    // branch above), but apply the same kids perfect/zero override here too
    // for consistency if it's ever reached.
    const override = session.track === 'kids' ? await kidsLevelOverrideIndex(env, sessionId) : null;
    const level = override !== null ? LEVELS_BY_TRACK.kids[override] : finalLevel(nextState, session.track);
    const levelName = override !== null ? STAGE_NAMES_BY_TRACK.kids[override] : finalLevelName(nextState, session.track);
    await completeSession(env, sessionId, level);
    return json({ done: true, level, levelName, ...feedback });
  }

  const next = await nextQuestionPayload(env, sessionId, session.track, nextState.currentLevelIndex, answeredIds);
  return json({ ...next, ...feedback });
}
