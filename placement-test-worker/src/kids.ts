// Kids-track placement, replacing the adaptive CEFR step-walk in scoring.ts
// for the 'kids' track (adults use the proficiency bands in bands.ts).
//
// The walk-through serves the whole kids bank in fixed order, so a kid's
// result is simply how much of it they got right. The old adaptive engine
// moved a level index by +/-1 per answer and clamped it to 0-5, which meant
// the final placement was dominated by the last few answers rather than the
// run as a whole -- two kids with the same score could land three levels
// apart depending on where their mistakes fell.
//
// Per ELC: a full score places at Super Minds 3A, more mistakes place lower,
// and a kid falling between two A-halves is placed in the B half between them.
// So the ladder runs Pre-Starters -> 1A -> 1B -> 2A -> 2B -> 3A, and the score
// share is split evenly across those six rungs.

import { LEVELS_BY_TRACK, STAGE_NAMES_BY_TRACK } from './scoring';

/**
 * Highest index the placement test can award on the kids ladder
 * ('Super Minds 3A'). The ladder continues past it up to 6B for teaching and
 * reporting; those rungs are simply never reachable from a placement result.
 */
export const KIDS_CEILING_INDEX = 5;

/**
 * Minimum share of correct answers for each rung, highest first. Even sixths.
 * Shares (not counts) so the bank can grow without retuning -- against the
 * current 44-question bank these land at 37 / 30 / 22 / 15 / 8 correct.
 */
export const KIDS_BANDS: ReadonlyArray<{ minShare: number; index: number }> = [
  { minShare: 5 / 6, index: 5 }, // Super Minds 3A
  { minShare: 4 / 6, index: 4 }, // Super Minds 2B
  { minShare: 3 / 6, index: 3 }, // Super Minds 2A
  { minShare: 2 / 6, index: 2 }, // Super Minds 1B
  { minShare: 1 / 6, index: 1 }, // Super Minds 1A
  { minShare: 0, index: 0 }, // Pre-Starters
];

/**
 * Ladder index for a kids session that answered `correct` of `total` questions.
 * A skipped question counts as incorrect (same as everywhere else in scoring).
 * A session that answered nothing places at the bottom rather than erroring.
 */
export function kidsLevelIndex(correct: number, total: number): number {
  if (total <= 0) return 0;
  const share = correct / total;
  const band = KIDS_BANDS.find((b) => share >= b.minShare);
  return band ? band.index : 0;
}

/** CEFR-ish code for a kids placement, for the `sessions.level` column. */
export function kidsLevel(correct: number, total: number): string {
  return LEVELS_BY_TRACK.kids[kidsLevelIndex(correct, total)];
}

/**
 * Cambridge Young Learners exam level per rung, following Cambridge's own
 * alignment for Super Minds: books 1-2 are Starters, book 3 is Movers (books
 * 4-6 would be Movers then Flyers, but placement stops at 3A). Pre-Starters
 * sits beneath the lowest YLE exam, so it has none -- hence the undefined.
 */
export const KIDS_YLE_BY_INDEX: ReadonlyArray<string | undefined> = [
  undefined, // Pre-Starters
  'Starters', 'Starters', // Super Minds 1A, 1B
  'Starters', 'Starters', // Super Minds 2A, 2B
  'Movers', 'Movers', // Super Minds 3A, 3B
  'Movers', 'Movers', // Super Minds 4A, 4B
  'Flyers', 'Flyers', // Super Minds 5A, 5B
  'Flyers', 'Flyers', // Super Minds 6A, 6B
];

/** Rungs the placement test can award, bottom to ceiling. */
export function kidsPlaceableRungs(): string[] {
  return STAGE_NAMES_BY_TRACK.kids.slice(0, KIDS_CEILING_INDEX + 1);
}

/**
 * Rungs above the ceiling: part of the teaching ladder, never awarded by the
 * placement test. Kept defined so reporting and future harder question banks
 * have names to refer to.
 */
export function kidsHiddenRungs(): string[] {
  return STAGE_NAMES_BY_TRACK.kids.slice(KIDS_CEILING_INDEX + 1);
}

/** Cambridge YLE exam level for a kids placement, or undefined below Starters. */
export function kidsYleLevel(correct: number, total: number): string | undefined {
  return KIDS_YLE_BY_INDEX[kidsLevelIndex(correct, total)];
}
