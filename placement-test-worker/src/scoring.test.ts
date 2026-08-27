import { describe, it, expect } from 'vitest';
import { initialState, applyAnswer, isDone, finalLevel, finalLevelName, LEVELS_BY_TRACK, STAGE_NAMES_BY_TRACK } from './scoring';

// The adaptive step-walk below is exercised against the adults ladder only:
// adults reach their placement through bands.ts and kids through kids.ts, so
// nothing places a student by walking this state any more. It survives as the
// session's running estimate and the 200-question safety cap.
describe('scoring', () => {
  it('starts at index 2 (A2 on the adults ladder -- see LEVELS_BY_TRACK)', () => {
    expect(finalLevel(initialState(), 'adults')).toBe('A2');
  });

  it('all correct climbs to the top of the ladder and stays there (no early stop via convergence)', () => {
    let state = initialState();
    for (let i = 0; i < 10; i++) state = applyAnswer(state, true);
    expect(finalLevel(state, 'adults')).toBe('C1');
    // convergence (4 identical recentLevels in a row, which this scenario hits well before
    // question 10) no longer ends the session early -- see isDone's comment. Only the fixed
    // question bank running out (handled in session.ts, not here) or the generous safety cap do.
    expect(isDone(state)).toBe(false);
  });

  it('all incorrect drops to the bottom of the ladder and stays there (no early stop via convergence)', () => {
    let state = initialState();
    for (let i = 0; i < 10; i++) state = applyAnswer(state, false);
    expect(finalLevel(state, 'adults')).toBe('A0');
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
    // Kids share codes across rungs: Cambridge places Super Minds 1-2 at pre-A1
    // and 3 at A1, which is coarser than the book ladder.
    expect(LEVELS_BY_TRACK.kids).toEqual(['-A1', '-A1', '-A1', '-A1', '-A1', 'A1']);
  });

  it('STAGE_NAMES_BY_TRACK has a short ELC code for every level slot, matching the diagrams', () => {
    expect(STAGE_NAMES_BY_TRACK.adults).toEqual(['Fun A', 'Lint A', 'Lint D', 'Hint A', 'Hint D', 'Advanced B']);
    // A- and B-halves alternate: a kid between two A-halves lands in the B half
    // between them. Placement tops out at 3A (see kids.ts).
    expect(STAGE_NAMES_BY_TRACK.kids).toEqual([
      'Pre-Starters', 'Super Minds 1A', 'Super Minds 1B', 'Super Minds 2A', 'Super Minds 2B', 'Super Minds 3A',
    ]);
  });

  it('finalLevelName matches finalLevel by index', () => {
    const state = initialState(); // index 2
    expect(finalLevel(state, 'adults')).toBe('A2');
    expect(finalLevelName(state, 'adults')).toBe('Lint D');
  });

  it('every kids ladder slot has both a code and a book name', () => {
    expect(LEVELS_BY_TRACK.kids).toHaveLength(STAGE_NAMES_BY_TRACK.kids.length);
  });
});
