export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = typeof CEFR_LEVELS[number];

export interface ScoringState {
  currentLevelIndex: number; // 0-5
  step: number;
  recentLevels: number[];    // trailing history of currentLevelIndex, most recent last
  questionsAsked: number;
}

export function initialState(): ScoringState {
  return { currentLevelIndex: 2, step: 2, recentLevels: [2], questionsAsked: 0 };
}

export function applyAnswer(state: ScoringState, correct: boolean): ScoringState {
  const delta = correct ? state.step : -state.step;
  const nextIndex = Math.min(5, Math.max(0, state.currentLevelIndex + delta));
  const nextStep = Math.max(1, state.step - 1);
  const recentLevels = [...state.recentLevels, nextIndex].slice(-4);
  return {
    currentLevelIndex: nextIndex,
    step: nextStep,
    recentLevels,
    questionsAsked: state.questionsAsked + 1,
  };
}

export function isDone(state: ScoringState): boolean {
  if (state.questionsAsked >= 25) return true;
  if (state.recentLevels.length === 4 && state.recentLevels.every((l) => l === state.recentLevels[0])) {
    return true;
  }
  return false;
}

export function finalLevel(state: ScoringState): CefrLevel {
  return CEFR_LEVELS[state.currentLevelIndex];
}
