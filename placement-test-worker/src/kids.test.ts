import { describe, it, expect } from 'vitest';
import { KIDS_CEILING_INDEX, kidsLevelIndex, kidsLevel } from './kids';
import { STAGE_NAMES_BY_TRACK } from './scoring';

const TOTAL = 44; // the active kids bank, for readable correct-count cases

function levelName(correct: number, total = TOTAL) {
  return STAGE_NAMES_BY_TRACK.kids[kidsLevelIndex(correct, total)];
}

describe('kids placement level', () => {
  it('places a full score at the Super Minds 3A ceiling', () => {
    expect(levelName(44)).toBe('Super Minds 3A');
    expect(kidsLevelIndex(44, TOTAL)).toBe(KIDS_CEILING_INDEX);
  });

  it('never places above the 3A ceiling', () => {
    for (let correct = 0; correct <= TOTAL; correct++) {
      expect(kidsLevelIndex(correct, TOTAL)).toBeLessThanOrEqual(KIDS_CEILING_INDEX);
    }
  });

  // Even sixths of the score range across the six reachable rungs, with the
  // "B" half of each book sitting between the "A" halves.
  it.each([
    [44, 'Super Minds 3A'],
    [37, 'Super Minds 3A'],
    [36, 'Super Minds 2B'],
    [30, 'Super Minds 2B'],
    [29, 'Super Minds 2A'],
    [22, 'Super Minds 2A'],
    [21, 'Super Minds 1B'],
    [15, 'Super Minds 1B'],
    [14, 'Super Minds 1A'],
    [8, 'Super Minds 1A'],
    [7, 'Pre-Starters'],
    [0, 'Pre-Starters'],
  ])('places %i/44 correct at %s', (correct, expected) => {
    expect(levelName(correct)).toBe(expected);
  });

  it('never places a higher score at a lower level', () => {
    for (let correct = 1; correct <= TOTAL; correct++) {
      expect(kidsLevelIndex(correct, TOTAL)).toBeGreaterThanOrEqual(kidsLevelIndex(correct - 1, TOTAL));
    }
  });

  it('is proportional, not tied to one bank size', () => {
    // Same shares against a 12-question bank land on the same rungs.
    expect(kidsLevelIndex(12, 12)).toBe(5); // 100%
    expect(kidsLevelIndex(10, 12)).toBe(5); // 83.3% -- exactly the 5/6 boundary
    expect(kidsLevelIndex(9, 12)).toBe(4); // 75%
    expect(kidsLevelIndex(6, 12)).toBe(3); // 50% -- exactly the 3/6 boundary
    expect(kidsLevelIndex(4, 12)).toBe(2); // 33.3% -- exactly the 2/6 boundary
    expect(kidsLevelIndex(2, 12)).toBe(1); // 16.7% -- exactly the 1/6 boundary
    expect(kidsLevelIndex(1, 12)).toBe(0); // 8.3%
  });

  it('treats a session with nothing answered as the bottom of the ladder', () => {
    expect(kidsLevelIndex(0, 0)).toBe(0);
  });

  // Cambridge's own alignment for the series: Super Minds 1-2 sit at pre-A1
  // (Starters), 3 at A1 (Movers).
  it('reports Cambridge-aligned CEFR codes, not the adults ladder', () => {
    expect(kidsLevel(0, TOTAL)).toBe('-A1'); // Pre-Starters
    expect(kidsLevel(8, TOTAL)).toBe('-A1'); // Super Minds 1A
    expect(kidsLevel(22, TOTAL)).toBe('-A1'); // Super Minds 2A
    expect(kidsLevel(30, TOTAL)).toBe('A1'); // Super Minds 2B
    expect(kidsLevel(44, TOTAL)).toBe('A1'); // Super Minds 3A
  });
});
