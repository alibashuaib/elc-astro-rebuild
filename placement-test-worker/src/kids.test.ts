import { describe, it, expect } from 'vitest';
import { KIDS_CEILING_INDEX, KIDS_YLE_BY_INDEX, kidsLevelIndex, kidsLevel, kidsYleLevel, kidsPlaceableRungs, kidsHiddenRungs } from './kids';
import { STAGE_NAMES_BY_TRACK, LEVELS_BY_TRACK } from './scoring';

const TOTAL = 35; // sampled letter blocks plus one consolidated number activity

function levelName(correct: number, total = TOTAL) {
  return STAGE_NAMES_BY_TRACK.kids[kidsLevelIndex(correct, total)];
}

describe('kids placement level', () => {
  it('places a full score at the Super Minds 3A ceiling', () => {
    expect(levelName(35)).toBe('Super Minds 3A');
    expect(kidsLevelIndex(35, TOTAL)).toBe(KIDS_CEILING_INDEX);
  });

  it('keeps the upper Super Minds books defined above the ceiling', () => {
    expect(STAGE_NAMES_BY_TRACK.kids).toEqual([
      'Pre-Starters',
      'Super Minds 1A', 'Super Minds 1B',
      'Super Minds 2A', 'Super Minds 2B',
      'Super Minds 3A',
      'Super Minds 4A', 'Super Minds 5A', 'Super Minds 6A',
    ]);
  });

  it('splits the ladder into rungs the test can award and rungs it cannot', () => {
    expect(kidsPlaceableRungs()).toEqual([
      'Pre-Starters',
      'Super Minds 1A', 'Super Minds 1B',
      'Super Minds 2A', 'Super Minds 2B',
      'Super Minds 3A',
    ]);
    // Above the ceiling: defined for teaching/reporting, never awarded here.
    expect(kidsHiddenRungs()).toEqual(['Super Minds 4A', 'Super Minds 5A', 'Super Minds 6A']);
  });

  it('never awards a hidden rung, whatever the score', () => {
    const hidden = new Set(kidsHiddenRungs());
    for (let correct = 0; correct <= TOTAL; correct++) {
      expect(hidden.has(levelName(correct))).toBe(false);
    }
  });

  it('never places above the 3A ceiling', () => {
    for (let correct = 0; correct <= TOTAL; correct++) {
      expect(kidsLevelIndex(correct, TOTAL)).toBeLessThanOrEqual(KIDS_CEILING_INDEX);
    }
  });

  // Even sixths of the score range across the six reachable rungs, with the
  // "B" half of each book sitting between the "A" halves.
  it.each([
    [35, 'Super Minds 3A'],
    [30, 'Super Minds 3A'],
    [29, 'Super Minds 2B'],
    [24, 'Super Minds 2B'],
    [23, 'Super Minds 2A'],
    [18, 'Super Minds 2A'],
    [17, 'Super Minds 1B'],
    [12, 'Super Minds 1B'],
    [11, 'Super Minds 1A'],
    [6, 'Super Minds 1A'],
    [5, 'Pre-Starters'],
    [0, 'Pre-Starters'],
  ])('places %i/35 correct at %s', (correct, expected) => {
    expect(levelName(correct)).toBe(expected);
  });

  it('maps every possible 35-question score to exactly one course level', () => {
    const expectedByScore = [
      ...Array(6).fill('Pre-Starters'),
      ...Array(6).fill('Super Minds 1A'),
      ...Array(6).fill('Super Minds 1B'),
      ...Array(6).fill('Super Minds 2A'),
      ...Array(6).fill('Super Minds 2B'),
      ...Array(6).fill('Super Minds 3A'),
    ];

    expect(expectedByScore).toHaveLength(TOTAL + 1);
    expect(Array.from({ length: TOTAL + 1 }, (_, correct) => levelName(correct))).toEqual(expectedByScore);
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

  // Cambridge's own alignment for the series: Super Minds books 1-2 are
  // Starters (pre-A1), book 3 is Movers (A1).
  it('reports Cambridge-aligned CEFR codes, not the adults ladder', () => {
    expect(kidsLevel(0, TOTAL)).toBe('-A1'); // Pre-Starters
    expect(kidsLevel(6, TOTAL)).toBe('-A1'); // Super Minds 1A
    expect(kidsLevel(18, TOTAL)).toBe('-A1'); // Super Minds 2A
    expect(kidsLevel(24, TOTAL)).toBe('-A1'); // Super Minds 2B -- still book 2
    expect(kidsLevel(35, TOTAL)).toBe('A1'); // Super Minds 3A
  });

  it('keeps CEFR storage codes defined for hidden course rungs', () => {
    expect(LEVELS_BY_TRACK.kids[6]).toBe('A1');
    expect(LEVELS_BY_TRACK.kids[8]).toBe('A2');
  });

  it('retains Cambridge YLE levels for reporting', () => {
    expect(kidsYleLevel(0, TOTAL)).toBeUndefined();
    expect(kidsYleLevel(6, TOTAL)).toBe('Starters');
    expect(kidsYleLevel(24, TOTAL)).toBe('Starters');
    expect(kidsYleLevel(30, TOTAL)).toBe('Movers');
    expect(KIDS_YLE_BY_INDEX[6]).toBe('Movers');
    expect(KIDS_YLE_BY_INDEX[8]).toBe('Flyers');
  });
});
