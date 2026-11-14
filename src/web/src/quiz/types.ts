import type { JSX } from "react";
import type { QuizItem, Visual } from "@ghaith/game-core";

/**
 * Props given to every visual renderer.
 * - Display-only visuals ignore `onAnswer`.
 * - For items whose input is { type: "visual" }, the renderer collects the answer
 *   (taps, placement...) and calls `onAnswer(answer)` when the child confirms.
 *   `answer` must be exactly what the mechanic's `check()` expects.
 */
export interface VisualProps<V extends Visual = Visual> {
  visual: V;
  item: QuizItem;
  /** Show the correct answer (after the second wrong try). */
  reveal: boolean;
  /** The mechanic's solution (for reveal). */
  solution: unknown;
  /** No more input accepted. */
  locked: boolean;
  hintLevel: number;
  onAnswer?: (answer: unknown) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VisualRenderer = (props: VisualProps<any>) => JSX.Element | null;
