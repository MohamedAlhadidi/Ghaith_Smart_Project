/** Shared bits for executor-B visual renderers. */
import { toArabicDigits } from "../../lib/digits";

export const ar = (v: number | string) => toArabicDigits(v);

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Rial amount as printed on p.30: «١ ريال», «٥ ريالات», «٢٠ ريالًا». */
export function rialsText(n: number): string {
  return `${ar(n)} ${n >= 3 && n <= 10 ? "ريالات" : n >= 11 ? "ريالًا" : "ريال"}`;
}

/** Confirm button for visual-input items (the e2e test looks for «تحقّق ✓»). */
export function ConfirmButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="visual-confirm"
      disabled={disabled}
      onClick={onClick}
      className="min-h-14 rounded-2xl bg-emerald-600 px-8 py-3 text-xl font-bold text-white shadow-lg active:scale-95 disabled:cursor-default disabled:opacity-40"
    >
      تحقّق ✓
    </button>
  );
}

/** A plain value card (never a banknote picture). */
export function ValueCard({ text, tone = "plain" }: { text: string; tone?: "plain" | "unknown" | "answer" }) {
  const cls =
    tone === "unknown" ? "border-sky-400 bg-sky-50 text-sky-700" : tone === "answer" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-400 bg-white text-slate-900";
  return <span className={`inline-flex min-h-14 min-w-24 items-center justify-center rounded-xl border-2 border-dashed px-3 py-2 text-2xl font-extrabold ${cls}`}>{text}</span>;
}
