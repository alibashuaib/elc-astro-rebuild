-- Text-type answers were graded case-sensitively across the board (see
-- session.ts's normalizeAnswer), on the theory that some items test
-- capitalization itself. In practice only the 9 explicit capital/small
-- letter handwriting items actually test that -- every other text-type
-- question (fill-in-the-blank, counting, vocab) was being marked wrong for
-- harmless casing (e.g. typing "tv" instead of "TV"), which has nothing to
-- do with what those items are meant to assess.
--
-- Adds `case_sensitive`, defaulting to 0 (case-insensitive), and flips it on
-- only for the questions that explicitly ask for a capital or small letter.

ALTER TABLE questions ADD COLUMN case_sensitive INTEGER NOT NULL DEFAULT 0;

UPDATE questions SET case_sensitive = 1
WHERE id IN ('kids-A1-1', 'kids-A1-2', 'kids-A1-3', 'kids-A1-4', 'kids-A1-5', 'kids-A1-6', 'kids-A1-7', 'kids-A2-1', 'kids-A2-2');
