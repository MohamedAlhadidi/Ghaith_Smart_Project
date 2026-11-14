import { useEffect, useState } from "react";
import {
  positionOf,
  stepCell,
  numberAt,
  validatePathMove,
  type Cell,
  type PathMoveItem,
  type ValidationResult,
  type VisualDir,
} from "@ghaith/game-core";
import { HundredGrid, type CellMark } from "../components/HundredGrid";
import { toArabicDigits } from "../lib/digits";

interface Props {
  item: PathMoveItem;
  hintLevel: number;
  reveal: boolean;
  locked: boolean;
  onSubmit: (result: ValidationResult) => void;
}

const ARROW: Record<VisualDir, { glyph: string; label: string }> = {
  left: { glyph: "⬅", label: "يسار" },
  right: { glyph: "➡", label: "يمين" },
  up: { glyph: "⬆", label: "أعلى" },
  down: { glyph: "⬇", label: "أسفل" },
};

export function PathMoveGame({ item, hintLevel, reveal, locked, onSubmit }: Props) {
  const [chosenWrong, setChosenWrong] = useState<number | null>(null);
  const correct = item.options.find((o) => validatePathMove(item, o).correct)!;

  function choose(option: number) {
    if (locked || reveal) return;
    const result = validatePathMove(item, option);
    setChosenWrong(result.correct ? null : option);
    onSubmit(result);
  }

  // Keyboard: digits 1..4 pick an option (accessibility, no mouse needed).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < item.options.length) choose(item.options[i]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const marks = new Map<number, CellMark>([[item.start, "start"]]);
  if (hintLevel >= 3 || reveal) {
    let cell: Cell = positionOf(item.start);
    for (const d of item.path) {
      cell = stepCell(cell, d, item.layout);
      marks.set(numberAt(cell), "path");
    }
  }
  if (reveal) marks.set(correct, "correct");

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow" aria-label="الأسهم بالترتيب">
        <span className="text-xl font-bold" data-testid="path-start">ابدأ من {toArabicDigits(item.start)}</span>
        {item.path.map((d, i) => (
          <span key={i} className="flex flex-col items-center" aria-label={`الخطوة ${toArabicDigits(i + 1)}: ${ARROW[d].label}`}>
            <span className="text-4xl leading-none" aria-hidden>
              {ARROW[d].glyph}
            </span>
            <span className="text-xs text-slate-500">{toArabicDigits(i + 1)}</span>
          </span>
        ))}
      </div>

      <HundredGrid
        layout={item.layout}
        ariaLabel="لوحة المائة"
        marks={marks}
        label={(n) => (n === item.start || (reveal && n === correct) ? n : null)}
      />

      <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-4">
        {item.options.map((o, i) => (
          <button
            key={o}
            type="button"
            disabled={locked || reveal}
            onClick={() => choose(o)}
            aria-keyshortcuts={String(i + 1)}
            className={`h-16 rounded-2xl text-3xl font-extrabold shadow active:scale-95 ${
              reveal && o === correct ? "bg-emerald-300" : chosenWrong === o ? "bg-rose-200" : "bg-white"
            }`}
          >
            {toArabicDigits(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
