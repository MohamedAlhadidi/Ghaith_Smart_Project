import type { Difficulty } from "@ghaith/game-core";

export interface AdaptState {
  difficulty: Difficulty;
  streak: number; // consecutive independent first-try successes at this level
}

export type ItemOutcome = "independent" | "with_help" | "missed";

/**
 * Transparent, adjustable rule (draft, for parent/reviewer tuning):
 * - 2 independent first-try successes in a row → one level up.
 * - an item missed after the second try → one level down (never below 1).
 * - success after a hint or second try → stay, reset streak.
 * Response time is never used.
 */
export function adapt(state: AdaptState, outcome: ItemOutcome): AdaptState {
  if (outcome === "independent") {
    const streak = state.streak + 1;
    if (streak >= 2 && state.difficulty < 3) return { difficulty: (state.difficulty + 1) as Difficulty, streak: 0 };
    return { difficulty: state.difficulty, streak };
  }
  if (outcome === "missed") {
    return { difficulty: Math.max(1, state.difficulty - 1) as Difficulty, streak: 0 };
  }
  return { difficulty: state.difficulty, streak: 0 };
}
