import type { Env, StudentInput } from '../types';
import { computeTrack, isUnderEleven, insertStudent, insertSession, getSession, updateSessionScoring, completeSession, pickNextQuestion, insertResponse, getPassage, countSessionQuestions, countBandCorrect, countBandAnswered, listAnsweredQuestionIds, setCurrentQuestion, getQuestion } from '../db';
import { initialState, applyAnswer, isDone, finalLevel, finalLevelName, LEVELS_BY_TRACK, STAGE_NAMES_BY_TRACK } from '../scoring';
import { ADULT_BANDS, BELOW_FIRST_BAND, bandForSequence, isLastBand, evaluateBand, placementLevel, canStillPass, previousBand } from '../bands';
import { kidsLevelIndex, KIDS_YLE_BY_INDEX } from '../kids';

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

// Kids placement is the share of the bank answered correctly (see kids.ts),
// not the adaptive walk in scoring.ts -- that walk stepped a level index by
// +/-1 per answer and clamped it to 0-5, so the result tracked the last few
// answers rather than the run: a kid answering 30 of 44 correctly could still
// finish at the bottom of the ladder if their mistakes fell at the end.
async function kidsPlacementIndex(env: Env, sessionId: string): Promise<number> {
  const row = await env.DB
    .prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS correctCount FROM responses WHERE session_id = ?`)
    .bind(sessionId)
    .first<{ total: number; correctCount: number }>();
  return kidsLevelIndex(row?.correctCount ?? 0, row?.total ?? 0);
}

// Questions are served in fixed order (see migrations/0006_fixed_sequential_order.sql
// and db.ts/pickNextQuestion) -- `levelIndex` here is only the CEFR scoring
// state's current estimate, used to label the session if the whole track's
// bank runs out before scoring naturally concludes (see isDone/finalLevel in
// scoring.ts); it no longer selects which question comes next.
/**
 * Adults may skip for as long as the band is still winnable. A skip scores as
 * incorrect, so it is offered only while passing remains reachable *after*
 * taking it -- once it isn't, there is nothing left to skip toward and the
 * answer handler ends the test. Kids may always skip: each one lowers their
 * share of correct answers, which is the measurement rather than a way around
 * it.
 */
async function skipAvailableFor(env: Env, sessionId: string, track: string, sequence: number): Promise<boolean> {
  if (track !== 'adults') return true;
  const band = bandForSequence(sequence);
  if (!band) return true;
  const { correct, answered } = await bandProgress(env, sessionId, band);
  return canStillPass(band, correct, answered + 1); // as if this one were skipped
}

async function bandProgress(env: Env, sessionId: string, band: { start: number; end: number }) {
  const correct = await countBandCorrect(env, sessionId, band.start, band.end);
  const answered = await countBandAnswered(env, sessionId, band.start, band.end);
  return { correct, answered };
}

async function nextQuestionPayload(env: Env, sessionId: string, track: string, levelIndex: number, excludeIds: string[]) {
  const q = await pickNextQuestion(env, track as any, excludeIds);
  if (!q) {
    // bank exhausted (asked every question in the track): end the session at the current estimate rather than error
    const finalIndex = track === 'kids' ? await kidsPlacementIndex(env, sessionId) : levelIndex;
    const level = LEVELS_BY_TRACK[track as 'kids' | 'adults'][finalIndex];
    const levelName = STAGE_NAMES_BY_TRACK[track as 'kids' | 'adults'][finalIndex];
    await completeSession(env, sessionId, level);
    await setCurrentQuestion(env, sessionId, null);
    // Cambridge YLE exam level, kids only -- adults aren't on that scale, and
    // Pre-Starters sits below the lowest YLE exam, so it stays absent there.
    const yle = track === 'kids' ? KIDS_YLE_BY_INDEX[finalIndex] : undefined;
    return { done: true, level, levelName, ...(yle ? { yle } : {}) };
  }
  // Remember what we are about to serve: the answer handler checks against it
  // rather than re-deriving, which the kids track's shuffling would break.
  await setCurrentQuestion(env, sessionId, q.id);
  const passage = q.passage_id ? await getPassage(env, q.passage_id) : null;
  // Adults only serves its banded prefix (see ADULT_BANDED_QUESTION_COUNT) --
  // report progress against that, not the track's full 50-question bank.
  const total = track === 'adults' ? ADULT_BANDED_QUESTION_COUNT : await countSessionQuestions(env, track as 'kids' | 'adults');
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
    skipAvailable: await skipAvailableFor(env, sessionId, track, q.sequence),
  };
}

export async function handleStartSession(req: Request, env: Env): Promise<Response> {
  const body = await req.json<StudentInput>();
  if (!body.name || !body.phone || !body.dob || !body.locale) {
    return json({ error: 'name, phone, dob, and locale are required' }, 400);
  }
  const requestedTrack = body.track === 'kids' || body.track === 'adults' ? body.track : computeTrack(body.dob);
  const track = isUnderEleven(body.dob) ? 'kids' : requestedTrack;
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

  // Grade only the question this session is actually on. Without this check the
  // handler graded whatever `questionId` the client sent, so a student could
  // re-submit an easy question they'd already cleared (or skip ahead to one they
  // knew), inflating `questionNumber`, adding duplicate rows to `responses`, and
  // skewing the adults band counts in countBandCorrect.
  //
  // `current_question_id` records what was served (migration 0014). Sessions
  // started before that migration have NULL there, so they fall back to
  // re-deriving the pending question -- valid for the adults track, which is
  // still a deterministic pass in `sequence` order. The kids track shuffles
  // within each exercise block, which is exactly why the column exists.
  const askedIds = await listAnsweredQuestionIds(env, sessionId);
  const expectedId = session.current_question_id
    ?? (await pickNextQuestion(env, session.track, askedIds))?.id
    ?? null;
  if (!expectedId || expectedId !== body.questionId) {
    return json({ error: 'not the question this session is on' }, 400);
  }
  const q = await getQuestion(env, expectedId);
  if (!q) return json({ error: 'unknown question' }, 400);

  const skipped = body.skip === true;
  let correct: boolean;
  if (skipped) {
    // A student who doesn't understand the question can skip it instead of
    // guessing. Scored the same as a wrong answer -- the level estimate has
    // no third "unknown" outcome to give it, and for kids that is exactly the
    // point: every skip lowers their share of correct answers. Recorded
    // distinctly (see migrations/0011_skip_question.sql) so admin reporting can
    // tell "answered wrong" apart from "never attempted".
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
    questionsAsked: session.questions_asked,
  };
  const nextState = applyAnswer(priorState, correct);

  // Persisted identically on every path below (band boundary, safety cap, and
  // the ordinary next-question case), so it happens once here rather than being
  // repeated in each branch.
  await updateSessionScoring(env, sessionId, {
    current_level_index: nextState.currentLevelIndex,
    step: nextState.step,
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
    if (band) {
      const { correct: correctCount, answered } = await bandProgress(env, sessionId, band);

      // The moment a perfect run of what's left can no longer clear the band,
      // the test is over -- there is nothing further to measure. The student is
      // placed at the last band they actually cleared, not at the one they just
      // failed. Failing the very first band leaves nothing below it, so they
      // are placed at 'Pre Fun'.
      if (!canStillPass(band, correctCount, answered)) {
        const below = previousBand(band);
        const level = below ? below.name : BELOW_FIRST_BAND;
        await completeSession(env, sessionId, level);
        await setCurrentQuestion(env, sessionId, null);
        return json({ done: true, level, levelName: level, ...feedback });
      }
    }
    if (band && q.sequence === band.end) {
      const result = evaluateBand(band, await countBandCorrect(env, sessionId, band.start, band.end));
      if (!result.passed || isLastBand(band)) {
        // Reaching the end of a band that is still winnable but not won can
        // only happen on the last band; earlier failures stop above.
        const level = placementLevel([result]);
        await completeSession(env, sessionId, level);
        await setCurrentQuestion(env, sessionId, null);
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
    const override = session.track === 'kids' ? await kidsPlacementIndex(env, sessionId) : null;
    const level = override !== null ? LEVELS_BY_TRACK.kids[override] : finalLevel(nextState, session.track);
    const levelName = override !== null ? STAGE_NAMES_BY_TRACK.kids[override] : finalLevelName(nextState, session.track);
    await completeSession(env, sessionId, level);
    await setCurrentQuestion(env, sessionId, null);
    const yle = override !== null ? KIDS_YLE_BY_INDEX[override] : undefined;
    return json({ done: true, level, levelName, ...(yle ? { yle } : {}), ...feedback });
  }

  const next = await nextQuestionPayload(env, sessionId, session.track, nextState.currentLevelIndex, answeredIds);
  return json({ ...next, ...feedback });
}
