/**
 * Number pairs and fact families (MATH-S1 lessons L05, L06, L09, L10, L11, L12, L31).
 * Reference implementation of the QuizMechanic pattern.
 */
import type { Difficulty, ErrorType } from "../types";
import {
  asStringArray,
  byLevel,
  isWholeNumber,
  makeItem,
  ok,
  optionProblems,
  randInt,
  sample,
  shuffle,
  wrong,
  type QuizItem,
  type QuizMechanic,
} from "../quiz";

function numberError(expected: number, given: unknown, extra: Record<number, ErrorType> = {}): ErrorType {
  if (!isWholeNumber(given)) return "input_invalid";
  if (extra[given]) return extra[given]!;
  const rev = expected >= 10 && expected <= 99 ? (expected % 10) * 10 + Math.floor(expected / 10) : null;
  if (rev !== null && rev === given && rev !== expected) return "tens_ones_confusion";
  if (Math.abs(given - expected) === 1) return "off_by_one";
  if (Math.abs(given - expected) === 10) return "counting_error";
  return "other";
}

/* ------------------------------------------------------------------ */
/* complement: find the missing part of a pair                         */
/* ------------------------------------------------------------------ */

export interface ComplementConfig {
  targets: number[];
  step: 1 | 10;
  visual: "tenframes" | "clock" | "scale" | "cards";
  unit?: string;
}
export interface ComplementParams {
  target: number;
  known: number;
  visual: ComplementConfig["visual"];
  unit: string;
  missingFirst: boolean;
}

export const complement: QuizMechanic<ComplementConfig, ComplementParams> = {
  id: "GEN-COMPLEMENT",
  version: 1,
  mechanicId: "complement",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!Array.isArray(c.targets) || c.targets.length === 0) p.push("targets required");
    if (c.step !== 1 && c.step !== 10) p.push("step must be 1 or 10");
    for (const t of c.targets ?? []) if (!isWholeNumber(t) || t < 2 || t > 100 || t % c.step !== 0) p.push(`bad target ${t}`);
    if (c.visual === "clock" && c.targets.some((t) => t !== 12)) p.push("clock visual needs target 12");
    if (c.visual === "tenframes" && c.targets.some((t) => t > 20)) p.push("tenframes visual supports targets up to 20");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const target = config.targets[randInt(rng, 0, config.targets.length - 1)]!;
      const parts = target / config.step;
      // Level 1: the missing part is the smaller one; level 2: any; level 3: missing part written first.
      const knownParts = difficulty === 1 ? randInt(rng, Math.ceil(parts / 2), parts - 1) : randInt(rng, 1, parts - 1);
      const known = knownParts * config.step;
      const unit = config.unit ?? "";
      const missingFirst = difficulty === 3;
      const u = unit ? ` ${unit}` : "";
      let prompt: string;
      switch (config.visual) {
        case "scale":
          prompt = `في الكفة كتلتان مجموعهما ${target}${u}. إحداهما ${known}${u}. كم كتلة الأخرى؟`;
          break;
        case "clock":
          prompt = `اكتب زوج العدد ${known} للعدد ${target} كما على الساعة.`;
          break;
        case "tenframes":
          prompt = `في الإطارين ${known} مكعبًا. كم مكعبًا نضيف لنكمل ${target}؟`;
          break;
        default:
          prompt = `مجموع وجهي البطاقة ${target}. على الوجه الظاهر ${known}. ما العدد على الوجه الآخر؟`;
      }
      prompt += missingFirst ? ` (؟ + ${known} = ${target})` : ` (${known} + ؟ = ${target})`;
      const visual =
        config.visual === "tenframes"
          ? { type: "tenframes", filled: known, total: target }
          : config.visual === "clock"
            ? { type: "clock", highlight: known }
            : config.visual === "scale"
              ? { type: "scale", known, target, unit }
              : { type: "cards", cards: [{ text: String(known), tone: target === 30 ? "star" : "heart" }, { text: "?", tone: "plain" }] };
      return makeItem(this, seed, difficulty, {
        params: { target, known, visual: config.visual, unit, missingFirst },
        prompt,
        visual,
        input: { type: "number", unit: unit || undefined, maxDigits: 3 },
      });
    });
  },
  solution(item) {
    return item.params.target - item.params.known;
  },
  check(item, answer) {
    const { target, known } = item.params;
    const expected = target - known;
    if (answer === expected) return ok();
    return wrong(expected, answer, numberError(expected, answer, { [target + known]: "operation_confusion" }));
  },
  explain(item) {
    const { target, known } = item.params;
    return [`نبحث عن العدد الذي نضيفه إلى ${known} لنحصل على ${target}.`, `${target} - ${known} = ${target - known}`, `إذن ${known} + ${target - known} = ${target}`];
  },
  checkIntegrity(item) {
    const { target, known } = item.params;
    const p: string[] = [];
    if (!(known > 0 && known < target)) p.push("known part out of range");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* pair-pick: choose the two cards that make the target                */
/* ------------------------------------------------------------------ */

export interface PairPickConfig {
  target: number;
  step: 1 | 10;
  unit?: string;
}
export interface PairPickParams {
  target: number;
  values: number[];
  unit: string;
}

function countPairs(values: number[], target: number): number {
  let n = 0;
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) if (values[i]! + values[j]! === target) n++;
  return n;
}

export const pairPick: QuizMechanic<PairPickConfig, PairPickParams> = {
  id: "GEN-PAIR-PICK",
  version: 1,
  mechanicId: "pair-pick",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!isWholeNumber(c.target) || c.target < 4 || c.target > 100) p.push("target 4..100");
    if (c.step !== 1 && c.step !== 10) p.push("step must be 1 or 10");
    if (c.target % c.step !== 0) p.push("target must be a multiple of step");
    if (c.target / c.step < 6) p.push("target too small for distinct cards");
    return p;
  },
  generate(seed, difficulty, config) {
    const count = byLevel(difficulty, [4, 5, 6] as const);
    return sample(seed, (rng) => {
      const parts = config.target / config.step;
      const a = randInt(rng, 1, parts - 1);
      const b = parts - a;
      if (a === b) return null;
      const values = new Set([a * config.step, b * config.step]);
      let guard = 0;
      while (values.size < count && guard++ < 200) values.add(randInt(rng, 1, parts - 1) * config.step);
      const list = shuffle(rng, [...values]);
      if (list.length !== count || countPairs(list, config.target) !== 1) return null;
      const unit = config.unit ?? "";
      return makeItem(this, seed, difficulty, {
        params: { target: config.target, values: list, unit },
        prompt: `اختر البطاقتين اللتين مجموعهما ${config.target}${unit ? " " + unit : ""}.`,
        visual: { type: "none" },
        input: { type: "multi", exactly: 2, options: list.map((v, i) => ({ id: `c${i}`, label: unit ? `${v} ${unit}` : String(v) })) },
      });
    });
  },
  solution(item) {
    const v = item.params.values;
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (v[i]! + v[j]! === item.params.target) return [`c${i}`, `c${j}`];
    return [];
  },
  check(item, answer) {
    const ids = asStringArray(answer);
    const expected = this.solution(item);
    if (!ids || ids.length !== 2 || new Set(ids).size !== 2) return wrong(expected, answer, "input_invalid");
    const vals = ids.map((id) => item.params.values[Number(id.slice(1))]);
    if (vals.some((v) => v === undefined)) return wrong(expected, answer, "input_invalid");
    return (vals[0]! + vals[1]!) === item.params.target ? ok() : wrong(expected, answer, "other");
  },
  explain(item) {
    const [i, j] = (this.solution(item) as string[]).map((id) => item.params.values[Number(id.slice(1))]!);
    return [`نختار بطاقة ونبحث عن شريكتها: ${item.params.target} - ${i} = ${j}.`, `${i} + ${j} = ${item.params.target}`];
  },
  checkIntegrity(item) {
    const p = item.input.type === "multi" ? optionProblems(item.input.options) : ["expects multi input"];
    if (countPairs(item.params.values, item.params.target) !== 1) p.push("must contain exactly one valid pair");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* fact-triangle and fact-family                                       */
/* ------------------------------------------------------------------ */

export type Family = "tens100" | "to20" | "to12";

function drawFamily(rng: () => number, family: Family, difficulty: Difficulty): { total: number; a: number; b: number } | null {
  let total: number, a: number;
  if (family === "tens100") {
    total = 100;
    a = randInt(rng, 1, 9) * 10;
  } else if (family === "to12") {
    total = 12;
    a = randInt(rng, 1, 11);
  } else {
    total = difficulty === 1 ? randInt(rng, 10, 14) : randInt(rng, 11, 20);
    a = randInt(rng, 1, total - 1);
  }
  const b = total - a;
  return a === b ? null : { total, a, b };
}

export interface FactTriangleConfig {
  family: Family;
}
export interface FactTriangleParams {
  total: number;
  a: number;
  b: number;
  missing: "a" | "b" | "total";
}

export const factTriangle: QuizMechanic<FactTriangleConfig, FactTriangleParams> = {
  id: "GEN-FACT-TRIANGLE",
  version: 1,
  mechanicId: "fact-triangle",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return ["tens100", "to20", "to12"].includes(c.family) ? [] : ["unknown family"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const f = drawFamily(rng, config.family, difficulty);
      if (!f) return null;
      // Level 3 may hide the total, but only where the total varies (not for 100 or 12).
      const missing: FactTriangleParams["missing"] =
        difficulty === 3 && config.family === "to20" && rng() < 0.5 ? "total" : rng() < 0.5 ? "a" : "b";
      return makeItem(this, seed, difficulty, {
        params: { ...f, missing },
        prompt: "اكتب العدد الذي لا يظهر في مثلث عائلة الحقائق.",
        visual: {
          type: "triangle",
          top: missing === "total" ? null : f.total,
          left: missing === "a" ? null : f.a,
          right: missing === "b" ? null : f.b,
        },
        input: { type: "number", maxDigits: 3 },
      });
    });
  },
  solution(item) {
    return item.params[item.params.missing];
  },
  check(item, answer) {
    const { total, a, b, missing } = item.params;
    const expected = item.params[missing];
    if (answer === expected) return ok();
    const known = missing === "a" ? b : missing === "b" ? a : null;
    const extra: Record<number, ErrorType> = known !== null ? { [total + known]: "operation_confusion" } : { [Math.abs(a - b)]: "operation_confusion" };
    return wrong(expected, answer, numberError(expected, answer, extra));
  },
  explain(item) {
    const { total, a, b, missing } = item.params;
    if (missing === "total") return [`الجزءان ${a} و${b}.`, `${a} + ${b} = ${total}`];
    const known = missing === "a" ? b : a;
    return [`المجموع ${total} والجزء المعروف ${known}.`, `${total} - ${known} = ${total - known}`];
  },
  checkIntegrity(item) {
    const { total, a, b } = item.params;
    return a + b === total && a > 0 && b > 0 && a !== b ? [] : ["inconsistent family"];
  },
};

export interface FactFamilyParams {
  total: number;
  a: number;
  b: number;
  /** Each option: x op y = z, evaluated by the validator. */
  equations: Array<{ id: string; x: number; op: "+" | "-"; y: number; z: number }>;
}

function equationTrue(e: { x: number; op: "+" | "-"; y: number; z: number }): boolean {
  return e.op === "+" ? e.x + e.y === e.z : e.x - e.y === e.z;
}

export const factFamily: QuizMechanic<FactTriangleConfig, FactFamilyParams> = {
  id: "GEN-FACT-FAMILY",
  version: 1,
  mechanicId: "fact-family",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return ["tens100", "to20", "to12"].includes(c.family) ? [] : ["unknown family"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const f = drawFamily(rng, config.family, difficulty);
      if (!f) return null;
      const { total: t, a, b } = f;
      const trueEqs = [
        { x: a, op: "+" as const, y: b, z: t },
        { x: b, op: "+" as const, y: a, z: t },
        { x: t, op: "-" as const, y: a, z: b },
        { x: t, op: "-" as const, y: b, z: a },
      ];
      // Plausible false statements: subtraction started from the part, or a wrong total.
      const falseEqs = [
        { x: t, op: "+" as const, y: a, z: b },
        { x: Math.max(a, b), op: "-" as const, y: Math.min(a, b), z: t },
        { x: a, op: "+" as const, y: b, z: t + (config.family === "tens100" ? 10 : 1) },
      ].filter((e) => !equationTrue(e));
      const nFalse = byLevel(difficulty, [1, 2, 2] as const);
      const chosen = shuffle(rng, [...trueEqs, ...shuffle(rng, falseEqs).slice(0, nFalse)]);
      const equations = chosen.map((e, i) => ({ id: `e${i}`, ...e }));
      return makeItem(this, seed, difficulty, {
        params: { total: t, a, b, equations },
        prompt: `اختر كل الحقائق الصحيحة لعائلة الأعداد ${a} و${b} و${t}.`,
        visual: { type: "triangle", top: t, left: a, right: b },
        input: { type: "multi", options: equations.map((e) => ({ id: e.id, label: `${e.x} ${e.op} ${e.y} = ${e.z}` })) },
      });
    });
  },
  solution(item) {
    return item.params.equations.filter(equationTrue).map((e) => e.id);
  },
  check(item, answer) {
    const ids = asStringArray(answer);
    const expected = this.solution(item) as string[];
    if (!ids || ids.length === 0) return wrong(expected, answer, "input_invalid");
    const picked = new Set(ids);
    const falsePicked = item.params.equations.filter((e) => picked.has(e.id) && !equationTrue(e));
    if (falsePicked.length) return wrong(expected, answer, "operation_confusion");
    return expected.every((id) => picked.has(id)) ? ok() : wrong(expected, answer, "partial_answer");
  },
  explain(item) {
    const { total: t, a, b } = item.params;
    return [`${a} + ${b} = ${t}`, `${b} + ${a} = ${t}`, `${t} - ${a} = ${b}`, `${t} - ${b} = ${a}`];
  },
  checkIntegrity(item) {
    const p = item.input.type === "multi" ? optionProblems(item.input.options) : ["expects multi input"];
    if (item.params.equations.filter(equationTrue).length !== 4) p.push("must contain the 4 true facts");
    return p;
  },
};

export const PAIRS_MECHANICS = [complement, pairPick, factTriangle, factFamily] as const;
