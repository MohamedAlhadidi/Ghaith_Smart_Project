/**
 * Hundred square (لوحة المائة) model.
 *
 * Source: MATH-S1-STU printed p.4 (PDF p.15). In the Omani Arabic edition the square is
 * laid out right-to-left: 1 is in the top-RIGHT corner and numbers increase towards the
 * LEFT along a row (the book shows the row fragment "١٦ ١٧ ١٨" with 18 left-most, and
 * 88 directly above 98). Moving DOWN one row adds 10.
 *
 * Positions are stored as (row, col) where col counts from the reading-start side
 * (col 0 = right edge in RTL). Visual directions ("left"/"right") are converted using
 * the layout, so the same logic serves an RTL (Arabic) and an LTR (English) board.
 */
export type Layout = "rtl" | "ltr";
export type VisualDir = "up" | "down" | "left" | "right";

export interface Cell {
  row: number; // 0 = top row (1..10)
  col: number; // 0 = reading-start side
}

export const ROWS = 10;
export const COLS = 10;
export const MIN = 1;
export const MAX = 100;

export function isOnBoard(n: number): boolean {
  return Number.isInteger(n) && n >= MIN && n <= MAX;
}

export function positionOf(n: number): Cell {
  if (!isOnBoard(n)) throw new RangeError(`${n} is not on the hundred square`);
  return { row: Math.floor((n - 1) / COLS), col: (n - 1) % COLS };
}

export function isValidCell(cell: Cell): boolean {
  return Number.isInteger(cell.row) && Number.isInteger(cell.col) &&
    cell.row >= 0 && cell.row < ROWS && cell.col >= 0 && cell.col < COLS;
}

export function numberAt(cell: Cell): number {
  if (!isValidCell(cell)) throw new RangeError(`cell ${cell.row},${cell.col} is off the board`);
  return cell.row * COLS + cell.col + 1;
}

/** Column step for one visual step to the left/right. */
export function colStep(dir: "left" | "right", layout: Layout): number {
  // RTL: reading starts on the right, so moving left goes forward (+1 column).
  if (layout === "rtl") return dir === "left" ? 1 : -1;
  return dir === "left" ? -1 : 1;
}

export function stepCell(cell: Cell, dir: VisualDir, layout: Layout): Cell {
  switch (dir) {
    case "up":
      return { row: cell.row - 1, col: cell.col };
    case "down":
      return { row: cell.row + 1, col: cell.col };
    default:
      return { row: cell.row, col: cell.col + colStep(dir, layout) };
  }
}

/** Number reached by one visual step, or null if the step leaves the board (no wrapping). */
export function neighbor(n: number, dir: VisualDir, layout: Layout): number | null {
  const next = stepCell(positionOf(n), dir, layout);
  return isValidCell(next) ? numberAt(next) : null;
}

/** Follow a path of visual steps; null if any step leaves the board. */
export function walk(start: number, path: readonly VisualDir[], layout: Layout): number | null {
  let current: number | null = start;
  for (const dir of path) {
    if (current === null) return null;
    current = neighbor(current, dir, layout);
  }
  return current;
}

/** Screen column (0 = left edge) of a logical cell, for rendering a 10x10 grid. */
export function screenCol(cell: Cell, layout: Layout): number {
  return layout === "rtl" ? COLS - 1 - cell.col : cell.col;
}
