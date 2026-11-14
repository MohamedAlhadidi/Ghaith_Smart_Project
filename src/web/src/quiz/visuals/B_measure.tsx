/** Renderers for measurement: ruler, results, stopwatch, tallies, dial scale (executor B). */
import type { VisualProps } from "../types";
import { ar, isNum } from "./B_shared";

/** Centimetre ruler, 0 on the left as on a real ruler; the object lies above it. */
function Ruler({ visual, reveal, solution }: VisualProps<{ type: "b-ruler"; maxCm: number; start: number; end: number; object: string }>) {
  const { maxCm, start, end, object } = visual;
  const u = 36;
  const pad = 24;
  const W = maxCm * u + 2 * pad;
  const x = (cm: number) => pad + cm * u;
  return (
    <figure className="flex w-full flex-col items-center gap-2">
      {/* LTR scroller: on narrow screens the ruler keeps ~30px per cm and starts at 0 (left). */}
      <div dir="ltr" className="w-full max-w-3xl overflow-x-auto pb-1 [contain:inline-size]" data-testid="ruler-scroll">
      <svg viewBox={`0 0 ${W} 150`} className="h-auto w-full" style={{ minWidth: `${maxCm * 30 + 40}px` }} role="img" aria-label={`${object} فوق مسطرة بالسنتيمتر`}>
        <rect x={x(start)} y={18} width={(end - start) * u} height={30} rx={12} fill="#f59e0b" stroke="#92400e" strokeWidth={3} />
        <line x1={x(start)} y1={48} x2={x(start)} y2={70} stroke="#92400e" strokeWidth={2} strokeDasharray="3 3" />
        <line x1={x(end)} y1={48} x2={x(end)} y2={70} stroke="#92400e" strokeWidth={2} strokeDasharray="3 3" />
        <rect x={4} y={70} width={W - 8} height={72} rx={8} fill="#fef9c3" stroke="#a16207" strokeWidth={3} />
        {Array.from({ length: maxCm * 2 + 1 }, (_, i) => {
          const cm = i / 2;
          const whole = i % 2 === 0;
          return (
            <g key={i}>
              <line x1={x(cm)} y1={70} x2={x(cm)} y2={whole ? 96 : 84} stroke="#0f172a" strokeWidth={whole ? 2.5 : 1.5} />
              {whole && (
                <text x={x(cm)} y={124} textAnchor="middle" fontSize={20} fontWeight={700}>
                  {ar(cm)}
                </text>
              )}
            </g>
          );
        })}
        <text x={W - 16} y={138} textAnchor="end" fontSize={14} fill="#713f12">
          سم
        </text>
      </svg>
      </div>
      {reveal && isNum(solution) && <figcaption className="text-xl font-bold text-emerald-800">{`الطول ${ar(solution)} سم`}</figcaption>}
    </figure>
  );
}

const EVENT: Record<string, string> = { distance: "رمي كيس الرمل", time: "السباق", height: "القفز إلى أعلى", mass: "أكياس التمر" };

function Results({ visual, reveal, solution }: VisualProps<{ type: "b-results"; context: string; entries: Array<{ name: string; text: string }> }>) {
  return (
    <figure className="flex w-full max-w-lg flex-col gap-2">
      <figcaption className="text-center text-lg font-bold text-sky-900">{EVENT[visual.context] ?? ""}</figcaption>
      <ul className="flex flex-col gap-2">
        {visual.entries.map((e, i) => (
          <li
            key={i}
            className={`flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-2xl shadow ${reveal && solution === `p${i}` ? "ring-4 ring-emerald-500" : ""}`}
          >
            <span className="font-extrabold">{e.name}</span>
            <span className="font-bold text-sky-800">{ar(e.text)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Analogue stopwatch, 0-60 seconds, 60 at the top. */
function Stopwatch({ visual, reveal }: VisualProps<{ type: "b-stopwatch"; seconds: number; labelStep: number }>) {
  const { seconds, labelStep } = visual;
  const R = 100;
  const at = (s: number, r: number) => [Math.sin((s / 60) * 2 * Math.PI) * r, -Math.cos((s / 60) * 2 * Math.PI) * r] as const;
  const [hx, hy] = at(seconds, R - 22);
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="-125 -145 250 270" className="h-64 w-60" role="img" aria-label="ساعة توقيت">
        <rect x={-14} y={-140} width={28} height={22} rx={6} fill="#64748b" />
        <circle r={R + 12} fill="#e2e8f0" stroke="#334155" strokeWidth={6} />
        <circle r={R} fill="#fff" />
        {Array.from({ length: 60 }, (_, s) => {
          const major = s % 5 === 0;
          const [x1, y1] = at(s, R - 2);
          const [x2, y2] = at(s, major ? R - 14 : R - 8);
          return <line key={s} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0f172a" strokeWidth={major ? 3 : 1.2} />;
        })}
        {Array.from({ length: 60 / labelStep }, (_, i) => {
          const s = (i + 1) * labelStep;
          const [x, y] = at(s, R - 30);
          return (
            <text key={s} x={x} y={y + 7} textAnchor="middle" fontSize={18} fontWeight={700}>
              {ar(s)}
            </text>
          );
        })}
        <line x1={0} y1={0} x2={hx} y2={hy} stroke="#dc2626" strokeWidth={4} strokeLinecap="round" />
        <circle r={7} fill="#dc2626" />
      </svg>
      {reveal && <figcaption className="rounded-xl bg-slate-900 px-4 py-1 font-mono text-2xl text-lime-300">{`${ar(seconds)} ثانية`}</figcaption>}
    </figure>
  );
}

function Hourglass({ className = "h-24 w-16" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 90" className={className} aria-hidden>
      <rect x={4} y={2} width={52} height={8} rx={3} fill="#92400e" />
      <rect x={4} y={80} width={52} height={8} rx={3} fill="#92400e" />
      <path d="M10 10 L50 10 L32 45 L50 80 L10 80 L28 45 Z" fill="#e0f2fe" stroke="#0369a1" strokeWidth={2.5} />
      <path d="M17 18 L43 18 L31 40 L29 40 Z" fill="#fcd34d" />
      <path d="M18 78 L42 78 L30 60 Z" fill="#fcd34d" />
    </svg>
  );
}

function Tally({ visual }: VisualProps<{ type: "b-tally"; count: number }>) {
  const n = visual.count;
  return (
    <div className="flex items-center gap-6" role="img" aria-label={`علامات العد: ${ar(n)}`}>
      <figure className="flex flex-col items-center">
        <Hourglass />
        <figcaption className="text-lg font-bold">دقيقة واحدة</figcaption>
      </figure>
      <svg viewBox={`0 0 ${Math.max(n, 1) * 22 + 20} 80`} className="h-20" style={{ width: `${(Math.max(n, 1) * 22 + 20) / 16}rem` }} aria-hidden>
        {Array.from({ length: n }, (_, i) =>
          i === 4 ? (
            <line key={i} x1={6} y1={62} x2={4 * 22 + 14} y2={16} stroke="#0f172a" strokeWidth={5} strokeLinecap="round" />
          ) : (
            <line key={i} x1={12 + i * 22} y1={12} x2={12 + i * 22} y2={68} stroke="#0f172a" strokeWidth={5} strokeLinecap="round" />
          ),
        )}
      </svg>
    </div>
  );
}

function SandTimer() {
  return (
    <figure className="flex flex-col items-center" role="img" aria-label="ساعة رملية مدتها دقيقة واحدة">
      <Hourglass />
      <figcaption className="text-lg font-bold">ساعة رملية: دقيقة واحدة</figcaption>
    </figure>
  );
}

/**
 * Dial scale in grams as in the book (p.28, p.8): 0 and max share the top mark and values increase
 * clockwise (100 just right of the top ... 900 just left of it). Big marks every `tick`, small marks
 * every 50 g. Labels carry a white halo and sit above the pointer, so the pointer never hides them.
 */
function Dial({ visual, reveal }: VisualProps<{ type: "b-dial"; max: number; tick: number; labelStep: number; value: number }>) {
  const { max, tick, labelStep, value } = visual;
  const R = 105;
  const at = (g: number, r: number, shiftDeg = 0) => {
    const a = ((360 * g) / max + shiftDeg) * (Math.PI / 180);
    return [Math.sin(a) * r, -Math.cos(a) * r] as const;
  };
  const [px, py] = at(value, R - 6);
  const label = (text: string, x: number, y: number, size = 17) => (
    <text key={`${text}-${x}`} x={x} y={y + 6} textAnchor="middle" fontSize={size} fontWeight={700} stroke="#fff" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
      {text}
    </text>
  );
  // The shared top mark carries both numbers, stacked so they never read as one number: «٠» then the maximum.
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="-130 -130 260 250" className="h-64 w-64" role="img" aria-label={`ميزان ذو مؤشر بالغرام، الصفر و${ar(max)} في الأعلى`}>
        <rect x={-120} y={-120} width={240} height={235} rx={30} fill="#dc2626" />
        <circle r={R + 8} fill="#fff" stroke="#0f172a" strokeWidth={4} />
        {Array.from({ length: max / 50 }, (_, i) => {
          const g = i * 50;
          const major = g % tick === 0;
          const [x1, y1] = at(g, R);
          const [x2, y2] = at(g, major ? R - 16 : R - 9);
          return <line key={g} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0f172a" strokeWidth={g === 0 ? 4 : major ? 3 : 1.5} />;
        })}
        <line x1={0} y1={0} x2={px} y2={py} stroke="#1d4ed8" strokeWidth={4} strokeLinecap="round" />
        <circle r={8} fill="#1d4ed8" />
        {label(ar(0), 0, -(R - 31), 24)}
        {label(ar(max), 0, -(R - 51), 14)}
        {Array.from({ length: max / labelStep - 1 }, (_, i) => {
          const g = (i + 1) * labelStep;
          const [x, y] = at(g, R - 34);
          return label(ar(g), x, y);
        })}
        <text y={46} textAnchor="middle" fontSize={20} fontWeight={800} stroke="#fff" strokeWidth={4} paintOrder="stroke">
          غ
        </text>
      </svg>
      {reveal && <figcaption className="rounded-xl bg-slate-900 px-4 py-1 font-mono text-2xl text-lime-300">{`${ar(value)} غ`}</figcaption>}
    </figure>
  );
}

export const MEASURE_VISUALS = {
  "b-ruler": Ruler,
  "b-results": Results,
  "b-stopwatch": Stopwatch,
  "b-tally": Tally,
  "b-sandtimer": SandTimer,
  "b-dial": Dial,
};
