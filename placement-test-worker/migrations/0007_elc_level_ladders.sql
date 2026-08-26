-- Relabels questions.level to ELC's own level ladders (from the
-- 'Adults Structure' and 'General English for Kids' curricular-structure
-- diagrams), replacing the generic 6-tier CEFR A1-C2 scale this project
-- started with. Neither track actually spans A1-C2 in ELC's real
-- curriculum -- adults top out at C1 (no C2), and kids only reach B1 with
-- an extra sub-level between A1 and A2.
--
--   adults: A0, A1, A2, B1, B2, C1
--   kids:   -A1, A1, A1+, A2, A2+, B1
--
-- Same 6-slot bucket assignment/order as before (see 0003/0005's
-- position-based approximation) -- only the label per slot changes, not
-- which questions are in which bucket. See scoring.ts/LEVELS_BY_TRACK,
-- which now mirrors this per track for the session's reported estimated
-- level too.
--
-- The CHECK constraint on questions.level (from 0001_init.sql) doesn't
-- allow these new label strings, and SQLite can't ALTER an existing CHECK
-- constraint in place, so this rebuilds the table with an updated CHECK.
-- The relabel happens inline in the INSERT's SELECT (a CASE per id), not
-- as a separate UPDATE pass afterward -- copying old-label rows in first
-- and relabeling after would violate the new table's CHECK the moment a
-- still-old-labeled 'C2' row got inserted (or, relabeling the *old* table
-- first would violate *its* CHECK, which doesn't allow the new labels
-- either) -- so every row must already carry its final label the instant
-- it's inserted into the new table.

CREATE TABLE questions_new (
  id TEXT PRIMARY KEY,
  track TEXT NOT NULL CHECK (track IN ('kids','adults')),
  level TEXT NOT NULL CHECK (level IN ('A0','A1','A2','B1','B2','C1','-A1','A1+','A2+')),
  type TEXT NOT NULL DEFAULT 'mcq' CHECK (type IN ('mcq', 'text')),
  prompt TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  expected_answer TEXT,
  sequence INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

INSERT INTO questions_new (id, track, level, type, prompt, options, correct_index, expected_answer, sequence, active)
SELECT
  id,
  track,
  CASE
    WHEN id = 'adults-A1-1' THEN 'A0'
    WHEN id = 'adults-A1-2' THEN 'A0'
    WHEN id = 'adults-A1-3' THEN 'A0'
    WHEN id = 'adults-A1-4' THEN 'A0'
    WHEN id = 'adults-A1-5' THEN 'A0'
    WHEN id = 'adults-A1-6' THEN 'A0'
    WHEN id = 'adults-A1-7' THEN 'A0'
    WHEN id = 'adults-A1-8' THEN 'A0'
    WHEN id = 'adults-A1-9' THEN 'A0'
    WHEN id = 'adults-A2-1' THEN 'A1'
    WHEN id = 'adults-A2-2' THEN 'A1'
    WHEN id = 'adults-A2-3' THEN 'A1'
    WHEN id = 'adults-A2-4' THEN 'A1'
    WHEN id = 'adults-A2-5' THEN 'A1'
    WHEN id = 'adults-A2-6' THEN 'A1'
    WHEN id = 'adults-A2-7' THEN 'A1'
    WHEN id = 'adults-A2-8' THEN 'A1'
    WHEN id = 'adults-A2-9' THEN 'A1'
    WHEN id = 'adults-B1-1' THEN 'A2'
    WHEN id = 'adults-B1-2' THEN 'A2'
    WHEN id = 'adults-B1-3' THEN 'A2'
    WHEN id = 'adults-B1-4' THEN 'A2'
    WHEN id = 'adults-B1-5' THEN 'A2'
    WHEN id = 'adults-B1-6' THEN 'A2'
    WHEN id = 'adults-B1-7' THEN 'A2'
    WHEN id = 'adults-B1-8' THEN 'A2'
    WHEN id = 'adults-B2-1' THEN 'B1'
    WHEN id = 'adults-B2-2' THEN 'B1'
    WHEN id = 'adults-B2-3' THEN 'B1'
    WHEN id = 'adults-B2-4' THEN 'B1'
    WHEN id = 'adults-B2-5' THEN 'B1'
    WHEN id = 'adults-B2-6' THEN 'B1'
    WHEN id = 'adults-B2-7' THEN 'B1'
    WHEN id = 'adults-B2-8' THEN 'B1'
    WHEN id = 'adults-C1-1' THEN 'B2'
    WHEN id = 'adults-C1-2' THEN 'B2'
    WHEN id = 'adults-C1-3' THEN 'B2'
    WHEN id = 'adults-C1-4' THEN 'B2'
    WHEN id = 'adults-C1-5' THEN 'B2'
    WHEN id = 'adults-C1-6' THEN 'B2'
    WHEN id = 'adults-C1-7' THEN 'B2'
    WHEN id = 'adults-C1-8' THEN 'B2'
    WHEN id = 'adults-C2-1' THEN 'C1'
    WHEN id = 'adults-C2-2' THEN 'C1'
    WHEN id = 'adults-C2-3' THEN 'C1'
    WHEN id = 'adults-C2-4' THEN 'C1'
    WHEN id = 'adults-C2-5' THEN 'C1'
    WHEN id = 'adults-C2-6' THEN 'C1'
    WHEN id = 'adults-C2-7' THEN 'C1'
    WHEN id = 'adults-C2-8' THEN 'C1'
    WHEN id = 'kids-A1-1' THEN '-A1'
    WHEN id = 'kids-A1-2' THEN '-A1'
    WHEN id = 'kids-A1-3' THEN '-A1'
    WHEN id = 'kids-A1-4' THEN '-A1'
    WHEN id = 'kids-A1-5' THEN '-A1'
    WHEN id = 'kids-A1-6' THEN '-A1'
    WHEN id = 'kids-A1-7' THEN '-A1'
    WHEN id = 'kids-A2-1' THEN 'A1'
    WHEN id = 'kids-A2-2' THEN 'A1'
    WHEN id = 'kids-A2-3' THEN 'A1'
    WHEN id = 'kids-A2-4' THEN 'A1'
    WHEN id = 'kids-A2-5' THEN 'A1'
    WHEN id = 'kids-A2-6' THEN 'A1'
    WHEN id = 'kids-A2-7' THEN 'A1'
    WHEN id = 'kids-B1-1' THEN 'A1+'
    WHEN id = 'kids-B1-2' THEN 'A1+'
    WHEN id = 'kids-B1-3' THEN 'A1+'
    WHEN id = 'kids-B1-4' THEN 'A1+'
    WHEN id = 'kids-B1-5' THEN 'A1+'
    WHEN id = 'kids-B1-6' THEN 'A1+'
    WHEN id = 'kids-B1-7' THEN 'A1+'
    WHEN id = 'kids-B2-1' THEN 'A2'
    WHEN id = 'kids-B2-2' THEN 'A2'
    WHEN id = 'kids-B2-3' THEN 'A2'
    WHEN id = 'kids-B2-4' THEN 'A2'
    WHEN id = 'kids-B2-5' THEN 'A2'
    WHEN id = 'kids-B2-6' THEN 'A2'
    WHEN id = 'kids-C1-1' THEN 'A2+'
    WHEN id = 'kids-C1-2' THEN 'A2+'
    WHEN id = 'kids-C1-3' THEN 'A2+'
    WHEN id = 'kids-C1-4' THEN 'A2+'
    WHEN id = 'kids-C1-5' THEN 'A2+'
    WHEN id = 'kids-C1-6' THEN 'A2+'
    WHEN id = 'kids-C2-1' THEN 'B1'
    WHEN id = 'kids-C2-2' THEN 'B1'
    WHEN id = 'kids-C2-3' THEN 'B1'
    WHEN id = 'kids-C2-4' THEN 'B1'
    WHEN id = 'kids-C2-5' THEN 'B1'
    WHEN id = 'kids-C2-6' THEN 'B1'
    ELSE level
  END AS level,
  type, prompt, options, correct_index, expected_answer, sequence, active
FROM questions;

DROP TABLE questions;
ALTER TABLE questions_new RENAME TO questions;

CREATE INDEX idx_questions_track_level ON questions(track, level, active);
CREATE INDEX idx_questions_track_sequence ON questions(track, sequence);
