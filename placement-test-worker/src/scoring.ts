import type { Track } from './types';

// ELC's own level ladders (from the "Adults Structure" / "General English for
// Kids" curricular-structure diagrams), not the generic 6-tier CEFR scale --
// adults top out at C1 (no C2 in ELC's curriculum), and kids top out at B1
// with an extra sub-level between A1 and A2 (matching Super Minds 1-6 /
// Cambridge YLE). Same 6-slot shape (index 0-5) as before so the
// step/convergence math in this file doesn't need to change, only the labels.
export const LEVELS_BY_TRACK: Record<Track, readonly string[]> = {
  adults: ['A0', 'A1', 'A2', 'B1', 'B2', 'C1'],
  // Cambridge's own alignment for Super Minds: books 1-2 sit at pre-A1
  // (Starters), book 3 at A1 (Movers). Several rungs share a code because the
  // book ladder is finer-grained than CEFR at this age.
  kids: ['-A1', '-A1', '-A1', '-A1', 'A1', 'A1'],
};
export type CefrLevel = string;

// ELC's own short internal proficiency codes for each slot above (the "ELC
// PROFICIENCY" column in "Adults Structure", the "Super Minds" book codes in
// "General English for Kids") -- not the broad CEFR-adjacent stage names
// (Fundamentals/Low Intermediate/...). Both diagrams are more granular than
// this ladder's 6 slots (adults: 2 Fun codes for A0, 5 Lint codes split
// across A1/A2, 5 Hint codes split across B1/B2, 3 Advanced codes for C1),
// so each slot below picks one representative code from its CEFR band
// rather than expanding the ladder to match 1:1.
export const STAGE_NAMES_BY_TRACK: Record<Track, readonly string[]> = {
  adults: ['Fun A', 'Lint A', 'Lint D', 'Hint A', 'Hint D', 'Advanced B'],
  // The Super Minds books each split into an A and a B half, and a kid who
  // lands between two A-halves is placed in the B half below the higher one.
  // Placement tops out at 3A (see kids.ts), so the ladder ends there.
  kids: ['Pre-Starters', 'Super Minds 1A', 'Super Minds 1B', 'Super Minds 2A', 'Super Minds 2B', 'Super Minds 3A'],
};

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

// The real end-of-test signal is the question bank running out -- see
// session.ts's nextQuestionPayload, which calls completeSession once
// pickNextQuestion has nothing left to serve in fixed sequence order (see
// migrations/0006_fixed_sequential_order.sql). This function used to also
// end the session early once the level estimate converged (4 identical
// recentLevels in a row), a leftover from the old adaptive-CEFR-jumping
// engine -- with the fixed sequential walk-through, that cut sessions off
// after as few as 4-5 questions instead of the ~40-50 in the track's bank
// (bug report: "kids placement test missing the rest of the questions").
// Only a generous safety cap remains, well above any current or
// foreseeable track's question count, purely to guard against an infinite
// loop if a future bug ever left pickNextQuestion unable to signal
// exhaustion.
export function isDone(state: ScoringState): boolean {
  return state.questionsAsked >= 200;
}

export function finalLevel(state: ScoringState, track: Track): CefrLevel {
  return LEVELS_BY_TRACK[track][state.currentLevelIndex];
}

export function finalLevelName(state: ScoringState, track: Track): string {
  return STAGE_NAMES_BY_TRACK[track][state.currentLevelIndex];
}
