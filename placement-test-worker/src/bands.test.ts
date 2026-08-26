import { describe, it, expect } from 'vitest';
import { ADULT_BANDS, PASS_THRESHOLD, bandCount, bandForSequence, isLastBand, evaluateBand, placementLevel } from './bands';

describe('bands', () => {
  it('ADULT_BANDS covers sequence 1-34 contiguously with no gaps or overlaps', () => {
    expect(ADULT_BANDS[0].start).toBe(1);
    for (let i = 1; i < ADULT_BANDS.length; i++) {
      expect(ADULT_BANDS[i].start).toBe(ADULT_BANDS[i - 1].end + 1);
    }
    expect(ADULT_BANDS.at(-1)!.end).toBe(34);
  });

  it('ADULT_BANDS names match the center-preferred ladder, in order', () => {
    expect(ADULT_BANDS.map((b) => b.name)).toEqual([
      'Fun A', 'Fun B', 'Lint A', 'Lint B', 'Lint D', 'Lint E', 'Hint A',
    ]);
  });

  it('PASS_THRESHOLD is 60%', () => {
    expect(PASS_THRESHOLD).toBe(0.6);
  });

  it('bandCount returns the inclusive size of a band', () => {
    expect(bandCount({ name: 'Fun A', start: 1, end: 5 })).toBe(5);
    expect(bandCount({ name: 'Hint A', start: 27, end: 34 })).toBe(8);
  });

  it('bandForSequence finds the band containing a given sequence number', () => {
    expect(bandForSequence(1)!.name).toBe('Fun A');
    expect(bandForSequence(5)!.name).toBe('Fun A');
    expect(bandForSequence(6)!.name).toBe('Fun B');
    expect(bandForSequence(34)!.name).toBe('Hint A');
  });

  it('bandForSequence returns null outside the table (e.g. the un-banded reading-passage content at 35+)', () => {
    expect(bandForSequence(35)).toBeNull();
    expect(bandForSequence(0)).toBeNull();
  });

  it('isLastBand is true only for the final band in the table', () => {
    expect(isLastBand(ADULT_BANDS[0])).toBe(false);
    expect(isLastBand(ADULT_BANDS.at(-1)!)).toBe(true);
  });

  it('evaluateBand: exact-threshold pass at 60%', () => {
    const band = { name: 'Fun A', start: 1, end: 5 };
    const result = evaluateBand(band, 3); // 3/5 = 0.6
    expect(result).toEqual({ name: 'Fun A', correct: 3, total: 5, pct: 0.6, passed: true });
  });

  it('evaluateBand: just below threshold fails', () => {
    const band = { name: 'Fun A', start: 1, end: 5 };
    const result = evaluateBand(band, 2); // 2/5 = 0.4
    expect(result.passed).toBe(false);
  });

  it('placementLevel: first failed band is the placement', () => {
    const results = [
      { name: 'Fun A', correct: 5, total: 5, pct: 1, passed: true },
      { name: 'Fun B', correct: 1, total: 4, pct: 0.25, passed: false },
      { name: 'Lint A', correct: 5, total: 5, pct: 1, passed: true },
    ];
    expect(placementLevel(results)).toBe('Fun B');
  });

  it('placementLevel: "Above Hint A" when every band passes', () => {
    const results = [
      { name: 'Fun A', correct: 5, total: 5, pct: 1, passed: true },
      { name: 'Hint A', correct: 8, total: 8, pct: 1, passed: true },
    ];
    expect(placementLevel(results)).toBe('Above Hint A');
  });
});
