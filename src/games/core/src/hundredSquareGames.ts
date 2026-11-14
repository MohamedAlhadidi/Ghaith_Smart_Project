/**
 * Generators + deterministic validators for lesson MATH-S1-U1A-L01 «لوحة المائة»
 * (MATH-S1-STU printed p.4 / PDF p.15). Draft skills, pending human curriculum review:
 *   SK-HSQ-LOCATE   locate a number 1–100 on the hundred square
 *   SK-HSQ-NEIGHBOR numbers change by ±1 along a row and ±10 up/down a column
 *   SK-HSQ-PATTERN  describe a pattern of coloured squares (e.g. diagonal +11)
 *
 * Validators never trust values stored in an item: they recompute the expected
 * answer from board positions, independently of the generator.
 */
import {
  COLS,
  type Cell,
  type Layout,
  type VisualDir,
  isOnBoard,
  isValidCell,
  numberAt,
  positionOf,
  walk,
} from "./hundredSquare";
import { createRng, pick, randInt, shuffle } from "./rng";
import type { CellError, Difficulty, ErrorType, Generator, ItemMeta, ValidationResult } from "./types";

export const cellKey = (c: Cell): string => `${c.row},${c.col}`;

/* ------------------------------------------------------------------ */
/* Shared error classification                                         */
/* ------------------------------------------------------------------ */

function reverseDigits(n: number): number | null {
  if (n < 10 || n > 99) return null;
  return (n % 10) * 10 + Math.floor(n / 10);
}

/** Classify a wrong number for an expected cell; `mirror` is the left/right-swapped answer if any. */
export function classifyNumberError(expected: number, given: unknown, mirror: number | null): ErrorType {
  if (typeof given !== "number" || !Number.isInteger(given)) return "input_invalid";
  if (mirror !== null && given === mirror && mirror !== expected) return "rtl_direction_confusion";
  if (reverseDigits(expected) === given && given !== expected) return "tens_ones_confusion";
  const diff = Math.abs(given - expected);
  if (diff === 10) return "row_step_error";
  if (diff === 1) return "off_by_one";
  return "other";
}

/* ------------------------------------------------------------------ */
/* Mechanic 1: grid-fragment-fill — complete a piece of the square      */
/* (mirrors the book task: coloured shapes with one number given)       */
/* ------------------------------------------------------------------ */

/** Visual offsets: dr down, dx right on screen (negative = left). */
type Offset = readonly [dr: number, dx: number];

export const SHAPES: Record<string, { offsets: readonly Offset[]; difficulty: Difficulty; source: string }> = {
  row3: { offsets: [[0, 0], [0, -1], [0, -2]], difficulty: 1, source: "p4 row fragment ١٦ ١٧ ١٨" },
  col3: { offsets: [[0, 0], [1, 0], [2, 0]], difficulty: 1, source: "p4 column fragments (٢ ١٢, ٨٨ ٩٨)" },
  plus: { offsets: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]], difficulty: 2, source: "p4 red plus ٢٤ ٣٣ ٣٤ ٣٥ ٤٤" },
  ell: { offsets: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]], difficulty: 2, source: "p4 yellow shape ٣٩ ٤٩ ٤٨ ٤٧ ٥٧" },
  cup: { offsets: [[0, 0], [1, 0], [1, -1], [1, -2], [0, -2]], difficulty: 2, source: "p4 green shape ٧٤ ٧٦ ٨٤ ٨٥ ٨٦" },
  diag3: { offsets: [[0, 0], [1, -1], [2, -2]], difficulty: 3, source: "p4 blue squares ٤١ ٥٢ ٦٣ (+١١)" },
};

export interface FragmentCell {
  row: number;
  col: number;
  /** Shown number, or null when the child must fill it. */
  given: number | null;
}

export interface FragmentFillItem extends ItemMeta {
  kind: "fragment-fill";
  shapeId: string;
  cells: FragmentCell[];
}

export type FragmentAnswer = Record<string, number | null | undefined>;

function placeShape(offsets: readonly Offset[], anchor: Cell, layout: Layout): Cell[] {
  // Visual dx to logical col: in RTL moving right on screen goes back towards col 0.
  const sign = layout === "rtl" ? -1 : 1;
  return offsets.map(([dr, dx]) => ({ row: anchor.row + dr, col: anchor.col + sign * dx }));
}

export const fragmentFillGenerator: Generator<FragmentFillItem> = {
  id: "GEN-HSQ-FRAGMENT",
  version: 1,
  mechanicId: "grid-fragment-fill",
  difficulties: [1, 2, 3],
  generate(seed, difficulty, layout = "rtl") {
    const rng = createRng(seed);
    const shapeIds = Object.keys(SHAPES).filter((id) => SHAPES[id]!.difficulty === difficulty);
    const shapeId = pick(rng, shapeIds);
    const offsets = SHAPES[shapeId]!.offsets;
    // Rejection-sample an anchor that keeps every cell on the board (no wrapping).
    for (let attempt = 0; attempt < 500; attempt++) {
      const anchor = { row: randInt(rng, 0, 9), col: randInt(rng, 0, 9) };
      const cells = placeShape(offsets, anchor, layout);
      if (!cells.every(isValidCell)) continue;
      // Difficulty 3 may give a non-anchor cell, so the child must reason in both directions.
      const givenIndex = difficulty === 3 ? randInt(rng, 0, cells.length - 1) : 0;
      return {
        kind: "fragment-fill",
        generatorId: this.id,
        generatorVersion: this.version,
        mechanicId: this.mechanicId,
        seed,
        difficulty,
        layout,
        shapeId,
        cells: cells.map((c, i) => ({ ...c, given: i === givenIndex ? numberAt(c) : null })),
      };
    }
    throw new Error(`no valid placement for ${shapeId} (seed ${seed})`);
  },
  checkIntegrity(item) {
    const problems: string[] = [];
    const keys = new Set<string>();
    let givens = 0;
    for (const c of item.cells) {
      if (!isValidCell(c)) problems.push(`cell ${cellKey(c)} off board`);
      else if (c.given !== null && c.given !== numberAt(c)) problems.push(`given ${c.given} wrong at ${cellKey(c)}`);
      if (keys.has(cellKey(c))) problems.push(`duplicate cell ${cellKey(c)}`);
      keys.add(cellKey(c));
      if (c.given !== null) givens++;
    }
    if (givens !== 1) problems.push(`expected exactly 1 given cell, found ${givens}`);
    if (item.cells.length - givens < 1) problems.push("no blank cell to fill");
    // Shape must be connected (8-neighbourhood, so diagonals count).
    const seen = new Set<string>();
    const stack = item.cells.slice(0, 1);
    while (stack.length) {
      const c = stack.pop()!;
      if (seen.has(cellKey(c))) continue;
      seen.add(cellKey(c));
      for (const o of item.cells) {
        if (Math.abs(o.row - c.row) <= 1 && Math.abs(o.col - c.col) <= 1) stack.push(o);
      }
    }
    if (seen.size !== item.cells.length) problems.push("shape is not connected");
    return problems;
  },
};

export function validateFragmentFill(item: FragmentFillItem, answer: FragmentAnswer): ValidationResult {
  const anchor = item.cells.find((c) => c.given !== null);
  const errors: CellError[] = [];
  for (const c of item.cells) {
    if (c.given !== null) continue;
    const expected = numberAt(c);
    const given = answer[cellKey(c)];
    if (given === expected) continue;
    let mirror: number | null = null;
    if (anchor && anchor.row === c.row) {
      const mirrored = { row: c.row, col: 2 * anchor.col - c.col };
      if (isValidCell(mirrored)) mirror = numberAt(mirrored);
    }
    errors.push({ key: cellKey(c), expected, given, errorType: classifyNumberError(expected, given, mirror) });
  }
  return { correct: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ */
/* Mechanic 2: grid-locate — tap where a number lives                  */
/* ------------------------------------------------------------------ */

export interface LocateItem extends ItemMeta {
  kind: "locate";
  target: number;
  /** Numbers printed on the otherwise empty board as landmarks. */
  revealed: number[];
}

const LANDMARKS: Record<Difficulty, number[]> = {
  1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 21, 31, 41, 51, 61, 71, 81, 91],
  2: [1, 10, 91, 100],
  3: [],
};

export const locateGenerator: Generator<LocateItem> = {
  id: "GEN-HSQ-LOCATE",
  version: 1,
  mechanicId: "grid-locate",
  difficulties: [1, 2, 3],
  generate(seed, difficulty, layout = "rtl") {
    const rng = createRng(seed);
    const revealed = LANDMARKS[difficulty];
    const candidates: number[] = [];
    for (let n = 1; n <= 100; n++) if (!revealed.includes(n)) candidates.push(n);
    return {
      kind: "locate",
      generatorId: this.id,
      generatorVersion: this.version,
      mechanicId: this.mechanicId,
      seed,
      difficulty,
      layout,
      target: pick(rng, candidates),
      revealed: [...revealed],
    };
  },
  checkIntegrity(item) {
    const problems: string[] = [];
    if (!isOnBoard(item.target)) problems.push(`target ${item.target} off board`);
    if (item.revealed.includes(item.target)) problems.push("target is already revealed");
    if (item.revealed.some((n) => !isOnBoard(n))) problems.push("revealed number off board");
    return problems;
  },
};

export function validateLocate(item: LocateItem, tapped: Cell | null | undefined): ValidationResult {
  const expected = positionOf(item.target);
  if (!tapped || !isValidCell(tapped)) {
    return { correct: false, errors: [{ key: "tap", expected, given: tapped, errorType: "input_invalid" }] };
  }
  if (tapped.row === expected.row && tapped.col === expected.col) return { correct: true, errors: [] };
  // A tap on the screen-mirrored column means the child read the row in the wrong direction.
  const mirrorCol = COLS - 1 - expected.col;
  const mirror = mirrorCol !== expected.col ? numberAt({ row: expected.row, col: mirrorCol }) : null;
  const errorType = classifyNumberError(item.target, numberAt(tapped), mirror);
  return { correct: false, errors: [{ key: "tap", expected, given: tapped, errorType }] };
}

/* ------------------------------------------------------------------ */
/* Mechanic 3: path-move — follow arrows, choose the landing number    */
/* (book question: how do numbers change moving up / down?)            */
/* ------------------------------------------------------------------ */

export interface PathMoveItem extends ItemMeta {
  kind: "path-move";
  start: number;
  path: VisualDir[];
  options: number[];
  /** Why each wrong option is plausible (distractor rationale), keyed by option value. */
  distractorRationale: Record<string, ErrorType>;
}

const OPPOSITE: Record<VisualDir, VisualDir> = { up: "down", down: "up", left: "right", right: "left" };
const ALL_DIRS: VisualDir[] = ["up", "down", "left", "right"];

export const pathMoveGenerator: Generator<PathMoveItem> = {
  id: "GEN-HSQ-PATH",
  version: 1,
  mechanicId: "grid-path-move",
  difficulties: [1, 2, 3],
  generate(seed, difficulty, layout = "rtl") {
    const rng = createRng(seed);
    const steps = difficulty; // 1, 2 or 3 arrows
    for (let attempt = 0; attempt < 500; attempt++) {
      const start = randInt(rng, 1, 100);
      const path = Array.from({ length: steps }, () => pick(rng, ALL_DIRS));
      // Disallow immediately undoing a step (e.g. up then down): it teaches nothing.
      if (path.some((d, i) => i > 0 && OPPOSITE[d] === path[i - 1])) continue;
      const correct = walk(start, path, layout);
      if (correct === null) continue;
      const candidates: Array<[number | null, ErrorType]> = [
        [walk(start, path.map((d) => (d === "left" || d === "right" ? OPPOSITE[d] : d)), layout), "rtl_direction_confusion"],
        [walk(start, path.map((d) => (d === "up" || d === "down" ? OPPOSITE[d] : d)), layout), "row_step_error"],
        [reverseDigits(correct), "tens_ones_confusion"],
        [correct + 1, "off_by_one"],
        [correct - 1, "off_by_one"],
        [correct + 10, "row_step_error"],
        [correct - 10, "row_step_error"],
      ];
      const rationale: Record<string, ErrorType> = {};
      for (const [value, why] of candidates) {
        if (value === null || !isOnBoard(value) || value === correct || value === start) continue;
        if (String(value) in rationale) continue;
        rationale[String(value)] = why;
        if (Object.keys(rationale).length === 3) break;
      }
      if (Object.keys(rationale).length < 2) continue;
      const options = shuffle(rng, [correct, ...Object.keys(rationale).map(Number)]);
      return {
        kind: "path-move",
        generatorId: this.id,
        generatorVersion: this.version,
        mechanicId: this.mechanicId,
        seed,
        difficulty,
        layout,
        start,
        path,
        options,
        distractorRationale: rationale,
      };
    }
    throw new Error(`no valid path item (seed ${seed})`);
  },
  checkIntegrity(item) {
    const problems: string[] = [];
    const correct = walk(item.start, item.path, item.layout);
    if (correct === null) problems.push("path leaves the board");
    const matching = item.options.filter((o) => o === correct).length;
    if (matching !== 1) problems.push(`expected exactly one correct option, found ${matching}`);
    if (new Set(item.options).size !== item.options.length) problems.push("duplicate options");
    if (item.options.some((o) => !isOnBoard(o))) problems.push("option off board");
    if (item.options.length < 3) problems.push("fewer than 3 options");
    return problems;
  },
};

export function validatePathMove(item: PathMoveItem, chosen: number | null | undefined): ValidationResult {
  const expected = walk(item.start, item.path, item.layout);
  if (expected === null) throw new Error("invalid item: path leaves the board");
  if (chosen === expected) return { correct: true, errors: [] };
  const errorType: ErrorType =
    typeof chosen !== "number" ? "input_invalid" : item.distractorRationale[String(chosen)] ?? "other";
  return { correct: false, errors: [{ key: "choice", expected, given: chosen, errorType }] };
}
