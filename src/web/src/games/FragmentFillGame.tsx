import { useMemo, useState } from "react";
import {
  cellKey,
  numberAt,
  screenCol,
  validateFragmentFill,
  type FragmentFillItem,
  type ValidationResult,
} from "@ghaith/game-core";
import { HundredGrid, type CellMark } from "../components/HundredGrid";
import { NumberPad } from "../components/NumberPad";
import { parseNumberInput, toArabicDigits } from "../lib/digits";

interface Props {
  item: FragmentFillItem;
  hintLevel: number;
  reveal: boolean;
  locked: boolean;
  onSubmit: (result: ValidationResult) => void;
}

export function FragmentFillGame({ item, hintLevel, reveal, locked, onSubmit }: Props) {
  const blanks = item.cells.filter((c) => c.given === null);
  const given = item.cells.find((c) => c.given !== null)!;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [active, setActive] = useState(cellKey(blanks[0]!));
  const [wrongKeys, setWrongKeys] = useState<Set<string>>(new Set());

  // Place the fragment exactly as it appears on the (RTL) board.
  const placed = useMemo(() => {
    const pos = item.cells.map((c) => ({ c, r: c.row, sc: screenCol(c, item.layout) }));
    const minR = Math.min(...pos.map((p) => p.r));
    const minC = Math.min(...pos.map((p) => p.sc));
    const width = Math.max(...pos.map((p) => p.sc)) - minC + 1;
    return { cells: pos.map((p) => ({ ...p, gr: p.r - minR + 1, gc: p.sc - minC + 1 })), width };
  }, [item]);

  function edit(key: string, update: (old: string) => string) {
    setAnswers((a) => ({ ...a, [key]: update(a[key] ?? "").slice(0, 3) }));
    setWrongKeys((w) => {
      const next = new Set(w);
      next.delete(key);
      return next;
    });
  }

  function submit() {
    const parsed: Record<string, number | null> = {};
    for (const b of blanks) parsed[cellKey(b)] = parseNumberInput(answers[cellKey(b)] ?? "");
    const result = validateFragmentFill(item, parsed);
    setWrongKeys(new Set(result.errors.map((e) => e.key)));
    onSubmit(result);
  }

  const hintMarks = new Map<number, CellMark>();
  if (hintLevel >= 3) for (const c of item.cells) hintMarks.set(numberAt(c), c.given !== null ? "start" : "hint");

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        dir="ltr"
        className="grid gap-1 rounded-2xl bg-sky-800 p-1 shadow-lg"
        style={{ gridTemplateColumns: `repeat(${placed.width}, minmax(3.5rem, 4.5rem))` }}
        aria-label="قطعة من لوحة المائة"
      >
        {placed.cells.map(({ c, gr, gc }) => {
          const key = cellKey(c);
          const style = { gridRow: gr, gridColumn: gc };
          if (c.given !== null) {
            return (
              <div key={key} style={style} className="flex h-16 items-center justify-center rounded-lg bg-amber-300 text-3xl font-extrabold">
                {toArabicDigits(c.given)}
              </div>
            );
          }
          const shown = reveal ? toArabicDigits(numberAt(c)) : toArabicDigits(answers[key] ?? "");
          const state = reveal ? "bg-emerald-200" : wrongKeys.has(key) ? "bg-rose-200 ring-4 ring-rose-400" : "bg-white";
          return (
            <input
              key={key}
              style={style}
              data-cell={key}
              aria-label="اكتب العدد في هذا المربع"
              inputMode="numeric"
              autoComplete="off"
              readOnly={locked || reveal}
              value={shown}
              onFocus={() => setActive(key)}
              onChange={(e) => edit(key, () => e.target.value.replace(/[^0-9٠-٩۰-۹]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className={`h-16 w-full rounded-lg text-center text-3xl font-extrabold outline-none ${state} ${
                active === key && !locked ? "ring-4 ring-amber-400" : ""
              }`}
            />
          );
        })}
      </div>

      {hintLevel >= 3 && (
        <HundredGrid
          layout={item.layout}
          ariaLabel="لوحة المائة للمساعدة"
          marks={hintMarks}
          label={(n) => (Math.floor((n - 1) / 10) === given.row || (n - 1) % 10 === given.col ? n : null)}
        />
      )}

      {!locked && !reveal && (
        <>
          <NumberPad onDigit={(d) => edit(active, (old) => old + d)} onDelete={() => edit(active, (old) => old.slice(0, -1))} />
          <button
            type="button"
            onClick={submit}
            className="h-14 w-full max-w-xs rounded-2xl bg-emerald-600 text-2xl font-bold text-white shadow-lg active:scale-95"
          >
            تحقّق ✓
          </button>
        </>
      )}
    </div>
  );
}
