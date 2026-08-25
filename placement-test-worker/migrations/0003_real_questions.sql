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

INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-1', 'adults', 'A1', 'A: What''s your typical week like? B: ___', '["If the weather is good, I''m going to the park.", "I work every weekday.", "I have other plans.", "I''m not doing anything special."]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-2', 'adults', 'A1', 'A: I broke my arm. B: ___', '["Congratulations!", "That''s too bad. I''m sorry.", "Too bad I wasn''t there!", "That''s interesting."]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-3', 'adults', 'A1', 'A: Let''s go shopping. B: ___', '["I''m really sorry. I''m too busy.", "I think I''d like the same thing.", "I''m not sure. What about you?", "That''s too bad. Maybe some other time."]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-4', 'adults', 'A1', 'Alex''s hair isn''t curly. It''s ___.', '["short", "blonde", "straight", "light"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-5', 'adults', 'A1', 'When my wife is late for work, she ___ on her makeup in the car.', '["puts", "is going to put", "is putting", "put"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-6', 'adults', 'A1', 'If she ___ home, she''s going to relax.', '["is going to stay", "stay", "would like to stay", "stays"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-7', 'adults', 'A1', 'A: Excuse me. I''m looking for the Beekman Gallery. B: ___', '["Oh. That''s right down the street, on the left side.", "Really? I''d love to go, but I''m busy tonight.", "Sorry. You''re out of luck.", "Well, thanks, but I''m not really an art fan."]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-8', 'adults', 'A1', 'A: Tell me something about your family. B: Sure. ___', '["What do you mean?", "What should we do?", "What do you do?", "What do you want to know?"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A1-9', 'adults', 'A1', 'A: Can we make the 5:00 train? B: ___', '["It makes two stops.", "It''s a local.", "It left ten minutes ago.", "It was pretty long, actually."]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-1', 'adults', 'A2', 'John and Carl are brothers. John''s wife is Carl''s ___.', '["niece", "sister-in-law", "cousin", "aunt"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-2', 'adults', 'A2', 'Bruce hardly ever exercises. He''s really ___.', '["modest", "out of shape", "inappropriate", "healthy"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-3', 'adults', 'A2', '___ your sister live?', '["Where is", "Where do", "Where", "Where does"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-4', 'adults', 'A2', 'We ___ a new laptop this afternoon.', '["are buying", "buy", "buys", "is buying"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-5', 'adults', 'A2', '___ milk in the fridge.', '["There are", "It''s", "They''re", "There''s"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-6', 'adults', 'A2', 'There is roast chicken on the menu. ___ roast chicken comes with soup.', '["A", "The", "Any", "An"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-7', 'adults', 'A2', 'Sonia wants to see a movie, but she has an exam tomorrow. She ___ study tonight.', '["can''t", "has to", "can", "could"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-8', 'adults', 'A2', 'I''ll take the green polo shirt. Can you gift wrap ___ for me?', '["it", "him", "them", "her"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-A2-9', 'adults', 'A2', 'What ___ last night?', '["you did", "were you", "did you do", "are you doing"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-1', 'adults', 'B1', 'These loafers aren''t ___. They''re very uncomfortable.', '["bigger", "too big", "the biggest", "big enough"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-2', 'adults', 'B1', 'Rose has ___ seen that movie.', '["yet", "ever", "already", "before"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-3', 'adults', 'B1', 'Anthony ___ in London since 2001.', '["has lived", "lived", "was living", "lives"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-4', 'adults', 'B1', '___ her later?', '["Were you calling", "Have you called", "Will you call", "Do you call"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-5', 'adults', 'B1', 'You ___ make a reservation soon. That restaurant is very popular.', '["would rather", "used to", "will", "had better"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-6', 'adults', 'B1', 'Luckily, I ___ a seat belt when I had the accident.', '["wore", "was wearing", "have worn", "had better wear"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-7', 'adults', 'B1', 'I bought ___ shampoo at the drugstore.', '["any", "much", "some", "many"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B1-8', 'adults', 'B1', 'I ___ to exercise.', '["enjoy", "dislike", "need", "feel like"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-1', 'adults', 'B2', 'That photograph ___ by Henri Cartier-Bresson in 1954.', '["took", "was taking", "has taken", "was taken"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-2', 'adults', 'B2', 'Our old laptop was ___ fast as the new one. The new one is much faster.', '["just as", "almost as", "not quite as", "not nearly as"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-3', 'adults', 'B2', 'If we eat in a restaurant, I ___ the bill.', '["would pay", "paid", "have paid", "will pay"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-4', 'adults', 'B2', 'If I found a wallet, I ___ it.', '["was returning", "returned", "would return", "have returned"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-5', 'adults', 'B2', 'A: ___ B: No. It''s my first time.', '["Have you ever been here before?", "Have you been here long?", "Have you seen any good movies lately?", "Have we met before?"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-6', 'adults', 'B2', 'A: Be sure not to miss the Louvre Museum while you''re in Paris. B: ___', '["Oh, yeah? What kind?", "Sure. What''s the problem?", "Really? Why''s that?", "What are you up to?"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-7', 'adults', 'B2', 'I''m on time, ___ I?', '["am", "don''t", "aren''t", "won''t"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-B2-8', 'adults', 'B2', 'I ___ the movie when it came out on DVD.', '["already saw", "have already seen", "was already going to see", "had already seen"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-1', 'adults', 'C1', 'I heard she lost a filling, so she ___ be at the dentist.', '["must not", "might be able to", "must", "might not"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-2', 'adults', 'C1', 'My wife needs to have this dress ___ by Saturday.', '["to dry-clean", "dry-clean", "dry-cleaned", "dry-cleaning"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-3', 'adults', 'C1', 'She got her mother ___ the wedding.', '["to plan", "plan", "planned", "planning"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-4', 'adults', 'C1', 'Andre ___ be a doctor, but he changed his mind.', '["would", "was going to", "might", "could have"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-5', 'adults', 'C1', 'Joe ___ married Amy. They would have been happy.', '["must have", "may have", "had", "should have"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-6', 'adults', 'C1', 'The Cherry Blossom Festival is a holiday ___ in Japan every spring.', '["who is celebrated", "is celebrated", "to celebrate", "that is celebrated"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-7', 'adults', 'C1', 'Reading: "Body Talk!" -- Seventy percent of communication comes from ___.', '["talking", "gestures of introduction", "nonverbal actions", "shaking hands"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C1-8', 'adults', 'C1', 'Reading: "Body Talk!" -- ___ prefer a firm handshake.', '["North Americans", "The French", "Eastern Europeans", "Brazilians"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-1', 'adults', 'C2', 'Reading: "Body Talk!" -- According to the article, ___.', '["Eastern Europeans never shake hands", "Brazilians often hug after shaking hands", "French people like firm handshakes", "Japanese people think the OK sign is rude"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-2', 'adults', 'C2', 'Reading: "Body Talk!" -- If your friendship "gets off on the wrong foot," it ___.', '["ends well", "begins badly", "ends badly", "begins well"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-3', 'adults', 'C2', 'Reading: "Body Talk!" -- The author advises that visitors to other countries should ___.', '["not learn the local language", "find out what gestures are appropriate there", "avoid gestures and other nonverbal actions", "never use the OK sign"]', 1);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-4', 'adults', 'C2', 'Reading: "Comics: Trash or Treasure?" -- Comics are most popular in ___.', '["the U.S.", "Mexico", "Japan", "Italy"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-5', 'adults', 'C2', 'Reading: "Comics: Trash or Treasure?" -- 6.5 million is the number of ___.', '["comic books sold in Japan each week", "copies of manga sold each year", "copies of Shonen Jump sold each week", "Japanese people who buy manga each week"]', 2);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-6', 'adults', 'C2', 'Reading: "Comics: Trash or Treasure?" -- People who criticized comics said they ___.', '["caused bad behavior among young people", "encouraged teenagers to choose TV and video games instead of reading", "made people who read them feel guilty", "weren''t a pleasure to read"]', 0);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-7', 'adults', 'C2', 'Reading: "Comics: Trash or Treasure?" -- Comics do not ___.', '["get children to think creatively", "prepare young people to handle computers easily", "provide a useful way to teach academic subjects", "encourage teenagers to play video games"]', 3);
INSERT INTO questions (id, track, level, prompt, options, correct_index) VALUES ('adults-C2-8', 'adults', 'C2', 'Reading: "Comics: Trash or Treasure?" -- The Japanese Education Ministry views comics as ___.', '["trash", "a treasure", "a guilty pleasure", "immoral"]', 1);
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
