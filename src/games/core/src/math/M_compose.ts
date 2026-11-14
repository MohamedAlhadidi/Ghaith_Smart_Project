/**
 * triangles-compose — MATH-S1 L15 «الأشكال» (p.18): shapes made from small triangles
 * (rhombus from 2, trapezoid from 3, big triangle from 4 or 9, hexagon from 6, the
 * star from 12). The child counts the small triangles that compose the shape.
 *
 * Shapes live on a triangular lattice. Point (a, b) maps to x = a + b/2, y = -b·√3/2.
 * Up triangle u(a,b) = (a,b),(a+1,b),(a,b+1); down triangle d(a,b) = (a+1,b),(a,b+1),(a+1,b+1).
 * The validator counts the triangles stored in params; it never trusts a stored total.
 */
import type { Difficulty } from "../types";
import { isWholeNumber, makeItem, ok, randInt, sample, wrong, type QuizMechanic } from "../quiz";

export type LatticeTri = readonly [a: number, b: number, kind: "u" | "d"];

export const COMPOSE_SHAPES: Record<string, { name: string; tris: LatticeTri[]; level: Difficulty }> = {
  rhombus: { name: "معيّن", tris: [[0, 0, "u"], [0, 0, "d"]], level: 1 },
  trapezoid: { name: "شبه منحرف", tris: [[0, 0, "u"], [0, 0, "d"], [1, 0, "u"]], level: 1 },
  triangle4: { name: "مثلث كبير", tris: [[0, 0, "u"], [1, 0, "u"], [0, 1, "u"], [0, 0, "d"]], level: 1 },
  parallelogram: { name: "متوازي أضلاع", tris: [[0, 0, "u"], [0, 0, "d"], [1, 0, "u"], [1, 0, "d"]], level: 2 },
  hexagon: { name: "شكل سداسي", tris: [[1, 1, "u"], [0, 1, "u"], [1, 0, "u"], [0, 1, "d"], [1, 0, "d"], [0, 0, "d"]], level: 2 },
  triangle9: {
    name: "مثلث كبير",
    tris: [[0, 0, "u"], [1, 0, "u"], [2, 0, "u"], [0, 1, "u"], [1, 1, "u"], [0, 2, "u"], [0, 0, "d"], [1, 0, "d"], [0, 1, "d"]],
    level: 3,
  },
  star: {
    name: "نجمة",
    tris: [
      [1, 1, "u"], [0, 1, "u"], [1, 0, "u"], [0, 1, "d"], [1, 0, "d"], [0, 0, "d"],
      [1, 1, "d"], [-1, 1, "d"], [1, -1, "d"], [0, 2, "u"], [2, 0, "u"], [0, 0, "u"],
    ],
    level: 3,
  },
};

export interface ComposeParams {
  shapeId: string;
  tris: LatticeTri[];
  rotation: number; // degrees, multiple of 60 (visual only)
}

const key = (t: LatticeTri) => `${t[0]},${t[1]},${t[2]}`;

export const trianglesCompose: QuizMechanic<Record<string, never>, ComposeParams> = {
  id: "GEN-TRIANGLES-COMPOSE",
  version: 1,
  mechanicId: "triangles-compose",
  difficulties: [1, 2, 3],
  validateConfig() {
    return [];
  },
  generate(seed, difficulty) {
    return sample(seed, (rng) => {
      const ids = Object.keys(COMPOSE_SHAPES).filter((id) => COMPOSE_SHAPES[id]!.level === difficulty);
      const shapeId = ids[randInt(rng, 0, ids.length - 1)]!;
      const shape = COMPOSE_SHAPES[shapeId]!;
      const rotation = difficulty === 1 ? 0 : randInt(rng, 0, 5) * 60;
      return makeItem(this, seed, difficulty, {
        params: { shapeId, tris: shape.tris.map((t) => [...t] as unknown as LatticeTri), rotation },
        prompt: `كم مثلثًا صغيرًا يكوّن هذا الشكل (${shape.name})؟`,
        visual: { type: "triangleCompose", tris: shape.tris, rotation },
        input: { type: "number", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return new Set(item.params.tris.map(key)).size;
  },
  check(item, answer) {
    const expected = new Set(item.params.tris.map(key)).size;
    if (answer === expected) return ok();
    if (!isWholeNumber(answer)) return wrong(expected, answer, "input_invalid");
    return wrong(expected, answer, Math.abs(answer - expected) <= 2 ? "counting_error" : "other");
  },
  explain(item) {
    const n = new Set(item.params.tris.map(key)).size;
    return ["نعدّ المثلثات الصغيرة واحدًا واحدًا دون أن نكرر أي مثلث.", n > 6 ? "نعدّ مثلثات الوسط أولًا ثم المثلثات على الأطراف." : "نلمس كل مثلث ونحن نعدّ.", `عدد المثلثات = ${n}`];
  },
  checkIntegrity(item) {
    const p: string[] = [];
    if (new Set(item.params.tris.map(key)).size !== item.params.tris.length) p.push("duplicate triangles");
    if (item.params.rotation % 60 !== 0) p.push("rotation must be a multiple of 60");
    // Shape must be edge-connected (each triangle shares an edge with another, unless alone).
    const verts = (t: LatticeTri) =>
      t[2] === "u"
        ? [`${t[0]},${t[1]}`, `${t[0] + 1},${t[1]}`, `${t[0]},${t[1] + 1}`]
        : [`${t[0] + 1},${t[1]}`, `${t[0]},${t[1] + 1}`, `${t[0] + 1},${t[1] + 1}`];
    const tris = item.params.tris;
    for (const t of tris) {
      const vt = verts(t);
      const shares = tris.some((o) => o !== t && verts(o).filter((v) => vt.includes(v)).length === 2);
      if (tris.length > 1 && !shares) p.push(`triangle ${key(t)} not edge-connected`);
    }
    return p;
  },
};

export const COMPOSE_MECHANICS = [trianglesCompose] as const;
