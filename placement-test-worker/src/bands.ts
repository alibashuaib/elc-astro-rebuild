// Adults-only proficiency-band scoring, replacing the adaptive CEFR
// step-walk in scoring.ts for the 'adults' track (kids keeps scoring.ts's
// Super Minds ladder unchanged).
//
// Bands are data, not logic -- a future reading-passage section is
// appended by pushing another { name, start, end } entry onto ADULT_BANDS,
// no other code here needs to change.
//
// Sequence ranges below split the paper test's real, un-reordered first
// 34 adults questions (sequence 1-34 -- the old A0/A1/A2/B1 CEFR buckets
// from migrations/0007_elc_level_ladders.sql, sized 9/9/8/8) into the
// center's actual finer-grained proficiency codes (see scoring.ts's
// STAGE_NAMES_BY_TRACK comment: "2 Fun codes for A0, 5 Lint codes split
// across A1/A2, 5 Hint codes split across B1/B2" -- this table uses 2 Fun
// + 4 of the 5 Lint codes (A, B, D, E; no "Lint C") + the first Hint code).
// The remaining 16 questions (sequence 35-50 -- old B2/C1, which is also
// where the two reading passages live) aren't banded yet: a student who
// clears Hint A is placed "Above Hint A" and the session ends there.
// Reading-passage bands with their own ranges get appended here later.
export interface Band {
  name: string;
  start: number; // inclusive, 1-based, matches questions.sequence
  end: number; // inclusive
}

/** Adults pass each proficiency band with at least 50% correct. */
export const PASS_THRESHOLD = 0.5;

/** Placement for a student who never cleared the first band. */
export const BELOW_FIRST_BAND = 'Pre Fun';

export const ADULT_BANDS: Band[] = [
  { name: 'Fun A', start: 1, end: 5 },
  { name: 'Fun B', start: 6, end: 9 },
  { name: 'Lint A', start: 10, end: 14 },
  { name: 'Lint B', start: 15, end: 18 },
  { name: 'Lint D', start: 19, end: 23 },
  { name: 'Lint E', start: 24, end: 26 },
  { name: 'Hint A', start: 27, end: 34 },
];

export function bandCount(band: Band): number {
  return band.end - band.start + 1;
}

export function bandForSequence(seq: number, bands: readonly Band[] = ADULT_BANDS): Band | null {
  return bands.find((b) => seq >= b.start && seq <= b.end) ?? null;
}

export function isLastBand(band: Band, bands: readonly Band[] = ADULT_BANDS): boolean {
  return bands[bands.length - 1] === band;
}

export interface BandResult {
  name: string;
  correct: number;
  total: number;
  pct: number;
  passed: boolean;
}

/** Correct answers needed to clear PASS_THRESHOLD for this band. */
export function requiredCorrect(band: Band): number {
  return Math.ceil(PASS_THRESHOLD * bandCount(band));
}

/**
 * Whether the band can still be passed given what has been answered so far.
 * Every remaining question is assumed correct: once even a perfect run of the
 * remainder falls short, the band is lost and there is nothing left to measure.
 */
export function canStillPass(band: Band, correctSoFar: number, answeredSoFar: number): boolean {
  const remaining = bandCount(band) - answeredSoFar;
  return correctSoFar + remaining >= requiredCorrect(band);
}

/** The band immediately below this one, or null for the first. */
export function previousBand(band: Band, bands: readonly Band[] = ADULT_BANDS): Band | null {
  const i = bands.indexOf(band);
  return i > 0 ? bands[i - 1] : null;
}

export function evaluateBand(band: Band, correctCount: number): BandResult {
  const total = bandCount(band);
  const pct = total === 0 ? 0 : correctCount / total;
  return { name: band.name, correct: correctCount, total, pct, passed: pct >= PASS_THRESHOLD };
}

/** First failed band is the placement; "Above Hint A" if every band passed. */
export function placementLevel(results: readonly BandResult[]): string {
  const failed = results.find((r) => !r.passed);
  return failed ? failed.name : 'Above Hint A';
}
