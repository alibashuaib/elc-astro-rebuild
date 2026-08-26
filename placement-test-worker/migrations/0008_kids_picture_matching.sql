-- Adds the kids docx's picture-matching section (Q:2a -- "match the words
-- with the pictures": Book/Pen/Car/Tree/Apple), previously excluded by
-- 0005_kids_text_and_vocab_questions.sql for lack of source images. Since
-- we're supplying our own images rather than the (unavailable) originals,
-- there's no ambiguity about which picture is which word -- each new row's
-- image_url is paired directly with its expected_answer.
--
-- Reuses the existing `text` question type (student types the word; the
-- word bank is shown in full in the prompt, same pattern as the vocab-
-- completion items in 0005) rather than inventing a 4-option MCQ the
-- source doesn't have.

ALTER TABLE questions ADD COLUMN image_url TEXT;

-- Q:2a sits between Q:1(c) missing numbers (kids-A2-6/A2-7/kids-B1-1/B1-2,
-- sequence 13-16) and Q:2(b) room vocabulary (kids-B1-3 onward, currently
-- sequence 17+) in the source document -- shift everything from there
-- onward by 5 to make room, matching 0006's exact-document-order intent.
UPDATE questions SET sequence = sequence + 5 WHERE track = 'kids' AND sequence >= 17;

INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer, image_url, sequence) VALUES
  ('kids-pic-1', 'kids', 'A1+', 'text', 'Match the picture to the word: Book, Pen, Car, Tree, Apple.', '[]', 0, 'Book', '/images/placement-test/book.svg', 17),
  ('kids-pic-2', 'kids', 'A1+', 'text', 'Match the picture to the word: Book, Pen, Car, Tree, Apple.', '[]', 0, 'Pen', '/images/placement-test/pen.svg', 18),
  ('kids-pic-3', 'kids', 'A1+', 'text', 'Match the picture to the word: Book, Pen, Car, Tree, Apple.', '[]', 0, 'Car', '/images/placement-test/car.svg', 19),
  ('kids-pic-4', 'kids', 'A1+', 'text', 'Match the picture to the word: Book, Pen, Car, Tree, Apple.', '[]', 0, 'Tree', '/images/placement-test/tree.svg', 20),
  ('kids-pic-5', 'kids', 'A1+', 'text', 'Match the picture to the word: Book, Pen, Car, Tree, Apple.', '[]', 0, 'Apple', '/images/placement-test/apple.svg', 21);
