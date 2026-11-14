/**
 * Cards, strips and sentences for executor-A mechanics. Rows of numbers run right to left
 * (reading start on the right, like the hundred square); each number keeps its digits in
 * normal order. Sentences are logical text in an RTL block, so they look like the book.
 */
import { useState } from "react";
import type { Visual } from "@ghaith/game-core";
import type { VisualProps } from "../types";
import { ar, ConfirmButton, opGlyph, RtlSentence } from "./A_shared";

/* ------------------------------------------------------------------ */
/* Decades (p.5)                                                       */
/* ------------------------------------------------------------------ */

interface DecadeStripVisual extends Visual {
  type: "decadeStrip";
  cells: Array<number | null>;
  blank: number;
}

export function DecadeStrip({ visual, reveal, solution }: VisualProps<DecadeStripVisual>) {
  return (
    <div dir="rtl" className="flex max-w-full flex-wrap justify-center gap-1 rounded-2xl bg-sky-800 p-1 shadow-lg" role="list" aria-label="شريط عقد">
      {visual.cells.map((v, i) => {
        const isBlank = i === visual.blank;
        const text = isBlank ? (reveal && typeof solution === "number" ? ar(solution) : "؟") : v === null ? "" : ar(v);
        const tone = isBlank ? (reveal ? "bg-emerald-200" : "bg-amber-200 ring-4 ring-amber-400") : v === null ? "bg-slate-200" : "bg-white";
        return (
          <div key={i} role="listitem" className={`flex h-14 w-12 items-center justify-center rounded-lg text-2xl font-extrabold sm:w-14 ${tone}`}>
            {text}
          </div>
        );
      })}
    </div>
  );
}

interface MidpointVisual extends Visual {
  type: "decadeMidpoint";
  start: number;
  end: number;
  numbers: number[] | null;
}

export function DecadeMidpoint({ visual, reveal }: VisualProps<MidpointVisual>) {
  const mid = visual.start + 5;
  if (visual.numbers) {
    return (
      <div dir="rtl" className="flex max-w-full flex-wrap justify-center gap-2" role="list" aria-label="تسعة أعداد متتالية">
        {visual.numbers.map((v) => (
          <div key={v} role="listitem" className={`flex h-16 w-14 items-center justify-center rounded-xl text-2xl font-extrabold shadow ${reveal && v === mid ? "bg-emerald-200 ring-4 ring-emerald-500" : "bg-white"}`}>
            {ar(v)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div dir="rtl" className="flex items-center gap-1" aria-label={`من ${ar(visual.start)} إلى ${ar(visual.end)}`}>
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-sky-200 text-2xl font-extrabold shadow">{ar(visual.start)}</div>
      {Array.from({ length: 9 }, (_, i) =>
        i === 4 ? (
          <div key={i} className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-extrabold ring-4 ${reveal ? "bg-emerald-200 ring-emerald-500" : "bg-amber-200 ring-amber-400"}`}>
            {reveal ? ar(mid) : "؟"}
          </div>
        ) : (
          <div key={i} className="h-3 w-3 rounded-full bg-slate-400 sm:h-4 sm:w-4" aria-hidden />
        ),
      )}
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-sky-200 text-2xl font-extrabold shadow">{ar(visual.end)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bags with labels (p.7)                                              */
/* ------------------------------------------------------------------ */

interface BagsVisual extends Visual {
  type: "rangeBags";
  bags: string[];
  count: number | null;
}

export function RangeBags({ visual }: VisualProps<BagsVisual>) {
  return (
    <div className="flex flex-col items-center gap-3">
      {visual.count !== null && (
        <div className="rounded-2xl bg-amber-100 px-5 py-2 text-2xl font-extrabold shadow" aria-label="عدد الحبات">
          🫘 {ar(visual.count)}
        </div>
      )}
      <div dir="rtl" className="flex flex-wrap justify-center gap-3">
        {visual.bags.map((label) => (
          <div key={label} className="flex w-36 flex-col items-center">
            <div className="h-4 w-16 rounded-t-full bg-amber-700" aria-hidden />
            <div className="flex min-h-28 w-36 items-center justify-center rounded-b-[3rem] rounded-t-xl bg-amber-500 p-2 shadow-lg">
              <span className="rounded-lg bg-white px-2 py-1 text-center text-base font-bold leading-snug">{ar(label)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comparing (p.32)                                                    */
/* ------------------------------------------------------------------ */

const SIGN: Record<string, string> = { lt: "<", gt: ">", eq: "=" };

interface CompareVisual extends Visual {
  type: "compareSentence";
  a: number;
  b: number;
}

/**
 * Logical "a ? b" in an RTL row: a sits on the right. The sign is a lone character in an
 * RTL block, so it is mirrored exactly like the player's option buttons («٤٥ > ٢٣» for 23 < 45).
 */
export function CompareSentence({ visual, reveal, solution }: VisualProps<CompareVisual>) {
  const sign = reveal && typeof solution === "string" ? SIGN[solution] ?? "؟" : "؟";
  return (
    <div dir="rtl" className="flex items-center gap-4 rounded-2xl bg-white px-6 py-4 text-5xl font-extrabold shadow" aria-label="جملة مقارنة">
      <span>{ar(visual.a)}</span>
      <span className={`flex h-16 w-16 items-center justify-center rounded-xl ${reveal ? "bg-emerald-200" : "bg-amber-200"}`}>{sign}</span>
      <span>{ar(visual.b)}</span>
    </div>
  );
}

interface DigitSentenceVisual extends Visual {
  type: "digitSentence";
  cards: Array<{ id: string; digit: number }>;
  sign: "<" | ">";
}

export function DigitSentence({ visual, reveal, solution, locked, onAnswer }: VisualProps<DigitSentenceVisual>) {
  const [slots, setSlots] = useState<Array<string | null>>([null, null, null, null]);
  const [history, setHistory] = useState<number[]>([]);
  const done = locked || reveal;
  const shown = reveal && Array.isArray(solution) ? (solution as string[]) : slots;
  const used = new Set(slots.filter((s): s is string => s !== null));
  const digitOf = (id: string | null) => (id === null ? null : visual.cards.find((c) => c.id === id)?.digit ?? null);

  function place(id: string) {
    const i = slots.indexOf(null);
    if (i < 0 || used.has(id)) return;
    setSlots(slots.map((s, k) => (k === i ? id : s)));
    setHistory([...history, i]);
  }
  function clear(i: number) {
    setSlots(slots.map((s, k) => (k === i ? null : s)));
    setHistory(history.filter((k) => k !== i));
  }
  function undo() {
    const last = history[history.length - 1];
    if (last === undefined) return;
    clear(last);
  }

  // Slots 0-1 are the first number (on the right in RTL), 2-3 the second; digits inside a number stay tens-then-ones.
  const slot = (i: number) => {
    const d = digitOf(shown[i] ?? null);
    return (
      <button
        key={i}
        type="button"
        disabled={done || shown[i] === null}
        onClick={() => clear(i)}
        aria-label={d === null ? "مربع فارغ" : `بطاقة ${ar(d)}، المس لإزالتها`}
        className={`flex h-20 w-16 items-center justify-center rounded-xl border-4 border-dashed text-4xl font-extrabold ${
          d === null ? "border-slate-400 bg-slate-50" : reveal ? "border-emerald-500 bg-emerald-100" : "border-sky-500 bg-white"
        }`}
      >
        {d === null ? "" : ar(d)}
      </button>
    );
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div dir="rtl" className="flex items-center gap-3" aria-label="الجملة العددية">
        <div dir="ltr" className="flex gap-1">
          {slot(0)}
          {slot(1)}
        </div>
        <span className="text-5xl font-extrabold">{visual.sign}</span>
        <div dir="ltr" className="flex gap-1">
          {slot(2)}
          {slot(3)}
        </div>
      </div>
      {!done && (
        <>
          <div dir="rtl" className="flex flex-wrap justify-center gap-3" role="group" aria-label="بطاقات الأرقام">
            {visual.cards.map((c) => (
              <button
                key={c.id}
                type="button"
                data-card-id={c.id}
                disabled={used.has(c.id)}
                onClick={() => place(c.id)}
                aria-label={`بطاقة الرقم ${ar(c.digit)}`}
                className="flex h-20 w-16 items-center justify-center rounded-xl bg-amber-200 text-4xl font-extrabold shadow active:scale-95 disabled:opacity-30"
              >
                {ar(c.digit)}
              </button>
            ))}
          </div>
          <div className="flex w-full max-w-xs flex-col items-center gap-2">
            <button type="button" onClick={undo} disabled={history.length === 0} className="min-h-12 w-full rounded-2xl bg-slate-200 text-xl font-bold shadow active:scale-95 disabled:opacity-40">
              ↩ تراجع
            </button>
            <ConfirmButton disabled={slots.includes(null)} onClick={() => onAnswer?.(slots)} />
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Equivalence machine, balance, sentences and loop cards              */
/* ------------------------------------------------------------------ */

interface MachineVisual extends Visual {
  type: "equivalenceMachine";
  card: string;
}

export function EquivalenceMachine({ visual }: VisualProps<MachineVisual>) {
  return (
    <div dir="rtl" className="flex items-center gap-3" aria-label="آلة التساوي">
      <div className="rounded-xl bg-amber-200 px-4 py-3 shadow">
        <RtlSentence text={visual.card} className="text-3xl" />
      </div>
      <span className="text-3xl" aria-hidden>
        ⬅
      </span>
      <div className="flex flex-col items-center rounded-2xl border-4 border-slate-700 bg-slate-100 px-4 py-3 shadow-inner">
        <span className="text-3xl" aria-hidden>
          ⚙️
        </span>
        <span className="text-base font-bold">آلة التساوي</span>
      </div>
      <span className="text-3xl" aria-hidden>
        ⬅
      </span>
      <div className="rounded-xl bg-sky-100 px-5 py-3 text-3xl font-extrabold shadow">؟</div>
    </div>
  );
}

interface BalanceVisual extends Visual {
  type: "balancePans";
  first: Array<number | null>;
  second: Array<number | null>;
}

/** Level balance. The first side of the logical sentence hangs on the RIGHT, as the RTL sentence reads. */
export function BalancePans({ visual, reveal, solution }: VisualProps<BalanceVisual>) {
  const box = (v: number | null, x: number, key: string) => {
    const text = v === null ? (reveal && typeof solution === "number" ? ar(solution) : "؟") : ar(v);
    const fill = v === null ? (reveal ? "#a7f3d0" : "#fde68a") : "#e0f2fe";
    return (
      <g key={key}>
        <rect x={x - 26} y={122} width={52} height={40} rx={8} fill={fill} stroke="#0f172a" strokeWidth={3} />
        <text x={x} y={150} textAnchor="middle" fontSize={22} fontWeight={800} fill="#0f172a">
          {text}
        </text>
      </g>
    );
  };
  const pan = (cx: number, items: Array<number | null>, tag: string) => (
    <g>
      <line x1={cx} y1={50} x2={cx - 62} y2={162} stroke="#475569" strokeWidth={2} />
      <line x1={cx} y1={50} x2={cx + 62} y2={162} stroke="#475569" strokeWidth={2} />
      {items.map((v, i) => box(v, cx - 30 + i * 60, `${tag}${i}`))}
      <path d={`M${cx - 70} 164 Q${cx} 196 ${cx + 70} 164 Z`} fill="#94a3b8" stroke="#334155" strokeWidth={3} />
    </g>
  );
  return (
    <svg viewBox="0 0 420 230" className="h-auto w-full max-w-md" role="img" aria-label="ميزان متوازن: الطرفان متساويان">
      <rect x={202} y={50} width={16} height={160} fill="#64748b" />
      <rect x={150} y={208} width={120} height={14} rx={6} fill="#475569" />
      <rect x={70} y={44} width={280} height={12} rx={6} fill="#334155" />
      <circle cx={210} cy={50} r={10} fill="#0f172a" />
      {pan(330, visual.first, "f")}
      {pan(90, visual.second, "s")}
    </svg>
  );
}

interface OddVisual extends Visual {
  type: "oddOneOutCards";
  numbers: number[];
}

export function OddOneOutCards({ visual }: VisualProps<OddVisual>) {
  return (
    <div dir="rtl" className="flex justify-center gap-4" role="list" aria-label="ثلاثة أعداد">
      {visual.numbers.map((n) => (
        <div key={n} role="listitem" className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white text-5xl font-extrabold shadow-lg ring-4 ring-violet-300">
          {ar(n)}
        </div>
      ))}
    </div>
  );
}

interface SentenceVisual extends Visual {
  type: "sentenceCard";
  x: number;
  op: "+" | "-";
  y: number;
  z: number | null;
}

export function SentenceCard({ visual, reveal, solution }: VisualProps<SentenceVisual>) {
  const z = visual.z ?? (reveal && typeof solution === "number" ? solution : "؟");
  return (
    <div className="rounded-2xl bg-white px-6 py-4 shadow-lg ring-4 ring-sky-200">
      <RtlSentence text={`${visual.x} ${opGlyph(visual.op)} ${visual.y} = ${z}`} className="text-4xl" />
    </div>
  );
}

interface LoopVisual extends Visual {
  type: "loopCard";
  have: number;
  a: number;
  b: number;
}

export function LoopCard({ visual }: VisualProps<LoopVisual>) {
  return (
    <div dir="rtl" className="w-56 overflow-hidden rounded-3xl bg-white shadow-lg ring-4 ring-amber-300" aria-label="بطاقة من حلقة الجمع">
      <p className="bg-amber-100 px-4 py-3 text-center text-3xl font-extrabold">{ar(`أنا ${visual.have}`)}</p>
      <p className="px-4 py-3 text-center text-2xl font-bold">{ar(`من هو ${visual.a} + ${visual.b}؟`)}</p>
    </div>
  );
}
