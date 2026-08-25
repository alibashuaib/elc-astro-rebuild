import type { Env, StudentInput } from '../types';
import { computeTrack, insertStudent, insertSession, getSession, updateSessionScoring, completeSession, pickRandomQuestion, insertResponse } from '../db';
import { initialState, applyAnswer, isDone, finalLevel, CEFR_LEVELS } from '../scoring';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

async function nextQuestionPayload(env: Env, sessionId: string, track: string, levelIndex: number, excludeIds: string[]) {
  const level = CEFR_LEVELS[levelIndex];
  const q = await pickRandomQuestion(env, track as any, level, excludeIds);
  if (!q) {
    // bank exhausted at this level: end the session at the current estimate rather than error
    await completeSession(env, sessionId, level);
    return { done: true, level };
  }
  return { done: false, questionId: q.id, prompt: q.prompt, options: JSON.parse(q.options) };
}

export async function handleStartSession(req: Request, env: Env): Promise<Response> {
  const body = await req.json<StudentInput>();
  if (!body.name || !body.phone || !body.dob || !body.locale) {
    return json({ error: 'name, phone, dob, and locale are required' }, 400);
  }
  const track = computeTrack(body.dob);
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
  const body = await req.json<{ questionId: string; selectedIndex: number }>();
  const q = await env.DB.prepare(`SELECT correct_index FROM questions WHERE id = ?`).bind(body.questionId).first<{ correct_index: number }>();
  if (!q) return json({ error: 'unknown question' }, 400);

  const correct = q.correct_index === body.selectedIndex;
  await insertResponse(env, sessionId, body.questionId, body.selectedIndex, correct);

  const priorState = {
    currentLevelIndex: session.current_level_index,
    step: session.step,
    recentLevels: JSON.parse(session.recent_levels) as number[],
    questionsAsked: session.questions_asked,
  };
  const nextState = applyAnswer(priorState, correct);

  if (isDone(nextState)) {
    const level = finalLevel(nextState);
    await updateSessionScoring(env, sessionId, {
      current_level_index: nextState.currentLevelIndex,
      step: nextState.step,
      recent_levels: JSON.stringify(nextState.recentLevels),
      questions_asked: nextState.questionsAsked,
    });
    await completeSession(env, sessionId, level);
    return json({ done: true, level });
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
