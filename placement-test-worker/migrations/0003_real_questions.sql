-- Real placement-test content, replacing the 72 placeholder rows from
-- 0002_seed_questions.sql. Source docs: 'Adult Placement Test (1).pdf'
-- and 'Kids Placement Test1 (2).docx'.
--
-- Level assignment note: neither source document tags questions with a
-- CEFR level. Levels below are assigned by position in the source test
-- (paper placement tests are ordered easiest-to-hardest), split into
-- roughly even buckets across A1-C2. This is an approximation, not a
-- validated CEFR mapping -- review before relying on it pedagogically.
--
-- Kids scope note: only the parts of the source docx that fit this
-- engine's 4-option multiple-choice model went in here (8 grammar/
-- vocabulary MCQ + 5 true/false reading-comprehension items = 13 total).
-- The docx's handwriting (capital/lowercase letters, missing numbers)
-- and picture-matching sections have no digital equivalent in this
-- schema/UI and were intentionally left out of the online test.

DELETE FROM questions;

INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-1', 'adults', 'A1', 'A: What''s your typical week like? B: ___', '["I work every weekday.", "I have other plans.", "If the weather is good, I''m going to the park.", "I''m not doing anything special."]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-2', 'adults', 'A1', 'A: I broke my arm. B: ___', '["That''s interesting.", "That''s too bad. I''m sorry.", "Too bad I wasn''t there!", "Congratulations!"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-3', 'adults', 'A1', 'A: Let''s go shopping. B: ___', '["I''m not sure. What about you?", "That''s too bad. Maybe some other time.", "I''m really sorry. I''m too busy.", "I think I''d like the same thing."]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-4', 'adults', 'A1', 'Alex''s hair isn''t curly. It''s ___.', '["blonde", "light", "short", "straight"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-5', 'adults', 'A1', 'When my wife is late for work, she ___ on her makeup in the car.', '["puts", "is putting", "is going to put", "put"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-6', 'adults', 'A1', 'If she ___ home, she''s going to relax.', '["is going to stay", "stays", "stay", "would like to stay"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-7', 'adults', 'A1', 'A: Excuse me. I''m looking for the Beekman Gallery. B: ___', '["Sorry. You''re out of luck.", "Well, thanks, but I''m not really an art fan.", "Oh. That''s right down the street, on the left side.", "Really? I''d love to go, but I''m busy tonight."]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-8', 'adults', 'A1', 'A: Tell me something about your family. B: Sure. ___', '["What should we do?", "What do you do?", "What do you mean?", "What do you want to know?"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-9', 'adults', 'A1', 'A: Can we make the 5:00 train? B: ___', '["It left ten minutes ago.", "It''s a local.", "It was pretty long, actually.", "It makes two stops."]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-1', 'adults', 'A2', 'John and Carl are brothers. John''s wife is Carl''s ___.', '["cousin", "sister-in-law", "niece", "aunt"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-2', 'adults', 'A2', 'Bruce hardly ever exercises. He''s really ___.', '["modest", "inappropriate", "out of shape", "healthy"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-3', 'adults', 'A2', '___ your sister live?', '["Where", "Where do", "Where is", "Where does"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-4', 'adults', 'A2', 'We ___ a new laptop this afternoon.', '["are buying", "buy", "buys", "is buying"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-5', 'adults', 'A2', '___ milk in the fridge.', '["It''s", "There''s", "They''re", "There are"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-6', 'adults', 'A2', 'There is roast chicken on the menu. ___ roast chicken comes with soup.', '["A", "Any", "The", "An"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-7', 'adults', 'A2', 'Sonia wants to see a movie, but she has an exam tomorrow. She ___ study tonight.', '["can''t", "could", "can", "has to"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-8', 'adults', 'A2', 'I''ll take the green polo shirt. Can you gift wrap ___ for me?', '["it", "them", "her", "him"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-9', 'adults', 'A2', 'What ___ last night?', '["are you doing", "did you do", "you did", "were you"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-1', 'adults', 'B1', 'These loafers aren''t ___. They''re very uncomfortable.', '["the biggest", "too big", "big enough", "bigger"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-2', 'adults', 'B1', 'Rose has ___ seen that movie.', '["before", "ever", "yet", "already"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-3', 'adults', 'B1', 'Anthony ___ in London since 2001.', '["has lived", "lived", "lives", "was living"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-4', 'adults', 'B1', '___ her later?', '["Do you call", "Will you call", "Have you called", "Were you calling"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-5', 'adults', 'B1', 'You ___ make a reservation soon. That restaurant is very popular.', '["used to", "would rather", "had better", "will"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-6', 'adults', 'B1', 'Luckily, I ___ a seat belt when I had the accident.', '["had better wear", "wore", "have worn", "was wearing"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-7', 'adults', 'B1', 'I bought ___ shampoo at the drugstore.', '["some", "any", "much", "many"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-8', 'adults', 'B1', 'I ___ to exercise.', '["enjoy", "need", "dislike", "feel like"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-1', 'adults', 'B2', 'That photograph ___ by Henri Cartier-Bresson in 1954.', '["was taking", "took", "was taken", "has taken"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-2', 'adults', 'B2', 'Our old laptop was ___ fast as the new one. The new one is much faster.', '["almost as", "just as", "not quite as", "not nearly as"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-3', 'adults', 'B2', 'If we eat in a restaurant, I ___ the bill.', '["will pay", "paid", "have paid", "would pay"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-4', 'adults', 'B2', 'If I found a wallet, I ___ it.', '["have returned", "would return", "was returning", "returned"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-5', 'adults', 'B2', 'A: ___ B: No. It''s my first time.', '["Have you seen any good movies lately?", "Have we met before?", "Have you ever been here before?", "Have you been here long?"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-6', 'adults', 'B2', 'A: Be sure not to miss the Louvre Museum while you''re in Paris. B: ___', '["Oh, yeah? What kind?", "What are you up to?", "Sure. What''s the problem?", "Really? Why''s that?"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-7', 'adults', 'B2', 'I''m on time, ___ I?', '["aren''t", "am", "won''t", "don''t"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-8', 'adults', 'B2', 'I ___ the movie when it came out on DVD.', '["was already going to see", "had already seen", "have already seen", "already saw"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-1', 'adults', 'C1', 'I heard she lost a filling, so she ___ be at the dentist.', '["might not", "must not", "must", "might be able to"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-2', 'adults', 'C1', 'My wife needs to have this dress ___ by Saturday.', '["to dry-clean", "dry-clean", "dry-cleaning", "dry-cleaned"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-3', 'adults', 'C1', 'She got her mother ___ the wedding.', '["to plan", "planned", "plan", "planning"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-4', 'adults', 'C1', 'Andre ___ be a doctor, but he changed his mind.', '["might", "was going to", "would", "could have"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-5', 'adults', 'C1', 'Joe ___ married Amy. They would have been happy.', '["may have", "must have", "should have", "had"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-6', 'adults', 'C1', 'The Cherry Blossom Festival is a holiday ___ in Japan every spring.', '["to celebrate", "is celebrated", "who is celebrated", "that is celebrated"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-7', 'adults', 'C1', 'Reading: "Body Talk!" -- Seventy percent of communication comes from ___.', '["nonverbal actions", "talking", "shaking hands", "gestures of introduction"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-8', 'adults', 'C1', 'Reading: "Body Talk!" -- ___ prefer a firm handshake.', '["Eastern Europeans", "North Americans", "The French", "Brazilians"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-1', 'adults', 'C2', 'Reading: "Body Talk!" -- According to the article, ___.', '["Eastern Europeans never shake hands", "French people like firm handshakes", "Brazilians often hug after shaking hands", "Japanese people think the OK sign is rude"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-2', 'adults', 'C2', 'Reading: "Body Talk!" -- If your friendship "gets off on the wrong foot," it ___.', '["ends badly", "begins well", "ends well", "begins badly"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-3', 'adults', 'C2', 'Reading: "Body Talk!" -- The author advises that visitors to other countries should ___.', '["find out what gestures are appropriate there", "never use the OK sign", "avoid gestures and other nonverbal actions", "not learn the local language"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-4', 'adults', 'C2', 'Reading: "Comics: Trash or Treasure?" -- Comics are most popular in ___.', '["the U.S.", "Japan", "Italy", "Mexico"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-5', 'adults', 'C2', 'Reading: "Comics: Trash or Treasure?" -- 6.5 million is the number of ___.', '["copies of manga sold each year", "Japanese people who buy manga each week", "copies of Shonen Jump sold each week", "comic books sold in Japan each week"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-6', 'adults', 'C2', 'Reading: "Comics: Trash or Treasure?" -- People who criticized comics said they ___.', '["encouraged teenagers to choose TV and video games instead of reading", "made people who read them feel guilty", "weren''t a pleasure to read", "caused bad behavior among young people"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-7', 'adults', 'C2', 'Reading: "Comics: Trash or Treasure?" -- Comics do not ___.', '["encourage teenagers to play video games", "provide a useful way to teach academic subjects", "prepare young people to handle computers easily", "get children to think creatively"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-8', 'adults', 'C2', 'Reading: "Comics: Trash or Treasure?" -- The Japanese Education Ministry views comics as ___.', '["trash", "a treasure", "immoral", "a guilty pleasure"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-A1-1', 'kids', 'A1', 'Reading: Talal and Ali -- Ali and Talal are in the same class.', '["True", "False"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-A1-2', 'kids', 'A1', 'Reading: Talal and Ali -- Talal comes to school by bus.', '["True", "False"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-A1-3', 'kids', 'A1', 'Reading: Talal and Ali -- Talal likes English.', '["True", "False"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-A2-1', 'kids', 'A2', 'Reading: Talal and Ali -- Talal gets up at 6 o''clock.', '["True", "False"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-A2-2', 'kids', 'A2', 'Reading: Talal and Ali -- Ali is from Saudi Arabia.', '["True", "False"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-B1-1', 'kids', 'B1', 'He gave ___ a book.', '["my", "me", "mine", "I"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-B1-2', 'kids', 'B1', 'This is the man ___ car broke down.', '["who''s", "whose", "who", "which"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-B2-1', 'kids', 'B2', '___ six o''clock, I get up.', '["in", "at", "on", "for"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-B2-2', 'kids', 'B2', 'Where is Ahmed? He is ___ in the yard.', '["play", "played", "playing", "plays"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-C1-1', 'kids', 'C1', 'Where do sharks live? They live in ___.', '["jungles", "seas", "deserts", "rivers"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-C1-2', 'kids', 'C1', 'Which is the biggest animal in the world? It is ___.', '["the elephant", "the whale", "the giraffe", "the hippo"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-C2-1', 'kids', 'C2', 'What can monkeys do? They can ___.', '["jump", "climb", "fly", "sing"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('kids-C2-2', 'kids', 'C2', 'What does a crocodile have?', '["a long neck", "short legs", "a thin tail", "big ears"]', 1);
