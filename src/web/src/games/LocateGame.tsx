import { useState } from "react";
import { numberAt, validateLocate, type LocateItem, type ValidationResult } from "@ghaith/game-core";
import { HundredGrid, type CellMark } from "../components/HundredGrid";

interface Props {
  item: LocateItem;
  hintLevel: number;
  reveal: boolean;
  locked: boolean;
  onSubmit: (result: ValidationResult) => void;
}

export function LocateGame({ item, hintLevel, reveal, locked, onSubmit }: Props) {
  const [wrongTap, setWrongTap] = useState<number | null>(null);
  const targetRow = Math.floor((item.target - 1) / 10);

  const marks = new Map<number, CellMark>();
  if (hintLevel >= 3) for (let n = targetRow * 10 + 1; n <= targetRow * 10 + 10; n++) marks.set(n, "hint");
  if (wrongTap !== null) marks.set(wrongTap, "wrong");
  if (reveal) marks.set(item.target, "correct");

  return (
    <HundredGrid
      layout={item.layout}
      ariaLabel="لوحة المائة"
      marks={marks}
      disabled={locked || reveal}
      label={(n) => (item.revealed.includes(n) || (reveal && n === item.target) ? n : null)}
      onSelect={(cell) => {
        const result = validateLocate(item, cell);
        setWrongTap(result.correct ? null : numberAt(cell));
        onSubmit(result);
      }}
    />
  );
}
