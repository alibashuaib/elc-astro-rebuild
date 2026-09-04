import { describe, it, expect } from 'vitest';
import { KIDS_CEILING_INDEX, KIDS_YLE_BY_INDEX, kidsLevelIndex, kidsLevel, kidsYleLevel, kidsPlaceableRungs, kidsHiddenRungs } from './kids';
import { STAGE_NAMES_BY_TRACK, LEVELS_BY_TRACK } from './scoring';

const TOTAL = 38; // three prompts are sampled from each six-question letter block

function levelName(correct: number, total = TOTAL) {
  return STAGE_NAMES_BY_TRACK.kids[kidsLevelIndex(correct, total)];
}

describe('kids placement level', () => {
  it('places a full score at the Super Minds 3A ceiling', () => {
    expect(levelName(38)).toBe('Super Minds 3A');
    expect(kidsLevelIndex(38, TOTAL)).toBe(KIDS_CEILING_INDEX);
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
    [38, 'Super Minds 3A'],
    [32, 'Super Minds 3A'],
    [31, 'Super Minds 2B'],
    [26, 'Super Minds 2B'],
    [25, 'Super Minds 2A'],
    [19, 'Super Minds 2A'],
    [18, 'Super Minds 1B'],
    [13, 'Super Minds 1B'],
    [12, 'Super Minds 1A'],
    [7, 'Super Minds 1A'],
    [6, 'Pre-Starters'],
    [0, 'Pre-Starters'],
  ])('places %i/38 correct at %s', (correct, expected) => {
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

  // Cambridge's own alignment for the series: Super Minds books 1-2 are
  // Starters (pre-A1), book 3 is Movers (A1).
  it('reports Cambridge-aligned CEFR codes, not the adults ladder', () => {
    expect(kidsLevel(0, TOTAL)).toBe('-A1'); // Pre-Starters
    expect(kidsLevel(7, TOTAL)).toBe('-A1'); // Super Minds 1A
    expect(kidsLevel(19, TOTAL)).toBe('-A1'); // Super Minds 2A
    expect(kidsLevel(26, TOTAL)).toBe('-A1'); // Super Minds 2B -- still book 2
    expect(kidsLevel(38, TOTAL)).toBe('A1'); // Super Minds 3A
  });

  it('aligns the hidden rungs to Movers and Flyers too', () => {
    // Cambridge: Super Minds 3-4 are Movers (A1), 5-6 are Flyers (A2).
    expect(KIDS_YLE_BY_INDEX[6]).toBe('Movers'); // Super Minds 4A
    expect(KIDS_YLE_BY_INDEX[8]).toBe('Flyers'); // Super Minds 6A
    expect(LEVELS_BY_TRACK.kids[6]).toBe('A1');
    expect(LEVELS_BY_TRACK.kids[8]).toBe('A2');
  });

  it('reports the Cambridge YLE exam level for each rung', () => {
    expect(kidsYleLevel(7, TOTAL)).toBe('Starters'); // Super Minds 1A
    expect(kidsYleLevel(13, TOTAL)).toBe('Starters'); // Super Minds 1B
    expect(kidsYleLevel(19, TOTAL)).toBe('Starters'); // Super Minds 2A
    expect(kidsYleLevel(26, TOTAL)).toBe('Starters'); // Super Minds 2B
    expect(kidsYleLevel(38, TOTAL)).toBe('Movers'); // Super Minds 3A
  });

  it('has no YLE level below Starters', () => {
    // Pre-Starters sits beneath the lowest YLE exam, so it maps to nothing.
    expect(kidsYleLevel(0, TOTAL)).toBeUndefined();
    expect(kidsYleLevel(6, TOTAL)).toBeUndefined();
  });

  it('never reports a YLE level that contradicts the CEFR code', () => {
    for (let correct = 0; correct <= TOTAL; correct++) {
      const yle = kidsYleLevel(correct, TOTAL);
      if (yle === 'Movers') expect(kidsLevel(correct, TOTAL)).toBe('A1');
      if (yle === 'Starters') expect(kidsLevel(correct, TOTAL)).toBe('-A1');
    }
  });
});
