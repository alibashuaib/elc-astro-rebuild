CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES test_sessions(id),
  course TEXT NOT NULL,
  guardian_name TEXT,          -- kids track only, NULL for adults
  id_number TEXT NOT NULL,     -- national ID / passport number
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES admin_users(id)
);

CREATE TABLE application_documents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  kind TEXT NOT NULL CHECK (kind IN ('id_copy','photo','other')),
  r2_key TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_applications_session ON applications(session_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_application_documents_application ON application_documents(application_id);
