/** Small building blocks shared by executor-A visuals. */
import { toArabicDigits } from "../../lib/digits";

export const MINUS = "−";
export const opGlyph = (op: unknown) => (op === "-" ? MINUS : "+");

/** Arabic-Indic number text. */
export const ar = (v: number | string) => toArabicDigits(v);

export function ConfirmButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-14 w-full max-w-xs rounded-2xl bg-emerald-600 px-4 py-3 text-2xl font-extrabold text-white shadow active:scale-95 disabled:opacity-40"
    >
      تحقّق ✓
    </button>
  );
}

/**
 * A logical sentence such as "23 < 45" inside an RTL block: digits become Arabic-Indic and
 * the browser's bidi mirroring shows it as «٤٥ > ٢٣», exactly like the book and like the
 * player's option buttons (which are rendered in the same RTL page).
 */
export function RtlSentence({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p dir="rtl" className={`text-center font-extrabold ${className}`}>
      {toArabicDigits(text)}
    </p>
  );
}
