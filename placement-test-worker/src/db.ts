import type { Env, StudentInput, QuestionRow, PassageRow, SessionRow, Track } from './types';

function newId(): string {
  return crypto.randomUUID();
}

// Kids track is age 12 and under; 13+ is adults. Computed as an exact
// calendar-year age (not ms-elapsed / 365.25 days) -- that average-year
// approximation put a student turning 12 exactly today on the wrong side of
// the cutoff, since "now" is always some hours past midnight while `dob`
// parses to midnight, nudging the approximate age fractionally past 12.
export function computeTrack(dob: string): Track {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age--;
  return age <= 12 ? 'kids' : 'adults';
}

export function isUnderEleven(dob: string): boolean {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return false;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age--;
  return age < 11;
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

// Adults keep the source paper's exact sequence. Kids keep the paper's
// exercise-block progression, but questions inside repeated blocks are
// shuffled so letter, number, picture, vocabulary, and reading drills do not
// appear in the same predictable order on every attempt.
export async function pickNextQuestion(
  env: Env,
  track: Track,
  excludeIds: string[]
): Promise<QuestionRow | null> {
  const placeholders = excludeIds.length ? excludeIds.map(() => '?').join(',') : null;
  const where = placeholders
    ? `track = ? AND active = 1 AND id NOT IN (${placeholders})`
    : `track = ? AND active = 1`;
  const kidsOrder = `CASE
    WHEN sequence BETWEEN 1 AND 6 THEN 1
    WHEN sequence BETWEEN 7 AND 12 THEN 7
    WHEN sequence BETWEEN 13 AND 16 THEN 13
    WHEN sequence BETWEEN 17 AND 21 THEN 17
    WHEN sequence BETWEEN 22 AND 26 THEN 22
    WHEN sequence BETWEEN 27 AND 31 THEN 27
    WHEN sequence BETWEEN 32 AND 36 THEN 32
    ELSE sequence
  END ASC, RANDOM()`;
  const order = track === 'kids' ? kidsOrder : 'sequence ASC';
  const sql = `SELECT * FROM questions WHERE ${where} ORDER BY ${order} LIMIT 1`;
  const binds = placeholders ? [track, ...excludeIds] : [track];
  const row = await env.DB.prepare(sql).bind(...binds).first<QuestionRow>();
  return row ?? null;
}

/**
 * Record which question the session is now waiting on, so handleAnswer can
 * check an incoming answer against it. Pass null when the session ends.
 *
 * The alternative -- re-deriving the pending question with pickNextQuestion --
 * only holds while the walk is deterministic, and the kids track shuffles
 * within each exercise block.
 */
export async function setCurrentQuestion(env: Env, sessionId: string, questionId: string | null): Promise<void> {
  await env.DB.prepare(`UPDATE test_sessions SET current_question_id = ? WHERE id = ?`)
    .bind(questionId, sessionId)
    .run();
}

/** Responses recorded for questions whose `sequence` falls within [start, end]. */
export async function countBandAnswered(env: Env, sessionId: string, start: number, end: number): Promise<number> {
  const row = await env.DB
    .prepare(
      `SELECT COUNT(*) AS n FROM responses r
       JOIN questions q ON q.id = r.question_id
       WHERE r.session_id = ? AND q.sequence BETWEEN ? AND ?`
    )
    .bind(sessionId, start, end)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** One question row by id. */
export async function getQuestion(env: Env, id: string): Promise<QuestionRow | null> {
  const row = await env.DB.prepare(`SELECT * FROM questions WHERE id = ?`).bind(id).first<QuestionRow>();
  return row ?? null;
}

/** Ids of every question this session has already recorded a response for, in insertion order. */
export async function listAnsweredQuestionIds(env: Env, sessionId: string): Promise<string[]> {
  const rows = await env.DB.prepare(`SELECT question_id FROM responses WHERE session_id = ?`)
    .bind(sessionId)
    .all<{ question_id: string }>();
  return rows.results?.map((r) => r.question_id) ?? [];
}

// Total size of a track's active question bank -- used by the frontend to
// render "question N of total" progress, since the walk-through is a fixed
// sequential pass over this same set (see pickNextQuestion) rather than an
// adaptive test with a variable question count.
export async function countActiveQuestions(env: Env, track: Track): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM questions WHERE track = ? AND active = 1`)
    .bind(track)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// Number of correct responses this session has recorded for questions whose
// `sequence` falls within [start, end] -- used by session.ts's adults-track
// band-boundary check (see bands.ts) once the last question of a band has
// been answered.
export async function countBandCorrect(env: Env, sessionId: string, start: number, end: number): Promise<number> {
  const row = await env.DB
    .prepare(
      `SELECT COUNT(*) AS n FROM responses r
       JOIN questions q ON q.id = r.question_id
       WHERE r.session_id = ? AND r.correct = 1 AND q.sequence BETWEEN ? AND ?`
    )
    .bind(sessionId, start, end)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getPassage(env: Env, id: string): Promise<PassageRow | null> {
  const row = await env.DB.prepare(`SELECT * FROM passages WHERE id = ?`).bind(id).first<PassageRow>();
  return row ?? null;
}

export async function insertResponse(
  env: Env,
  sessionId: string,
  questionId: string,
  // For type: 'text' questions and skipped questions there's no option index --
  // pass null and the row stores the documented -1 sentinel in selected_index
  // (kept NOT NULL for backward compatibility) with the typed answer in
  // answer_text instead (null for a skip too).
  selectedIndex: number | null,
  correct: boolean,
  answerText: string | null = null,
  skipped: boolean = false
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO responses (id, session_id, question_id, selected_index, correct, answer_text, skipped) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(newId(), sessionId, questionId, selectedIndex ?? -1, correct ? 1 : 0, answerText, skipped ? 1 : 0).run();
}

export async function listOpenSlots(env: Env): Promise<Array<{ id: string; starts_at: string; remaining: number }>> {
  // `starts_at` is stored as ISO-8601 with a 'T' separator and 'Z' suffix (see createSlot /
  // AdminPanel.astro's `new Date(startsAt).toISOString()`). datetime('now') instead produces a
  // space-separated, millisecond-less string ('2026-09-01 10:00:00'), and comparing the two
  // formats as strings is unreliable near date/time boundaries. strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  // formats "now" the same way as the stored values, so the string comparison is apples-to-apples.
  const { results } = await env.DB.prepare(
    `SELECT id, starts_at, (capacity - booked_count) AS remaining FROM slots
     WHERE starts_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AND booked_count < capacity ORDER BY starts_at ASC`
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

/**
 * Deletes a slot, but refuses (returns false) if it still has confirmed bookings —
 * otherwise `listBookingsWithDetails`'s JOIN would silently drop those bookings from the
 * admin's booking list with no warning and no cancellation record. Returns true on success.
 */
export async function deleteSlot(env: Env, id: string): Promise<boolean> {
  const booked = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM bookings WHERE slot_id = ? AND status = 'confirmed'`
  ).bind(id).first<{ count: number }>();
  if (booked && booked.count > 0) return false;
  await env.DB.prepare(`DELETE FROM slots WHERE id = ?`).bind(id).run();
  return true;
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
  const { results } = await env.DB.prepare(`SELECT * FROM questions ORDER BY track, sequence`).all<QuestionRow>();
  return results ?? [];
}

// Admin-created questions are appended after everything currently in that
// track's fixed sequence (see migrations/0006_fixed_sequential_order.sql) --
// callers don't pick a `sequence` themselves.
export async function insertQuestion(env: Env, q: Omit<QuestionRow, 'id' | 'sequence'>): Promise<string> {
  const id = newId();
  const next = await env.DB.prepare(`SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM questions WHERE track = ?`)
    .bind(q.track)
    .first<{ next: number }>();
  await env.DB.prepare(
    `INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer, case_sensitive, passage_id, sequence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, q.track, q.level, q.type, q.prompt, q.options, q.correct_index, q.expected_answer, q.case_sensitive, q.passage_id, next?.next ?? 1).run();
  return id;
}

export async function setQuestionActive(env: Env, id: string, active: boolean): Promise<void> {
  await env.DB.prepare(`UPDATE questions SET active = ? WHERE id = ?`).bind(active ? 1 : 0, id).run();
}
