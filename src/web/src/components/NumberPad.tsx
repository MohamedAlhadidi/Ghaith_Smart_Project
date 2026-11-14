import { toArabicDigits } from "../lib/digits";

interface Props {
  onDigit: (d: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}

/** On-screen number pad so a child on a tablet never needs the system keyboard. */
export function NumberPad({ onDigit, onDelete, disabled }: Props) {
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  return (
    <div className="grid w-full max-w-xs grid-cols-5 gap-2" aria-label="لوحة الأرقام">
      {digits.map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(d)}
          className="h-14 rounded-xl bg-white text-2xl font-bold shadow active:scale-95 disabled:opacity-40"
        >
          {toArabicDigits(d)}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className="col-span-5 h-12 rounded-xl bg-slate-200 text-lg font-bold shadow active:scale-95 disabled:opacity-40"
      >
        ⌫ مسح
      </button>
    </div>
  );
}
