import { describe, it, expect } from 'vitest';
import { initialState, applyAnswer, isDone, finalLevel, finalLevelName, LEVELS_BY_TRACK, STAGE_NAMES_BY_TRACK } from './scoring';

describe('scoring', () => {
  it('starts at index 2 (A2 for adults, A1+ for kids -- see LEVELS_BY_TRACK)', () => {
    expect(finalLevel(initialState(), 'adults')).toBe('A2');
    expect(finalLevel(initialState(), 'kids')).toBe('A1+');
  });

  it('all correct climbs to the top of the ladder and stays there (no early stop via convergence)', () => {
    let state = initialState();
    for (let i = 0; i < 10; i++) state = applyAnswer(state, true);
    expect(finalLevel(state, 'adults')).toBe('C1');
    expect(finalLevel(state, 'kids')).toBe('B1');
    // convergence (4 identical recentLevels in a row, which this scenario hits well before
    // question 10) no longer ends the session early -- see isDone's comment. Only the fixed
    // question bank running out (handled in session.ts, not here) or the generous safety cap do.
    expect(isDone(state)).toBe(false);
  });

  it('all incorrect drops to the bottom of the ladder and stays there (no early stop via convergence)', () => {
    let state = initialState();
    for (let i = 0; i < 10; i++) state = applyAnswer(state, false);
    expect(finalLevel(state, 'adults')).toBe('A0');
    expect(finalLevel(state, 'kids')).toBe('-A1');
    expect(isDone(state)).toBe(false);
  });

  it('isDone is a generous safety cap only, well above any track\'s question count', () => {
    let state = initialState();
    for (let i = 0; i < 199; i++) state = applyAnswer(state, true);
    expect(state.questionsAsked).toBe(199);
    expect(isDone(state)).toBe(false);
    state = applyAnswer(state, true);
    expect(state.questionsAsked).toBe(200);
    expect(isDone(state)).toBe(true);
  });

  it('LEVELS_BY_TRACK has the 6 ELC levels per track, matching the curricular-structure diagrams', () => {
    expect(LEVELS_BY_TRACK.adults).toEqual(['A0', 'A1', 'A2', 'B1', 'B2', 'C1']);
    expect(LEVELS_BY_TRACK.kids).toEqual(['-A1', 'A1', 'A1+', 'A2', 'A2+', 'B1']);
  });

  it('STAGE_NAMES_BY_TRACK has a short ELC code for every level slot, matching the diagrams', () => {
    expect(STAGE_NAMES_BY_TRACK.adults).toEqual(['Fun A', 'Lint A', 'Lint D', 'Hint A', 'Hint D', 'Advanced B']);
    expect(STAGE_NAMES_BY_TRACK.kids).toEqual([
      'Pre-Starters', 'Super Minds 2A', 'Super Minds 3A', 'Super Minds 4A', 'Super Minds 5A', 'Super Minds 6A',
    ]);
  });

  it('finalLevelName matches finalLevel by index for both tracks', () => {
    const state = initialState(); // index 2
    expect(finalLevel(state, 'adults')).toBe('A2');
    expect(finalLevelName(state, 'adults')).toBe('Lint D');
    expect(finalLevel(state, 'kids')).toBe('A1+');
    expect(finalLevelName(state, 'kids')).toBe('Super Minds 3A');
  });
});
