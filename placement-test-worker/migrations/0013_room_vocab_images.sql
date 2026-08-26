-- Wires up images for the room-vocabulary fill-in-the-blank items
-- (kids-B1-3..7, "In my living room there is a ___", etc.). The source
-- docx's Q:2(b) pairs this section with pictures of each item (sofa, a
-- curtain, a picture, a TV, lamps) the same way Q:2(a)'s Book/Pen/Car/
-- Tree/Apple picture-matching does -- but 0005_kids_text_and_vocab_questions.sql
-- only carried over the text, not images, when it first seeded these rows.
-- Same approach as 0008_kids_picture_matching.sql: the original docx images
-- aren't reusable source assets, so these are custom-drawn replacements in
-- the same flat-icon style as the existing book/pen/car/tree/apple set.

UPDATE questions SET image_url = '/images/placement-test/sofa.svg' WHERE id = 'kids-B1-3';
UPDATE questions SET image_url = '/images/placement-test/curtain.svg' WHERE id = 'kids-B1-4';
UPDATE questions SET image_url = '/images/placement-test/picture.svg' WHERE id = 'kids-B1-5';
UPDATE questions SET image_url = '/images/placement-test/tv.svg' WHERE id = 'kids-B1-6';
UPDATE questions SET image_url = '/images/placement-test/lamps.svg' WHERE id = 'kids-B1-7';
