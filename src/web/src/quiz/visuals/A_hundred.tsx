/** hsq-pattern: tap the next cell of a pattern on the RTL hundred square (1 at top-right). */
import { useState } from "react";
import { isValidCell, numberAt, type Cell, type Visual } from "@ghaith/game-core";
import { HundredGrid, type CellMark } from "../../components/HundredGrid";
import type { VisualProps } from "../types";
import { ConfirmButton } from "./A_shared";

interface HundredPatternVisual extends Visual {
  type: "hundredPattern";
  shown: number[];
  /** "pattern": only the pattern cells are numbered (harder). */
  labels: "all" | "pattern";
}

const asCell = (v: unknown): Cell | null => {
  const c = v as Cell | null;
  return c && typeof c === "object" && isValidCell(c) ? c : null;
};

export function HundredPattern({ visual, item, reveal, solution, locked, hintLevel, onAnswer }: VisualProps<HundredPatternVisual>) {
  const [picked, setPicked] = useState<Cell | null>(null);
  const sol = asCell(solution);
  const solN = sol ? numberAt(sol) : null;
  const marks = new Map<number, CellMark>();
  for (const n of visual.shown) marks.set(n, "start");
  if (picked) marks.set(numberAt(picked), "path");
  if (reveal && solN !== null) marks.set(solN, "correct");
  // Hint 2 numbers the whole board again at the hardest level.
  const all = visual.labels === "all" || hintLevel >= 2;
  const done = locked || reveal;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <HundredGrid
        layout={item.layout}
        ariaLabel="لوحة المائة: المس المربع التالي في النمط"
        marks={marks}
        disabled={done}
        label={(n) => (all || visual.shown.includes(n) || (reveal && n === solN) ? n : null)}
        onSelect={(cell) => !done && setPicked(cell)}
      />
      {!done && <ConfirmButton disabled={!picked} onClick={() => picked && onAnswer?.(picked)} />}
    </div>
  );
}
