/**
 * Shapes, solids and symmetry (MATH-S1 L15 p18, L16 p19, L17 p20, L18 p21).
 * Every geometric truth (number of sides, line of symmetry, mirror cells) is computed from coordinates
 * stored in the item params, never from a stored label.
 */
import type { Difficulty } from "../types";
import {
  asStringArray,
  byLevel,
  exactlyOneCorrect,
  isWholeNumber,
  makeItem,
  ok,
  optionProblems,
  randInt,
  sample,
  shuffle,
  wrong,
  type QuizMechanic,
} from "../quiz";
import { createRng, type Rng } from "../rng";
import { checkMulti, checkWhole, choiceId, countOf, multiProblems, NOUNS, pickOne, round2 } from "./B_common";

export type Pt = [number, number];
export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Mirror image of a point in a line (SVG coordinates, y pointing down). */
export function reflect(p: Pt, l: Line): Pt {
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  const t = ((p[0] - l.x1) * dx + (p[1] - l.y1) * dy) / (dx * dx + dy * dy);
  const fx = l.x1 + t * dx;
  const fy = l.y1 + t * dy;
  return [2 * fx - p[0], 2 * fy - p[1]];
}

/** Translate so the bounding box is centred on (0, 0); rounding is sign-symmetric. */
function centred(points: Pt[]): Pt[] {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return points.map(([x, y]) => [round2(x - cx), round2(y - cy)]);
}

/* ------------------------------------------------------------------ */
/* polygons: polygon-sides and shape-select                            */
/* ------------------------------------------------------------------ */

export type PolygonStyle = "upright" | "rotated" | "irregular";

/** Regular (upright or rotated) or irregular star-shaped polygon with n vertices around the centre. */
export function polygonPoints(rng: Rng, n: number, style: PolygonStyle, scale = 1): Pt[] {
  const R = 80 * scale;
  const step = 360 / n;
  // Upright: odd polygons point up, even ones sit on a flat side (a square is axis-aligned).
  const base = style === "upright" ? (n % 2 === 1 ? -90 : -90 + step / 2) : randInt(rng, 0, 359);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const jitter = style === "irregular" ? (rng() - 0.5) * 0.5 * step : 0;
    const radius = style === "irregular" ? R * (0.62 + 0.38 * rng()) : R;
    const a = ((base + i * step + jitter) * Math.PI) / 180;
    pts.push([radius * Math.cos(a), radius * Math.sin(a)]);
  }
  return centred(pts);
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/**
 * A polygon whose sides a child can count: simple (no crossing sides), every side long enough to see,
 * and no corner so flat that two sides look like one.
 */
export function polygonProblems(points: Pt[], minSide = 18): string[] {
  const n = points.length;
  const p: string[] = [];
  if (n < 3) return ["fewer than 3 vertices"];
  for (let i = 0; i < n; i++) {
    const prev = points[(i + n - 1) % n]!;
    const cur = points[i]!;
    const next = points[(i + 1) % n]!;
    if (dist(cur, next) < minSide) p.push(`side ${i} too short`);
    const e1: Pt = [cur[0] - prev[0], cur[1] - prev[1]];
    const e2: Pt = [next[0] - cur[0], next[1] - cur[1]];
    const turn = (Math.abs(Math.atan2(e1[0] * e2[1] - e1[1] * e2[0], e1[0] * e2[0] + e1[1] * e2[1])) * 180) / Math.PI;
    if (turn < 20) p.push(`corner ${i} too flat`);
  }
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(points[i]!, points[(i + 1) % n]!, points[j]!, points[(j + 1) % n]!)) p.push("sides cross");
    }
  return p;
}

const POLYGON_PLURALS: Record<number, string> = {
  3: "مثلثات",
  4: "أشكال رباعية",
  5: "أشكال خماسية",
  6: "أشكال سداسية",
  7: "أشكال سباعية",
  8: "أشكال ثمانية",
};

export const POLYGON_NAMES: Record<number, string> = {
  3: "مثلث",
  4: "شكل رباعي",
  5: "شكل خماسي",
  6: "شكل سداسي",
  7: "شكل سباعي",
  8: "شكل ثماني",
};

function sidesConfigProblems(c: { min: number; max: number }): string[] {
  return isWholeNumber(c.min) && isWholeNumber(c.max) && c.min >= 3 && c.max <= 8 && c.min + 2 <= c.max ? [] : ["need 3 <= min, min + 2 <= max <= 8"];
}

export interface SidesConfig {
  min: number;
  max: number;
}
export interface PolygonSidesParams {
  points: Pt[];
}

export const polygonSides: QuizMechanic<SidesConfig, PolygonSidesParams> = {
  id: "GEN-POLYGON-SIDES",
  version: 1,
  mechanicId: "polygon-sides",
  difficulties: [1, 2, 3],
  validateConfig: sidesConfigProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1: regular and upright up to 6 sides; level 2: rotated; level 3: irregular.
      const n = randInt(rng, config.min, difficulty === 1 ? Math.min(6, config.max) : config.max);
      const style = byLevel(difficulty, ["upright", "rotated", "irregular"] as const);
      const points = polygonPoints(rng, n, style);
      if (polygonProblems(points, 22).length) return null;
      return makeItem(this, seed, difficulty, {
        params: { points },
        prompt: "كم ضلعًا لهذا الشكل؟",
        visual: { type: "b-polygon", points },
        input: { type: "number", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return item.params.points.length;
  },
  check(item, answer) {
    return checkWhole(item.params.points.length, answer, [], { 1: "counting_error", 2: "counting_error" });
  },
  explain(item) {
    const n = item.params.points.length;
    return ["نضع إصبعنا على ضلع، ونعدّ الأضلاع حول الشكل حتى نعود إلى البداية.", `عدد الأضلاع ${n}.`, `هذا الشكل ${POLYGON_NAMES[n] ?? "مضلع"}.`];
  },
  checkIntegrity(item) {
    const p = polygonProblems(item.params.points);
    if (item.params.points.length < 3 || item.params.points.length > 8) p.push("3..8 sides");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

export interface ShapeSelectParams {
  sides: number;
  shapes: Pt[][];
}

export const shapeSelect: QuizMechanic<SidesConfig, ShapeSelectParams> = {
  id: "GEN-SHAPE-SELECT",
  version: 1,
  mechanicId: "shape-select",
  difficulties: [1, 2, 3],
  validateConfig: sidesConfigProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const all = Array.from({ length: config.max - config.min + 1 }, (_, i) => config.min + i);
      const targets = difficulty === 1 ? all.filter((n) => n <= 4) : difficulty === 2 ? all.filter((n) => n <= 6) : all;
      const sides = pickOne(rng, targets.length ? targets : all);
      // Distractors: far side counts at level 1, any at level 2, one more/one fewer at level 3.
      const others =
        difficulty === 1 ? all.filter((n) => Math.abs(n - sides) >= 2) : difficulty === 2 ? all.filter((n) => n !== sides) : all.filter((n) => Math.abs(n - sides) === 1);
      if (!others.length) return null;
      const nCorrect = difficulty === 1 ? 2 : randInt(rng, 2, 3);
      const counts = shuffle(rng, [...Array.from({ length: nCorrect }, () => sides), ...Array.from({ length: 6 - nCorrect }, () => pickOne(rng, others))]);
      const style = byLevel(difficulty, ["upright", "rotated", "irregular"] as const);
      const shapes = counts.map((n) => polygonPoints(rng, n, style, 0.65 + 0.35 * rng()));
      if (shapes.some((s) => polygonProblems(s, 16).length)) return null;
      return makeItem(this, seed, difficulty, {
        params: { sides, shapes },
        prompt: `اختر كل الأشكال التي لها ${sides} أضلاع.`,
        visual: { type: "b-shapes", shapes: shapes.map((points, i) => ({ label: String(i + 1), points })) },
        input: { type: "multi", options: shapes.map((_, i) => ({ id: `p${i}`, label: `الشكل ${i + 1}` })) },
      });
    });
  },
  solution(item) {
    return item.params.shapes.map((s, i) => (s.length === item.params.sides ? `p${i}` : null)).filter((x): x is string => x !== null);
  },
  check(item, answer) {
    return checkMulti(
      this.solution(item) as string[],
      item.params.shapes.map((_, i) => `p${i}`),
      answer,
      () => "property_error",
    );
  },
  explain(item) {
    const { sides, shapes } = item.params;
    const picked = shapes.map((s, i) => (s.length === sides ? i + 1 : 0)).filter((i) => i > 0);
    return ["نعدّ أضلاع كل شكل.", `الأشكال التي لها ${sides} أضلاع: ${picked.join("، ")}.`, `كلها ${POLYGON_PLURALS[sides] ?? "مضلعات"} مهما اختلف حجمها أو وضعها.`];
  },
  checkIntegrity(item) {
    const p = multiProblems(item.input, (this.solution(item) as string[]).length);
    for (const s of item.params.shapes) p.push(...polygonProblems(s, 16));
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* cube-faces (p.19)                                                   */
/* ------------------------------------------------------------------ */

export type Axis = "x" | "y" | "z";
/** One solid: a single cube (length 1) or a straight row of joined cubes along an axis. */
export interface Solid {
  length: number;
  axis: Axis;
}
export interface CubeFacesConfig {
  maxCubes: number;
}
export type CubeFacesParams = { mode: "count"; solids: Solid[] } | { mode: "most"; arrangements: Solid[][] };

/** Book rule (p.19 labels 3, 3, 6): from the fixed view each separate solid shows 3 faces. */
export const visibleFaces = (solids: readonly Solid[]) => 3 * solids.length;
const LETTERS = ["أ", "ب", "ج"];

function partitions(maxCubes: number): number[][] {
  const out: number[][] = [];
  const rec = (left: number, maxPart: number, acc: number[]) => {
    if (left === 0) {
      out.push(acc);
      return;
    }
    for (let p = Math.min(left, maxPart); p >= 1; p--) rec(left - p, p, [...acc, p]);
  };
  for (let m = 1; m <= maxCubes; m++) rec(m, m, []);
  return out;
}

function toSolids(rng: Rng, parts: number[], axes: readonly Axis[]): Solid[] {
  return parts.map((length) => ({ length, axis: length === 1 ? "x" : pickOne(rng, axes) }));
}

export const cubeFaces: QuizMechanic<CubeFacesConfig, CubeFacesParams> = {
  id: "GEN-CUBE-FACES",
  version: 1,
  mechanicId: "cube-faces",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.maxCubes) && c.maxCubes >= 2 && c.maxCubes <= 4 ? [] : ["maxCubes must be 2..4"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const all = partitions(config.maxCubes);
      if (difficulty === 3 && rng() < 0.5) {
        // p.19: "which way shows the most faces?" — three arrangements, one clear winner.
        const picks = shuffle(rng, all).slice(0, 3);
        const counts = picks.map((p) => p.length);
        const best = Math.max(...counts);
        if (counts.filter((c) => c === best).length !== 1) return null;
        const arrangements = picks.map((p) => toSolids(rng, p, ["x", "y", "z"]));
        return makeItem(this, seed, difficulty, {
          params: { mode: "most", arrangements },
          prompt: "في أي مجموعة يمكنك أن ترى أكبر عدد من الأوجه؟",
          visual: { type: "b-cubes-choice", arrangements: arrangements.map((solids, i) => ({ label: LETTERS[i]!, solids })) },
          input: { type: "choice", options: arrangements.map((_, i) => ({ id: `a${i}`, label: `المجموعة (${LETTERS[i]})` })) },
        });
      }
      const pool = difficulty === 1 ? all.filter((p) => p.reduce((s, x) => s + x, 0) <= 2) : difficulty === 2 ? all : all.filter((p) => p.length > 1 || p[0]! > 1);
      const parts = pickOne(rng, pool);
      const solids = toSolids(rng, parts, difficulty === 1 ? ["x"] : ["x", "y", "z"]);
      return makeItem(this, seed, difficulty, {
        params: { mode: "count", solids },
        prompt: solids.length === 1 && solids[0]!.length === 1 ? "مكعب أمامك لا يمكنك تحريكه. كم وجهًا يمكنك أن ترى؟" : "كم وجهًا يمكنك أن ترى من مكانك؟",
        visual: { type: "b-cubes", solids },
        input: { type: "number", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    const p = item.params;
    if (p.mode === "count") return visibleFaces(p.solids);
    const faces = p.arrangements.map(visibleFaces);
    return `a${faces.indexOf(Math.max(...faces))}`;
  },
  check(item, answer) {
    const p = item.params;
    if (p.mode === "most") {
      const expected = this.solution(item);
      const id = choiceId(answer, item.input);
      if (id === null) return wrong(expected, answer, "input_invalid");
      return id === expected ? ok() : wrong(expected, answer, "property_error");
    }
    const cubes = p.solids.reduce((s, x) => s + x.length, 0);
    const squares = p.solids.reduce((s, x) => s + 2 * x.length + 1, 0);
    return checkWhole(
      visibleFaces(p.solids),
      answer,
      [
        [6 * cubes, "property_error"], // counted hidden faces too
        [6 * p.solids.length, "property_error"],
        [3 * cubes, "property_error"], // counted joined cubes as separate solids
        [squares, "counting_error"], // counted every visible square
      ],
      { 1: "counting_error", 2: "counting_error" },
    );
  },
  explain(item) {
    const p = item.params;
    const rule = "من مكاننا نرى من كل مجسّم منفصل 3 أوجه: الأعلى والأمام والجانب.";
    if (p.mode === "most") {
      const faces = p.arrangements.map(visibleFaces);
      const best = faces.indexOf(Math.max(...faces));
      return [rule, faces.map((f, i) => `(${LETTERS[i]}): ${f} أوجه`).join("، "), `أكبر عدد من الأوجه نراه في المجموعة (${LETTERS[best]}).`];
    }
    const k = p.solids.length;
    const joined = p.solids.some((s) => s.length > 1);
    return [
      rule,
      joined ? `المكعبات الملتصقة في صف تكوّن مجسّمًا واحدًا، فعدد المجسّمات ${k}.` : `عدد المجسّمات المنفصلة ${k}.`,
      k === 1 ? "إذن نرى 3 أوجه." : `${k} × 3 = ${3 * k}`,
    ];
  },
  checkIntegrity(item) {
    const p = item.params;
    if (p.mode === "most") {
      const problems = [...exactlyOneCorrect(this, item), ...(item.input.type === "choice" ? optionProblems(item.input.options) : [])];
      if (new Set(p.arrangements.map((a) => a.map((s) => s.length).join("+"))).size !== p.arrangements.length) problems.push("arrangements must differ");
      return problems;
    }
    const cubes = p.solids.reduce((s, x) => s + x.length, 0);
    const problems: string[] = [];
    if (cubes < 1 || cubes > 4 || p.solids.some((s) => s.length < 1)) problems.push("1..4 cubes");
    if (item.input.type !== "number") problems.push("expects number input");
    return problems;
  },
};

/* ------------------------------------------------------------------ */
/* symmetry-check (p.20-21)                                            */
/* ------------------------------------------------------------------ */

export type SymShape =
  | "square"
  | "rectangle"
  | "isosceles"
  | "circle"
  | "arrowRight"
  | "arrowUp"
  | "star"
  | "hexagon"
  | "kite"
  | "scalene"
  | "parallelogram"
  | "trapezoid"
  | "lshape";

const ngon = (n: number, r: number, startDeg: number): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + (360 * i) / n) * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)] as Pt;
  });
const ARROW_RIGHT: Pt[] = [[-75, -18], [15, -18], [15, -50], [75, 0], [15, 50], [15, 18], [-75, 18]];

/** Shape outlines (SVG coordinates, y down). Names are for wording only; truth comes from the points. */
export const SYM_SHAPES: Record<SymShape, { name: string; points: Pt[] }> = {
  square: { name: "المربع", points: [[-60, -60], [60, -60], [60, 60], [-60, 60]] },
  rectangle: { name: "المستطيل", points: [[-80, -45], [80, -45], [80, 45], [-80, 45]] },
  isosceles: { name: "المثلث", points: [[0, -70], [60, 55], [-60, 55]] },
  circle: { name: "الدائرة", points: ngon(48, 70, 0) },
  arrowRight: { name: "السهم", points: ARROW_RIGHT },
  arrowUp: { name: "السهم", points: ARROW_RIGHT.map(([x, y]) => [y, -x] as Pt) },
  star: { name: "النجمة", points: Array.from({ length: 10 }, (_, i) => ngon(10, i % 2 === 0 ? 78 : 32, -90)[i]!) },
  hexagon: { name: "الشكل السداسي", points: ngon(6, 72, 0) },
  kite: { name: "الطائرة الورقية", points: [[0, -75], [45, -25], [0, 75], [-45, -25]] },
  scalene: { name: "المثلث", points: [[-65, 50], [70, 50], [-25, -60]] },
  parallelogram: { name: "الشكل الرباعي", points: [[-75, 40], [35, 40], [75, -40], [-35, -40]] },
  trapezoid: { name: "الشكل الرباعي", points: [[-65, -45], [25, -45], [65, 45], [-65, 45]] },
  lshape: { name: "الشكل", points: [[-60, -60], [-20, -60], [-20, 20], [60, 20], [60, 60], [-60, 60]] },
};

export type LineKind = "vertical" | "horizontal" | "diag-down" | "diag-up";
export function symmetryLine(kind: LineKind, offset = 0): Line {
  switch (kind) {
    case "vertical":
      return { x1: offset, y1: -95, x2: offset, y2: 95 };
    case "horizontal":
      return { x1: -95, y1: offset, x2: 95, y2: offset };
    case "diag-down":
      return { x1: -80, y1: -80, x2: 80, y2: 80 };
    default:
      return { x1: -80, y1: 80, x2: 80, y2: -80 };
  }
}

/** True iff reflecting the polygon in the line gives the same polygon (vertex cycle up to rotation/reversal). */
export function isLineOfSymmetry(points: readonly Pt[], line: Line, tol = 0.5): boolean {
  const n = points.length;
  const mirrored = points.map((p) => reflect(p, line));
  for (let k = 0; k < n; k++)
    for (const dir of [1, -1]) {
      let match = true;
      for (let i = 0; i < n && match; i++) if (dist(mirrored[i]!, points[(((k + dir * i) % n) + n) % n]!) > tol) match = false;
      if (match) return true;
    }
  return false;
}

/** How far the mirror image is from the shape: the largest distance from a mirrored vertex to the nearest vertex. */
export function asymmetry(points: readonly Pt[], line: Line): number {
  return Math.max(...points.map((p) => reflect(p, line)).map((m) => Math.min(...points.map((q) => dist(m, q)))));
}

export interface SymmetryCheckParams {
  shape: SymShape;
  points: Pt[];
  line: Line;
}

const SHAPES_BY_LEVEL: Record<Difficulty, SymShape[]> = {
  1: ["square", "rectangle", "isosceles", "circle", "arrowRight", "arrowUp"],
  2: ["square", "rectangle", "isosceles", "circle", "arrowRight", "arrowUp", "star", "hexagon", "kite", "scalene", "parallelogram", "trapezoid"],
  3: ["square", "rectangle", "isosceles", "circle", "arrowRight", "arrowUp", "star", "hexagon", "kite", "scalene", "parallelogram", "trapezoid", "lshape"],
};

export const symmetryCheck: QuizMechanic<Record<string, never>, SymmetryCheckParams> = {
  id: "GEN-SYMMETRY-CHECK",
  version: 1,
  mechanicId: "symmetry-check",
  difficulties: [1, 2, 3],
  validateConfig() {
    return [];
  },
  generate(seed, difficulty) {
    // Drawn once per seed (not per retry) so "yes" and "no" items stay balanced.
    const wantYes = createRng((seed ^ 0x5bd1e995) >>> 0)() < 0.5;
    return sample(seed, (rng) => {
      const shape = pickOne(rng, SHAPES_BY_LEVEL[difficulty]);
      const kind: LineKind = difficulty === 3 && rng() < 0.5 ? pickOne(rng, ["diag-down", "diag-up"] as const) : pickOne(rng, ["vertical", "horizontal"] as const);
      const offset = (kind === "vertical" || kind === "horizontal") && rng() < 0.25 ? pickOne(rng, [-35, 35]) : 0;
      const points = centred(SYM_SHAPES[shape].points);
      const line = symmetryLine(kind, offset);
      const yes = isLineOfSymmetry(points, line);
      if (yes !== wantYes) return null;
      if (!yes && asymmetry(points, line) < 6) return null;
      return makeItem(this, seed, difficulty, {
        params: { shape, points, line },
        prompt: "هل الخط المتقطع خط تماثل لهذا الشكل؟",
        visual: { type: "b-symmetry", points, line },
        input: {
          type: "choice",
          options: [
            { id: "yes", label: "نعم، خط تماثل" },
            { id: "no", label: "لا، ليس خط تماثل" },
          ],
        },
      });
    });
  },
  solution(item) {
    return isLineOfSymmetry(item.params.points, item.params.line) ? "yes" : "no";
  },
  check(item, answer) {
    const expected = this.solution(item);
    const id = choiceId(answer, item.input);
    if (id === null) return wrong(expected, answer, "input_invalid");
    return id === expected ? ok() : wrong(expected, answer, "reflection_error");
  },
  explain(item) {
    const name = SYM_SHAPES[item.params.shape]?.name ?? "الشكل";
    const yes = this.solution(item) === "yes";
    return [
      `نتخيل أننا نطوي ${name} على الخط المتقطع.`,
      yes ? "ينطبق الجزءان تمامًا، مثل صورة في المرآة." : "لا ينطبق الجزءان، فهما مختلفان.",
      yes ? "إذن الخط خط تماثل." : "إذن الخط ليس خط تماثل.",
    ];
  },
  checkIntegrity(item) {
    const p = [...exactlyOneCorrect(this, item)];
    const { points, line } = item.params;
    if (!isLineOfSymmetry(points, line) && asymmetry(points, line) < 6) p.push("shape is nearly symmetric: ambiguous");
    if (points.length < 3) p.push("not a polygon");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* symmetry-complete: tap the mirror cells on a grid                   */
/* ------------------------------------------------------------------ */

export type GridAxis = "vertical" | "horizontal" | "diag-main" | "diag-anti";
export interface SymmetryCompleteConfig {
  size: number;
  axes: Array<"vertical" | "horizontal" | "diagonal">;
}
export interface SymmetryCompleteParams {
  size: number;
  axis: GridAxis;
  /** Coloured cells "r,c" (row from the top, column from the left of the screen). */
  given: string[];
}

/** The mirror axis as a line in grid units (cell (r, c) spans x in [c, c+1], y in [r, r+1]). */
export function gridAxisLine(size: number, axis: GridAxis): Line {
  switch (axis) {
    case "vertical":
      return { x1: size / 2, y1: 0, x2: size / 2, y2: size };
    case "horizontal":
      return { x1: 0, y1: size / 2, x2: size, y2: size / 2 };
    case "diag-main":
      return { x1: 0, y1: 0, x2: size, y2: size };
    default:
      return { x1: size, y1: 0, x2: 0, y2: size };
  }
}

/** Mirror cell computed by reflecting the cell centre in the axis. */
export function mirrorCell(r: number, c: number, size: number, axis: GridAxis): [number, number] {
  const [x, y] = reflect([c + 0.5, r + 0.5], gridAxisLine(size, axis));
  return [Math.round(y - 0.5), Math.round(x - 0.5)];
}

/** Which side of the axis a cell centre lies on: -1, 0 (on the axis) or 1. */
function sideOf(r: number, c: number, size: number, axis: GridAxis): number {
  const l = gridAxisLine(size, axis);
  const v = (l.x2 - l.x1) * (r + 0.5 - l.y1) - (l.y2 - l.y1) * (c + 0.5 - l.x1);
  return Math.abs(v) < 1e-9 ? 0 : Math.sign(v);
}

const key = (r: number, c: number) => `${r},${c}`;
function parseKey(k: string, size: number): [number, number] | null {
  const m = /^(\d+),(\d+)$/.exec(k);
  if (!m) return null;
  const r = Number(m[1]);
  const c = Number(m[2]);
  return r < size && c < size ? [r, c] : null;
}

export const symmetryComplete: QuizMechanic<SymmetryCompleteConfig, SymmetryCompleteParams> = {
  id: "GEN-SYMMETRY-COMPLETE",
  version: 1,
  mechanicId: "symmetry-complete",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!isWholeNumber(c.size) || c.size < 4 || c.size > 8 || c.size % 2 !== 0) p.push("size must be even, 4..8");
    if (!Array.isArray(c.axes) || c.axes.length === 0) p.push("axes required");
    else for (const a of c.axes) if (!["vertical", "horizontal", "diagonal"].includes(a)) p.push(`unknown axis ${a}`);
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const straight = config.axes.filter((a) => a !== "diagonal");
      const pool = difficulty === 1 && straight.length ? straight : config.axes;
      const choice = difficulty === 3 && config.axes.includes("diagonal") && rng() < 0.5 ? "diagonal" : pickOne(rng, pool);
      const axis: GridAxis = choice === "diagonal" ? pickOne(rng, ["diag-main", "diag-anti"] as const) : choice;
      const size = config.size;
      const side = rng() < 0.5 ? -1 : 1;
      const [cLo, cHi] = byLevel(difficulty, [[2, 3], [3, 5], [5, 7]] as const);
      const count = randInt(rng, cLo, cHi);
      // A connected little picture on one side of the axis (random walk over neighbouring cells).
      const onSide: Array<[number, number]> = [];
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (sideOf(r, c, size, axis) === side) onSide.push([r, c]);
      const chosen = new Set<string>([key(...pickOne(rng, onSide))]);
      let guard = 0;
      while (chosen.size < count && guard++ < 200) {
        const [r, c] = [...chosen][randInt(rng, 0, chosen.size - 1)]!.split(",").map(Number) as [number, number];
        const [dr, dc] = pickOne(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]] as const);
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nc >= 0 && nr < size && nc < size && sideOf(nr, nc, size, axis) === side) chosen.add(key(nr, nc));
      }
      if (chosen.size !== count) return null;
      const given = [...chosen].sort();
      return makeItem(this, seed, difficulty, {
        params: { size, axis, given },
        prompt: "لوّن المربعات التي تكمل الصورة في الجهة الأخرى من خط التماثل، ثم اضغط «تحقّق».",
        visual: { type: "b-symgrid", size, axis, given },
        input: { type: "visual" },
      });
    });
  },
  solution(item) {
    const { size, axis, given } = item.params;
    return given
      .map((k) => parseKey(k, size)!)
      .map(([r, c]) => key(...mirrorCell(r, c, size, axis)))
      .sort();
  },
  check(item, answer) {
    const expected = this.solution(item) as string[];
    const ids = asStringArray(answer);
    if (!ids || ids.length === 0 || new Set(ids).size !== ids.length || ids.some((k) => parseKey(k, item.params.size) === null)) {
      return wrong(expected, answer, "input_invalid");
    }
    const extra = ids.filter((k) => !expected.includes(k));
    if (extra.length) return wrong(expected, answer, "reflection_error");
    return expected.every((k) => ids.includes(k)) ? ok() : wrong(expected, answer, "partial_answer");
  },
  explain(item) {
    const { axis, given } = item.params;
    const how =
      axis === "vertical"
        ? "الخط عمودي: كل مربع ينتقل إلى الجهة الأخرى في الصف نفسه، وعلى البعد نفسه من الخط."
        : axis === "horizontal"
          ? "الخط أفقي: كل مربع ينتقل إلى الجهة الأخرى في العمود نفسه، وعلى البعد نفسه من الخط."
          : "الخط مائل: نعكس كل مربع عبر الخط المائل، على البعد نفسه منه.";
    return ["خط التماثل مثل المرآة: الصورة في الجهتين متطابقة.", how, `نلوّن ${countOf(given.length, NOUNS.squareAcc)} في الجهة الأخرى.`];
  },
  checkIntegrity(item) {
    const { size, axis, given } = item.params;
    const p: string[] = [];
    const cells = given.map((k) => parseKey(k, size));
    if (cells.some((c) => c === null)) return ["bad given cell"];
    const sides = new Set(cells.map((c) => sideOf(c![0], c![1], size, axis)));
    if (sides.has(0) || sides.size !== 1) p.push("given cells must all be strictly on one side of the axis");
    const sol = this.solution(item) as string[];
    if (sol.some((k) => given.includes(k))) p.push("mirror overlaps the picture");
    if (sol.some((k) => parseKey(k, size) === null)) p.push("mirror leaves the grid");
    if (item.input.type !== "visual") p.push("expects visual input");
    return p;
  },
};

export const GEOMETRY_MECHANICS = [polygonSides, shapeSelect, cubeFaces, symmetryCheck, symmetryComplete] as const;
