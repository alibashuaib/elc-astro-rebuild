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
// Per ELC: a full score places at Super Minds 3A, and more mistakes place
// lower. So 3A is the ceiling, and the reachable ladder is its bottom three
// rungs; the score share is split evenly across them.

import { LEVELS_BY_TRACK } from './scoring';

/** Highest index the placement test can award on the kids ladder ('Super Minds 3A'). */
export const KIDS_CEILING_INDEX = 2;

/**
 * Minimum share of correct answers for each reachable level, highest first.
 * Even thirds: >=2/3 places at the ceiling, >=1/3 one rung down, the rest at
 * the bottom. Shares (not counts) so the bank can grow without retuning.
 */
export const KIDS_BANDS: ReadonlyArray<{ minShare: number; index: number }> = [
  { minShare: 2 / 3, index: 2 }, // Super Minds 3A
  { minShare: 1 / 3, index: 1 }, // Super Minds 2A
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
