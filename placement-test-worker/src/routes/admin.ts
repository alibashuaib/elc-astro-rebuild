import type { Env } from '../types';
import { getAdminByUsername, listSlotsAll, createSlot, deleteSlot, listBookingsWithDetails, listQuestions, insertQuestion, setQuestionActive } from '../db';
import { checkPassword, issueSessionCookie, verifyAdminSession } from '../auth';

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
}

export async function requireAdmin(req: Request, env: Env): Promise<Response | null> {
  const ok = await verifyAdminSession(req, env);
  return ok ? null : json({ error: 'unauthorized' }, 401);
}

export async function handleAdminLogin(req: Request, env: Env): Promise<Response> {
  const { username, password } = await req.json<{ username: string; password: string }>();
  const admin = await getAdminByUsername(env, username);
  if (!admin || !(await checkPassword(password, admin.password_hash))) {
    return json({ error: 'invalid credentials' }, 401);
  }
  const cookie = await issueSessionCookie(env, admin.id);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}

export async function handleAdminListSlots(_req: Request, env: Env): Promise<Response> {
  return json({ slots: await listSlotsAll(env) });
}

export async function handleAdminCreateSlot(req: Request, env: Env): Promise<Response> {
  const { startsAt, capacity } = await req.json<{ startsAt: string; capacity: number }>();
  const id = await createSlot(env, startsAt, capacity);
  return json({ id }, 201);
}

export async function handleAdminDeleteSlot(_req: Request, env: Env, slotId: string): Promise<Response> {
  await deleteSlot(env, slotId);
  return json({ ok: true });
}

export async function handleAdminListBookings(_req: Request, env: Env): Promise<Response> {
  return json({ bookings: await listBookingsWithDetails(env) });
}

export async function handleAdminListQuestions(_req: Request, env: Env): Promise<Response> {
  return json({ questions: await listQuestions(env) });
}

export async function handleAdminCreateQuestion(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ track: 'kids' | 'adults'; level: string; prompt: string; options: string[]; correctIndex: number }>();
  const id = await insertQuestion(env, {
    track: body.track,
    level: body.level as any,
    prompt: body.prompt,
    options: JSON.stringify(body.options),
    correct_index: body.correctIndex,
    active: 1,
  });
  return json({ id }, 201);
}

export async function handleAdminSetQuestionActive(req: Request, env: Env, questionId: string): Promise<Response> {
  const { active } = await req.json<{ active: boolean }>();
  await setQuestionActive(env, questionId, active);
  return json({ ok: true });
}
