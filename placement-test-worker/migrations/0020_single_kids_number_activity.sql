-- Replace four repeated one-answer counting prompts with one sequence activity.
-- The frontend hides three random slots and submits the completed 1-7 sequence.
UPDATE questions
SET prompt = 'Complete the number sequence from 1 to 7.',
    expected_answer = '1,2,3,4,5,6,7',
    active = 1
WHERE id = 'kids-A2-6';

UPDATE questions
SET active = 0
WHERE id IN ('kids-A2-7', 'kids-B1-1', 'kids-B1-2');
