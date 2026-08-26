import type { Env, StudentInput } from '../types';
import { computeTrack, insertStudent, insertSession, getSession, updateSessionScoring, completeSession, pickNextQuestion, insertResponse, getPassage } from '../db';
import { initialState, applyAnswer, isDone, finalLevel, finalLevelName, LEVELS_BY_TRACK, STAGE_NAMES_BY_TRACK } from '../scoring';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// Case-sensitive on purpose: some text-type items test capitalization itself
// (e.g. "write the capital letter"), so folding case would make those
// ungradeable. Only whitespace is normalized.
function normalizeAnswer(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
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
    const level = LEVELS_BY_TRACK[track as 'kids' | 'adults'][levelIndex];
    const levelName = STAGE_NAMES_BY_TRACK[track as 'kids' | 'adults'][levelIndex];
    await completeSession(env, sessionId, level);
    return { done: true, level, levelName };
  }
  const passage = q.passage_id ? await getPassage(env, q.passage_id) : null;
  return {
    done: false,
    questionId: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.type === 'mcq' ? JSON.parse(q.options) : undefined,
    imageUrl: q.image_url ?? undefined,
    passage: passage ? { id: passage.id, title: passage.title, body: passage.body } : undefined,
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
  const body = await req.json<{ questionId: string; selectedIndex?: number; answerText?: string }>();
  const q = await env.DB
    .prepare(`SELECT type, correct_index, expected_answer FROM questions WHERE id = ?`)
    .bind(body.questionId)
    .first<{ type: 'mcq' | 'text'; correct_index: number; expected_answer: string | null }>();
  if (!q) return json({ error: 'unknown question' }, 400);

  let correct: boolean;
  if (q.type === 'text') {
    if (typeof body.answerText !== 'string') return json({ error: 'answerText is required for this question' }, 400);
    correct = q.expected_answer !== null && normalizeAnswer(body.answerText) === normalizeAnswer(q.expected_answer);
  } else {
    if (typeof body.selectedIndex !== 'number') return json({ error: 'selectedIndex is required for this question' }, 400);
    correct = q.correct_index === body.selectedIndex;
  }
  await insertResponse(env, sessionId, body.questionId, body.selectedIndex ?? null, correct, body.answerText ?? null);

  const priorState = {
    currentLevelIndex: session.current_level_index,
    step: session.step,
    recentLevels: JSON.parse(session.recent_levels) as number[],
    questionsAsked: session.questions_asked,
  };
  const nextState = applyAnswer(priorState, correct);

  if (isDone(nextState)) {
    const level = finalLevel(nextState, session.track);
    const levelName = finalLevelName(nextState, session.track);
    await updateSessionScoring(env, sessionId, {
      current_level_index: nextState.currentLevelIndex,
      step: nextState.step,
      recent_levels: JSON.stringify(nextState.recentLevels),
      questions_asked: nextState.questionsAsked,
    });
    await completeSession(env, sessionId, level);
    return json({ done: true, level, levelName });
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
  return json(next);
}
