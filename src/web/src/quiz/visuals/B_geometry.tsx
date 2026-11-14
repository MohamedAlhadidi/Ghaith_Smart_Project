/** Renderers for shapes, solids and symmetry (executor B). */
import { useState } from "react";
import type { VisualProps } from "../types";
import { ar, ConfirmButton } from "./B_shared";

type Pt = [number, number];
interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const pointsAttr = (pts: Pt[]) => pts.map(([x, y]) => `${x},${y}`).join(" ");

/** Display-only mirror image (the mechanic computes the truth itself). */
function reflect([px, py]: Pt, l: Line): Pt {
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  const t = ((px - l.x1) * dx + (py - l.y1) * dy) / (dx * dx + dy * dy);
  return [2 * (l.x1 + t * dx) - px, 2 * (l.y1 + t * dy) - py];
}

function PolygonView({ visual, reveal }: VisualProps<{ type: "b-polygon"; points: Pt[] }>) {
  const pts = visual.points;
  return (
    <svg viewBox="-110 -110 220 220" className="h-64 w-64" role="img" aria-label="شكل مضلع">
      <polygon points={pointsAttr(pts)} fill="#bae6fd" stroke="#0369a1" strokeWidth={4} strokeLinejoin="round" />
      {reveal &&
        pts.map((p, i) => {
          const q = pts[(i + 1) % pts.length]!;
          const mx = (p[0] + q[0]) / 2;
          const my = (p[1] + q[1]) / 2;
          const len = Math.hypot(mx, my) || 1;
          return (
            <text key={i} x={mx + (mx / len) * 13} y={my + (my / len) * 13 + 7} textAnchor="middle" fontSize={20} fontWeight={800} fill="#be123c">
              {ar(i + 1)}
            </text>
          );
        })}
    </svg>
  );
}

function Shapes({ visual, reveal, solution }: VisualProps<{ type: "b-shapes"; shapes: Array<{ label: string; points: Pt[] }> }>) {
  const picked = new Set(Array.isArray(solution) ? (solution as string[]) : []);
  return (
    <div className="grid w-full max-w-xl grid-cols-3 gap-3">
      {visual.shapes.map((s, i) => {
        const on = reveal && picked.has(`p${i}`);
        return (
          <figure key={i} className={`flex flex-col items-center rounded-2xl bg-white p-2 shadow ${on ? "ring-4 ring-emerald-500" : ""}`}>
            <svg viewBox="-100 -100 200 200" className="h-24 w-24 sm:h-28 sm:w-28" role="img" aria-label={`الشكل ${ar(s.label)}`}>
              <polygon points={pointsAttr(s.points)} fill="#fde68a" stroke="#b45309" strokeWidth={6} strokeLinejoin="round" />
            </svg>
            <figcaption className="text-xl font-extrabold">{ar(s.label)}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* isometric cubes (p.19)                                              */
/* ------------------------------------------------------------------ */

type Axis = "x" | "y" | "z";
interface Solid {
  length: number;
  axis: Axis;
}
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
/** x goes right-down, z goes left-down, y goes up: the visible faces are top, x-front and z-front. */
const project = (x: number, y: number, z: number, s: number): Pt => [(x - z) * COS * s, (x + z) * SIN * s - y * s];

function Cuboid({ solid }: { solid: Solid }) {
  const s = 34;
  const [lx, ly, lz] = solid.axis === "x" ? [solid.length, 1, 1] : solid.axis === "y" ? [1, solid.length, 1] : [1, 1, solid.length];
  const P = (x: number, y: number, z: number) => project(x, y, z, s);
  const top = [P(0, ly, 0), P(lx, ly, 0), P(lx, ly, lz), P(0, ly, lz)];
  const right = [P(lx, 0, 0), P(lx, ly, 0), P(lx, ly, lz), P(lx, 0, lz)];
  const left = [P(0, 0, lz), P(lx, 0, lz), P(lx, ly, lz), P(0, ly, lz)];
  const all = [...top, ...right, ...left];
  const minX = Math.min(...all.map((p) => p[0])) - 4;
  const maxX = Math.max(...all.map((p) => p[0])) + 4;
  const minY = Math.min(...all.map((p) => p[1])) - 4;
  const maxY = Math.max(...all.map((p) => p[1])) + 4;
  // Thin lines where the joined cubes meet (the solid outline stays bold).
  const seams: Array<[Pt, Pt]> = [];
  for (let i = 1; i < solid.length; i++) {
    if (solid.axis === "x") seams.push([P(i, ly, 0), P(i, ly, lz)], [P(i, ly, lz), P(i, 0, lz)]);
    if (solid.axis === "y") seams.push([P(lx, i, 0), P(lx, i, lz)], [P(lx, i, lz), P(0, i, lz)]);
    if (solid.axis === "z") seams.push([P(0, ly, i), P(lx, ly, i)], [P(lx, ly, i), P(lx, 0, i)]);
  }
  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} style={{ width: `${(maxX - minX) / 16}rem` }} className="h-auto" aria-hidden>
      <polygon points={pointsAttr(left)} fill="#f97316" stroke="#7c2d12" strokeWidth={2.5} strokeLinejoin="round" />
      <polygon points={pointsAttr(right)} fill="#fb923c" stroke="#7c2d12" strokeWidth={2.5} strokeLinejoin="round" />
      <polygon points={pointsAttr(top)} fill="#fed7aa" stroke="#7c2d12" strokeWidth={2.5} strokeLinejoin="round" />
      {seams.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#7c2d12" strokeWidth={1} strokeOpacity={0.45} />
      ))}
    </svg>
  );
}

function CubeRow({ solids }: { solids: Solid[] }) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-6">
      {solids.map((s, i) => (
        <Cuboid key={i} solid={s} />
      ))}
    </div>
  );
}

function Cubes({ visual, reveal, solution }: VisualProps<{ type: "b-cubes"; solids: Solid[] }>) {
  const cubes = visual.solids.reduce((n, s) => n + s.length, 0);
  return (
    <figure className="flex flex-col items-center gap-2" role="img" aria-label={`${ar(cubes)} مكعبات في ${ar(visual.solids.length)} مجسّمات منفصلة`}>
      <div className="rounded-2xl bg-white p-4 shadow">
        <CubeRow solids={visual.solids} />
      </div>
      {reveal && typeof solution === "number" && <figcaption className="text-xl font-bold text-emerald-800">{`${ar(visual.solids.length)} × ${ar(3)} = ${ar(solution)}`}</figcaption>}
    </figure>
  );
}

function CubesChoice({ visual, reveal, solution }: VisualProps<{ type: "b-cubes-choice"; arrangements: Array<{ label: string; solids: Solid[] }> }>) {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {visual.arrangements.map((a, i) => (
        <figure key={a.label} className={`flex flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow ${reveal && solution === `a${i}` ? "ring-4 ring-emerald-500" : ""}`}>
          <CubeRow solids={a.solids} />
          <figcaption className="text-2xl font-extrabold">{`(${a.label})`}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* symmetry                                                            */
/* ------------------------------------------------------------------ */

function Symmetry({ visual, reveal }: VisualProps<{ type: "b-symmetry"; points: Pt[]; line: Line }>) {
  const { points, line } = visual;
  return (
    <svg viewBox="-100 -100 200 200" className="h-64 w-64" role="img" aria-label="شكل وخط متقطع">
      <polygon points={pointsAttr(points)} fill="#c4b5fd" stroke="#5b21b6" strokeWidth={3} strokeLinejoin="round" />
      {reveal && <polygon points={pointsAttr(points.map((p) => reflect(p, line)))} fill="none" stroke="#e11d48" strokeWidth={3} strokeDasharray="5 4" />}
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#0f172a" strokeWidth={3} strokeDasharray="10 7" />
    </svg>
  );
}

type GridAxis = "vertical" | "horizontal" | "diag-main" | "diag-anti";
function axisLine(size: number, axis: GridAxis): Line {
  if (axis === "vertical") return { x1: size / 2, y1: 0, x2: size / 2, y2: size };
  if (axis === "horizontal") return { x1: 0, y1: size / 2, x2: size, y2: size / 2 };
  if (axis === "diag-main") return { x1: 0, y1: 0, x2: size, y2: size };
  return { x1: size, y1: 0, x2: 0, y2: size };
}

/** Tap the cells that mirror the coloured picture. Keys are "r,c" with c counted from the left of the screen. */
function SymmetryGrid({ visual, reveal, solution, locked, onAnswer }: VisualProps<{ type: "b-symgrid"; size: number; axis: GridAxis; given: string[] }>) {
  const { size, axis } = visual;
  const given = new Set(visual.given);
  const answer = new Set(Array.isArray(solution) ? (solution as string[]) : []);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const l = axisLine(size, axis);
  const toggle = (k: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="relative w-full max-w-sm">
        <div dir="ltr" role="grid" aria-label="شبكة التماثل" className="grid gap-1 rounded-2xl bg-slate-300 p-1" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
          {Array.from({ length: size * size }, (_, i) => {
            const r = Math.floor(i / size);
            const c = i % size;
            const k = `${r},${c}`;
            if (given.has(k)) return <div key={k} role="gridcell" data-given={k} aria-label="مربع ملوّن" className="aspect-square rounded-md bg-violet-600" />;
            const on = picked.has(k);
            const show = reveal && answer.has(k);
            return (
              <button
                key={k}
                type="button"
                role="gridcell"
                data-cell-key={k}
                aria-pressed={on}
                aria-label={`الصف ${ar(r + 1)}، العمود ${ar(c + 1)}`}
                disabled={locked}
                onClick={() => toggle(k)}
                className={`aspect-square min-h-11 rounded-md ${show ? "bg-emerald-400 ring-4 ring-emerald-700" : on ? "bg-violet-300" : "bg-white"} disabled:cursor-default`}
              />
            );
          })}
        </div>
        <svg viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-1" preserveAspectRatio="none" aria-hidden>
          <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#e11d48" strokeWidth={0.08} strokeDasharray="0.25 0.18" />
        </svg>
      </div>
      {onAnswer && !reveal && <ConfirmButton disabled={locked || picked.size === 0} onClick={() => onAnswer([...picked])} />}
    </div>
  );
}

export const GEOMETRY_VISUALS = {
  "b-polygon": PolygonView,
  "b-shapes": Shapes,
  "b-cubes": Cubes,
  "b-cubes-choice": CubesChoice,
  "b-symmetry": Symmetry,
  "b-symgrid": SymmetryGrid,
};
