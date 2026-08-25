import type { Env, StudentInput, QuestionRow, SessionRow, Track } from './types';

function newId(): string {
  return crypto.randomUUID();
}

export function computeTrack(dob: string): Track {
  const birth = new Date(dob);
  const ageMs = Date.now() - birth.getTime();
  const age = ageMs / (1000 * 60 * 60 * 24 * 365.25);
  return age < 16 ? 'kids' : 'adults';
}

export async function insertStudent(env: Env, input: StudentInput): Promise<string> {
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO students (id, name, phone, dob, guardian_name, locale) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, input.name, input.phone, input.dob, input.guardianName ?? null, input.locale).run();
  return id;
}

export async function insertSession(env: Env, studentId: string, track: Track): Promise<string> {
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO test_sessions (id, student_id, track) VALUES (?, ?, ?)`
  ).bind(id, studentId, track).run();
  return id;
}

export async function getSession(env: Env, id: string): Promise<SessionRow | null> {
  const row = await env.DB.prepare(`SELECT * FROM test_sessions WHERE id = ?`).bind(id).first<SessionRow>();
  return row ?? null;
}

export async function updateSessionScoring(
  env: Env,
  id: string,
  fields: { current_level_index: number; step: number; recent_levels: string; questions_asked: number }
): Promise<void> {
  await env.DB.prepare(
    `UPDATE test_sessions SET current_level_index = ?, step = ?, recent_levels = ?, questions_asked = ? WHERE id = ?`
  ).bind(fields.current_level_index, fields.step, fields.recent_levels, fields.questions_asked, id).run();
}

export async function completeSession(env: Env, id: string, estimatedLevel: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE test_sessions SET status = 'completed', estimated_level = ?, completed_at = datetime('now') WHERE id = ?`
  ).bind(estimatedLevel, id).run();
}

export async function pickRandomQuestion(
  env: Env,
  track: Track,
  level: string,
  excludeIds: string[]
): Promise<QuestionRow | null> {
  const placeholders = excludeIds.length ? excludeIds.map(() => '?').join(',') : null;
  const sql = placeholders
    ? `SELECT * FROM questions WHERE track = ? AND level = ? AND active = 1 AND id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`
    : `SELECT * FROM questions WHERE track = ? AND level = ? AND active = 1 ORDER BY RANDOM() LIMIT 1`;
  const binds = placeholders ? [track, level, ...excludeIds] : [track, level];
  const row = await env.DB.prepare(sql).bind(...binds).first<QuestionRow>();
  return row ?? null;
}

export async function insertResponse(
  env: Env,
  sessionId: string,
  questionId: string,
  selectedIndex: number,
  correct: boolean
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO responses (id, session_id, question_id, selected_index, correct) VALUES (?, ?, ?, ?, ?)`
  ).bind(newId(), sessionId, questionId, selectedIndex, correct ? 1 : 0).run();
}

export async function listOpenSlots(env: Env): Promise<Array<{ id: string; starts_at: string; remaining: number }>> {
  const { results } = await env.DB.prepare(
    `SELECT id, starts_at, (capacity - booked_count) AS remaining FROM slots
     WHERE starts_at > datetime('now') AND booked_count < capacity ORDER BY starts_at ASC`
  ).all<{ id: string; starts_at: string; remaining: number }>();
  return results ?? [];
}

/** Race-safe: single UPDATE with a WHERE guard means only one concurrent caller's row-count is 1. */
export async function bookSlotAtomic(env: Env, slotId: string, sessionId: string): Promise<string | null> {
  const update = await env.DB.prepare(
    `UPDATE slots SET booked_count = booked_count + 1 WHERE id = ? AND booked_count < capacity`
  ).bind(slotId).run();
  if (!update.meta.changes) return null; // slot was full
  const bookingId = newId();
  await env.DB.prepare(
    `INSERT INTO bookings (id, session_id, slot_id) VALUES (?, ?, ?)`
  ).bind(bookingId, sessionId, slotId).run();
  return bookingId;
}

export async function getAdminByUsername(env: Env, username: string): Promise<{ id: string; password_hash: string } | null> {
  const row = await env.DB.prepare(`SELECT id, password_hash FROM admin_users WHERE username = ?`).bind(username).first<{ id: string; password_hash: string }>();
  return row ?? null;
}

export async function listSlotsAll(env: Env): Promise<Array<{ id: string; starts_at: string; capacity: number; booked_count: number }>> {
  const { results } = await env.DB.prepare(`SELECT id, starts_at, capacity, booked_count FROM slots ORDER BY starts_at ASC`).all();
  return (results as any) ?? [];
}

export async function createSlot(env: Env, startsAt: string, capacity: number): Promise<string> {
  const id = newId();
  await env.DB.prepare(`INSERT INTO slots (id, starts_at, capacity) VALUES (?, ?, ?)`).bind(id, startsAt, capacity).run();
  return id;
}

export async function deleteSlot(env: Env, id: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM slots WHERE id = ?`).bind(id).run();
}

export async function listBookingsWithDetails(env: Env): Promise<Array<{
  booking_id: string; student_name: string; phone: string; estimated_level: string | null; starts_at: string;
}>> {
  const { results } = await env.DB.prepare(
    `SELECT b.id AS booking_id, s.name AS student_name, s.phone AS phone, ts.estimated_level AS estimated_level, sl.starts_at AS starts_at
     FROM bookings b
     JOIN test_sessions ts ON ts.id = b.session_id
     JOIN students s ON s.id = ts.student_id
     JOIN slots sl ON sl.id = b.slot_id
     WHERE b.status = 'confirmed'
     ORDER BY sl.starts_at ASC`
  ).all();
  return (results as any) ?? [];
}

export async function listQuestions(env: Env): Promise<QuestionRow[]> {
  const { results } = await env.DB.prepare(`SELECT * FROM questions ORDER BY track, level, id`).all<QuestionRow>();
  return results ?? [];
}

export async function insertQuestion(env: Env, q: Omit<QuestionRow, 'id'>): Promise<string> {
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, q.track, q.level, q.prompt, q.options, q.correct_index).run();
  return id;
}

export async function setQuestionActive(env: Env, id: string, active: boolean): Promise<void> {
  await env.DB.prepare(`UPDATE questions SET active = ? WHERE id = ?`).bind(active ? 1 : 0, id).run();
}
