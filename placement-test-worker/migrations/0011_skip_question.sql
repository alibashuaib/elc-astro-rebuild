-- Lets a student skip a question they don't understand instead of being
-- forced to guess. Skipped responses are recorded distinctly from wrong
-- answers (their own `skipped` flag, `selected_index` reuses the existing
-- -1 "no option" sentinel from text-type answers) so admin reporting can
-- tell "answered wrong" apart from "never attempted" later, even though
-- scoring.ts currently treats a skip the same as an incorrect answer for
-- the level estimate (see session.ts's handleAnswer).

ALTER TABLE responses ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0;
