# Remote Placement Test + Oral Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student complete an adaptive grammar/vocabulary placement test from home, see an estimated CEFR level, and book an oral-test slot at the center, with staff managing slots/bookings/questions from an admin page.

**Architecture:** New Cloudflare Worker (`placement-test-worker/`) + D1 database, following the same pattern as the existing `cms-oauth-worker/`. The static Astro site gains new pages that call the Worker's JSON API via `fetch()`. No change to hosting or deploy pipeline for the static site.

**Tech Stack:** Cloudflare Workers, D1 (SQLite), TypeScript, Vitest + `@cloudflare/vitest-pool-workers` for Worker tests, Astro (existing site), vanilla client-side TS (matches the site's no-framework pattern already used by `SearchOverlay.astro`).

**Spec:** `docs/superpowers/specs/2026-08-25-placement-test-design.md`

## Global Constraints

- Grammar & vocabulary MCQ only — no listening/reading/writing sections.
- CEFR levels: `A1, A2, B1, B2, C1, C2` (indices 0-5), exactly this order.
- Two tracks: `kids`, `adults` — auto-derived from DOB, no manual picker.
- Adaptive algorithm is the staircase rule defined in the spec (start B1/index 2, step 2 then 1s, stop at 25 questions or 4 consecutive identical estimates) — implement exactly as specified, do not substitute a different algorithm.
- Booking must be race-safe: two simultaneous bookings against a slot with 1 remaining seat → exactly one succeeds.
- WhatsApp confirmation only — no WhatsApp Business API, no email in v1.
- Placeholder question bank: exactly 6 items per level per track (72 total), clearly fabricated/generic content, inserted via seed SQL — not fabricated inline in application code.
- Admin: single shared account, bcrypt password hash, signed-cookie session — no self-service password reset.
- Static site's existing deploy pipeline, i18n routing (`en`/`ar`), and `.htaccess` are unmodified by this work.

---

## File Structure

```
placement-test-worker/              # new sibling to cms-oauth-worker/
  wrangler.toml
  package.json
  tsconfig.json
  migrations/
    0001_init.sql                   # schema
    0002_seed_questions.sql         # 72 placeholder questions
  src/
    index.ts                        # router: dispatches by pathname+method
    types.ts                        # shared TS types (Env, DB row shapes)
    scoring.ts                      # pure adaptive algorithm
    scoring.test.ts
    db.ts                           # D1 query helpers (students, sessions, questions, responses)
    auth.ts                         # bcrypt check + signed session cookie helpers
    routes/
      session.ts                    # POST /api/session, POST /api/session/:id/answer
      booking.ts                    # GET /api/slots, POST /api/bookings
      admin.ts                      # login + slots/bookings/questions CRUD
    routes/session.test.ts
    routes/booking.test.ts
    routes/admin.test.ts

src/pages/{en,ar}/placement-test/
  index.astro                       # registration -> test -> result -> booking, one page, client-side state machine
  admin.astro                       # staff login + management UI

src/components/placement-test/
  RegistrationForm.astro
  TestRunner.astro
  ResultBooking.astro
  AdminPanel.astro

src/i18n/ui.ts                      # add placement-test + admin strings (modify existing file)
src/lib/placementApi.ts             # typed fetch client used by the Astro pages/components
```

---

## Task 1: D1 schema + placeholder question seed

**Files:**
- Create: `placement-test-worker/wrangler.toml`
- Create: `placement-test-worker/package.json`
- Create: `placement-test-worker/tsconfig.json`
- Create: `placement-test-worker/migrations/0001_init.sql`
- Create: `placement-test-worker/migrations/0002_seed_questions.sql`

**Interfaces:**
- Produces: the D1 schema every later task queries against. Table/column names below are final and must be used verbatim by Task 3-6.

- [ ] **Step 1: Scaffold the Worker project**

```bash
mkdir -p placement-test-worker/src/routes placement-test-worker/migrations
cd placement-test-worker
npm init -y
npm install -D wrangler typescript vitest @cloudflare/vitest-pool-workers @cloudflare/workers-types
npm install bcryptjs
```

`placement-test-worker/package.json` scripts section:

```json
{
  "name": "placement-test-worker",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "test": "vitest run",
    "db:migrate:local": "wrangler d1 execute placement-test --local --file=migrations/0001_init.sql && wrangler d1 execute placement-test --local --file=migrations/0002_seed_questions.sql",
    "db:migrate:remote": "wrangler d1 execute placement-test --remote --file=migrations/0001_init.sql && wrangler d1 execute placement-test --remote --file=migrations/0002_seed_questions.sql"
  }
}
```

`placement-test-worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "types": ["@cloudflare/workers-types"],
    "lib": ["ES2022"],
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`placement-test-worker/wrangler.toml`:

```toml
name = "placement-test-worker"
main = "src/index.ts"
compatibility_date = "2026-08-01"

[[d1_databases]]
binding = "DB"
database_name = "placement-test"
database_id = "REPLACE_AFTER_WRANGLER_D1_CREATE"

[vars]
ADMIN_SESSION_TTL_SECONDS = "43200"
```

- [ ] **Step 2: Write the schema migration**

`placement-test-worker/migrations/0001_init.sql`:

```sql
CREATE TABLE students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  dob TEXT NOT NULL,
  guardian_name TEXT,
  locale TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  track TEXT NOT NULL CHECK (track IN ('kids','adults')),
  level TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  prompt TEXT NOT NULL,
  options TEXT NOT NULL,        -- JSON array of 4 strings
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE test_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  track TEXT NOT NULL CHECK (track IN ('kids','adults')),
  status TEXT NOT NULL CHECK (status IN ('in_progress','completed','abandoned')) DEFAULT 'in_progress',
  current_level_index INTEGER NOT NULL DEFAULT 2,
  step INTEGER NOT NULL DEFAULT 2,
  recent_levels TEXT NOT NULL DEFAULT '[2]',  -- JSON array, last few current_level_index values
  questions_asked INTEGER NOT NULL DEFAULT 0,
  estimated_level TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE responses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES test_sessions(id),
  question_id TEXT NOT NULL REFERENCES questions(id),
  selected_index INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  answered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE slots (
  id TEXT PRIMARY KEY,
  starts_at TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  booked_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES test_sessions(id),
  slot_id TEXT NOT NULL REFERENCES slots(id),
  status TEXT NOT NULL CHECK (status IN ('confirmed','cancelled')) DEFAULT 'confirmed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE INDEX idx_responses_session ON responses(session_id);
CREATE INDEX idx_questions_track_level ON questions(track, level, active);
CREATE INDEX idx_slots_starts_at ON slots(starts_at);
CREATE INDEX idx_bookings_slot ON bookings(slot_id);
```

- [ ] **Step 3: Write the placeholder question seed**

`placement-test-worker/migrations/0002_seed_questions.sql` — generate with a small Node script so all 72 rows are consistent, then paste the output as static SQL (D1 migrations must be plain SQL, not scripts). Write and run this generator once locally:

```js
// scratch script, not committed — run with `node gen-seed.js > migrations/0002_seed_questions.sql`
const levels = ['A1','A2','B1','B2','C1','C2'];
const tracks = ['kids','adults'];
let out = [];
for (const track of tracks) {
  for (const level of levels) {
    for (let i = 1; i <= 6; i++) {
      const id = `${track}-${level}-${i}`;
      const prompt = track === 'kids'
        ? `[Kids ${level} placeholder ${i}] Choose the correct word: I ___ to school every day.`
        : `[Adults ${level} placeholder ${i}] Choose the correct form: She ___ finished the report by 5pm.`;
      const options = JSON.stringify(['go', 'goes', 'going', 'gone']).replace(/'/g, "''");
      out.push(`INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('${id}', '${track}', '${level}', '${prompt.replace(/'/g,"''")}', '${options}', 1);`);
    }
  }
}
console.log(out.join('\n'));
```

Run it and save the output as `migrations/0002_seed_questions.sql` (72 `INSERT` statements, one per placeholder question). Every row is clearly marked `[Kids/Adults <LEVEL> placeholder N]` in the prompt text so nobody mistakes it for real content — replacing it later is a `DELETE FROM questions; INSERT ...` data operation, no code change.

- [ ] **Step 4: Create the D1 database and run migrations locally**

```bash
cd placement-test-worker
npx wrangler d1 create placement-test
# copy the printed database_id into wrangler.toml's database_id field
npm run db:migrate:local
```

- [ ] **Step 5: Verify the seed loaded**

```bash
npx wrangler d1 execute placement-test --local --command "SELECT track, level, COUNT(*) FROM questions GROUP BY track, level"
```

Expected: 12 rows (6 tracks×levels... actually 2 tracks × 6 levels = 12 rows), each with count 6.

- [ ] **Step 6: Commit**

```bash
git add placement-test-worker/
git commit -m "Add placement-test-worker scaffold, D1 schema, placeholder question seed"
```

---

## Task 2: Adaptive scoring algorithm (pure function)

**Files:**
- Create: `placement-test-worker/src/scoring.ts`
- Test: `placement-test-worker/src/scoring.test.ts`

**Interfaces:**
- Produces: `applyAnswer(state: ScoringState, correct: boolean): ScoringState` and `isDone(state: ScoringState): boolean` and `finalLevel(state: ScoringState): CefrLevel` — used verbatim by Task 4 (`routes/session.ts`).

```ts
// placement-test-worker/src/scoring.ts
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = typeof CEFR_LEVELS[number];

export interface ScoringState {
  currentLevelIndex: number; // 0-5
  step: number;
  recentLevels: number[];    // trailing history of currentLevelIndex, most recent last
  questionsAsked: number;
}

export function initialState(): ScoringState {
  return { currentLevelIndex: 2, step: 2, recentLevels: [2], questionsAsked: 0 };
}

export function applyAnswer(state: ScoringState, correct: boolean): ScoringState {
  const delta = correct ? state.step : -state.step;
  const nextIndex = Math.min(5, Math.max(0, state.currentLevelIndex + delta));
  const nextStep = Math.max(1, state.step - 1);
  const recentLevels = [...state.recentLevels, nextIndex].slice(-4);
  return {
    currentLevelIndex: nextIndex,
    step: nextStep,
    recentLevels,
    questionsAsked: state.questionsAsked + 1,
  };
}

export function isDone(state: ScoringState): boolean {
  if (state.questionsAsked >= 25) return true;
  if (state.recentLevels.length === 4 && state.recentLevels.every((l) => l === state.recentLevels[0])) {
    return true;
  }
  return false;
}

export function finalLevel(state: ScoringState): CefrLevel {
  return CEFR_LEVELS[state.currentLevelIndex];
}
```

- [ ] **Step 1: Write the failing tests**

```ts
// placement-test-worker/src/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { initialState, applyAnswer, isDone, finalLevel, CEFR_LEVELS } from './scoring';

describe('scoring', () => {
  it('starts at B1 (index 2)', () => {
    expect(finalLevel(initialState())).toBe('B1');
  });

  it('all correct climbs to C2 and stops early via step-1 plateau, capped at 25 questions', () => {
    let state = initialState();
    let guard = 0;
    while (!isDone(state) && guard < 100) {
      state = applyAnswer(state, true);
      guard++;
    }
    expect(finalLevel(state)).toBe('C2');
    expect(state.questionsAsked).toBeLessThanOrEqual(25);
  });

  it('all incorrect drops to A1', () => {
    let state = initialState();
    let guard = 0;
    while (!isDone(state) && guard < 100) {
      state = applyAnswer(state, false);
      guard++;
    }
    expect(finalLevel(state)).toBe('A1');
  });

  it('stops after exactly 4 identical consecutive estimates', () => {
    // B1 -> correct -> index 4 (C1), step 1
    let state = applyAnswer(initialState(), true);
    expect(state.currentLevelIndex).toBe(4);
    // then alternate to hold steady at index 4: incorrect (->3, step1) correct(->4,step1) ... won't hold steady this way.
    // Instead: from index 4 with step 1, alternate correct/incorrect never repeats 4x identically unless clamped.
    // Use clamping at the ceiling: keep answering correct once at C2 (index 5) it's clamped, producing repeats.
    state = initialState();
    for (let i = 0; i < 3; i++) state = applyAnswer(state, true); // pushes to index 5 (C2) and clamps
    expect(state.currentLevelIndex).toBe(5);
    // two more correct answers stay clamped at 5, extending recentLevels with repeats
    state = applyAnswer(state, true);
    state = applyAnswer(state, true);
    expect(isDone(state)).toBe(true);
    expect(finalLevel(state)).toBe('C2');
  });

  it('CEFR_LEVELS is exactly the 6 levels in order', () => {
    expect(CEFR_LEVELS).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (file doesn't exist yet if written test-first)**

```bash
cd placement-test-worker
npx vitest run src/scoring.test.ts
```

Expected: FAIL — `Cannot find module './scoring'`.

- [ ] **Step 3: Write `src/scoring.ts`** (code shown above in Interfaces block)

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/scoring.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scoring.ts src/scoring.test.ts
git commit -m "Add adaptive CEFR scoring algorithm with tests"
```

---

## Task 3: D1 helpers + shared types

**Files:**
- Create: `placement-test-worker/src/types.ts`
- Create: `placement-test-worker/src/db.ts`

**Interfaces:**
- Consumes: table schema from Task 1.
- Produces: `Env` type (with `DB: D1Database`), and DB helper functions used verbatim by Tasks 4-6: `insertStudent`, `insertSession`, `getSession`, `updateSessionScoring`, `completeSession`, `pickRandomQuestion`, `insertResponse`, `listOpenSlots`, `bookSlotAtomic`, `getAdminByUsername`, `listSlotsAll`, `createSlot`, `deleteSlot`, `listBookingsWithDetails`, `listQuestions`, `insertQuestion`, `setQuestionActive`.

```ts
// placement-test-worker/src/types.ts
import type { CefrLevel } from './scoring';

export interface Env {
  DB: D1Database;
  ADMIN_SESSION_TTL_SECONDS: string;
  ADMIN_COOKIE_SECRET: string; // set via `wrangler secret put ADMIN_COOKIE_SECRET`
}

export type Track = 'kids' | 'adults';

export interface StudentInput {
  name: string;
  phone: string;
  dob: string; // ISO date
  guardianName?: string;
  locale: 'en' | 'ar';
}

export interface QuestionRow {
  id: string;
  track: Track;
  level: CefrLevel;
  prompt: string;
  options: string; // JSON string
  correct_index: number;
}

export interface SessionRow {
  id: string;
  student_id: string;
  track: Track;
  status: 'in_progress' | 'completed' | 'abandoned';
  current_level_index: number;
  step: number;
  recent_levels: string; // JSON string
  questions_asked: number;
  estimated_level: string | null;
}
```

```ts
// placement-test-worker/src/db.ts
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
```

- [ ] **Step 1: Add the files above.**
- [ ] **Step 2: Type-check**

```bash
cd placement-test-worker
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/db.ts
git commit -m "Add D1 helpers and shared types for placement-test-worker"
```

---

## Task 4: Session + scoring API routes

**Files:**
- Create: `placement-test-worker/src/routes/session.ts`
- Test: `placement-test-worker/src/routes/session.test.ts`

**Interfaces:**
- Consumes: `computeTrack`, `insertStudent`, `insertSession`, `getSession`, `updateSessionScoring`, `completeSession`, `pickRandomQuestion`, `insertResponse` (Task 3); `initialState`, `applyAnswer`, `isDone`, `finalLevel`, `CEFR_LEVELS` (Task 2).
- Produces: `handleStartSession(req, env)` and `handleAnswer(req, env, sessionId)`, wired into the router in Task 7.

```ts
// placement-test-worker/src/routes/session.ts
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
```

- [ ] **Step 1: Write the failing integration test**

```ts
// placement-test-worker/src/routes/session.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { handleStartSession, handleAnswer } from './session';

async function seedOneQuestion(track: string, level: string, id: string, correctIndex = 1) {
  await env.DB.prepare(
    `INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES (?, ?, ?, 'p', '["a","b","c","d"]', ?)`
  ).bind(id, track, level, correctIndex).run();
}

beforeEach(async () => {
  await env.DB.exec(`DELETE FROM responses; DELETE FROM test_sessions; DELETE FROM students; DELETE FROM questions;`);
});

describe('session routes', () => {
  it('starts a session for an adult and returns the first question', async () => {
    for (const level of ['A1','A2','B1','B2','C1','C2']) {
      await seedOneQuestion('adults', level, `adults-${level}-1`);
    }
    const req = new Request('http://x/api/session', {
      method: 'POST',
      body: JSON.stringify({ name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en' }),
    });
    const res = await handleStartSession(req, env);
    const data = await res.json() as any;
    expect(data.track).toBe('adults');
    expect(data.done).toBe(false);
    expect(data.prompt).toBeDefined();
  });

  it('completes after 25 questions and returns a final level', async () => {
    for (const level of ['A1','A2','B1','B2','C1','C2']) {
      for (let i = 0; i < 5; i++) await seedOneQuestion('adults', level, `adults-${level}-${i}`, 1);
    }
    const startRes = await handleStartSession(new Request('http://x/api/session', {
      method: 'POST',
      body: JSON.stringify({ name: 'Sam', phone: '+966500000000', dob: '1995-01-01', locale: 'en' }),
    }), env);
    let data = await startRes.json() as any;
    const sessionId = data.sessionId;
    let rounds = 0;
    while (!data.done && rounds < 30) {
      const res = await handleAnswer(new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ questionId: data.questionId, selectedIndex: 1 }), // always correct
      }), env, sessionId);
      data = await res.json();
      rounds++;
    }
    expect(data.done).toBe(true);
    expect(['A1','A2','B1','B2','C1','C2']).toContain(data.level);
    expect(rounds).toBeLessThanOrEqual(25);
  });
});
```

- [ ] **Step 2: Configure Workers test pool** — create `placement-test-worker/vitest.config.ts`:

```ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/routes/session.test.ts
```

Expected: FAIL — `Cannot find module './session'`.

- [ ] **Step 4: Write `src/routes/session.ts`** (code shown above).

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/routes/session.test.ts
```

Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/session.ts src/routes/session.test.ts vitest.config.ts
git commit -m "Add session start/answer API routes with adaptive scoring wired in"
```

---

## Task 5: Booking API routes (race-safe)

**Files:**
- Create: `placement-test-worker/src/routes/booking.ts`
- Test: `placement-test-worker/src/routes/booking.test.ts`

**Interfaces:**
- Consumes: `listOpenSlots`, `bookSlotAtomic`, `createSlot` (Task 3, test-only for seeding).
- Produces: `handleListSlots(req, env)`, `handleCreateBooking(req, env)`.

```ts
// placement-test-worker/src/routes/booking.ts
import type { Env } from '../types';
import { listOpenSlots, bookSlotAtomic } from '../db';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export async function handleListSlots(_req: Request, env: Env): Promise<Response> {
  const slots = await listOpenSlots(env);
  return json({ slots });
}

export async function handleCreateBooking(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ sessionId: string; slotId: string }>();
  if (!body.sessionId || !body.slotId) return json({ error: 'sessionId and slotId are required' }, 400);
  const bookingId = await bookSlotAtomic(env, body.slotId, body.sessionId);
  if (!bookingId) return json({ error: 'slot_full' }, 409);
  return json({ bookingId });
}
```

- [ ] **Step 1: Write the failing concurrency test**

```ts
// placement-test-worker/src/routes/booking.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { handleCreateBooking } from './booking';
import { createSlot, insertStudent, insertSession } from '../db';

beforeEach(async () => {
  await env.DB.exec(`DELETE FROM bookings; DELETE FROM slots; DELETE FROM test_sessions; DELETE FROM students;`);
});

describe('booking routes', () => {
  it('only one of two simultaneous bookings succeeds when capacity is 1', async () => {
    const slotId = await createSlot(env, '2099-01-01T10:00:00Z', 1);
    const studentA = await insertStudent(env, { name: 'A', phone: '1', dob: '2000-01-01', locale: 'en' });
    const studentB = await insertStudent(env, { name: 'B', phone: '2', dob: '2000-01-01', locale: 'en' });
    const sessionA = await insertSession(env, studentA, 'adults');
    const sessionB = await insertSession(env, studentB, 'adults');

    const [resA, resB] = await Promise.all([
      handleCreateBooking(new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: sessionA, slotId }) }), env),
      handleCreateBooking(new Request('http://x', { method: 'POST', body: JSON.stringify({ sessionId: sessionB, slotId }) }), env),
    ]);
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/routes/booking.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/routes/booking.ts`** (code above).

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run src/routes/booking.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/booking.ts src/routes/booking.test.ts
git commit -m "Add race-safe slot booking API route"
```

---

## Task 6: Admin auth + management routes

**Files:**
- Create: `placement-test-worker/src/auth.ts`
- Create: `placement-test-worker/src/routes/admin.ts`
- Test: `placement-test-worker/src/routes/admin.test.ts`

**Interfaces:**
- Consumes: `getAdminByUsername`, `listSlotsAll`, `createSlot`, `deleteSlot`, `listBookingsWithDetails`, `listQuestions`, `insertQuestion`, `setQuestionActive` (Task 3).
- Produces: `verifyAdminSession(req, env)`, `handleAdminLogin`, `handleAdminSlots*`, `handleAdminBookings`, `handleAdminQuestions*` — wired into router in Task 7.

```ts
// placement-test-worker/src/auth.ts
import bcrypt from 'bcryptjs';
import type { Env } from './types';

const COOKIE_NAME = 'elc_admin_session';

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function checkPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function issueSessionCookie(env: Env, adminId: string): Promise<string> {
  const ttl = parseInt(env.ADMIN_SESSION_TTL_SECONDS, 10);
  const expires = Date.now() + ttl * 1000;
  const payload = `${adminId}.${expires}`;
  const sig = await sign(payload, env.ADMIN_COOKIE_SECRET);
  const value = `${payload}.${sig}`;
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${ttl}`;
}

export async function verifyAdminSession(req: Request, env: Env): Promise<boolean> {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const [adminId, expiresStr, sig] = match[1].split('.');
  if (!adminId || !expiresStr || !sig) return false;
  if (Date.now() > parseInt(expiresStr, 10)) return false;
  const expectedSig = await sign(`${adminId}.${expiresStr}`, env.ADMIN_COOKIE_SECRET);
  return expectedSig === sig;
}
```

```ts
// placement-test-worker/src/routes/admin.ts
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
```

- [ ] **Step 1: Write the failing tests**

```ts
// placement-test-worker/src/routes/admin.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import bcrypt from 'bcryptjs';
import { handleAdminLogin, handleAdminCreateSlot, handleAdminListSlots } from './admin';
import { verifyAdminSession } from '../auth';

beforeEach(async () => {
  await env.DB.exec(`DELETE FROM admin_users; DELETE FROM slots;`);
  const hash = await bcrypt.hash('correct-horse', 10);
  await env.DB.prepare(`INSERT INTO admin_users (id, username, password_hash) VALUES ('a1', 'staff', ?)`).bind(hash).run();
});

describe('admin routes', () => {
  it('rejects bad credentials', async () => {
    const res = await handleAdminLogin(new Request('http://x', { method: 'POST', body: JSON.stringify({ username: 'staff', password: 'wrong' }) }), env);
    expect(res.status).toBe(401);
  });

  it('accepts good credentials and issues a verifiable session cookie', async () => {
    const res = await handleAdminLogin(new Request('http://x', { method: 'POST', body: JSON.stringify({ username: 'staff', password: 'correct-horse' }) }), env);
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie')!;
    const cookieValue = cookie.split(';')[0];
    const req2 = new Request('http://x', { headers: { cookie: cookieValue } });
    expect(await verifyAdminSession(req2, env)).toBe(true);
  });

  it('creates and lists slots', async () => {
    await handleAdminCreateSlot(new Request('http://x', { method: 'POST', body: JSON.stringify({ startsAt: '2099-01-01T10:00:00Z', capacity: 4 }) }), env);
    const res = await handleAdminListSlots(new Request('http://x'), env);
    const data = await res.json() as any;
    expect(data.slots).toHaveLength(1);
    expect(data.slots[0].capacity).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify failure, then write `src/auth.ts` and `src/routes/admin.ts`** (code above), then rerun.

```bash
npx vitest run src/routes/admin.test.ts
```

Expected: fails first (missing modules), passes after both files are added.

- [ ] **Step 3: Commit**

```bash
git add src/auth.ts src/routes/admin.ts src/routes/admin.test.ts
git commit -m "Add admin auth and slot/booking/question management routes"
```

---

## Task 7: Router wiring + CORS + admin bootstrap

**Files:**
- Create: `placement-test-worker/src/index.ts`
- Create: `placement-test-worker/migrations/0003_seed_admin.sql`

**Interfaces:**
- Consumes: every `handle*` function from Tasks 4-6.
- Produces: the deployed Worker's public HTTP surface, consumed by the Astro frontend in Task 8.

```ts
// placement-test-worker/src/index.ts
import type { Env } from './types';
import { handleStartSession, handleAnswer } from './routes/session';
import { handleListSlots, handleCreateBooking } from './routes/booking';
import {
  requireAdmin, handleAdminLogin, handleAdminListSlots, handleAdminCreateSlot, handleAdminDeleteSlot,
  handleAdminListBookings, handleAdminListQuestions, handleAdminCreateQuestion, handleAdminSetQuestionActive,
} from './routes/admin';

const ALLOWED_ORIGINS = ['https://elc.com.sa', 'http://localhost:4321'];

function withCors(res: Response, origin: string | null): Response {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const headers = new Headers(res.headers);
  headers.set('access-control-allow-origin', allow);
  headers.set('access-control-allow-credentials', 'true');
  headers.set('access-control-allow-headers', 'content-type');
  headers.set('access-control-allow-methods', 'GET,POST,DELETE,PATCH,OPTIONS');
  return new Response(res.body, { status: res.status, headers });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('origin');
    if (req.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), origin);

    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

    try {
      if (parts[0] !== 'api') return withCors(new Response('not found', { status: 404 }), origin);

      if (parts[1] === 'session' && parts.length === 2 && req.method === 'POST') {
        return withCors(await handleStartSession(req, env), origin);
      }
      if (parts[1] === 'session' && parts[3] === 'answer' && req.method === 'POST') {
        return withCors(await handleAnswer(req, env, parts[2]), origin);
      }
      if (parts[1] === 'slots' && parts.length === 2 && req.method === 'GET') {
        return withCors(await handleListSlots(req, env), origin);
      }
      if (parts[1] === 'bookings' && parts.length === 2 && req.method === 'POST') {
        return withCors(await handleCreateBooking(req, env), origin);
      }
      if (parts[1] === 'admin' && parts[2] === 'login' && req.method === 'POST') {
        return withCors(await handleAdminLogin(req, env), origin);
      }
      if (parts[1] === 'admin') {
        const unauthorized = await requireAdmin(req, env);
        if (unauthorized) return withCors(unauthorized, origin);

        if (parts[2] === 'slots' && parts.length === 3 && req.method === 'GET') return withCors(await handleAdminListSlots(req, env), origin);
        if (parts[2] === 'slots' && parts.length === 3 && req.method === 'POST') return withCors(await handleAdminCreateSlot(req, env), origin);
        if (parts[2] === 'slots' && parts.length === 4 && req.method === 'DELETE') return withCors(await handleAdminDeleteSlot(req, env, parts[3]), origin);
        if (parts[2] === 'bookings' && req.method === 'GET') return withCors(await handleAdminListBookings(req, env), origin);
        if (parts[2] === 'questions' && parts.length === 3 && req.method === 'GET') return withCors(await handleAdminListQuestions(req, env), origin);
        if (parts[2] === 'questions' && parts.length === 3 && req.method === 'POST') return withCors(await handleAdminCreateQuestion(req, env), origin);
        if (parts[2] === 'questions' && parts.length === 4 && req.method === 'PATCH') return withCors(await handleAdminSetQuestionActive(req, env, parts[3]), origin);
      }
      return withCors(new Response('not found', { status: 404 }), origin);
    } catch (err) {
      return withCors(new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { 'content-type': 'application/json' } }), origin);
    }
  },
};
```

`placement-test-worker/migrations/0003_seed_admin.sql` — placeholder only, real password set via Step 2:

```sql
-- Placeholder row; password_hash is replaced by the bootstrap step below before this
-- ever runs against a real (non-local) database. Do not deploy with this hash.
INSERT INTO admin_users (id, username, password_hash) VALUES ('admin-1', 'staff', 'REPLACE_ME');
```

- [ ] **Step 1: Add `src/index.ts`.**

- [ ] **Step 2: Generate a real admin password hash and bootstrap the local DB** (do this again against `--remote` at deploy time with a real chosen password — never commit the real hash to `0003_seed_admin.sql`, run it as a one-off `wrangler d1 execute` command instead):

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'choose-a-real-password'
npx wrangler d1 execute placement-test --local --command "INSERT INTO admin_users (id, username, password_hash) VALUES ('admin-1','staff','<PASTE_HASH_HERE>')"
```

Delete `migrations/0003_seed_admin.sql` (it was scratch guidance, not a real migration to commit) — admin bootstrapping is a manual `wrangler d1 execute` step per environment, documented in Task 9's README, not a checked-in seed with a real credential.

- [ ] **Step 3: Set the cookie-signing secret**

```bash
npx wrangler secret put ADMIN_COOKIE_SECRET
# paste a long random string when prompted
```

- [ ] **Step 4: Smoke-test locally**

```bash
npx wrangler dev &
curl -X POST http://localhost:8787/api/session -d '{"name":"T","phone":"1","dob":"1995-01-01","locale":"en"}'
```

Expected: JSON with `sessionId`, `track: "adults"`, and a `prompt`.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests from Tasks 2, 4, 5, 6 pass.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "Wire up placement-test-worker router with CORS and admin auth gate"
```

---

## Task 8: `placementApi.ts` frontend client

**Files:**
- Create: `src/lib/placementApi.ts`

**Interfaces:**
- Consumes: the Worker's HTTP API from Task 7 (base URL via `PUBLIC_PLACEMENT_API_URL` env var, same `PUBLIC_`-prefix convention as `PUBLIC_GTM_ID`).
- Produces: `startSession`, `submitAnswer`, `listSlots`, `createBooking` — used verbatim by Task 9's components.

```ts
// src/lib/placementApi.ts
const BASE = import.meta.env.PUBLIC_PLACEMENT_API_URL as string;

export interface StartSessionInput {
  name: string;
  phone: string;
  dob: string;
  guardianName?: string;
  locale: 'en' | 'ar';
}

export interface QuestionPayload {
  done: false;
  sessionId?: string;
  track?: 'kids' | 'adults';
  questionId: string;
  prompt: string;
  options: string[];
}

export interface DonePayload {
  done: true;
  level: string;
}

export type SessionStep = (QuestionPayload | DonePayload) & { sessionId?: string; track?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`placement API ${path} failed: ${res.status}`);
  return res.json();
}

export function startSession(input: StartSessionInput) {
  return request<SessionStep & { sessionId: string; track: string }>('/api/session', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function submitAnswer(sessionId: string, questionId: string, selectedIndex: number) {
  return request<SessionStep>(`/api/session/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ questionId, selectedIndex }),
  });
}

export function listSlots() {
  return request<{ slots: Array<{ id: string; starts_at: string; remaining: number }> }>('/api/slots');
}

export function createBooking(sessionId: string, slotId: string) {
  return request<{ bookingId: string } | { error: string }>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify({ sessionId, slotId }),
  });
}
```

- [ ] **Step 1: Add the file above.**
- [ ] **Step 2: Add `PUBLIC_PLACEMENT_API_URL=` to `.env.example`** (root of the Astro project), documenting it the same way `PUBLIC_GTM_ID` is documented:

```
# Base URL of the deployed placement-test-worker, e.g. https://placement-test.yourname.workers.dev
PUBLIC_PLACEMENT_API_URL=
```

- [ ] **Step 3: Type-check the Astro project**

```bash
npm run build
```

Expected: build succeeds (the file is unused until Task 9 imports it, so this just confirms no TS errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/placementApi.ts .env.example
git commit -m "Add typed frontend client for the placement-test Worker API"
```

---

## Task 9: Student-facing pages (registration → test → result → booking)

**Files:**
- Create: `src/components/placement-test/RegistrationForm.astro`
- Create: `src/components/placement-test/TestRunner.astro`
- Create: `src/components/placement-test/ResultBooking.astro`
- Create: `src/pages/en/placement-test/index.astro`
- Create: `src/pages/ar/placement-test/index.astro`
- Modify: `src/i18n/ui.ts` — add a `placementTest` key block for `en`/`ar`

**Interfaces:**
- Consumes: `startSession`, `submitAnswer`, `listSlots`, `createBooking` from Task 8.

- [ ] **Step 1: Add i18n strings** — open `src/i18n/ui.ts` and add, inside each locale's existing top-level object (follow the file's existing key style):

```ts
placementTest: {
  heading: 'Placement Test',
  formName: 'Full name',
  formPhone: 'WhatsApp number',
  formDob: 'Date of birth',
  formGuardian: 'Guardian name',
  formSubmit: 'Start test',
  questionOf: 'Question',
  resultHeading: 'Your estimated level',
  bookingHeading: 'Choose a time for your oral test',
  bookingConfirm: 'Confirm booking',
  whatsappConfirm: 'Send confirmation on WhatsApp',
},
```

(Arabic locale gets the equivalent translated block under the same key path — translate each string, keep the key names identical.)

- [ ] **Step 2: `RegistrationForm.astro`** — plain HTML form + inline `<script>`, no framework, matching `RegistrationExperience.astro`'s existing style:

```astro
---
export interface Props { locale: 'en' | 'ar'; t: any }
const { locale, t } = Astro.props;
---
<form id="placement-registration" class="card">
  <label>{t.placementTest.formName}<input required name="name" type="text" /></label>
  <label>{t.placementTest.formPhone}<input required name="phone" type="tel" /></label>
  <label>{t.placementTest.formDob}<input required name="dob" type="date" /></label>
  <label id="guardian-field" hidden>{t.placementTest.formGuardian}<input name="guardianName" type="text" /></label>
  <button type="submit">{t.placementTest.formSubmit}</button>
</form>

<script define:vars={{ locale }}>
  const form = document.getElementById('placement-registration');
  const dobInput = form.querySelector('input[name="dob"]');
  const guardianField = document.getElementById('guardian-field');

  function isMinor(dobValue) {
    const age = (Date.now() - new Date(dobValue).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return age < 16;
  }

  dobInput.addEventListener('change', () => {
    guardianField.hidden = !isMinor(dobInput.value);
    guardianField.querySelector('input').required = !guardianField.hidden;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    document.dispatchEvent(new CustomEvent('placement:register', { detail: { ...data, locale } }));
  });
</script>
```

- [ ] **Step 3: `TestRunner.astro`** — listens for the registration event, drives the test loop:

```astro
---
export interface Props { t: any }
const { t } = Astro.props;
---
<section id="placement-test-runner" hidden>
  <p id="pt-progress"></p>
  <p id="pt-prompt"></p>
  <div id="pt-options"></div>
</section>

<script>
  import { startSession, submitAnswer } from '../../lib/placementApi';

  const runner = document.getElementById('placement-test-runner')!;
  const progressEl = document.getElementById('pt-progress')!;
  const promptEl = document.getElementById('pt-prompt')!;
  const optionsEl = document.getElementById('pt-options')!;
  let sessionId = '';
  let questionNum = 0;

  function renderQuestion(step: any) {
    questionNum++;
    progressEl.textContent = `${questionNum}`;
    promptEl.textContent = step.prompt;
    optionsEl.innerHTML = '';
    step.options.forEach((opt: string, idx: number) => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      btn.addEventListener('click', async () => {
        const next = await submitAnswer(sessionId, step.questionId, idx);
        if (next.done) {
          document.dispatchEvent(new CustomEvent('placement:done', { detail: { level: (next as any).level, sessionId } }));
          runner.hidden = true;
        } else {
          renderQuestion(next);
        }
      });
      optionsEl.appendChild(btn);
    });
  }

  document.addEventListener('placement:register', async (e: any) => {
    const step = await startSession(e.detail);
    sessionId = step.sessionId;
    runner.hidden = false;
    renderQuestion(step);
  });
</script>
```

- [ ] **Step 4: `ResultBooking.astro`** — shows level, slot list, booking + WhatsApp confirm:

```astro
---
export interface Props { t: any; whatsappNumber: string }
const { t, whatsappNumber } = Astro.props;
---
<section id="placement-result" hidden>
  <h2>{t.placementTest.resultHeading}: <span id="pt-level"></span></h2>
  <h3>{t.placementTest.bookingHeading}</h3>
  <ul id="pt-slots"></ul>
  <a id="pt-whatsapp" hidden target="_blank" rel="noopener">{t.placementTest.whatsappConfirm}</a>
</section>

<script define:vars={{ whatsappNumber }}>
  import { listSlots, createBooking } from '../../lib/placementApi';

  const section = document.getElementById('placement-result');
  const levelEl = document.getElementById('pt-level');
  const slotsEl = document.getElementById('pt-slots');
  const waLink = document.getElementById('pt-whatsapp');
  let studentName = '';

  document.addEventListener('placement:register', (e) => { studentName = e.detail.name; });

  document.addEventListener('placement:done', async (e) => {
    section.hidden = false;
    levelEl.textContent = e.detail.level;
    const { slots } = await listSlots();
    slotsEl.innerHTML = '';
    slots.forEach((slot) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.textContent = new Date(slot.starts_at).toLocaleString();
      btn.addEventListener('click', async () => {
        const result = await createBooking(e.detail.sessionId, slot.id);
        if ('error' in result) {
          alert('That slot just filled up — please pick another.');
          return;
        }
        const text = encodeURIComponent(
          `Hi, I'm ${studentName}. My estimated level is ${e.detail.level} and I booked an oral test slot for ${new Date(slot.starts_at).toLocaleString()}.`
        );
        waLink.href = `https://wa.me/${whatsappNumber}?text=${text}`;
        waLink.hidden = false;
      });
      li.appendChild(btn);
      slotsEl.appendChild(li);
    });
  });
</script>
```

- [ ] **Step 5: Page wiring** — `src/pages/en/placement-test/index.astro` (Arabic page is identical but imports the `ar` locale's `t` and passes `locale="ar"`):

```astro
---
import Layout from '../../../layouts/Layout.astro';
import RegistrationForm from '../../../components/placement-test/RegistrationForm.astro';
import TestRunner from '../../../components/placement-test/TestRunner.astro';
import ResultBooking from '../../../components/placement-test/ResultBooking.astro';
import { ui } from '../../../i18n/ui';

const t = ui.en;
const WHATSAPP_NUMBER = '966500000000'; // TODO: confirm the real center WhatsApp number before launch
---
<Layout title={t.placementTest.heading} locale="en">
  <h1>{t.placementTest.heading}</h1>
  <RegistrationForm locale="en" t={t} />
  <TestRunner t={t} />
  <ResultBooking t={t} whatsappNumber={WHATSAPP_NUMBER} />
</Layout>
```

- [ ] **Step 6: Manual QA** — run `npm run dev` and `npx wrangler dev` (Task 7) side by side, walk through: register as an adult (age ≥16) → answer several questions → reach a result → book a slot → WhatsApp link opens prefilled. Repeat once with a DOB that makes `guardian-field` appear.

- [ ] **Step 7: Commit**

```bash
git add src/components/placement-test/ src/pages/en/placement-test/ src/pages/ar/placement-test/ src/i18n/ui.ts
git commit -m "Add student-facing placement test pages (registration, adaptive test, result, booking)"
```

---

## Task 10: Admin page

**Files:**
- Create: `src/components/placement-test/AdminPanel.astro`
- Create: `src/pages/en/placement-test/admin.astro`

**Interfaces:**
- Consumes: `PUBLIC_PLACEMENT_API_URL` (same as Task 8) for `/api/admin/*` endpoints directly (no shared client needed — admin calls are few and page-local).

```astro
---
// src/components/placement-test/AdminPanel.astro
---
<section id="admin-login">
  <label>Username <input id="admin-username" /></label>
  <label>Password <input id="admin-password" type="password" /></label>
  <button id="admin-login-btn">Log in</button>
</section>

<section id="admin-dashboard" hidden>
  <h2>Slots</h2>
  <form id="slot-form">
    <input id="slot-starts-at" type="datetime-local" required />
    <input id="slot-capacity" type="number" min="1" value="4" required />
    <button type="submit">Add slot</button>
  </form>
  <ul id="slot-list"></ul>

  <h2>Upcoming bookings</h2>
  <ul id="booking-list"></ul>

  <h2>Question bank</h2>
  <ul id="question-list"></ul>
</section>

<script>
  const BASE = import.meta.env.PUBLIC_PLACEMENT_API_URL as string;

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(`${BASE}${path}`, { ...init, credentials: 'include', headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  document.getElementById('admin-login-btn')!.addEventListener('click', async () => {
    const username = (document.getElementById('admin-username') as HTMLInputElement).value;
    const password = (document.getElementById('admin-password') as HTMLInputElement).value;
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      document.getElementById('admin-login')!.setAttribute('hidden', '');
      document.getElementById('admin-dashboard')!.removeAttribute('hidden');
      await loadAll();
    } catch {
      alert('Login failed');
    }
  });

  async function loadAll() {
    const [{ slots }, { bookings }, { questions }] = await Promise.all([
      api('/api/admin/slots'), api('/api/admin/bookings'), api('/api/admin/questions'),
    ]);
    const slotList = document.getElementById('slot-list')!;
    slotList.innerHTML = '';
    slots.forEach((s: any) => {
      const li = document.createElement('li');
      li.textContent = `${new Date(s.starts_at).toLocaleString()} — ${s.booked_count}/${s.capacity} `;
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.addEventListener('click', async () => { await api(`/api/admin/slots/${s.id}`, { method: 'DELETE' }); loadAll(); });
      li.appendChild(del);
      slotList.appendChild(li);
    });

    const bookingList = document.getElementById('booking-list')!;
    bookingList.innerHTML = '';
    bookings.forEach((b: any) => {
      const li = document.createElement('li');
      li.textContent = `${b.student_name} (${b.phone}) — level ${b.estimated_level} — ${new Date(b.starts_at).toLocaleString()}`;
      bookingList.appendChild(li);
    });

    const questionList = document.getElementById('question-list')!;
    questionList.innerHTML = '';
    questions.forEach((q: any) => {
      const li = document.createElement('li');
      li.textContent = `[${q.track}/${q.level}] ${q.prompt} ${q.active ? '' : '(inactive)'} `;
      const toggle = document.createElement('button');
      toggle.textContent = q.active ? 'Deactivate' : 'Activate';
      toggle.addEventListener('click', async () => { await api(`/api/admin/questions/${q.id}`, { method: 'PATCH', body: JSON.stringify({ active: !q.active }) }); loadAll(); });
      li.appendChild(toggle);
      questionList.appendChild(li);
    });
  }

  document.getElementById('slot-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const startsAt = (document.getElementById('slot-starts-at') as HTMLInputElement).value;
    const capacity = Number((document.getElementById('slot-capacity') as HTMLInputElement).value);
    await api('/api/admin/slots', { method: 'POST', body: JSON.stringify({ startsAt: new Date(startsAt).toISOString(), capacity }) });
    await loadAll();
  });
</script>
```

```astro
---
// src/pages/en/placement-test/admin.astro
import Layout from '../../../layouts/Layout.astro';
import AdminPanel from '../../../components/placement-test/AdminPanel.astro';
---
<Layout title="Placement Test Admin" locale="en" noindex={true}>
  <AdminPanel />
</Layout>
```

- [ ] **Step 1: Add the two files above.** (Confirm `Layout.astro` accepts a `noindex` prop — if it doesn't yet, add one that renders `<meta name="robots" content="noindex" />` when true; the 404 page already sets `noindex`, so follow that existing pattern.)
- [ ] **Step 2: Manual QA** — log in with the credentials bootstrapped in Task 7 Step 2, create a slot, confirm it appears, run through Task 9's booking flow in another tab, confirm the booking shows up here, toggle a question inactive and confirm it stops appearing in the test (spot-check via the Worker test suite's existing coverage, or a manual `curl`).
- [ ] **Step 3: Commit**

```bash
git add src/components/placement-test/AdminPanel.astro src/pages/en/placement-test/admin.astro
git commit -m "Add admin page for slot, booking, and question-bank management"
```

---

## Task 11: Deployment docs

**Files:**
- Create: `placement-test-worker/README.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Write the README**

```markdown
# placement-test-worker

Cloudflare Worker + D1 backend for the remote placement test and oral-test
booking flow. See `docs/superpowers/specs/2026-08-25-placement-test-design.md`
in the main repo for the full design.

## First-time deploy

1. `npm install`
2. `npx wrangler d1 create placement-test` — copy the printed `database_id`
   into `wrangler.toml`.
3. `npm run db:migrate:remote` — creates tables and loads the 72 placeholder
   questions. Do **not** run `0003_seed_admin.sql` (it isn't a real
   migration); instead bootstrap the admin account directly:
   ```
   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'your-real-password'
   npx wrangler d1 execute placement-test --remote --command "INSERT INTO admin_users (id, username, password_hash) VALUES ('admin-1','staff','<PASTE_HASH>')"
   ```
4. `npx wrangler secret put ADMIN_COOKIE_SECRET` — paste a long random string.
5. `npx wrangler deploy` — note the printed `*.workers.dev` URL (or configure
   a custom route/domain in `wrangler.toml` first).
6. In the main Astro project, set `PUBLIC_PLACEMENT_API_URL` (as a repo
   secret for CI builds, and in local `.env`) to that URL.
7. In `src/index.ts`, add the deployed site's real origin to
   `ALLOWED_ORIGINS` if it differs from `https://elc.com.sa`.

## Replacing the placeholder question bank

The seed migration (`migrations/0002_seed_questions.sql`) inserts 72
clearly-labeled placeholder items. To replace them with real content:

```
npx wrangler d1 execute placement-test --remote --command "DELETE FROM questions"
```

then insert the real bank either via the admin page's question form
(Task 10) or a new SQL file run the same way as the seed migration.

## Local development

```
npm run db:migrate:local   # first time only
npx wrangler dev           # serves the Worker on localhost:8787
npm test                   # runs the Vitest suite against a local D1
```
```

- [ ] **Step 2: Commit**

```bash
git add placement-test-worker/README.md
git commit -m "Add placement-test-worker deployment README"
```

---

## Self-Review Notes

- **Spec coverage**: registration form (Task 9), adaptive algorithm exactly as specified (Task 2), kids/adults track auto-derived from DOB (Task 3 `computeTrack`), booking race-safety (Task 5, tested), WhatsApp confirmation matching existing pattern (Task 9 `ResultBooking.astro`), admin page with slots/bookings/questions (Task 10), placeholder question bank clearly labeled and swappable (Task 1, documented in Task 11), error handling for a full slot (409 handled in both Task 5's route and Task 9's UI) and for Worker downtime (documented as a fast-follow — not implemented in this plan; flagged below).
- **Gap found and accepted as out-of-scope for this plan**: the spec's "Worker/D1 unavailable → fallback WhatsApp link on the registration form" error path isn't implemented as a task here — it's a small addition to `RegistrationForm.astro`'s submit handler (wrap in try/catch, show a static WhatsApp link on failure). Left out of this plan to keep Task 9 focused; call it out to the user as a follow-up task before launch.
- **Type consistency checked**: `SessionRow`/`QuestionRow` field names in `types.ts` match column names used in `db.ts`; the `SessionStep`/`QuestionPayload`/`DonePayload` shapes in `placementApi.ts` match the JSON actually returned by `session.ts`'s `nextQuestionPayload`/`handleAnswer`.
