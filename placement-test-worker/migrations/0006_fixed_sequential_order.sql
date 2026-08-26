-- Switches the test from an adaptive CEFR-level-jumping engine to a
-- fixed, sequential walk-through per track, matching the exact question
-- order in the source paper tests (Adult Placement Test / Kids Placement
-- Test). See src/db.ts's pickNextQuestion and src/routes/session.ts for
-- the selection-query change this unlocks -- questions are now served in
-- ascending `sequence` order per track, ignoring `level` for selection
-- (the `level` column is kept only as descriptive metadata / for the
-- admin panel; the CEFR-level scoring math in scoring.ts is unchanged and
-- still produces the session's final estimated level from the answers
-- given, in this fixed order, rather than driving which question comes
-- next).
--
-- `sequence` reconstructs each item's original position in its source
-- document: adults 1-50 (0003_real_questions.sql's bucket order is
-- itself the exact document order -- see that file's comment), kids
-- 1-39 (0005_kids_text_and_vocab_questions.sql, same property).

ALTER TABLE questions ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0;

UPDATE questions SET sequence = 1 WHERE id = 'adults-A1-1';
UPDATE questions SET sequence = 2 WHERE id = 'adults-A1-2';
UPDATE questions SET sequence = 3 WHERE id = 'adults-A1-3';
UPDATE questions SET sequence = 4 WHERE id = 'adults-A1-4';
UPDATE questions SET sequence = 5 WHERE id = 'adults-A1-5';
UPDATE questions SET sequence = 6 WHERE id = 'adults-A1-6';
UPDATE questions SET sequence = 7 WHERE id = 'adults-A1-7';
UPDATE questions SET sequence = 8 WHERE id = 'adults-A1-8';
UPDATE questions SET sequence = 9 WHERE id = 'adults-A1-9';
UPDATE questions SET sequence = 10 WHERE id = 'adults-A2-1';
UPDATE questions SET sequence = 11 WHERE id = 'adults-A2-2';
UPDATE questions SET sequence = 12 WHERE id = 'adults-A2-3';
UPDATE questions SET sequence = 13 WHERE id = 'adults-A2-4';
UPDATE questions SET sequence = 14 WHERE id = 'adults-A2-5';
UPDATE questions SET sequence = 15 WHERE id = 'adults-A2-6';
UPDATE questions SET sequence = 16 WHERE id = 'adults-A2-7';
UPDATE questions SET sequence = 17 WHERE id = 'adults-A2-8';
UPDATE questions SET sequence = 18 WHERE id = 'adults-A2-9';
UPDATE questions SET sequence = 19 WHERE id = 'adults-B1-1';
UPDATE questions SET sequence = 20 WHERE id = 'adults-B1-2';
UPDATE questions SET sequence = 21 WHERE id = 'adults-B1-3';
UPDATE questions SET sequence = 22 WHERE id = 'adults-B1-4';
UPDATE questions SET sequence = 23 WHERE id = 'adults-B1-5';
UPDATE questions SET sequence = 24 WHERE id = 'adults-B1-6';
UPDATE questions SET sequence = 25 WHERE id = 'adults-B1-7';
UPDATE questions SET sequence = 26 WHERE id = 'adults-B1-8';
UPDATE questions SET sequence = 27 WHERE id = 'adults-B2-1';
UPDATE questions SET sequence = 28 WHERE id = 'adults-B2-2';
UPDATE questions SET sequence = 29 WHERE id = 'adults-B2-3';
UPDATE questions SET sequence = 30 WHERE id = 'adults-B2-4';
UPDATE questions SET sequence = 31 WHERE id = 'adults-B2-5';
UPDATE questions SET sequence = 32 WHERE id = 'adults-B2-6';
UPDATE questions SET sequence = 33 WHERE id = 'adults-B2-7';
UPDATE questions SET sequence = 34 WHERE id = 'adults-B2-8';
UPDATE questions SET sequence = 35 WHERE id = 'adults-C1-1';
UPDATE questions SET sequence = 36 WHERE id = 'adults-C1-2';
UPDATE questions SET sequence = 37 WHERE id = 'adults-C1-3';
UPDATE questions SET sequence = 38 WHERE id = 'adults-C1-4';
UPDATE questions SET sequence = 39 WHERE id = 'adults-C1-5';
UPDATE questions SET sequence = 40 WHERE id = 'adults-C1-6';
UPDATE questions SET sequence = 41 WHERE id = 'adults-C1-7';
UPDATE questions SET sequence = 42 WHERE id = 'adults-C1-8';
UPDATE questions SET sequence = 43 WHERE id = 'adults-C2-1';
UPDATE questions SET sequence = 44 WHERE id = 'adults-C2-2';
UPDATE questions SET sequence = 45 WHERE id = 'adults-C2-3';
UPDATE questions SET sequence = 46 WHERE id = 'adults-C2-4';
UPDATE questions SET sequence = 47 WHERE id = 'adults-C2-5';
UPDATE questions SET sequence = 48 WHERE id = 'adults-C2-6';
UPDATE questions SET sequence = 49 WHERE id = 'adults-C2-7';
UPDATE questions SET sequence = 50 WHERE id = 'adults-C2-8';
UPDATE questions SET sequence = 1 WHERE id = 'kids-A1-1';
UPDATE questions SET sequence = 2 WHERE id = 'kids-A1-2';
UPDATE questions SET sequence = 3 WHERE id = 'kids-A1-3';
UPDATE questions SET sequence = 4 WHERE id = 'kids-A1-4';
UPDATE questions SET sequence = 5 WHERE id = 'kids-A1-5';
UPDATE questions SET sequence = 6 WHERE id = 'kids-A1-6';
UPDATE questions SET sequence = 7 WHERE id = 'kids-A1-7';
UPDATE questions SET sequence = 8 WHERE id = 'kids-A2-1';
UPDATE questions SET sequence = 9 WHERE id = 'kids-A2-2';
UPDATE questions SET sequence = 10 WHERE id = 'kids-A2-3';
UPDATE questions SET sequence = 11 WHERE id = 'kids-A2-4';
UPDATE questions SET sequence = 12 WHERE id = 'kids-A2-5';
UPDATE questions SET sequence = 13 WHERE id = 'kids-A2-6';
UPDATE questions SET sequence = 14 WHERE id = 'kids-A2-7';
UPDATE questions SET sequence = 15 WHERE id = 'kids-B1-1';
UPDATE questions SET sequence = 16 WHERE id = 'kids-B1-2';
UPDATE questions SET sequence = 17 WHERE id = 'kids-B1-3';
UPDATE questions SET sequence = 18 WHERE id = 'kids-B1-4';
UPDATE questions SET sequence = 19 WHERE id = 'kids-B1-5';
UPDATE questions SET sequence = 20 WHERE id = 'kids-B1-6';
UPDATE questions SET sequence = 21 WHERE id = 'kids-B1-7';
UPDATE questions SET sequence = 22 WHERE id = 'kids-B2-1';
UPDATE questions SET sequence = 23 WHERE id = 'kids-B2-2';
UPDATE questions SET sequence = 24 WHERE id = 'kids-B2-3';
UPDATE questions SET sequence = 25 WHERE id = 'kids-B2-4';
UPDATE questions SET sequence = 26 WHERE id = 'kids-B2-5';
UPDATE questions SET sequence = 27 WHERE id = 'kids-B2-6';
UPDATE questions SET sequence = 28 WHERE id = 'kids-C1-1';
UPDATE questions SET sequence = 29 WHERE id = 'kids-C1-2';
UPDATE questions SET sequence = 30 WHERE id = 'kids-C1-3';
UPDATE questions SET sequence = 31 WHERE id = 'kids-C1-4';
UPDATE questions SET sequence = 32 WHERE id = 'kids-C1-5';
UPDATE questions SET sequence = 33 WHERE id = 'kids-C1-6';
UPDATE questions SET sequence = 34 WHERE id = 'kids-C2-1';
UPDATE questions SET sequence = 35 WHERE id = 'kids-C2-2';
UPDATE questions SET sequence = 36 WHERE id = 'kids-C2-3';
UPDATE questions SET sequence = 37 WHERE id = 'kids-C2-4';
UPDATE questions SET sequence = 38 WHERE id = 'kids-C2-5';
UPDATE questions SET sequence = 39 WHERE id = 'kids-C2-6';

CREATE INDEX idx_questions_track_sequence ON questions(track, sequence);
