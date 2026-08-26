-- Same fix as 0009 (see its header) but for the kids track's "Talal and Ali"
-- reading-comprehension items, which had the identical gap: the True/False
-- questions were served without the passage they're about.
--
-- Text transcribed from 'Kids Placement Test1 (2).docx', reading section
-- (Q:4a).
--
-- IDs note: the reading items were originally seeded as kids-A1-1..3 /
-- kids-A2-1..2 in 0003_real_questions.sql, but 0005_kids_text_and_vocab_questions.sql
-- did `DELETE FROM questions WHERE track = 'kids'` and re-inserted the whole
-- kids bank -- reusing those same ids for its new handwriting items (e.g.
-- kids-A1-1 is now 'Write the capital letter for "a"') and re-adding the
-- reading questions under new ids: kids-B2-6, kids-C1-1..4. Those are the
-- ones that still hold the reading content today -- verified against the
-- live local DB before writing this migration, not just against 0003.

INSERT INTO passages (id, title, body) VALUES (
  'talal-and-ali',
  'Talal and Ali',
  'My name is Talal. I am Saudi. Ali, my friend, is from Bahrain. We are in the same class. Ali comes to school by bus but, I walk to school because my house is very near the school. Everyday I get up at 5 o''clock, go to the mosque, have breakfast, then walk to school. I like Arabic, but Ali likes English.'
);

UPDATE questions SET passage_id = 'talal-and-ali' WHERE id IN ('kids-B2-6', 'kids-C1-1', 'kids-C1-2', 'kids-C1-3', 'kids-C1-4');
