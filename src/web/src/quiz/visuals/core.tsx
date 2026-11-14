/** Visual renderers for the reference mechanics (pairs / fact families). */
import { toArabicDigits } from "../../lib/digits";
import type { VisualProps, VisualRenderer } from "../types";

function TenFrames({ visual, reveal, solution }: VisualProps<{ type: "tenframes"; filled: number; total: number }>) {
  const extra = reveal && typeof solution === "number" ? solution : 0;
  const frames = Math.ceil(visual.total / 10);
  return (
    <div className="flex flex-wrap justify-center gap-4" aria-label={`إطارا العشرة: ${toArabicDigits(visual.filled)} مكعبًا`}>
      {Array.from({ length: frames }, (_, f) => (
        <div key={f} dir="ltr" className="grid grid-cols-5 gap-1 rounded-xl border-4 border-slate-800 bg-white p-1">
          {Array.from({ length: 10 }, (_, i) => {
            const idx = f * 10 + i;
            const state = idx < visual.filled ? "bg-rose-500" : idx < visual.filled + extra ? "bg-sky-400" : "bg-white";
            return <div key={i} className={`h-9 w-9 rounded-md border-2 border-slate-300 sm:h-11 sm:w-11 ${state}`} />;
          })}
        </div>
      ))}
    </div>
  );
}

function Clock({ visual, reveal, solution }: VisualProps<{ type: "clock"; highlight: number }>) {
  const r = 110;
  return (
    <svg viewBox="-130 -130 260 260" className="h-60 w-60" role="img" aria-label="وجه الساعة">
      <circle r={r + 8} fill="#fff" stroke="#0f172a" strokeWidth={6} />
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const a = (n / 12) * 2 * Math.PI;
        const x = Math.sin(a) * (r - 18);
        const y = -Math.cos(a) * (r - 18);
        const hl = n === visual.highlight;
        return (
          <g key={n}>
            {hl && <circle cx={x} cy={y} r={20} fill="#fcd34d" />}
            <text x={x} y={y + 8} textAnchor="middle" fontSize={22} fontWeight={700} fill="#0f172a">
              {toArabicDigits(n)}
            </text>
            {hl && (
              <text x={x * 1.42} y={y * 1.42 + 7} textAnchor="middle" fontSize={18} fontWeight={800} fill="#0369a1">
                {reveal && typeof solution === "number" ? toArabicDigits(solution) : "؟"}
              </text>
            )}
          </g>
        );
      })}
      <circle r={5} fill="#0f172a" />
    </svg>
  );
}

function Scale({ visual, reveal, solution }: VisualProps<{ type: "scale"; known: number; target: number; unit: string }>) {
  const other = reveal && typeof solution === "number" ? `${toArabicDigits(solution)} ${visual.unit}` : "؟";
  return (
    <svg viewBox="0 0 300 200" className="h-48 w-72" role="img" aria-label={`ميزان يظهر ${toArabicDigits(visual.target)} ${visual.unit}`}>
      <path d="M40 70 Q150 120 260 70 Z" fill="#e2e8f0" stroke="#334155" strokeWidth={4} />
      <rect x={70} y={30} width={60} height={40} rx={8} fill="#94a3b8" />
      <text x={100} y={57} textAnchor="middle" fontSize={16} fontWeight={700}>{`${toArabicDigits(visual.known)} ${visual.unit}`}</text>
      <rect x={170} y={30} width={60} height={40} rx={8} fill="#bae6fd" />
      <text x={200} y={57} textAnchor="middle" fontSize={16} fontWeight={700}>{other}</text>
      <rect x={110} y={110} width={80} height={70} rx={10} fill="#dc2626" />
      <circle cx={150} cy={145} r={26} fill="#fef08a" stroke="#0f172a" strokeWidth={3} />
      <text x={150} y={151} textAnchor="middle" fontSize={14} fontWeight={800}>{toArabicDigits(visual.target)}</text>
    </svg>
  );
}

function Cards({ visual, reveal, solution }: VisualProps<{ type: "cards"; cards: Array<{ text: string; tone?: string }> }>) {
  return (
    <div className="flex justify-center gap-4">
      {visual.cards.map((c, i) => {
        const text = c.text === "?" ? (reveal && solution !== undefined ? String(solution) : "؟") : c.text;
        const tone = c.tone === "star" ? "bg-purple-100 border-amber-300" : c.tone === "heart" ? "bg-cyan-50 border-sky-600" : "bg-white border-slate-300";
        return (
          <div key={i} className={`flex h-28 w-20 flex-col items-center justify-center rounded-2xl border-4 shadow ${tone}`}>
            <span className="text-2xl" aria-hidden>
              {c.tone === "star" ? "⭐" : c.tone === "heart" ? "💙" : ""}
            </span>
            <span className="text-3xl font-extrabold">{toArabicDigits(text)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Triangle({ visual, reveal, solution }: VisualProps<{ type: "triangle"; top: number | null; left: number | null; right: number | null }>) {
  const show = (v: number | null) => (v !== null ? toArabicDigits(v) : reveal && solution !== undefined ? toArabicDigits(String(solution)) : "؟");
  return (
    <svg viewBox="0 0 300 240" className="h-56 w-72" role="img" aria-label="مثلث عائلة الحقائق">
      <polygon points="150,10 290,230 10,230" fill="#fef9c3" stroke="#ca8a04" strokeWidth={5} />
      <text x={150} y={80} textAnchor="middle" fontSize={34} fontWeight={800}>{show(visual.top)}</text>
      {/* RTL: the first part sits on the right like the book's triangles. */}
      <text x={220} y={205} textAnchor="middle" fontSize={30} fontWeight={800}>{show(visual.left)}</text>
      <text x={80} y={205} textAnchor="middle" fontSize={30} fontWeight={800}>{show(visual.right)}</text>
      <text x={150} y={160} textAnchor="middle" fontSize={26} fill="#a16207">+ −</text>
    </svg>
  );
}

export const CORE_VISUALS: Record<string, VisualRenderer> = {
  none: () => null,
  tenframes: TenFrames,
  clock: Clock,
  scale: Scale,
  cards: Cards,
  triangle: Triangle,
};
