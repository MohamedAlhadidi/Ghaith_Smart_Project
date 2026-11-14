/** Drawn objects: counting (p.6), estimation dots (p.33), difference rows (p.39), tens and ones (p.31), adding groups (p.14). */
import { useState, type JSX } from "react";
import type { Visual } from "@ghaith/game-core";
import type { VisualProps } from "../types";
import { ar } from "./A_shared";

/* ------------------------------------------------------------------ */
/* Scattered objects                                                   */
/* ------------------------------------------------------------------ */

const BOX_W = 100;
const BOX_H = 70;

/** Same jittered-grid cell size the generator used, so objects are drawn without touching. */
function scatterCell(n: number): number {
  const cols = Math.max(2, Math.ceil(Math.sqrt((n * 1.4 * BOX_W) / BOX_H)));
  const rows = Math.max(2, Math.ceil((n * 1.4) / cols));
  return Math.min(BOX_W / cols, BOX_H / rows);
}

type Kind = "shell" | "counter" | "marble" | "bead";

function Thing({ kind, r }: { kind: Kind; r: number }) {
  const sw = r * 0.16;
  switch (kind) {
    case "shell":
      return (
        <g>
          <path d={`M${-r} ${r * 0.55} Q0 ${-r * 1.5} ${r} ${r * 0.55} Z`} fill="#fbcfe8" stroke="#be185d" strokeWidth={sw} />
          {[-0.5, 0, 0.5].map((k) => (
            <line key={k} x1={0} y1={r * 0.55} x2={k * r} y2={-r * 0.35} stroke="#be185d" strokeWidth={sw * 0.7} />
          ))}
        </g>
      );
    case "counter":
      return (
        <g>
          <circle r={r} fill="#fde047" stroke="#a16207" strokeWidth={sw} />
          <circle r={r * 0.55} fill="none" stroke="#a16207" strokeWidth={sw * 0.7} />
        </g>
      );
    case "marble":
      return (
        <g>
          <circle r={r} fill="#60a5fa" stroke="#1d4ed8" strokeWidth={sw} />
          <circle cx={-r * 0.35} cy={-r * 0.35} r={r * 0.28} fill="#fff" opacity={0.85} />
        </g>
      );
    default:
      return (
        <g>
          <circle r={r} fill="#fb923c" stroke="#c2410c" strokeWidth={sw} />
          <circle r={r * 0.3} fill="#fff" />
        </g>
      );
  }
}

/** Positions when the objects are regrouped in groups of g (first group on the right, like RTL reading). */
function groupedLayout(n: number, g: number): { pts: Array<[number, number]>; r: number; frames: Array<{ x: number; y: number; w: number; h: number; full: boolean }> } {
  const gc = Math.min(g, 5);
  const gr = Math.ceil(g / gc);
  const q = Math.ceil(n / g);
  for (let s = 10; s >= 1.2; s -= 0.2) {
    const gw = gc * s + s * 0.9;
    const gh = gr * s + s * 0.9;
    const perRow = Math.floor(BOX_W / gw);
    if (perRow < 1) continue;
    const rowsNeeded = Math.ceil(q / perRow);
    if (rowsNeeded * gh > BOX_H) continue;
    const offX = (BOX_W - Math.min(perRow, q) * gw) / 2;
    const offY = (BOX_H - rowsNeeded * gh) / 2;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      const grp = Math.floor(i / g);
      const k = i % g;
      const gx = offX + (grp % perRow) * gw;
      const gy = offY + Math.floor(grp / perRow) * gh;
      pts.push([BOX_W - (gx + s * 0.45 + (k % gc) * s + s / 2), gy + s * 0.45 + Math.floor(k / gc) * s + s / 2]);
    }
    const frames = Array.from({ length: q }, (_, grp) => {
      const gx = offX + (grp % perRow) * gw;
      return { x: BOX_W - gx - gw + s * 0.1, y: offY + Math.floor(grp / perRow) * gh + s * 0.1, w: gw - s * 0.2, h: gh - s * 0.2, full: (grp + 1) * g <= n };
    });
    return { pts, r: s * 0.38, frames };
  }
  return { pts: Array.from({ length: n }, () => [50, 35] as [number, number]), r: 1, frames: [] };
}

interface ScatterVisual extends Visual {
  type: "scatterCount";
  positions: Array<[number, number]>;
  kind: Kind;
  groupBy: number[];
}

export function ScatterCount({ visual }: VisualProps<ScatterVisual>) {
  const [group, setGroup] = useState<number | null>(null);
  const n = visual.positions.length;
  const loose = scatterCell(n) * 0.32;
  const layout = group ? groupedLayout(n, group) : null;
  const r = layout ? Math.min(layout.r, loose * 1.2) : loose;
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <svg viewBox={`-2 -2 ${BOX_W + 4} ${BOX_H + 4}`} className="h-auto w-full max-w-2xl rounded-2xl bg-white shadow" role="img" aria-label="صورة فيها أشياء متفرقة للعدّ">
        {layout?.frames.map((f, i) => (
          <rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} rx={1.5} fill={f.full ? "#e0f2fe" : "none"} stroke="#7dd3fc" strokeWidth={0.3} strokeDasharray={f.full ? undefined : "1 0.8"} />
        ))}
        {visual.positions.map(([x, y], i) => {
          const [gx, gy] = layout ? layout.pts[i]! : [x, y];
          return (
            <g key={i} style={{ transform: `translate(${gx}px, ${gy}px)`, transition: "transform 450ms ease" }}>
              <Thing kind={visual.kind} r={r} />
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="مساعدة: إعادة الترتيب">
        {visual.groupBy.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={group === g}
            onClick={() => setGroup(group === g ? null : g)}
            className={`min-h-12 rounded-xl px-4 py-2 text-lg font-bold shadow active:scale-95 ${group === g ? "bg-sky-600 text-white" : "bg-white"}`}
          >
            رتّب في مجموعات من {ar(g)}
          </button>
        ))}
      </div>
    </div>
  );
}

interface DotsVisual extends Visual {
  type: "estimateDots";
  positions: Array<[number, number]>;
  size: "big" | "small";
}

export function EstimateDots({ visual }: VisualProps<DotsVisual>) {
  const cell = scatterCell(visual.positions.length);
  const r = cell * (visual.size === "big" ? 0.32 : 0.17);
  return (
    <svg viewBox={`-2 -2 ${BOX_W + 4} ${BOX_H + 4}`} className="h-auto w-full max-w-2xl rounded-2xl bg-white shadow" role="img" aria-label="صورة فيها نقاط كثيرة: قدّر عددها">
      {visual.positions.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#1e3a8a" />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Difference rows (p.39)                                              */
/* ------------------------------------------------------------------ */

type RowKind = "star" | "face" | "car" | "fish" | "button" | "heart";
const ROW_NAMES: Record<RowKind, string> = { star: "نجوم", face: "وجوه", car: "سيارات", fish: "أسماك", button: "أزرار", heart: "قلوب" };

function Icon({ kind, x, y, s, ring }: { kind: RowKind; x: number; y: number; s: number; ring: boolean }) {
  let body: JSX.Element;
  switch (kind) {
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 ? s * 0.45 : s;
        return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
      }).join(" ");
      body = <polygon points={pts} fill="#facc15" stroke="#a16207" strokeWidth={2} />;
      break;
    }
    case "face":
      body = (
        <g>
          <circle cx={x} cy={y} r={s} fill="#fde68a" stroke="#92400e" strokeWidth={2} />
          <circle cx={x - s * 0.35} cy={y - s * 0.25} r={s * 0.12} fill="#0f172a" />
          <circle cx={x + s * 0.35} cy={y - s * 0.25} r={s * 0.12} fill="#0f172a" />
          <path d={`M${x - s * 0.45} ${y + s * 0.2} Q${x} ${y + s * 0.65} ${x + s * 0.45} ${y + s * 0.2}`} fill="none" stroke="#0f172a" strokeWidth={2} />
        </g>
      );
      break;
    case "car":
      body = (
        <g>
          <rect x={x - s} y={y - s * 0.45} width={s * 2} height={s * 0.8} rx={s * 0.25} fill="#f87171" stroke="#991b1b" strokeWidth={2} />
          <rect x={x - s * 0.5} y={y - s * 0.85} width={s} height={s * 0.5} rx={s * 0.15} fill="#fecaca" stroke="#991b1b" strokeWidth={2} />
          <circle cx={x - s * 0.55} cy={y + s * 0.4} r={s * 0.25} fill="#0f172a" />
          <circle cx={x + s * 0.55} cy={y + s * 0.4} r={s * 0.25} fill="#0f172a" />
        </g>
      );
      break;
    case "fish":
      body = (
        <g>
          <ellipse cx={x - s * 0.15} cy={y} rx={s * 0.75} ry={s * 0.5} fill="#38bdf8" stroke="#075985" strokeWidth={2} />
          <path d={`M${x + s * 0.55} ${y} L${x + s} ${y - s * 0.45} L${x + s} ${y + s * 0.45} Z`} fill="#38bdf8" stroke="#075985" strokeWidth={2} />
          <circle cx={x - s * 0.5} cy={y - s * 0.1} r={s * 0.1} fill="#0f172a" />
        </g>
      );
      break;
    case "button":
      body = (
        <g>
          <circle cx={x} cy={y} r={s * 0.9} fill="#a78bfa" stroke="#5b21b6" strokeWidth={2} />
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([dx, dy], i) => (
            <circle key={i} cx={x + dx! * s * 0.25} cy={y + dy! * s * 0.25} r={s * 0.12} fill="#ede9fe" />
          ))}
        </g>
      );
      break;
    default:
      body = (
        <path
          d={`M${x} ${y + s * 0.85} C${x - s * 1.3} ${y} ${x - s * 0.6} ${y - s} ${x} ${y - s * 0.35} C${x + s * 0.6} ${y - s} ${x + s * 1.3} ${y} ${x} ${y + s * 0.85} Z`}
          fill="#fb7185"
          stroke="#9f1239"
          strokeWidth={2}
        />
      );
  }
  return (
    <g>
      {ring && <circle cx={x} cy={y} r={s * 1.25} fill="#dcfce7" stroke="#16a34a" strokeWidth={2} />}
      {body}
    </g>
  );
}

interface RowsVisual extends Visual {
  type: "differenceRows";
  top: number;
  bottom: number;
  kind: RowKind;
}

export function DifferenceRows({ visual, reveal, hintLevel }: VisualProps<RowsVisual>) {
  const { top, bottom, kind } = visual;
  const cell = 44;
  const pad = 16;
  const w = top * cell + pad * 2;
  // Both rows start at the right edge (reading start in Arabic), item under item, like the book.
  const xAt = (i: number) => w - pad - cell * (i + 0.5);
  const lineX = w - pad - cell * bottom;
  return (
    <svg viewBox={`0 0 ${w} 120`} className="h-auto w-full max-w-2xl rounded-2xl bg-white shadow" role="img" aria-label={`صفّان من ال${ROW_NAMES[kind]}: ${ar(top)} و ${ar(bottom)}`}>
      {Array.from({ length: top }, (_, i) => (
        <Icon key={`t${i}`} kind={kind} x={xAt(i)} y={32} s={16} ring={(reveal || hintLevel >= 2) && i >= bottom} />
      ))}
      {Array.from({ length: bottom }, (_, i) => (
        <Icon key={`b${i}`} kind={kind} x={xAt(i)} y={88} s={16} ring={false} />
      ))}
      {(hintLevel >= 1 || reveal) && <line x1={lineX} x2={lineX} y1={4} y2={116} stroke="#0f172a" strokeWidth={3} strokeDasharray="8 6" />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Tens rods and ones cubes                                            */
/* ------------------------------------------------------------------ */

interface BlocksVisual extends Visual {
  type: "baseTenBlocks";
  tens: number;
  ones: number;
}

export function BaseTenBlocks({ visual }: VisualProps<BlocksVisual>) {
  const { tens, ones } = visual;
  const u = 14;
  const rodsW = tens * (u + 8);
  const w = rodsW + 24 + Math.ceil(ones / 5) * (u + 6) + 16;
  return (
    <svg viewBox={`0 0 ${Math.max(w, 60)} ${10 * u + 20}`} className="h-44 w-auto max-w-full" role="img" aria-label="أعمدة عشرات ومكعبات آحاد">
      {Array.from({ length: tens }, (_, t) =>
        Array.from({ length: 10 }, (_, k) => <rect key={`${t}-${k}`} x={8 + t * (u + 8)} y={10 + k * u} width={u} height={u} fill="#60a5fa" stroke="#1e3a8a" strokeWidth={1.5} />),
      )}
      {Array.from({ length: ones }, (_, k) => (
        <rect key={`o${k}`} x={rodsW + 24 + Math.floor(k / 5) * (u + 6)} y={10 + (9 - (k % 5)) * u} width={u} height={u} fill="#fcd34d" stroke="#92400e" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Adding a group of numbers: tap two to mark a pair (aid only)        */
/* ------------------------------------------------------------------ */

interface DigitGroupVisual extends Visual {
  type: "digitGroup";
  digits: number[];
}

const PAIR_COLORS = ["bg-rose-200 ring-rose-500", "bg-sky-200 ring-sky-500", "bg-lime-200 ring-lime-600"];

export function DigitGroup({ visual, locked, reveal }: VisualProps<DigitGroupVisual>) {
  const [pairs, setPairs] = useState<Array<[number, number]>>([]);
  const [pending, setPending] = useState<number | null>(null);
  const done = locked || reveal;
  const pairOf = (i: number) => pairs.findIndex((p) => p.includes(i));

  function tap(i: number) {
    const p = pairOf(i);
    if (p >= 0) {
      setPairs(pairs.filter((_, k) => k !== p));
      return;
    }
    if (pending === null) setPending(i);
    else if (pending === i) setPending(null);
    else {
      setPairs([...pairs, [pending, i]]);
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div dir="rtl" className="flex flex-wrap justify-center gap-3" role="group" aria-label="الأعداد: المس عددين لتجعلهما زوجًا">
        {visual.digits.map((d, i) => {
          const p = pairOf(i);
          const ten = p >= 0 && visual.digits[pairs[p]![0]]! + visual.digits[pairs[p]![1]]! === 10;
          const tone = p >= 0 ? `${PAIR_COLORS[p % PAIR_COLORS.length]} ring-4` : pending === i ? "bg-amber-200 ring-4 ring-amber-500" : "bg-white";
          return (
            <button
              key={i}
              type="button"
              disabled={done}
              aria-pressed={p >= 0 || pending === i}
              aria-label={`العدد ${ar(d)}`}
              onClick={() => tap(i)}
              className={`relative flex h-20 w-16 items-center justify-center rounded-2xl text-4xl font-extrabold shadow active:scale-95 ${tone}`}
            >
              {ar(d)}
              {ten && <span className="absolute -bottom-3 rounded-full bg-emerald-600 px-2 text-sm text-white">{ar(10)}</span>}
            </button>
          );
        })}
      </div>
      {!done && <p className="text-base text-slate-600">المس عددين لتجعلهما زوجًا (مثل عددين مجموعهما {ar(10)}).</p>}
    </div>
  );
}
