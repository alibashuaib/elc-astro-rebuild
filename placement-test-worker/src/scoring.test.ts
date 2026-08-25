import { describe, it, expect } from 'vitest';
import { initialState, applyAnswer, isDone, finalLevel, CEFR_LEVELS } from './scoring';

describe('scoring', () => {
  it('starts at B1 (index 2)', () => {
    expect(finalLevel(initialState())).toBe('B1');
  });

  it('all correct climbs to C2 and stops early via step-1 plateau, capped at 25 questions', () => {
    let state = initialState();
    let guard = 0;
    while (!isDone(state) && guard < 100) {
      state = applyAnswer(state, true);
      guard++;
    }
    expect(finalLevel(state)).toBe('C2');
    expect(state.questionsAsked).toBeLessThanOrEqual(25);
  });

  it('all incorrect drops to A1', () => {
    let state = initialState();
    let guard = 0;
    while (!isDone(state) && guard < 100) {
      state = applyAnswer(state, false);
      guard++;
    }
    expect(finalLevel(state)).toBe('A1');
  });

  it('stops after exactly 4 identical consecutive estimates', () => {
    // B1 -> correct -> index 4 (C1), step 1
    let state = applyAnswer(initialState(), true);
    expect(state.currentLevelIndex).toBe(4);
    // then alternate to hold steady at index 4: incorrect (->3, step1) correct(->4,step1) ... won't hold steady this way.
    // Instead: from index 4 with step 1, alternate correct/incorrect never repeats 4x identically unless clamped.
    // Use clamping at the ceiling: keep answering correct once at C2 (index 5) it's clamped, producing repeats.
    state = initialState();
    for (let i = 0; i < 3; i++) state = applyAnswer(state, true); // pushes to index 5 (C2) and clamps
    expect(state.currentLevelIndex).toBe(5);
    // two more correct answers stay clamped at 5, extending recentLevels with repeats
    state = applyAnswer(state, true);
    state = applyAnswer(state, true);
    expect(isDone(state)).toBe(true);
    expect(finalLevel(state)).toBe('C2');
  });

  it('CEFR_LEVELS is exactly the 6 levels in order', () => {
    expect(CEFR_LEVELS).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });
});
