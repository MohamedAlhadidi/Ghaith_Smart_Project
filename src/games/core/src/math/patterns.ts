/**
 * Patterns and properties of numbers (MATH-S1 L01, L03 hundred-square patterns; L33 odd one out, multiples).
 */
import type { Difficulty, ErrorType } from "../types";
import { isValidCell, numberAt, positionOf, type Cell } from "../hundredSquare";
import {
  asStringArray,
  byLevel,
  isWholeNumber,
  makeItem,
  ok,
  optionValue,
  randInt,
  sample,
  shuffle,
  wrong,
  type QuizMechanic,
} from "../quiz";
import { MINUS, multiProblems, pickOne } from "./A_common";

/* ------------------------------------------------------------------ */
/* hsq-pattern: tap the next cell of a pattern on the RTL hundred square */
/* ------------------------------------------------------------------ */

export interface HsqPatternConfig {
  steps: number[];
}
export interface HsqPatternParams {
  start: number;
  step: number;
}

const patternValues = (p: HsqPatternParams) => [p.start, p.start + p.step, p.start + 2 * p.step];
const patternNext = (p: HsqPatternParams) => p.start + 3 * p.step;

/** True when the four cells lie on one straight line of the board (same row/col move each step). */
function straight(values: number[]): boolean {
  const cells = values.map(positionOf);
  const dr = cells[1]!.row - cells[0]!.row;
  const dc = cells[1]!.col - cells[0]!.col;
  return cells.every((c, i) => i === 0 || (c.row - cells[i - 1]!.row === dr && c.col - cells[i - 1]!.col === dc));
}

/** Diagonal steps (9, 11) only make sense without wrapping round the board edge. */
const mustBeStraight = (step: number, difficulty: Difficulty) => step === 9 || step === 11 || (step === 1 && difficulty < 3);

function asCell(v: unknown): Cell | null {
  if (typeof v !== "object" || v === null) return null;
  const c = v as Partial<Cell>;
  if (!Number.isInteger(c.row) || !Number.isInteger(c.col)) return null;
  const cell = { row: c.row!, col: c.col! };
  return isValidCell(cell) ? cell : null;
}

export const hsqPattern: QuizMechanic<HsqPatternConfig, HsqPatternParams> = {
  id: "GEN-HSQ-PATTERN",
  version: 1,
  mechanicId: "hsq-pattern",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!Array.isArray(c.steps) || c.steps.length === 0) p.push("steps required");
    for (const s of c.steps ?? []) if (!isWholeNumber(s) || s < 1 || s > 20) p.push(`bad step ${s}`);
    return p;
  },
  generate(seed, difficulty, config) {
    const sorted = [...config.steps].sort((a, b) => a - b);
    return sample(seed, (rng) => {
      // Level 1: smallest step, counting from a multiple of the step (2, 4, 6 / 5, 10, 15).
      // Level 2: any step, any start. Level 3: the larger steps, any start, wrapping rows allowed for +1,
      // and only the pattern cells are numbered on the board.
      const step =
        difficulty === 1 ? sorted[0]! : difficulty === 2 || sorted.length === 1 ? pickOne(rng, sorted) : pickOne(rng, sorted.slice(1));
      const lastAllowed = 100 - 3 * step;
      if (lastAllowed < 1) return null;
      let start: number;
      if (difficulty === 1 && step >= 2 && step <= 10) {
        const k = randInt(rng, 1, Math.max(1, Math.floor(Math.min(lastAllowed, 40) / step)));
        start = k * step;
      } else if (difficulty === 1) {
        start = randInt(rng, 1, Math.min(lastAllowed, 60));
      } else {
        start = randInt(rng, 1, lastAllowed);
      }
      if (start > lastAllowed) return null;
      // Level 3 with a skip step: avoid starting on a multiple (harder: 3, 8, 13...).
      if (difficulty === 3 && step >= 2 && step <= 10 && start % step === 0) return null;
      const params = { start, step };
      const all = [...patternValues(params), patternNext(params)];
      if (mustBeStraight(step, difficulty) && !straight(all)) return null;
      const shown = patternValues(params);
      return makeItem(this, seed, difficulty, {
        params,
        prompt: `انظر إلى الأعداد ${shown.join("، ")}. المس المربع التالي في النمط.`,
        visual: { type: "hundredPattern", shown, labels: difficulty === 3 ? "pattern" : "all" },
        input: { type: "visual" },
      });
    });
  },
  solution(item) {
    return positionOf(patternNext(item.params));
  },
  check(item, answer) {
    const expected = patternNext(item.params);
    const expCell = positionOf(expected);
    const cell = asCell(answer);
    if (!cell) return wrong(expCell, answer, "input_invalid");
    const given = numberAt(cell);
    if (given === expected) return ok();
    const { start, step } = item.params;
    const last = start + 2 * step;
    let type: ErrorType = "other";
    if (patternValues(item.params).includes(given)) type = "other";
    else if (cell.row === expCell.row && cell.col === 9 - expCell.col) type = "rtl_direction_confusion";
    else if ((step === 11 && given === last + 9) || (step === 9 && given === last + 11) || given === start - step) type = "rtl_direction_confusion";
    else if (Math.abs(given - expected) === 1) type = "off_by_one";
    else if (Math.abs(given - expected) === 10) type = "row_step_error";
    return wrong(expCell, cell, type);
  },
  explain(item) {
    const [a, b, c] = patternValues(item.params);
    const { step } = item.params;
    return [`الأعداد: ${a}، ${b}، ${c}.`, `كل مرة نزيد ${step}: ${b} ${MINUS} ${a} = ${step}`, `${c} + ${step} = ${c! + step}`, `نلمس المربع ${c! + step}.`];
  },
  checkIntegrity(item) {
    const p: string[] = [];
    const { start, step } = item.params;
    const next = patternNext(item.params);
    if (start < 1 || next > 100) p.push("pattern leaves the board");
    if ((step === 9 || step === 11) && !straight([...patternValues(item.params), next])) p.push("diagonal pattern wraps the board");
    if (item.input.type !== "visual") p.push("expects visual input");
    const shown = item.visual.shown as number[] | undefined;
    if (!Array.isArray(shown) || shown.join() !== patternValues(item.params).join()) p.push("visual does not match params");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* odd-one-out: choose every true "X is the odd one out because..."     */
/* ------------------------------------------------------------------ */

export type NumberProp = "odd" | "even" | "mult5" | "notMult5" | "mult10" | "notMult10" | "oneDigit" | "twoDigit" | "gt50" | "lt50";

export const PROP_TEXT: Record<NumberProp, string> = {
  odd: "عدد فردي",
  even: "عدد زوجي",
  mult5: "من مضاعفات 5",
  notMult5: "ليس من مضاعفات 5",
  mult10: "من مضاعفات 10",
  notMult10: "ليس من مضاعفات 10",
  oneDigit: "عدد من رقم واحد",
  twoDigit: "عدد من رقمين",
  gt50: "أكبر من 50",
  lt50: "أصغر من 50",
};

export function hasProp(n: number, prop: NumberProp): boolean {
  switch (prop) {
    case "odd":
      return n % 2 === 1;
    case "even":
      return n % 2 === 0;
    case "mult5":
      return n % 5 === 0;
    case "notMult5":
      return n % 5 !== 0;
    case "mult10":
      return n % 10 === 0;
    case "notMult10":
      return n % 10 !== 0;
    case "oneDigit":
      return n < 10;
    case "twoDigit":
      return n >= 10 && n <= 99;
    case "gt50":
      return n > 50;
    case "lt50":
      return n < 50;
  }
}

export interface OddOneOutConfig {
  max: number;
}
export interface OddStatement {
  id: string;
  /** Index into numbers. */
  x: number;
  prop: NumberProp;
}
export interface OddOneOutParams {
  numbers: number[];
  statements: OddStatement[];
}

/** "X is the odd one out because it is P" is true iff X alone (of the three) has P. */
export function statementTrue(numbers: readonly number[], s: Pick<OddStatement, "x" | "prop">): boolean {
  return numbers.every((n, i) => (i === s.x ? hasProp(n, s.prop) : !hasProp(n, s.prop)));
}

const statementLabel = (numbers: readonly number[], s: Pick<OddStatement, "x" | "prop">) => `${numbers[s.x]} هو الدخيل لأنه ${PROP_TEXT[s.prop]}`;

export const oddOneOut: QuizMechanic<OddOneOutConfig, OddOneOutParams> = {
  id: "GEN-ODD-ONE-OUT",
  version: 1,
  mechanicId: "odd-one-out",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.max) && c.max >= 20 && c.max <= 99 ? [] : ["max must be 20..99"];
  },
  generate(seed, difficulty, config) {
    const props: NumberProp[] = ["odd", "even", "mult5", "notMult5", "mult10", "notMult10", "oneDigit", "twoDigit"];
    if (config.max > 50) props.push("gt50", "lt50");
    const total = byLevel(difficulty, [4, 5, 6] as const);
    return sample(seed, (rng) => {
      // Level 1: one one-digit number with two two-digit numbers (like 7, 25, 60).
      // Level 2: any three numbers. Level 3: all two-digit, so the reasons are subtler (5s vs 10s, parity).
      const pickNum = (lo: number, hi: number) => randInt(rng, lo, hi);
      let numbers: number[];
      if (difficulty === 1) numbers = [pickNum(1, 9), pickNum(10, config.max), pickNum(10, config.max)];
      else if (difficulty === 2) numbers = [pickNum(1, config.max), pickNum(1, config.max), pickNum(1, config.max)];
      else numbers = [pickNum(10, config.max), pickNum(10, config.max), pickNum(10, config.max)];
      if (new Set(numbers).size !== 3 || numbers.includes(50)) return null;
      numbers = shuffle(rng, numbers);
      const all = numbers.flatMap((_, x) => props.map((prop) => ({ x, prop })));
      const trues = all.filter((s) => statementTrue(numbers, s));
      // Plausible false statements: X really has the property, but so does another number.
      const plausible = all.filter((s) => !statementTrue(numbers, s) && hasProp(numbers[s.x]!, s.prop));
      if (trues.length === 0 || plausible.length === 0) return null;
      const nTrue = Math.min(trues.length, difficulty === 3 ? randInt(rng, 2, 3) : randInt(rng, 1, 2), total - 1);
      const chosenTrue = shuffle(rng, trues).slice(0, nTrue);
      const chosenFalse = shuffle(rng, plausible).slice(0, total - nTrue);
      if (chosenTrue.length + chosenFalse.length < 3) return null;
      const statements = shuffle(rng, [...chosenTrue, ...chosenFalse]).map((s, i) => ({ id: `s${i}`, ...s }));
      return makeItem(this, seed, difficulty, {
        params: { numbers, statements },
        prompt: `الأعداد ${numbers.join("، ")}. اختر كل الجمل الصحيحة عن الدخيل.`,
        visual: { type: "oddOneOutCards", numbers },
        input: { type: "multi", options: statements.map((s) => ({ id: s.id, label: statementLabel(numbers, s) })) },
      });
    });
  },
  solution(item) {
    return item.params.statements.filter((s) => statementTrue(item.params.numbers, s)).map((s) => s.id);
  },
  check(item, answer) {
    const ids = asStringArray(answer);
    const expected = this.solution(item) as string[];
    if (!ids || ids.length === 0) return wrong(expected, answer, "input_invalid");
    const known = new Set(item.params.statements.map((s) => s.id));
    if (ids.some((id) => !known.has(id))) return wrong(expected, answer, "input_invalid");
    if (ids.some((id) => !expected.includes(id))) return wrong(expected, answer, "property_error");
    return expected.every((id) => ids.includes(id)) ? ok() : wrong(expected, answer, "partial_answer");
  },
  explain(item) {
    const { numbers } = item.params;
    const trues = item.params.statements.filter((s) => statementTrue(numbers, s));
    return [
      `نفحص كل عدد: هل هو فردي أم زوجي؟ هل هو من مضاعفات 5 أو 10؟ كم رقمًا فيه؟`,
      ...trues.slice(0, 2).map((s) => `${numbers[s.x]} ${PROP_TEXT[s.prop]}، والعددان الآخران ليسا كذلك.`),
      "قد يكون للدخيل أكثر من سبب صحيح.",
    ];
  },
  checkIntegrity(item) {
    const { numbers, statements } = item.params;
    const p = multiProblems(item, this.solution(item) as string[]);
    if (new Set(numbers).size !== 3) p.push("numbers must be three distinct values");
    if (numbers.includes(50)) p.push("50 makes greater/less than 50 ambiguous");
    if (new Set(statements.map((s) => `${s.x}:${s.prop}`)).size !== statements.length) p.push("duplicate statements");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* multiples-select                                                     */
/* ------------------------------------------------------------------ */

export interface MultiplesConfig {
  ks: number[];
  max: number;
}
export interface MultiplesParams {
  k: number;
  values: number[];
}

export const multiplesSelect: QuizMechanic<MultiplesConfig, MultiplesParams> = {
  id: "GEN-MULTIPLES-SELECT",
  version: 1,
  mechanicId: "multiples-select",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!Array.isArray(c.ks) || c.ks.length === 0) p.push("ks required");
    if (!isWholeNumber(c.max) || c.max < 10 || c.max > 100) p.push("max 10..100");
    for (const k of c.ks ?? []) if (!isWholeNumber(k) || k < 2 || k > 10 || c.max < 3 * k) p.push(`bad k ${k}`);
    return p;
  },
  generate(seed, difficulty, config) {
    const total = byLevel(difficulty, [5, 6, 6] as const);
    return sample(seed, (rng) => {
      // Level 1: multiples of 10 if offered (end in 0). Level 3: near misses (35 for 10, 26 for 5, 17 for 2).
      const k = difficulty === 1 ? (config.ks.includes(10) ? 10 : Math.max(...config.ks)) : pickOne(rng, config.ks);
      const multiples = Array.from({ length: Math.floor(config.max / k) }, (_, i) => (i + 1) * k);
      const nYes = randInt(rng, 2, Math.min(3, multiples.length));
      const yes = shuffle(rng, multiples).slice(0, nYes);
      let pool: number[];
      if (difficulty === 3) {
        const near = new Set<number>();
        for (const m of multiples) {
          if (k === 10) near.add(m - 5);
          for (const d of [-1, 1, -2, 2]) near.add(m + d);
        }
        pool = [...near];
      } else {
        pool = Array.from({ length: config.max }, (_, i) => i + 1);
      }
      pool = pool.filter((v) => v >= 1 && v <= config.max && v % k !== 0 && !yes.includes(v));
      const no = shuffle(rng, [...new Set(pool)]).slice(0, total - nYes);
      if (no.length !== total - nYes) return null;
      const values = shuffle(rng, [...yes, ...no]);
      return makeItem(this, seed, difficulty, {
        params: { k, values },
        prompt: `اختر كل الأعداد التي هي من مضاعفات ${k}.`,
        visual: { type: "none" },
        input: { type: "multi", options: values.map((v) => ({ id: `n${v}`, label: String(v) })) },
      });
    });
  },
  solution(item) {
    return item.params.values.filter((v) => v % item.params.k === 0).map((v) => `n${v}`);
  },
  check(item, answer) {
    const ids = asStringArray(answer);
    const expected = this.solution(item) as string[];
    if (!ids || ids.length === 0) return wrong(expected, answer, "input_invalid");
    const vals = ids.map(optionValue);
    if (vals.some((v) => v === null || !item.params.values.includes(v))) return wrong(expected, answer, "input_invalid");
    if (vals.some((v) => v! % item.params.k !== 0)) return wrong(expected, answer, "property_error");
    return expected.every((id) => ids.includes(id)) ? ok() : wrong(expected, answer, "partial_answer");
  },
  explain(item) {
    const { k } = item.params;
    const rule = k === 10 ? "مضاعفات 10 تنتهي بالصفر." : k === 5 ? "مضاعفات 5 تنتهي بالرقم 0 أو 5." : k === 2 ? "مضاعفات 2 أعداد زوجية: تنتهي بالرقم 0 أو 2 أو 4 أو 6 أو 8." : `نعدّ بالقفز ${k} خطوات.`;
    const sol = item.params.values.filter((v) => v % k === 0).sort((a, b) => a - b);
    return [`نعدّ من 0 بخطوات متساوية: 0، ${k}، ${2 * k}، ${3 * k}، ...`, rule, `مضاعفات ${k} هنا: ${sol.join("، ")}.`];
  },
  checkIntegrity(item) {
    const { values, k } = item.params;
    const p = multiProblems(item, this.solution(item) as string[]);
    if (values.some((v) => v < 1)) p.push("values must be positive");
    if (!values.some((v) => v % k !== 0)) p.push("needs a non-multiple");
    return p;
  },
};

export const PATTERN_MECHANICS = [hsqPattern, oddOneOut, multiplesSelect] as const;
