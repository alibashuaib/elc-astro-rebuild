import { describe, it, expect } from 'vitest';
import { KIDS_CEILING_INDEX, kidsLevelIndex } from './kids';
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

  it('never places above the 3A ceiling, so 4A-6A are unreachable', () => {
    for (let correct = 0; correct <= TOTAL; correct++) {
      expect(kidsLevelIndex(correct, TOTAL)).toBeLessThanOrEqual(KIDS_CEILING_INDEX);
    }
  });

  // Even thirds of the score range across the three reachable levels.
  it.each([
    [44, 'Super Minds 3A'],
    [30, 'Super Minds 3A'],
    [29, 'Super Minds 2A'],
    [15, 'Super Minds 2A'],
    [14, 'Pre-Starters'],
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
    // Same shares against a 12-question bank land in the same places.
    expect(kidsLevelIndex(12, 12)).toBe(2);
    expect(kidsLevelIndex(8, 12)).toBe(2); // 66.7% -- exactly the 2/3 boundary
    expect(kidsLevelIndex(7, 12)).toBe(1); // 58.3%
    expect(kidsLevelIndex(4, 12)).toBe(1); // 33.3% -- exactly the 1/3 boundary
    expect(kidsLevelIndex(3, 12)).toBe(0); // 25%
  });

  it('treats a session with nothing answered as the bottom of the ladder', () => {
    expect(kidsLevelIndex(0, 0)).toBe(0);
  });
});
