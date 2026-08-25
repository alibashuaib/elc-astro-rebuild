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
