-- Adds the reading passage text itself, which until now was never stored
-- anywhere -- only the follow-up questions referencing it (e.g. 'Reading:
-- "Body Talk!" -- Seventy percent of communication comes from ___.') were
-- served, so a student answering them had never actually seen the article.
--
-- A separate `passages` table (rather than a text column repeated on all 10
-- adult reading questions) because 5 questions per passage share the exact
-- same text, and TestRunner.astro should show it once per passage, not
-- re-render it per question.
--
-- Text transcribed from 'Adult Placement Test (1).pdf' pages 4-5 (the two
-- adult reading articles). Kids' "Talal and Ali" reading-comprehension items
-- (kids-A1-1..3, kids-A2-1..2) aren't wired up here -- that passage's source
-- text hasn't been transcribed from the kids docx yet; left for a follow-up.

CREATE TABLE passages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL
);

INSERT INTO passages (id, title, body) VALUES (
  'body-talk',
  'Body Talk!',
  'To communicate well with people of other countries, you must learn to speak well, right? Yes, but speaking isn''t everything. Some experts say only thirty percent of communication comes from talking. Your gestures and other nonverbal actions matter, too.

But in different cultures, the same action can have different meanings. When you have to meet someone from a different culture, be prepared. Do you know what kind of gestures and customs are appropriate?

Let''s look at shaking hands. North Americans like a firm handshake. But the French prefer a light, short handshake. If you shake a French person''s hand the North American way, he or she may not like it. People in Eastern European countries and some Latino cultures prefer shorter handshakes, too. Hugging after shaking hands is also a common introduction there. Don''t be surprised if a Brazilian gives you a hug. If you misinterpret gestures of introduction, your friendship may get off on the wrong foot!

Everyone around the world knows the "OK" hand gesture, don''t they? But in Spain, parts of South America, and Eastern Europe, the OK sign is considered rude. And if you go shopping in Japan, it means you''d like your change in coins instead of bills. In France, making the OK sign means "zero" or that something is worthless. So check before you use the OK sign to be sure it''s OK!

Understanding even a few key gestures from different cultures can make you a better communicator. So next time you travel, try being culturally sensitive. Find out the local gesture and let your body talk.'
);

INSERT INTO passages (id, title, body) VALUES (
  'comics-trash-or-treasure',
  'Comics: Trash or Treasure?',
  'In Japan, they call them manga; in Latin America, historietas; in Italy, fumetti; in Brazil, historia em quadrinhos; and in the U.S., comics. But no matter what you call them, comics are a favorite source of reading pleasure in many parts of the world.

In case you''re wondering how popular comics are, the best-selling comic title in the U.S. sells about 4.5 million copies a year. All of Mexico''s comic titles together sell over 7 million copies a week. But Japan is by far the leading publisher of comics in the world. Manga account for nearly forty percent of all the books and magazines published in Japan each year. And few magazines of any kind in the world can match this number: Shonen Jump, the leading comic title, has a circulation of 6.5 million copies per week!

Ever since comics first appeared, there have been people who have criticized them. In the 1940s and 50s, many people believed that comics were immoral and that they caused bad behavior among young people. Even today, many question whether young people should read them at all. They argue that reading comics encourages bad reading habits.

But some educators see comics as a way to get teenagers to choose reading instead of television and video games. And because of the art, a number of educators have argued that comics are a great way to get children to think creatively. More recent research has suggested that the combination of visuals and text in comics may be one reason young people handle computers and related software so easily.

In Japan, the Education Ministry calls comics "a part of Japan''s national culture, recognized and highly regarded abroad." Comics are increasingly being used for educational purposes, and many publishers there see them as a useful way of teaching history and other subjects.

No matter how you view them, comics remain a guilty pleasure for millions worldwide.'
);

ALTER TABLE questions ADD COLUMN passage_id TEXT REFERENCES passages(id);

UPDATE questions SET passage_id = 'body-talk' WHERE id IN ('adults-C1-7', 'adults-C1-8', 'adults-C2-1', 'adults-C2-2', 'adults-C2-3');
UPDATE questions SET passage_id = 'comics-trash-or-treasure' WHERE id IN ('adults-C2-4', 'adults-C2-5', 'adults-C2-6', 'adults-C2-7', 'adults-C2-8');
