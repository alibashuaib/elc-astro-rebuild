-- Adds a free-text-answer question type alongside the existing 4-option MCQ
-- type, so the engine can serve items that don't fit "pick one of four"
-- (handwriting/letter recognition, fill-in-the-blank, counting) --
-- see migrations/0005_kids_text_and_vocab_questions.sql for the real content
-- this unlocks.
--
-- Existing rows are unaffected: `type` defaults to 'mcq' for all of them.
-- Text-type rows still satisfy the pre-existing NOT NULL/CHECK constraints
-- on options/correct_index by storing options='[]' and correct_index=0
-- (unused placeholders for that row); the real answer key lives in the new
-- expected_answer column.
--
-- responses.selected_index is likewise left NOT NULL for backward
-- compatibility -- text-type responses store -1 there (a documented
-- sentinel, see db.ts/insertResponse) and the actual typed answer goes in
-- the new responses.answer_text column instead.

ALTER TABLE questions ADD COLUMN type TEXT NOT NULL DEFAULT 'mcq' CHECK (type IN ('mcq', 'text'));
ALTER TABLE questions ADD COLUMN expected_answer TEXT;

ALTER TABLE responses ADD COLUMN answer_text TEXT;
