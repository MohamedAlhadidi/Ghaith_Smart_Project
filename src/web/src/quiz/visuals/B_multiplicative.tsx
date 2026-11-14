/** Renderers for equal groups, doubles, arrays and sharing (executor B). */
import { useState, type JSX } from "react";
import type { VisualProps } from "../types";
import { ar, ConfirmButton, isNum } from "./B_shared";

type GroupContext = "generic" | "shoes" | "hands" | "tricycles";

/* ------------------------------------------------------------------ */
/* group icons                                                         */
/* ------------------------------------------------------------------ */

function Dots({ n }: { n: number }) {
  const perRow = 5;
  const rows = Math.ceil(n / perRow);
  return (
    <svg viewBox={`0 0 ${perRow * 20 + 4} ${rows * 20 + 4}`} className="h-auto w-24" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={12 + (i % perRow) * 20} cy={12 + Math.floor(i / perRow) * 20} r={7} fill="#f97316" stroke="#9a3412" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

function ShoeBox() {
  const shoe = (x: number) => (
    <path d={`M${x} 46 q0 -12 8 -12 h6 q3 6 12 7 q8 1 8 6 v3 h-34 z`} fill="#2563eb" stroke="#1e3a8a" strokeWidth={1.5} />
  );
  return (
    <svg viewBox="0 0 90 64" className="h-16 w-24" aria-hidden>
      <rect x={3} y={26} width={84} height={34} rx={4} fill="#fde68a" stroke="#92400e" strokeWidth={2.5} />
      <rect x={1} y={20} width={88} height={8} rx={3} fill="#fbbf24" stroke="#92400e" strokeWidth={2} />
      {shoe(6)}
      {shoe(46)}
    </svg>
  );
}

function Hand() {
  const fingers = [
    { x: 14, h: 30 },
    { x: 26, h: 38 },
    { x: 38, h: 40 },
    { x: 50, h: 36 },
  ];
  return (
    <svg viewBox="0 0 80 90" className="h-20 w-20" aria-hidden>
      <rect x={10} y={42} width={50} height={42} rx={14} fill="#fcd9b6" stroke="#9a3412" strokeWidth={2} />
      {fingers.map((f) => (
        <g key={f.x}>
          <rect x={f.x} y={46 - f.h} width={11} height={f.h + 6} rx={5.5} fill="#fcd9b6" stroke="#9a3412" strokeWidth={2} />
          <ellipse cx={f.x + 5.5} cy={46 - f.h + 6} rx={3.5} ry={4} fill="#fff" stroke="#be123c" strokeWidth={1.5} />
        </g>
      ))}
      <rect x={58} y={44} width={11} height={30} rx={5.5} transform="rotate(-35 63 60)" fill="#fcd9b6" stroke="#9a3412" strokeWidth={2} />
      <ellipse cx={72} cy={48} rx={3.5} ry={4} transform="rotate(-35 72 48)" fill="#fff" stroke="#be123c" strokeWidth={1.5} />
    </svg>
  );
}

function Tricycle() {
  const wheel = (cx: number, cy: number, r: number) => (
    <g key={cx}>
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#0f172a" strokeWidth={3.5} />
      <circle cx={cx} cy={cy} r={2.5} fill="#0f172a" />
    </g>
  );
  // Three separate wheels: two small back wheels and a big front wheel.
  return (
    <svg viewBox="0 0 110 70" className="h-16 w-24" aria-hidden>
      <path d="M14 56 H42 M28 56 L56 36 L88 52 M56 36 L54 18 M46 18 h16 M28 56 L32 34 h12" fill="none" stroke="#dc2626" strokeWidth={4} strokeLinecap="round" />
      {[wheel(14, 56, 10), wheel(42, 56, 10), wheel(88, 50, 16)]}
    </svg>
  );
}

function GroupIcon({ context, size }: { context: GroupContext; size: number }) {
  if (context === "shoes") return <ShoeBox />;
  if (context === "hands") return <Hand />;
  if (context === "tricycles") return <Tricycle />;
  return <Dots n={size} />;
}

const GROUP_WORD: Record<GroupContext, { each: string; total: string; groups: string }> = {
  generic: { each: "في كل مجموعة", total: "عدد النقاط", groups: "عدد المجموعات" },
  shoes: { each: "في كل علبة", total: "عدد الأحذية", groups: "عدد العلب" },
  hands: { each: "في كل يد", total: "عدد الأظافر", groups: "عدد الأيدي" },
  tricycles: { each: "لكل دراجة", total: "عدد العجلات", groups: "عدد الدراجات" },
};

function Groups({ visual, reveal, solution, hintLevel }: VisualProps<{ type: "b-groups"; context: GroupContext; size: number; groups: number }>) {
  const { context, size, groups } = visual;
  const showCount = reveal || hintLevel >= 2;
  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="flex max-w-2xl flex-wrap justify-center gap-2" role="img" aria-label={`${GROUP_WORD[context].groups} ${ar(groups)}، ${GROUP_WORD[context].each} ${ar(size)}`}>
        {Array.from({ length: groups }, (_, i) => (
          <div key={i} className="flex flex-col items-center rounded-2xl bg-white p-2 shadow" data-group={i}>
            <GroupIcon context={context} size={size} />
            {showCount && <span className="text-lg font-bold text-sky-800">{ar(size * (i + 1))}</span>}
          </div>
        ))}
      </div>
      {reveal && isNum(solution) && <figcaption className="text-xl font-bold text-emerald-800">{`${GROUP_WORD[context].total}: ${ar(solution)}`}</figcaption>}
    </figure>
  );
}

function GroupsTotal({ visual, reveal, solution }: VisualProps<{ type: "b-groups-total"; context: GroupContext; size: number; total: number }>) {
  const { context, size, total } = visual;
  const w = GROUP_WORD[context];
  return (
    <div className="flex flex-wrap items-center justify-center gap-4" role="img" aria-label={`${w.total} ${ar(total)}، ${w.each} ${ar(size)}`}>
      <div className="flex flex-col items-center rounded-2xl bg-white p-3 shadow">
        <GroupIcon context={context} size={size} />
        <span className="text-lg font-bold">{`${w.each} ${ar(size)}`}</span>
      </div>
      <div className="rounded-2xl border-4 border-amber-400 bg-amber-50 px-6 py-4 text-center">
        <div className="text-lg font-bold text-amber-900">{w.total}</div>
        <div className="text-4xl font-extrabold">{ar(total)}</div>
      </div>
      <div className="rounded-2xl border-4 border-sky-300 bg-sky-50 px-6 py-4 text-center">
        <div className="text-lg font-bold text-sky-900">{w.groups}</div>
        <div className="text-4xl font-extrabold text-sky-700">{reveal && isNum(solution) ? ar(solution) : "؟"}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* doubles                                                             */
/* ------------------------------------------------------------------ */

/** Number line drawn left-to-right as in the book (p.10, p.35). */
function DoubleLine({ visual, reveal, solution }: VisualProps<{ type: "b-doubleline"; lineMax: number; tick: number; value: number; role: "double" | "half" }>) {
  const { lineMax, tick, value, role } = visual;
  const W = 520;
  const pad = 26;
  const x = (n: number) => pad + ((W - 2 * pad) * n) / lineMax;
  const labelEvery = tick === 1 ? 5 : tick;
  const ticks = Array.from({ length: Math.floor(lineMax / tick) + 1 }, (_, i) => i * tick);
  const answer = reveal && isNum(solution) ? ar(solution) : "؟";
  const halfAt = role === "half" ? (reveal && isNum(solution) ? solution : value / 2) : value;
  // An unlabelled marked number gets its own tag below the axis so it never covers a tick label.
  const valueTag = role === "double" && value % labelEvery !== 0;
  return (
    <svg viewBox={`0 0 ${W} ${valueTag ? 186 : 150}`} className="h-auto w-full max-w-2xl" role="img" aria-label={role === "double" ? `خط الأعداد، العدد ${ar(value)} معلّم` : `خط الأعداد، الضعف ${ar(value)} معلّم`}>
      <line x1={pad} y1={100} x2={W - pad} y2={100} stroke="#0f172a" strokeWidth={4} />
      {ticks.map((n) => (
        <g key={n}>
          <line x1={x(n)} y1={n % labelEvery === 0 ? 88 : 93} x2={x(n)} y2={n % labelEvery === 0 ? 112 : 107} stroke="#0f172a" strokeWidth={n % labelEvery === 0 ? 3 : 2} />
          {n % labelEvery === 0 && (
            <text x={x(n)} y={138} textAnchor="middle" fontSize={lineMax >= 100 ? 21 : 25} fontWeight={700}>
              {ar(n)}
            </text>
          )}
        </g>
      ))}
      <circle cx={x(value)} cy={100} r={9} fill="#e11d48" />
      {valueTag && (
        <g>
          <line x1={x(value)} y1={108} x2={x(value)} y2={154} stroke="#e11d48" strokeWidth={2} strokeDasharray="3 3" />
          <rect x={x(value) - 24} y={152} width={48} height={32} rx={8} fill="#ffe4e6" stroke="#e11d48" strokeWidth={2} />
          <text x={x(value)} y={176} textAnchor="middle" fontSize={24} fontWeight={800} fill="#be123c">
            {ar(value)}
          </text>
        </g>
      )}
      {role === "double" ? (
        <g>
          <rect x={x(value) - 32} y={16} width={64} height={46} rx={10} fill="#e0f2fe" stroke="#0284c7" strokeWidth={3} />
          <text x={x(value)} y={49} textAnchor="middle" fontSize={27} fontWeight={800} fill="#0369a1">
            {answer}
          </text>
          <line x1={x(value)} y1={62} x2={x(value)} y2={90} stroke="#0284c7" strokeWidth={2} strokeDasharray="4 3" />
        </g>
      ) : (
        <g>
          <rect x={x(value) - 32} y={16} width={64} height={46} rx={10} fill="#ffe4e6" stroke="#e11d48" strokeWidth={3} />
          <text x={x(value)} y={49} textAnchor="middle" fontSize={27} fontWeight={800} fill="#be123c">
            {ar(value)}
          </text>
          <path d={`M${x(0)} 84 Q${x(value / 2)} 64 ${x(value)} 84`} fill="none" stroke="#64748b" strokeWidth={2} strokeDasharray="6 4" />
          <text x={x(halfAt)} y={76} textAnchor="middle" fontSize={25} fontWeight={800} fill="#0369a1">
            {answer}
          </text>
        </g>
      )}
    </svg>
  );
}

function Recipe({ visual, reveal, solution }: VisualProps<{ type: "b-recipe"; fromCount: number; toCount: number; lines: Array<{ name: string; text: string }>; ask: number; askUnit: string }>) {
  return (
    <table className="w-full max-w-md overflow-hidden rounded-2xl bg-amber-50 text-lg shadow" aria-label="وصفة البسكويت">
      <thead className="bg-amber-200">
        <tr>
          <th className="p-2 text-start">المقادير</th>
          <th className="p-2">{`${ar(visual.fromCount)} قطع`}</th>
          <th className="p-2">{`${ar(visual.toCount)} قطع`}</th>
        </tr>
      </thead>
      <tbody>
        {visual.lines.map((l, i) => (
          <tr key={i} className={i === visual.ask ? "bg-yellow-200 font-extrabold" : "opacity-70"}>
            <td className="p-2">{l.name}</td>
            <td className="p-2 text-center">{ar(l.text)}</td>
            <td className="p-2 text-center text-sky-700">{i === visual.ask ? (reveal && isNum(solution) ? `${ar(solution)} ${visual.askUnit}` : "؟") : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ */
/* arrays                                                              */
/* ------------------------------------------------------------------ */

function ArrayIcon({ icon, x, y }: { icon: string; x: number; y: number }): JSX.Element {
  if (icon === "star")
    return <polygon points="0,-14 4,-5 14,-4 6,3 9,13 0,8 -9,13 -6,3 -14,-4 -4,-5" transform={`translate(${x} ${y})`} fill="#facc15" stroke="#a16207" strokeWidth={1.5} />;
  if (icon === "flower")
    return (
      <g transform={`translate(${x} ${y})`}>
        {[0, 72, 144, 216, 288].map((a) => (
          <circle key={a} cx={8 * Math.cos((a * Math.PI) / 180)} cy={8 * Math.sin((a * Math.PI) / 180)} r={6} fill="#f472b6" />
        ))}
        <circle r={5} fill="#facc15" />
      </g>
    );
  return <circle cx={x} cy={y} r={12} fill="#38bdf8" stroke="#0369a1" strokeWidth={2} />;
}

function ArrayPicture({ visual, hintLevel }: VisualProps<{ type: "b-array"; rows: number; cols: number; icon: string }>) {
  const { rows, cols, icon } = visual;
  const cell = 40;
  return (
    <svg viewBox={`0 0 ${cols * cell + 40} ${rows * cell + 10}`} className="h-auto w-full max-w-lg" role="img" aria-label={`مصفوفة: ${ar(rows)} صفوف، في كل صف ${ar(cols)}`}>
      {Array.from({ length: rows }, (_, r) => (
        <g key={r}>
          {hintLevel >= 1 && <rect x={2} y={r * cell + 7} width={cols * cell + 6} height={cell - 4} rx={10} fill="#f1f5f9" />}
          {Array.from({ length: cols }, (_, c) => (
            <ArrayIcon key={c} icon={icon} x={c * cell + 25} y={r * cell + 25} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function isBuild(v: unknown): v is { rows: number; cols: number } {
  return typeof v === "object" && v !== null && isNum((v as { rows?: unknown }).rows) && isNum((v as { cols?: unknown }).cols);
}

/** Tap a cell to build the array from the top-right corner (RTL) to that cell. */
function ArrayBuild({ visual, reveal, solution, locked, onAnswer }: VisualProps<{ type: "b-array-build"; gridRows: number; gridCols: number }>) {
  const { gridRows, gridCols } = visual;
  const [built, setBuilt] = useState<{ rows: number; cols: number } | null>(null);
  const shown = reveal && isBuild(solution) ? solution : built;
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div
        dir="rtl"
        role="grid"
        aria-label="شبكة لبناء المصفوفة"
        className="grid w-full max-w-xl gap-1 rounded-2xl bg-slate-200 p-2"
        style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: gridRows * gridCols }, (_, i) => {
          const r = Math.floor(i / gridCols);
          const c = i % gridCols;
          const on = shown !== null && r < shown.rows && c < shown.cols;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              data-array-cell={`${r},${c}`}
              disabled={locked}
              aria-label={`الصف ${ar(r + 1)}، المربع ${ar(c + 1)}`}
              aria-pressed={on}
              onClick={() => setBuilt({ rows: r + 1, cols: c + 1 })}
              className={`aspect-square min-h-9 rounded-md border-2 ${on ? (reveal ? "border-emerald-700 bg-emerald-400" : "border-sky-700 bg-sky-400") : "border-slate-300 bg-white"} disabled:cursor-default`}
            />
          );
        })}
      </div>
      <p className="text-xl font-bold" aria-live="polite">
        {shown ? `الصفوف: ${ar(shown.rows)}، في كل صف: ${ar(shown.cols)} — المجموع ${ar(shown.rows * shown.cols)}` : "المس مربعًا لتبني المصفوفة."}
      </p>
      {onAnswer && !reveal && (
        <div className="flex gap-3">
          <button type="button" disabled={locked || !built} onClick={() => setBuilt(null)} className="min-h-14 rounded-2xl bg-white px-6 py-3 text-xl font-bold shadow disabled:opacity-40">
            مسح
          </button>
          <ConfirmButton disabled={locked || !built} onClick={() => built && onAnswer(built)} />
        </div>
      )}
    </div>
  );
}

function CubeLayer({ rows, cols, label }: { rows: number; cols: number; label?: string }) {
  const cell = 34;
  const pad = 14;
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${cols * cell + 2 * pad} ${rows * cell + 2 * pad}`} className="h-auto w-48 sm:w-56" role="img" aria-label={`علبة فيها طبقة من المكعبات${label ? ` (${label})` : ""}`}>
        <rect x={2} y={2} width={cols * cell + 2 * pad - 4} height={rows * cell + 2 * pad - 4} rx={8} fill="#d6a46c" stroke="#7c4a1e" strokeWidth={4} />
        {Array.from({ length: rows * cols }, (_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const x = pad + c * cell;
          const y = pad + r * cell;
          return (
            <g key={i}>
              <rect x={x + 1} y={y + 1} width={cell - 2} height={cell - 2} rx={3} fill="#60a5fa" stroke="#1e3a8a" strokeWidth={1.5} />
              <rect x={x + 5} y={y + 5} width={cell - 14} height={cell - 14} rx={2} fill="#93c5fd" />
            </g>
          );
        })}
      </svg>
      {label && <figcaption className="text-2xl font-extrabold">{`(${label})`}</figcaption>}
    </figure>
  );
}

function Box({ visual }: VisualProps<{ type: "b-box"; rows: number; cols: number }>) {
  return <CubeLayer rows={visual.rows} cols={visual.cols} />;
}

function Boxes({ visual }: VisualProps<{ type: "b-boxes"; boxes: Array<{ label: string; rows: number; cols: number }> }>) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-6">
      {visual.boxes.map((b) => (
        <CubeLayer key={b.label} rows={b.rows} cols={b.cols} label={b.label} />
      ))}
    </div>
  );
}

function Total({ visual }: VisualProps<{ type: "b-total"; total: number }>) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-4 border-sky-300 bg-white px-6 py-4 shadow" role="img" aria-label={`عدد المكعبات ${ar(visual.total)}`}>
      <svg viewBox="0 0 40 40" className="h-12 w-12" aria-hidden>
        <path d="M20 4 L36 12 L36 30 L20 38 L4 30 L4 12 Z" fill="#60a5fa" stroke="#1e3a8a" strokeWidth={2} />
        <path d="M4 12 L20 20 L36 12 M20 20 L20 38" fill="none" stroke="#1e3a8a" strokeWidth={2} />
      </svg>
      <span className="text-2xl font-bold">عدد المكعبات</span>
      <span className="text-4xl font-extrabold">{ar(visual.total)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* sharing biscuits (p.43)                                             */
/* ------------------------------------------------------------------ */

function Biscuits({ n, max = 10 }: { n: number; max?: number }) {
  const perRow = Math.min(max, 5);
  const rows = Math.max(1, Math.ceil(n / perRow));
  return (
    <svg viewBox={`0 0 ${perRow * 22 + 4} ${rows * 22 + 4}`} className="h-auto" style={{ width: `${perRow * 1.4}rem` }} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${13 + (i % perRow) * 22} ${13 + Math.floor(i / perRow) * 22})`}>
          <circle r={9} fill="#d97706" stroke="#78350f" strokeWidth={1.5} />
          <circle cx={-3} cy={-2} r={1.4} fill="#78350f" />
          <circle cx={3} cy={2} r={1.4} fill="#78350f" />
        </g>
      ))}
    </svg>
  );
}

function Share({
  visual,
  reveal,
  solution,
}: VisualProps<{ type: "b-share"; total: number; divisor: number; mode: "share" | "group"; distributed: boolean; showItems: boolean }>) {
  const { total, divisor, mode, distributed, showItems } = visual;
  const revealed = reveal && isNum(solution);
  if (mode === "group") {
    const bags = revealed ? solution : 0;
    return (
      <div className="flex flex-col items-center gap-3" role="img" aria-label={`${ar(total)} قطعة بسكويت، في كل كيس ${ar(divisor)}`}>
        {!revealed && (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="rounded-2xl bg-amber-100 p-3 shadow">{showItems ? <Biscuits n={total} /> : <span className="text-3xl font-extrabold">{`${ar(total)} قطعة`}</span>}</div>
            <div className="flex flex-col items-center rounded-2xl border-4 border-dashed border-violet-400 bg-violet-50 p-3">
              <Biscuits n={divisor} />
              <span className="font-bold">{`في كل كيس ${ar(divisor)}`}</span>
            </div>
          </div>
        )}
        {revealed && (
          <div className="flex flex-wrap justify-center gap-3">
            {Array.from({ length: bags }, (_, i) => (
              <div key={i} className="rounded-2xl border-4 border-violet-400 bg-violet-50 p-2">
                <Biscuits n={divisor} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  const perPlate = distributed ? total / divisor : revealed ? solution : 0;
  return (
    <div className="flex flex-col items-center gap-3" role="img" aria-label={`${ar(total)} قطعة بسكويت و${ar(divisor)} أطباق`}>
      {perPlate === 0 && (
        <div className="rounded-2xl border-4 border-amber-600 bg-amber-100 p-3 shadow">
          {showItems ? <Biscuits n={total} /> : <span className="text-3xl font-extrabold">{`${ar(total)} قطعة`}</span>}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {Array.from({ length: divisor }, (_, i) => (
          <div key={i} className="flex h-24 w-28 items-center justify-center rounded-[50%] border-4 border-slate-300 bg-white shadow-inner" data-plate={i}>
            {perPlate > 0 && <Biscuits n={perPlate} max={3} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export const MULTIPLICATIVE_VISUALS = {
  "b-groups": Groups,
  "b-groups-total": GroupsTotal,
  "b-doubleline": DoubleLine,
  "b-recipe": Recipe,
  "b-array": ArrayPicture,
  "b-array-build": ArrayBuild,
  "b-box": Box,
  "b-boxes": Boxes,
  "b-total": Total,
  "b-share": Share,
};
