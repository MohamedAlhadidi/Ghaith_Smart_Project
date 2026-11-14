/**
 * Number line 0..max drawn LEFT TO RIGHT as on p.10 (0 on the left), and the vertical
 * rounding line of p.11. The SVG keeps its own coordinates, so page direction never flips it.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { flushSync } from "react-dom";
import type { Visual } from "@ghaith/game-core";
import type { VisualProps } from "../types";
import { ar, ConfirmButton } from "./A_shared";

interface TickLineVisual extends Visual {
  type: "tickLine";
  mode: "place" | "read" | "spot";
  max: number;
  tick: number;
  minor: number | null;
  target?: number;
  marker?: number;
  markers?: Array<{ value: number; at: number }>;
}

const W = 640;
const PAD = 32;
const LINE_Y = 96;
const H = 140;
const xOf = (v: number, max: number) => PAD + ((W - 2 * PAD) * v) / max;

function Axis({ max, tick, minor }: { max: number; tick: number; minor: number | null }) {
  const ticks = Array.from({ length: max / tick + 1 }, (_, i) => i * tick);
  const minors = minor ? Array.from({ length: max / minor + 1 }, (_, i) => i * minor).filter((v) => v % tick !== 0) : [];
  return (
    <g>
      <line x1={PAD - 12} x2={W - PAD + 12} y1={LINE_Y} y2={LINE_Y} stroke="#0f172a" strokeWidth={4} strokeLinecap="round" />
      {minors.map((v) => (
        <line key={`m${v}`} x1={xOf(v, max)} x2={xOf(v, max)} y1={LINE_Y - 7} y2={LINE_Y + 7} stroke="#64748b" strokeWidth={2} />
      ))}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={xOf(v, max)} x2={xOf(v, max)} y1={LINE_Y - 14} y2={LINE_Y + 14} stroke="#0f172a" strokeWidth={3} />
          <text x={xOf(v, max)} y={LINE_Y + 38} textAnchor="middle" fontSize={20} fontWeight={700} fill="#0f172a">
            {ar(v)}
          </text>
        </g>
      ))}
    </g>
  );
}

function Pointer({ x, label, color, y = 20 }: { x: number; label: string; color: string; y?: number }) {
  return (
    <g>
      <rect x={x - 24} y={y} width={48} height={32} rx={8} fill={color} />
      <text x={x} y={y + 23} textAnchor="middle" fontSize={20} fontWeight={800} fill="#0f172a">
        {label}
      </text>
      <path d={`M${x} ${LINE_Y - 4} L${x - 8} ${y + 32} L${x + 8} ${y + 32} Z`} fill={color} />
    </g>
  );
}

export function TickLine(props: VisualProps<TickLineVisual>) {
  return props.visual.mode === "place" ? <PlaceLine {...props} /> : <ReadLine {...props} />;
}

function ReadLine({ visual, reveal, solution }: VisualProps<TickLineVisual>) {
  const { max, tick, minor } = visual;
  const markers = visual.markers ?? [];
  const wrongValue = typeof solution === "string" ? Number(solution.slice(1)) : null;
  const sorted = [...markers].sort((p, q) => p.at - q.at);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-2xl" role="img" aria-label={`خط الأعداد من ${ar(0)} إلى ${ar(max)}`}>
      <Axis max={max} tick={tick} minor={minor} />
      {visual.mode === "read" && visual.marker !== undefined && (
        <Pointer x={xOf(visual.marker, max)} label={reveal ? ar(visual.marker) : "؟"} color={reveal ? "#6ee7b7" : "#fcd34d"} />
      )}
      {visual.mode === "spot" &&
        sorted.map((m, i) => (
          // Alternate the label heights so close markers never overlap.
          <Pointer key={m.value} x={xOf(m.at, max)} y={i % 2 ? 34 : 2} label={ar(m.value)} color={reveal && m.value === wrongValue ? "#fda4af" : "#bae6fd"} />
        ))}
      {visual.mode === "spot" && reveal && wrongValue !== null && (
        // Where the misplaced number belongs.
        <g>
          <line x1={xOf(wrongValue, max)} x2={xOf(wrongValue, max)} y1={LINE_Y - 22} y2={LINE_Y + 18} stroke="#059669" strokeWidth={6} strokeLinecap="round" />
          <circle cx={xOf(wrongValue, max)} cy={LINE_Y} r={8} fill="#059669" />
        </g>
      )}
    </svg>
  );
}

function PlaceLine({ visual, reveal, solution, locked, hintLevel, onAnswer }: VisualProps<TickLineVisual>) {
  const { max, tick } = visual;
  const [value, setValue] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const done = locked || reveal;
  const clamp = (v: number) => Math.max(0, Math.min(max, Math.round(v)));

  // Test-only hook used by the browser sweep (e2e): set the marker to an exact value.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onPlace = (e: Event) => {
      const v = (e as CustomEvent<unknown>).detail;
      if (typeof v === "number" && Number.isFinite(v)) flushSync(() => setValue(clamp(v)));
    };
    el.addEventListener("e2e-place", onPlace);
    return () => el.removeEventListener("e2e-place", onPlace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max]);

  function place(e: PointerEvent<SVGSVGElement>) {
    if (done) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    setValue(clamp(((fx - PAD / W) / (1 - (2 * PAD) / W)) * max));
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (done) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      // The line runs left to right: right is larger, whatever the page direction.
      setValue((v) => clamp((v ?? max / 2) + (e.key === "ArrowRight" ? 1 : -1)));
    } else if (e.key === "Enter" && value !== null) onAnswer?.(value);
  }

  const shown = reveal && typeof solution === "number" ? solution : null;
  return (
    <div className="flex w-full flex-col items-center gap-3">
      {visual.target !== undefined && (
        <div className="rounded-2xl bg-amber-200 px-5 py-2 text-3xl font-extrabold shadow" aria-label="العدد المطلوب">
          {ar(visual.target)}
        </div>
      )}
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className={`h-auto w-full max-w-2xl touch-none select-none rounded-2xl bg-white shadow ${done ? "" : "cursor-pointer"}`}
        data-testid="numberline-place"
        data-min={0}
        data-max={max}
        data-pad-left={PAD / W}
        data-pad-right={PAD / W}
        role="slider"
        tabIndex={done ? -1 : 0}
        aria-label="خط الأعداد: المس المكان الصحيح للعدد"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value ?? undefined}
        aria-disabled={done}
        onPointerDown={place}
        onKeyDown={onKey}
      >
        <Axis max={max} tick={tick} minor={hintLevel >= 2 ? tick / 2 : null} />
        {value !== null && <Pointer x={xOf(value, max)} label="▼" color="#c4b5fd" />}
        {shown !== null && <Pointer x={xOf(shown, max)} y={value !== null ? 40 : 20} label={ar(shown)} color="#6ee7b7" />}
      </svg>
      {!done && <ConfirmButton disabled={value === null} onClick={() => value !== null && onAnswer?.(value)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vertical rounding line (p.11): low at the bottom, half-way mark, high at the top */
/* ------------------------------------------------------------------ */

interface RoundLineVisual extends Visual {
  type: "roundLine";
  low: number;
  high: number;
  n: number;
}

export function RoundLine({ visual, reveal }: VisualProps<RoundLineVisual>) {
  const { low, high, n } = visual;
  const top = 20;
  const bottom = 260;
  const yOf = (v: number) => bottom - ((bottom - top) * (v - low)) / (high - low);
  const mid = low + (high - low) / 2;
  const target = n - low >= (high - low) / 2 ? high : low;
  return (
    <svg viewBox="0 0 220 280" className="h-64 w-auto" role="img" aria-label={`خط رأسي من ${ar(low)} إلى ${ar(high)}`}>
      <line x1={110} x2={110} y1={top} y2={bottom} stroke="#0f172a" strokeWidth={4} />
      {Array.from({ length: high - low + 1 }, (_, i) => low + i).map((v) => {
        const big = v === low || v === high || v === mid;
        return (
          <g key={v}>
            <line x1={big ? 92 : 100} x2={big ? 128 : 120} y1={yOf(v)} y2={yOf(v)} stroke={v === mid ? "#b45309" : "#0f172a"} strokeWidth={big ? 4 : 2} />
            {big && (
              <text x={140} y={yOf(v) + 7} fontSize={20} fontWeight={800} fill={v === mid ? "#b45309" : "#0f172a"}>
                {ar(v)}
              </text>
            )}
          </g>
        );
      })}
      <circle cx={110} cy={yOf(n)} r={9} fill="#7c3aed" />
      <text x={78} y={yOf(n) + 7} textAnchor="end" fontSize={22} fontWeight={800} fill="#7c3aed">
        {ar(n)}
      </text>
      {reveal && (
        <path
          d={`M60 ${yOf(n)} Q40 ${(yOf(n) + yOf(target)) / 2} 86 ${yOf(target)}`}
          fill="none"
          stroke="#059669"
          strokeWidth={4}
          markerEnd="url(#a-round-arrow)"
        />
      )}
      <defs>
        <marker id="a-round-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="#059669" />
        </marker>
      </defs>
    </svg>
  );
}
