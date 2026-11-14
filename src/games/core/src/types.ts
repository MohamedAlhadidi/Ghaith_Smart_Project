import type { Cell, Layout } from "./hundredSquare";

export type Difficulty = 1 | 2 | 3;

/**
 * Error categories recorded per attempt. They describe a learning signal, never a
 * diagnosis of the child. Input errors are kept apart from concept errors.
 */
export type ErrorType =
  | "input_invalid" // empty / not a whole number: an input problem, not a concept error
  | "rtl_direction_confusion" // moved the wrong way along a row (left/right swapped)
  | "row_step_error" // off by one row (±10) or up/down swapped
  | "off_by_one" // one cell away along the row (±1)
  | "tens_ones_confusion" // digits reversed (e.g. 34 ↔ 43)
  | "other";

export interface ItemMeta {
  generatorId: string;
  generatorVersion: number;
  mechanicId: string;
  seed: number;
  difficulty: Difficulty;
  layout: Layout;
}

export interface CellError {
  key: string;
  expected: number | Cell;
  given: unknown;
  errorType: ErrorType;
}

export interface ValidationResult {
  correct: boolean;
  errors: CellError[];
}

export interface Generator<I extends ItemMeta> {
  id: string;
  version: number;
  mechanicId: string;
  difficulties: readonly Difficulty[];
  generate(seed: number, difficulty: Difficulty, layout?: Layout): I;
  /** Pre-publication check: returns problems; empty list means the item is publishable. */
  checkIntegrity(item: I): string[];
}
