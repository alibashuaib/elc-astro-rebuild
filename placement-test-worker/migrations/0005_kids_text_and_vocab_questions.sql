-- Expands the kids question bank from 13 to 39 items, replacing all
-- existing kids-track rows (adults rows from 0003 are untouched).
--
-- Adds, from 'Kids Placement Test1.docx':
--   - 6 capital-letter + 6 lowercase-letter handwriting items (text type)
--   - 4 missing-number counting items (text type)
--   - 5 room-vocabulary fill-in-the-blank items (text type)
--   - 5 vocab sentence-completion items, previously missed in 0003 (text
--     type, not mcq: the source is a single shared 5-word bank across all
--     5 sentences, not a 4-option MCQ -- forcing it into 4 options would
--     mean inventing a distractor not in the source, so the word bank is
--     shown in the prompt and the student types the word instead)
-- ...on top of the 13 items already seeded by 0003 (5 reading true/false +
-- 4 grammar MCQ + 4 animal-facts MCQ), all re-inserted here unchanged.
--
-- Still excluded: the docx's picture-matching section (match Book/Pen/
-- Car/Tree/Apple to pictures) has no digital equivalent without the
-- source images, which are out of scope for this pass.
--
-- Levels are approximated by position in the source document, same
-- caveat as 0003 -- not a validated CEFR mapping.

DELETE FROM questions WHERE track = 'kids';

INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A1-1', 'kids', 'A1', 'text', 'Write the capital letter for "a".', '[]', 0, 'A');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A1-2', 'kids', 'A1', 'text', 'Write the capital letter for "f".', '[]', 0, 'F');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A1-3', 'kids', 'A1', 'text', 'Write the capital letter for "q".', '[]', 0, 'Q');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A1-4', 'kids', 'A1', 'text', 'Write the capital letter for "h".', '[]', 0, 'H');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A1-5', 'kids', 'A1', 'text', 'Write the capital letter for "r".', '[]', 0, 'R');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A1-6', 'kids', 'A1', 'text', 'Write the capital letter for "j".', '[]', 0, 'J');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A1-7', 'kids', 'A1', 'text', 'Write the small letter for "A".', '[]', 0, 'a');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A2-1', 'kids', 'A2', 'text', 'Write the small letter for "B".', '[]', 0, 'b');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A2-2', 'kids', 'A2', 'text', 'Write the small letter for "N".', '[]', 0, 'n');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A2-3', 'kids', 'A2', 'text', 'Write the small letter for "I".', '[]', 0, 'i');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A2-4', 'kids', 'A2', 'text', 'Write the small letter for "E".', '[]', 0, 'e');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A2-5', 'kids', 'A2', 'text', 'Write the small letter for "D".', '[]', 0, 'd');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A2-6', 'kids', 'A2', 'text', 'Count in order: 1, 2, 3, 4, 5, 6, 7. What number comes right after 1?', '[]', 0, '2');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-A2-7', 'kids', 'A2', 'text', 'Count in order: 1, 2, 3, 4, 5, 6, 7. What number comes right before 4?', '[]', 0, '3');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B1-1', 'kids', 'B1', 'text', 'Count in order: 1, 2, 3, 4, 5, 6, 7. What number comes right after 4?', '[]', 0, '5');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B1-2', 'kids', 'B1', 'text', 'Count in order: 1, 2, 3, 4, 5, 6, 7. What number comes right before 7?', '[]', 0, '6');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B1-3', 'kids', 'B1', 'text', 'Fill in the blank: In my living room, there is a ____.', '[]', 0, 'sofa');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B1-4', 'kids', 'B1', 'text', 'Fill in the blank: And a long ____.', '[]', 0, 'curtain');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B1-5', 'kids', 'B1', 'text', 'Fill in the blank: There is a ____ on the wall.', '[]', 0, 'picture');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B1-6', 'kids', 'B1', 'text', 'Fill in the blank: There is a black ____.', '[]', 0, 'TV');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B1-7', 'kids', 'B1', 'text', 'Fill in the blank: There are two ____.', '[]', 0, 'lamps');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B2-1', 'kids', 'B2', 'text', 'Word bank: climbing, flying, playing, riding, throwing. Fill in the blank: She likes ____ the ball.', '[]', 0, 'throwing');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B2-2', 'kids', 'B2', 'text', 'Word bank: climbing, flying, playing, riding, throwing. Fill in the blank: He likes ____ kites.', '[]', 0, 'flying');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B2-3', 'kids', 'B2', 'text', 'Word bank: climbing, flying, playing, riding, throwing. Fill in the blank: They like ____ bikes.', '[]', 0, 'riding');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B2-4', 'kids', 'B2', 'text', 'Word bank: climbing, flying, playing, riding, throwing. Fill in the blank: I like ____ trees.', '[]', 0, 'climbing');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B2-5', 'kids', 'B2', 'text', 'Word bank: climbing, flying, playing, riding, throwing. Fill in the blank: We like ____ chess.', '[]', 0, 'playing');
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-B2-6', 'kids', 'B2', 'mcq', 'Reading: Talal and Ali -- Ali and Talal are in the same class.', '["True", "False"]', 0, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C1-1', 'kids', 'C1', 'mcq', 'Reading: Talal and Ali -- Talal comes to school by bus.', '["True", "False"]', 1, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C1-2', 'kids', 'C1', 'mcq', 'Reading: Talal and Ali -- Talal likes English.', '["True", "False"]', 1, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C1-3', 'kids', 'C1', 'mcq', 'Reading: Talal and Ali -- Talal gets up at 6 o''clock.', '["True", "False"]', 1, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C1-4', 'kids', 'C1', 'mcq', 'Reading: Talal and Ali -- Ali is from Saudi Arabia.', '["True", "False"]', 1, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C1-5', 'kids', 'C1', 'mcq', 'He gave ____ a book.', '["my", "me", "mine", "I"]', 1, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C1-6', 'kids', 'C1', 'mcq', 'This is the man ____ car broke down.', '["who''s", "whose", "who", "which"]', 1, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C2-1', 'kids', 'C2', 'mcq', '____ six o''clock, I get up.', '["in", "at", "on", "for"]', 1, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C2-2', 'kids', 'C2', 'mcq', 'Where is Ahmed? He is ____ in the yard.', '["play", "played", "playing", "plays"]', 2, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C2-3', 'kids', 'C2', 'mcq', 'Where do sharks live? They live in ____.', '["jungles", "seas", "deserts", "rivers"]', 1, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C2-4', 'kids', 'C2', 'mcq', 'Which is the biggest animal in the world? It is ____.', '["the elephant", "the whale", "the giraffe", "the hippo"]', 1, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C2-5', 'kids', 'C2', 'mcq', 'What can monkeys do? They can ____.', '["jump", "climb", "fly", "sing"]', 1, NULL);
INSERT INTO questions (id, track, level, type, prompt, options, correct_index, expected_answer) VALUES ('kids-C2-6', 'kids', 'C2', 'mcq', 'What does a crocodile have?', '["a long neck", "short legs", "a thin tail", "big ears"]', 1, NULL);
