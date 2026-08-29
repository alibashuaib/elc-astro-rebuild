-- 0012_case_insensitive_grading.sql turned on case_sensitive for the
-- "write the capital/small letter" handwriting items, but its id list
-- only covered 9 of the 12: kids-A1-1..7 and kids-A2-1/A2-2. It missed
-- kids-A2-3 ("Write the small letter for 'I'"), kids-A2-4 ("...'E'"),
-- and kids-A2-5 ("...'D'") -- the same question shape as kids-A2-1/A2-2
-- right next to them, seeded together in 0005_kids_text_and_vocab_questions.sql.
--
-- Effect while unfixed: normalizeAnswer() lowercases both sides before
-- comparing whenever case_sensitive = 0, so a student answering these three
-- items with a capital letter (e.g. "I" for a question that specifically
-- asks for the *small* letter) was graded correct.

UPDATE questions SET case_sensitive = 1 WHERE id IN ('kids-A2-3', 'kids-A2-4', 'kids-A2-5');
