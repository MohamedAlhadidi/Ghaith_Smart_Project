import { useRef, useState, type KeyboardEvent } from "react";
import { COLS, ROWS, type Cell, type Layout } from "@ghaith/game-core";
import { toArabicDigits } from "../lib/digits";

export type CellMark = "start" | "correct" | "wrong" | "hint" | "path";

interface Props {
  layout: Layout;
  ariaLabel: string;
  /** Number to print in a cell, or null to leave it blank. */
  label: (n: number) => number | null;
  marks?: Map<number, CellMark>;
  /** When given, every cell is a button (tap or arrow keys + Enter). */
  onSelect?: (cell: Cell) => void;
  disabled?: boolean;
}

const MARK_CLASS: Record<CellMark, string> = {
  start: "bg-amber-300 ring-2 ring-amber-500",
  correct: "bg-emerald-300 ring-2 ring-emerald-600",
  wrong: "bg-rose-200 ring-2 ring-rose-500",
  hint: "bg-sky-200",
  path: "bg-violet-200",
};

/**
 * 10×10 hundred square. The grid itself is laid out left-to-right on screen and each
 * screen column is mapped to a logical column, so the RTL book layout (1 at top-right)
 * is explicit and testable rather than depending on CSS direction.
 */
export function HundredGrid({ layout, ariaLabel, label, marks, onSelect, disabled }: Props) {
  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: 0, c: layout === "rtl" ? COLS - 1 : 0 });
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const toLogical = (r: number, c: number): Cell => ({ row: r, col: layout === "rtl" ? COLS - 1 - c : c });
  const numberOf = (r: number, c: number) => {
    const cell = toLogical(r, c);
    return cell.row * COLS + cell.col + 1;
  };

  function onKey(e: KeyboardEvent<HTMLButtonElement>, r: number, c: number) {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    const next = { r: Math.min(ROWS - 1, Math.max(0, r + m[0])), c: Math.min(COLS - 1, Math.max(0, c + m[1])) };
    setFocus(next);
    refs.current[next.r * COLS + next.c]?.focus();
  }

  return (
    <div
      dir="ltr"
      role="grid"
      aria-label={ariaLabel}
      className="grid aspect-square w-full max-w-[min(92vw,560px,max(52vh,300px))] grid-cols-10 grid-rows-10 gap-[3px] rounded-2xl bg-sky-800 p-[3px] shadow-lg"
    >
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        const n = numberOf(r, c);
        const shown = label(n);
        const mark = marks?.get(n);
        const base = `flex min-h-0 min-w-0 items-center justify-center rounded-md text-[clamp(0.7rem,2.6vw,1.25rem)] font-bold select-none ${
          mark ? MARK_CLASS[mark] : "bg-white"
        }`;
        const text = shown === null ? "" : toArabicDigits(shown);
        if (!onSelect) {
          return (
            <div key={i} role="gridcell" className={base} data-number={shown ?? undefined}>
              {text}
            </div>
          );
        }
        const isFocus = focus.r === r && focus.c === c;
        return (
          <button
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="gridcell"
            tabIndex={isFocus ? 0 : -1}
            disabled={disabled}
            aria-label={`الصف ${toArabicDigits(r + 1)}، المربع ${toArabicDigits(c + 1)}${text ? `: ${text}` : ""}`}
            data-row={r}
            data-screen-col={c}
            className={`${base} cursor-pointer hover:bg-amber-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 disabled:cursor-default`}
            onFocus={() => setFocus({ r, c })}
            onKeyDown={(e) => onKey(e, r, c)}
            onClick={() => onSelect(toLogical(r, c))}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
