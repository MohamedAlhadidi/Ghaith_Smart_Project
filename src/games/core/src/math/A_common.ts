/**
 * Shared helpers for executor-A mechanics (number sense, place value, operations).
 * Everything here is pure and deterministic.
 */
import type { Difficulty, ErrorType } from "../types";
import { isWholeNumber, type QuizItem } from "../quiz";
import { randInt, shuffle, type Rng } from "../rng";

/** Two-digit number with its digits swapped (34 -> 43), or null when it does not apply. */
export function reverseDigits(n: number): number | null {
  if (!Number.isInteger(n) || n < 10 || n > 99 || n % 10 === 0) return null;
  const r = (n % 10) * 10 + Math.floor(n / 10);
  return r === n ? null : r;
}

/**
 * Classify a wrong whole-number answer. `extra` maps specific given values to a
 * category (checked first), e.g. { [a + b]: "operation_confusion" }.
 */
export function numberError(
  expected: number,
  given: unknown,
  extra: Record<number, ErrorType> = {},
  tenStep: ErrorType = "place_value_error",
): ErrorType {
  if (!isWholeNumber(given)) return "input_invalid";
  if (extra[given]) return extra[given]!;
  if (reverseDigits(expected) === given) return "tens_ones_confusion";
  if (Math.abs(given - expected) === 1) return "off_by_one";
  if (Math.abs(given - expected) === 10) return tenStep;
  return "other";
}

/** Pick a random element. */
export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, 0, items.length - 1)]!;
}

/** Round to the nearest 10 with 5 rounding up (95 -> 100, 1 -> 0, 5 -> 10). */
export function roundTen(n: number): number {
  return Math.floor((n + 5) / 10) * 10;
}

/** Split [min, max] into an easy / medium / hard sub-range (overlapping bands). */
export function levelRange(min: number, max: number, difficulty: Difficulty): [number, number] {
  const span = max - min;
  const bands: readonly [number, number][] = [
    [0, 0.4],
    [0.25, 0.75],
    [0.5, 1],
  ];
  const [a, b] = bands[difficulty - 1]!;
  const lo = Math.round(min + span * a);
  const hi = Math.max(lo, Math.round(min + span * b));
  return [lo, hi];
}

/* ------------------------------------------------------------------ */
/* Equations                                                           */
/* ------------------------------------------------------------------ */

export type Op = "+" | "-";
export interface Eq {
  x: number;
  op: Op;
  y: number;
  z: number;
}
export interface Expr {
  a: number;
  op: Op;
  b: number;
}

export const evalOp = (x: number, op: Op, y: number): number => (op === "+" ? x + y : x - y);
export const eqTrue = (e: Eq): boolean => evalOp(e.x, e.op, e.y) === e.z;
export const sameEq = (p: Eq, q: Eq): boolean => p.x === q.x && p.op === q.op && p.y === q.y && p.z === q.z;
/** The book's minus sign (U+2212). */
export const MINUS = "−";
export const opText = (op: Op): string => (op === "+" ? "+" : MINUS);
/** Logical text, e.g. "24 − 9 = 15" (shows as «١٥ = ٩ − ٢٤» in the RTL page, like the book). */
export const eqLabel = (e: Eq): string => `${e.x} ${opText(e.op)} ${e.y} = ${e.z}`;
export const exprLabel = (e: Expr): string => `${e.a} ${opText(e.op)} ${e.b}`;
export const exprValue = (e: Expr): number => evalOp(e.a, e.op, e.b);

/** Integer pairs (a two-digit, b one-digit) for a + b; bridging = ones carry over a ten. */
export function bridges(a: number, b: number): boolean {
  return (a % 10) + b >= 10;
}
/** For a - b with b one-digit: bridging = the ones digit of a is smaller than b. */
export function bridgesDown(a: number, b: number): boolean {
  return a % 10 < b;
}

/* ------------------------------------------------------------------ */
/* Scattered objects                                                   */
/* ------------------------------------------------------------------ */

/** Drawing box used by scattered-object visuals (units are abstract SVG units). */
export const SCATTER_W = 100;
export const SCATTER_H = 70;

/**
 * Deterministic, non-overlapping scattered positions: a jittered grid with spare cells,
 * shuffled, so objects never touch and the picture looks random rather than arranged.
 */
export function scatter(rng: Rng, n: number): Array<[number, number]> {
  const cols = Math.max(2, Math.ceil(Math.sqrt((n * 1.4 * SCATTER_W) / SCATTER_H)));
  const rows = Math.max(2, Math.ceil((n * 1.4) / cols));
  const cw = SCATTER_W / cols;
  const ch = SCATTER_H / rows;
  const cells = shuffle(
    rng,
    Array.from({ length: cols * rows }, (_, i) => i),
  ).slice(0, n);
  return cells.map((c) => {
    const col = c % cols;
    const row = Math.floor(c / cols);
    const jx = (rng() - 0.5) * cw * 0.3;
    const jy = (rng() - 0.5) * ch * 0.3;
    return [round1((col + 0.5) * cw + jx), round1((row + 0.5) * ch + jy)];
  });
}

/** Smallest distance between two positions (for integrity checks). */
export function minGap(points: ReadonlyArray<readonly [number, number]>): number {
  let best = Infinity;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i]![0] - points[j]![0];
      const dy = points[i]![1] - points[j]![1];
      best = Math.min(best, Math.hypot(dx, dy));
    }
  return best;
}

/** Smallest gap the scatter guarantees for n objects (cell size × 0.7, minus rounding). */
export function scatterGap(n: number): number {
  const cols = Math.max(2, Math.ceil(Math.sqrt((n * 1.4 * SCATTER_W) / SCATTER_H)));
  const rows = Math.max(2, Math.ceil((n * 1.4) / cols));
  return Math.min(SCATTER_W / cols, SCATTER_H / rows) * 0.66;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

/** Multi-select integrity: unique options, at least one correct and one incorrect. */
export function multiProblems(item: QuizItem<unknown>, correctIds: readonly string[]): string[] {
  if (item.input.type !== "multi") return ["expects multi input"];
  const opts = item.input.options;
  const p: string[] = [];
  if (new Set(opts.map((o) => o.id)).size !== opts.length) p.push("duplicate option ids");
  if (new Set(opts.map((o) => o.label)).size !== opts.length) p.push("duplicate option labels");
  if (correctIds.length === 0) p.push("no correct option");
  if (correctIds.length >= opts.length) p.push("no incorrect option");
  return p;
}

/** Arabic count word for tens (1 عشرة، 2 عشرتان، 3-10 عشرات، 11+ عشرةً). */
export function tensWord(t: number): string {
  if (t === 1) return "عشرة واحدة";
  if (t === 2) return "عشرتان";
  return t <= 10 ? `${t} عشرات` : `${t} عشرةً`;
}
