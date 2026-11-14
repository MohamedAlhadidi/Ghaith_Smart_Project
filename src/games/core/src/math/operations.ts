/**
 * Addition and subtraction (MATH-S1 L11 adding groups, L13 equivalence, L13/L21 balance,
 * L34 number stories and inverses, L35 addition loop, L36 differences).
 */
import type { ErrorType } from "../types";
import {
  asStringArray,
  byLevel,
  exactlyOneCorrect,
  isWholeNumber,
  makeItem,
  numberOptions,
  ok,
  optionProblems,
  optionValue,
  randInt,
  sample,
  shuffle,
  wrong,
  type QuizMechanic,
} from "../quiz";
import type { Rng } from "../rng";
import {
  bridges,
  bridgesDown,
  eqLabel,
  eqTrue,
  evalOp,
  exprLabel,
  exprValue,
  MINUS,
  multiProblems,
  numberError,
  pickOne,
  reverseDigits,
  type Eq,
  type Expr,
  type Op,
} from "./A_common";

/* ------------------------------------------------------------------ */
/* add-many: add a group of one-digit numbers (p.14)                    */
/* ------------------------------------------------------------------ */

export interface AddManyConfig {
  countMin: number;
  countMax: number;
}
export interface AddManyParams {
  digits: number[];
}

function pairToTen(d: number[]): [number, number] | null {
  for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) if (d[i]! + d[j]! === 10) return [i, j];
  return null;
}

export const addMany: QuizMechanic<AddManyConfig, AddManyParams> = {
  id: "GEN-ADD-MANY",
  version: 1,
  mechanicId: "add-many",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.countMin) && isWholeNumber(c.countMax) && c.countMin >= 3 && c.countMin <= c.countMax && c.countMax <= 5 ? [] : ["need 3 <= countMin <= countMax <= 5"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1: fewest numbers, with a pair to 10. Level 2: a pair to 10 or a double. Level 3: most numbers, no help.
      const count = difficulty === 1 ? config.countMin : difficulty === 2 ? randInt(rng, config.countMin, config.countMax) : config.countMax;
      const digits = Array.from({ length: count }, () => randInt(rng, 1, 9));
      const hasDouble = new Set(digits).size < digits.length;
      if (difficulty === 1 && !pairToTen(digits)) return null;
      if (difficulty === 2 && !pairToTen(digits) && !hasDouble) return null;
      if (difficulty === 3 && digits.reduce((s, d) => s + d, 0) < 20) return null;
      return makeItem(this, seed, difficulty, {
        params: { digits },
        prompt: `اجمع الأعداد: ${digits.join(" + ")} = ؟`,
        visual: { type: "digitGroup", digits },
        input: { type: "number", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return item.params.digits.reduce((s, d) => s + d, 0);
  },
  check(item, answer) {
    const sum = this.solution(item) as number;
    if (answer === sum) return ok();
    const extra: Record<number, ErrorType> = {};
    for (const d of item.params.digits) extra[sum - d] = "partial_answer";
    let type = numberError(sum, answer, extra);
    if (type === "other" && isWholeNumber(answer) && Math.abs(answer - sum) <= 3) type = "counting_error";
    return wrong(sum, answer, type);
  },
  explain(item) {
    const d = [...item.params.digits];
    const pair = pairToTen(d);
    const steps: string[] = [];
    let order: number[];
    if (pair) {
      steps.push(`نبحث عن عددين مجموعهما 10: ${d[pair[0]]} + ${d[pair[1]]} = 10`);
      order = [10, ...d.filter((_, i) => i !== pair[0] && i !== pair[1])];
    } else {
      order = d;
    }
    let acc = order[0]!;
    for (const x of order.slice(1)) {
      steps.push(`${acc} + ${x} = ${acc + x}`);
      acc += x;
    }
    return steps.slice(0, 4);
  },
  checkIntegrity(item) {
    const { digits } = item.params;
    const p: string[] = [];
    if (digits.length < 3 || digits.length > 5 || digits.some((d) => d < 1 || d > 9)) p.push("digits must be 3-5 numbers 1..9");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* equivalence: the equaliser machine (p.16)                            */
/* ------------------------------------------------------------------ */

export interface EquivalenceConfig {
  maxValue: number;
}
export interface EquivalenceParams {
  target: Expr;
  options: Array<Expr & { id: string }>;
}

/** A random expression with value v; operands and value stay within 1..max. */
function exprFor(rng: Rng, v: number, max: number): Expr | null {
  if (rng() < 0.55) {
    if (v < 2) return null;
    const a = randInt(rng, 1, v - 1);
    return { a, op: "+", b: v - a };
  }
  const b = randInt(rng, 1, 9);
  return v + b <= max ? { a: v + b, op: "-", b } : null;
}

const sameExpr = (p: Expr, q: Expr) => p.a === q.a && p.op === q.op && p.b === q.b;

export const equivalence: QuizMechanic<EquivalenceConfig, EquivalenceParams> = {
  id: "GEN-EQUIVALENCE",
  version: 1,
  mechanicId: "equivalence",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.maxValue) && c.maxValue >= 20 && c.maxValue <= 99 ? [] : ["maxValue must be 20..99"];
  },
  generate(seed, difficulty, config) {
    const max = config.maxValue;
    const total = byLevel(difficulty, [4, 5, 6] as const);
    return sample(seed, (rng) => {
      // Target card like the book: two-digit ± one-digit (39 + 3, 36 − 7, 23 + 4).
      const op: Op = difficulty === 1 ? "+" : rng() < 0.5 ? "+" : "-";
      const b = randInt(rng, 1, 9);
      const a = randInt(rng, 10, max);
      const target: Expr = { a, op, b };
      const v = exprValue(target);
      if (v < 5 || v > (difficulty === 1 ? 30 : max)) return null;
      if (difficulty === 1 && bridges(a, b)) return null;
      const nEqual = difficulty === 3 ? randInt(rng, 2, 3) : 2;
      const chosen: Expr[] = [];
      const add = (e: Expr | null) => {
        if (!e || e.a < 1 || e.b < 1 || e.a > max || e.b > max) return;
        const val = exprValue(e);
        if (val < 1 || val > max) return;
        if (sameExpr(e, target) || chosen.some((c) => sameExpr(c, e))) return;
        // The commuted target is an easy "equal" card: only at level 1.
        if (difficulty > 1 && e.op === "+" && target.op === "+" && e.a === target.b && e.b === target.a) return;
        chosen.push(e);
      };
      let guard = 0;
      while (chosen.length < nEqual && guard++ < 50) add(exprFor(rng, v, max));
      if (chosen.length < nEqual) return null;
      // Unequal cards. Level 1: 3-6 away. Level 2: 1-2 away. Level 3: 1 away, 10 away and the other operation.
      const deltas = difficulty === 1 ? [3, -3, 4, -4, 5, -5, 6, -6] : difficulty === 2 ? [1, -1, 2, -2] : [1, -1, 10, -10];
      if (difficulty === 3) add({ a, op: op === "+" ? "-" : "+", b });
      guard = 0;
      while (chosen.length < total && guard++ < 80) {
        const w = v + pickOne(rng, deltas);
        if (w < 1 || w > max) continue;
        add(exprFor(rng, w, max));
      }
      if (chosen.length < total) return null;
      const options = shuffle(rng, chosen).map((e, i) => ({ id: `e${i}`, ...e }));
      const nTrue = options.filter((o) => exprValue(o) === v).length;
      if (nTrue < 1 || nTrue === options.length) return null;
      return makeItem(this, seed, difficulty, {
        params: { target, options },
        prompt: `اختر كل البطاقات التي تساوي ${exprLabel(target)}.`,
        visual: { type: "equivalenceMachine", card: exprLabel(target) },
        input: { type: "multi", options: options.map((o) => ({ id: o.id, label: exprLabel(o) })) },
      });
    });
  },
  solution(item) {
    const v = exprValue(item.params.target);
    return item.params.options.filter((o) => exprValue(o) === v).map((o) => o.id);
  },
  check(item, answer) {
    const ids = asStringArray(answer);
    const expected = this.solution(item) as string[];
    if (!ids || ids.length === 0) return wrong(expected, answer, "input_invalid");
    const picked = ids.map((id) => item.params.options.find((o) => o.id === id));
    if (picked.some((o) => !o)) return wrong(expected, answer, "input_invalid");
    const v = exprValue(item.params.target);
    const bad = picked.find((o) => exprValue(o!) !== v);
    if (bad) {
      const t = item.params.target;
      const d = Math.abs(exprValue(bad) - v);
      const type: ErrorType = bad.a === t.a && bad.b === t.b && bad.op !== t.op ? "operation_confusion" : d === 1 ? "off_by_one" : d === 10 ? "place_value_error" : "other";
      return wrong(expected, answer, type);
    }
    return expected.every((id) => ids.includes(id)) ? ok() : wrong(expected, answer, "partial_answer");
  },
  explain(item) {
    const { target, options } = item.params;
    const v = exprValue(target);
    const eq = options.filter((o) => exprValue(o) === v);
    return [`نحسب قيمة البطاقة أولًا: ${exprLabel(target)} = ${v}`, `ثم نحسب كل بطاقة ونختار التي قيمتها ${v}.`, ...eq.slice(0, 2).map((o) => `${exprLabel(o)} = ${v}`)];
  },
  checkIntegrity(item) {
    const { target, options } = item.params;
    const p = multiProblems(item, this.solution(item) as string[]);
    if (options.some((o) => sameExpr(o, target))) p.push("target repeated as an option");
    if ([target, ...options].some((e) => exprValue(e) < 1 || e.a < 1 || e.b < 1)) p.push("non-positive value");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* balance: a + b = c + ?  (p.16, p.24 mobiles)                         */
/* ------------------------------------------------------------------ */

export interface BalanceConfig {
  maxValue: number;
}
/** Logical sides of "first = second"; exactly one null (the missing number). */
export interface BalanceParams {
  first: [number | null, number | null];
  second: [number | null, number | null];
}

const sideSum = (s: readonly (number | null)[]) => s.reduce<number>((acc, v) => acc + (v ?? 0), 0);
function balanceAnswer(p: BalanceParams): number {
  const missingFirst = p.first.includes(null);
  return missingFirst ? sideSum(p.second) - sideSum(p.first) : sideSum(p.first) - sideSum(p.second);
}
const sideText = (s: readonly (number | null)[]) => s.map((v) => (v === null ? "؟" : String(v))).join(" + ");

export const balance: QuizMechanic<BalanceConfig, BalanceParams> = {
  id: "GEN-BALANCE",
  version: 1,
  mechanicId: "balance",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.maxValue) && c.maxValue >= 6 && c.maxValue <= 99 ? [] : ["maxValue must be 6..99"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1: totals to 10, missing number on the second side. Level 2: totals to maxValue.
      // Level 3: the missing number is on the first side.
      const total = randInt(rng, difficulty === 1 ? 4 : 8, difficulty === 1 ? Math.min(10, config.maxValue) : config.maxValue);
      const a = randInt(rng, 1, total - 1);
      const c = randInt(rng, 1, total - 1);
      const b = total - a;
      const d = total - c;
      if (c === a || c === b) return null;
      const first: [number | null, number | null] = [a, b];
      const second: [number | null, number | null] = [c, d];
      if (difficulty === 3) first[rng() < 0.5 ? 0 : 1] = null;
      else second[1] = null;
      const params = { first, second };
      return makeItem(this, seed, difficulty, {
        params,
        prompt: `ما العدد الناقص ليتوازن الطرفان؟ ${sideText(first)} = ${sideText(second)}`,
        visual: { type: "balancePans", first, second },
        input: { type: "number", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return balanceAnswer(item.params);
  },
  check(item, answer) {
    const expected = balanceAnswer(item.params);
    if (answer === expected) return ok();
    const full = item.params.first.includes(null) ? sideSum(item.params.second) : sideSum(item.params.first);
    const known = item.params.first.includes(null) ? sideSum(item.params.first) : sideSum(item.params.second);
    return wrong(expected, answer, numberError(expected, answer, { [full]: "partial_answer", [full + known]: "operation_confusion" }));
  },
  explain(item) {
    const { first, second } = item.params;
    const missingFirst = first.includes(null);
    const fullSide = missingFirst ? second : first;
    const half = missingFirst ? first : second;
    const full = sideSum(fullSide);
    const known = sideSum(half);
    const x = full - known;
    return [
      `نحسب الطرف الكامل: ${sideText(fullSide)} = ${full}`,
      `نحتاج أن يكون ${sideText(half)} = ${full}`,
      `${full} ${MINUS} ${known} = ${x}`,
      `إذن العدد الناقص ${x}، والطرفان متوازنان.`,
    ];
  },
  checkIntegrity(item) {
    const { first, second } = item.params;
    const p: string[] = [];
    if ([...first, ...second].filter((v) => v === null).length !== 1) p.push("exactly one missing number");
    if ([...first, ...second].some((v) => v !== null && v < 1)) p.push("terms must be positive");
    if (balanceAnswer(item.params) < 1) p.push("answer must be positive");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* Two-digit and one-digit sentences (p.37, p.38)                       */
/* ------------------------------------------------------------------ */

interface TwoOneConfig {
  max: number;
}

/** a two-digit (>= 11), b one-digit (3..9 for stories, 1..9 otherwise), result <= max. */
function drawTwoOne(rng: Rng, max: number, op: Op, bridging: boolean, bMin = 1, aMax = max): { a: number; b: number } | null {
  const b = randInt(rng, bMin, 9);
  const a = op === "+" ? randInt(rng, 11, Math.min(aMax, max - b)) : randInt(rng, Math.max(11, b + 1), Math.min(aMax, max));
  const br = op === "+" ? bridges(a, b) : bridgesDown(a, b);
  if (br !== bridging) return null;
  if (op === "-" && a - b < 1) return null;
  return { a, b };
}

const twoOneProblems = (c: TwoOneConfig) => (isWholeNumber(c.max) && c.max >= 20 && c.max <= 99 ? [] : ["max must be 20..99"]);

/* inverse-sentence ------------------------------------------------- */

export interface InverseSentenceParams {
  given: Eq;
  options: Array<Eq & { id: string }>;
}

/** The book's inverse: 15 + 9 = 24 <-> 24 − 9 = 15 (start from the result, undo the same number). */
function isInverse(given: Eq, e: Eq): boolean {
  return eqTrue(e) && e.op !== given.op && e.x === given.z && e.y === given.y && e.z === given.x;
}

export const inverseSentence: QuizMechanic<TwoOneConfig, InverseSentenceParams> = {
  id: "GEN-INVERSE-SENTENCE",
  version: 1,
  mechanicId: "inverse-sentence",
  difficulties: [1, 2, 3],
  validateConfig: twoOneProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1: addition without bridging. Level 2/3: bridging, addition or subtraction; level 3 adds
      // the "same operation, swapped order" card (9 + 15 = 24), which is true but not the inverse.
      const addGiven = difficulty === 1 || rng() < 0.5;
      const ab = drawTwoOne(rng, config.max, "+", difficulty > 1, 1, difficulty === 2 ? 30 : config.max);
      if (!ab) return null;
      const { a, b } = ab;
      const c = a + b;
      const given: Eq = addGiven ? { x: a, op: "+", y: b, z: c } : { x: c, op: "-", y: b, z: a };
      const inverse: Eq = addGiven ? { x: c, op: "-", y: b, z: a } : { x: a, op: "+", y: b, z: c };
      const off = pickOne(rng, [1, -1]);
      const pool: Eq[] = addGiven
        ? [
            { x: c, op: "+", y: b, z: a },
            { x: c, op: "-", y: b, z: a + off },
            { x: a, op: "-", y: b, z: c },
          ]
        : [
            { x: a, op: "-", y: b, z: c },
            { x: a, op: "+", y: b, z: c + off },
            { x: c, op: "+", y: b, z: a },
          ];
      if (difficulty === 3 && addGiven) pool.unshift({ x: b, op: "+", y: a, z: c });
      const distractors = (difficulty === 1 ? shuffle(rng, pool).slice(0, 2) : pool.slice(0, 3)).filter((e) => !isInverse(given, e) && e.z >= 0);
      const options = shuffle(rng, [inverse, ...distractors]).map((e, i) => ({ id: `e${i}`, ...e }));
      return makeItem(this, seed, difficulty, {
        params: { given, options },
        prompt: `ما الجملة العكسية للجملة ${eqLabel(given)}؟`,
        visual: { type: "sentenceCard", x: given.x, op: given.op, y: given.y, z: given.z },
        input: { type: "choice", options: options.map((o) => ({ id: o.id, label: eqLabel(o) })) },
      });
    });
  },
  solution(item) {
    return item.params.options.find((o) => isInverse(item.params.given, o))?.id ?? null;
  },
  check(item, answer) {
    const expected = this.solution(item);
    const e = item.params.options.find((o) => o.id === answer);
    if (!e) return wrong(expected, answer, "input_invalid");
    if (isInverse(item.params.given, e)) return ok();
    const g = item.params.given;
    const type: ErrorType = e.op === g.op ? "operation_confusion" : !eqTrue(e) && e.x === g.z && e.y === g.y ? "off_by_one" : "other";
    return wrong(expected, answer, type);
  },
  explain(item) {
    const g = item.params.given;
    const inv: Eq = g.op === "+" ? { x: g.z, op: "-", y: g.y, z: g.x } : { x: g.z, op: "+", y: g.y, z: g.x };
    return [`الجملة: ${eqLabel(g)}`, `العكس يبدأ بالناتج ${g.z}.`, g.op === "+" ? "عكس الجمع طرح." : "عكس الطرح جمع.", eqLabel(inv)];
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    if (!eqTrue(item.params.given)) p.push("given sentence is false");
    const g = item.params.given;
    // The other fact-family subtraction (24 − 15 = 9) must never be offered.
    if (item.params.options.some((o) => eqTrue(o) && o.op === "-" && g.op === "+" && o.x === g.z && o.y === g.x)) p.push("offers the other valid subtraction");
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, InverseSentenceParams>, item)];
  },
};

/* story-sentence ---------------------------------------------------- */

const PEOPLE = [
  { name: "أحمد", f: false },
  { name: "عائشة", f: true },
  { name: "خلفان", f: false },
  { name: "مريم", f: true },
  { name: "سالم", f: false },
  { name: "هدى", f: true },
] as const;
/** sing: accusative singular (after 11-99 and كم); plural: genitive plural (after 3-9). */
const THINGS = [
  { sing: "قلمًا", plural: "أقلام" },
  { sing: "كرةً", plural: "كرات" },
  { sing: "ملصقًا", plural: "ملصقات" },
  { sing: "كتابًا", plural: "كتب" },
  { sing: "بالونًا", plural: "بالونات" },
  { sing: "صدفةً", plural: "صدفات" },
  { sing: "تمرةً", plural: "تمرات" },
  { sing: "سمكةً", plural: "سمكات" },
] as const;

export interface StoryParams {
  person: number;
  thing: number;
  /** 0..2: wording variant. */
  variant: number;
  op: Op;
  a: number;
  b: number;
  options: Array<Eq & { id: string }>;
}

function storyText(p: Pick<StoryParams, "person" | "thing" | "variant" | "op" | "a" | "b">): string {
  const who = PEOPLE[p.person]!;
  const t = THINGS[p.thing]!;
  const him = who.f ? "ها" : "ه";
  const start = `مع ${who.name} ${p.a} ${t.sing}.`;
  if (p.op === "+") {
    const verbs = who.f ? ["اشترت", "جمعت", "أعطتها أمها"] : ["اشترى", "جمع", "أعطته أمه"];
    return `${start} ${verbs[p.variant % 3]} ${p.b} ${t.plural} أخرى. كم ${t.sing} مع${him} الآن؟`;
  }
  const verbs = who.f ? ["أعطت صديقتها", "وزّعت على أخواتها", "أهدت جارتها"] : ["أعطى صديقه", "وزّع على إخوته", "أهدى جاره"];
  return `${start} ${verbs[p.variant % 3]} ${p.b} ${t.plural}. كم ${t.sing} بقي مع${him}؟`;
}

const storyMatches = (p: Pick<StoryParams, "op" | "a" | "b">, e: Eq) => eqTrue(e) && e.op === p.op && e.x === p.a && e.y === p.b;

export const storySentence: QuizMechanic<TwoOneConfig, StoryParams> = {
  id: "GEN-STORY-SENTENCE",
  version: 1,
  mechanicId: "story-sentence",
  difficulties: [1, 2, 3],
  validateConfig: twoOneProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Like the book's stories (12 + 6, 24 − 9, 18 − 6, 46 + 7, 15 + 9, 53 − 7).
      // Level 1: no bridging, 3 options. Level 2: bridging, numbers to 30. Level 3: bridging, to max.
      const op: Op = rng() < 0.5 ? "+" : "-";
      const ab = drawTwoOne(rng, config.max, op, difficulty > 1, 3, difficulty === 2 ? 30 : config.max);
      if (!ab) return null;
      const { a, b } = ab;
      const r = evalOp(a, op, b);
      const other: Op = op === "+" ? "-" : "+";
      const off = pickOne(rng, [1, -1]);
      const swappedOp: Eq = { x: a, op: other, y: b, z: evalOp(a, other, b) };
      const offResult: Eq = { x: a, op, y: b, z: r + off };
      const b2 = b + off >= 1 && b + off <= 9 ? b + off : b - off;
      const wrongNumber: Eq = { x: a, op, y: b2, z: evalOp(a, op, b2) };
      const farResult: Eq = { x: a, op, y: b, z: r + 10 };
      const distractors = difficulty === 1 ? [swappedOp, farResult] : [swappedOp, offResult, wrongNumber];
      const correct: Eq = { x: a, op, y: b, z: r };
      const options = shuffle(rng, [correct, ...distractors]).map((e, i) => ({ id: `e${i}`, ...e }));
      const params = { person: randInt(rng, 0, PEOPLE.length - 1), thing: randInt(rng, 0, THINGS.length - 1), variant: randInt(rng, 0, 2), op, a, b, options };
      return makeItem(this, seed, difficulty, {
        params,
        prompt: `${storyText(params)} أي جملة عددية تناسب القصة؟`,
        visual: { type: "none" },
        input: { type: "choice", options: options.map((o) => ({ id: o.id, label: eqLabel(o) })) },
      });
    });
  },
  solution(item) {
    return item.params.options.find((o) => storyMatches(item.params, o))?.id ?? null;
  },
  check(item, answer) {
    const expected = this.solution(item);
    const e = item.params.options.find((o) => o.id === answer);
    if (!e) return wrong(expected, answer, "input_invalid");
    if (storyMatches(item.params, e)) return ok();
    const p = item.params;
    let type: ErrorType = "other";
    if (e.op !== p.op) type = "operation_confusion";
    else if (e.x === p.a && e.y === p.b) type = numberError(evalOp(p.a, p.op, p.b), e.z);
    return wrong(expected, answer, type);
  },
  explain(item) {
    const { op, a, b } = item.params;
    const r = evalOp(a, op, b);
    return [op === "+" ? `في القصة زاد العدد، فنجمع.` : `في القصة نقص العدد، فنطرح.`, `نبدأ بالعدد ${a}، ثم ${op === "+" ? "نضيف" : "نأخذ"} ${b}.`, eqLabel({ x: a, op, y: b, z: r })];
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    const { a, b, op } = item.params;
    if (a < 11 || b < 3 || b > 9 || evalOp(a, op, b) < 1) p.push("numbers outside the story grammar range");
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, StoryParams>, item)];
  },
};

/* loop-next --------------------------------------------------------- */

export interface LoopNextParams {
  have: number;
  a: number;
  b: number;
  values: number[];
}

export const loopNext: QuizMechanic<TwoOneConfig, LoopNextParams> = {
  id: "GEN-LOOP-NEXT",
  version: 1,
  mechanicId: "loop-next",
  difficulties: [1, 2, 3],
  validateConfig: twoOneProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const ab = drawTwoOne(rng, config.max, "+", difficulty > 1);
      if (!ab) return null;
      const { a, b } = ab;
      const s = a + b;
      const have = randInt(rng, 11, config.max);
      if (have === s) return null;
      // Level 1: far cards. Level 2: one away and ten away. Level 3: one away, forgot the carry, swapped digits.
      const swap = reverseDigits(s);
      const pool =
        difficulty === 1
          ? [s + 10, s - 10, have]
          : difficulty === 2
            ? [s + 1, s - 1, s + 10]
            : [s - 10, s + 1, ...(swap !== null ? [swap] : []), s - 1];
      const distractors = shuffle(
        rng,
        pool.filter((v) => v >= 1 && v <= 99 && v !== s),
      );
      const options = numberOptions(rng, s, distractors, difficulty === 1 ? 3 : 4).map((o) => ({ id: o.id, label: `أنا ${o.label}` }));
      if (options.length < 3) return null;
      return makeItem(this, seed, difficulty, {
        params: { have, a, b, values: options.map((o) => optionValue(o.id)!) },
        prompt: `البطاقة تسأل: من هو ${a} + ${b}؟ اختر البطاقة التالية في الحلقة.`,
        visual: { type: "loopCard", have, a, b },
        input: { type: "choice", options },
      });
    });
  },
  solution(item) {
    return `n${item.params.a + item.params.b}`;
  },
  check(item, answer) {
    const s = item.params.a + item.params.b;
    const v = optionValue(answer);
    if (v === null || !item.params.values.includes(v)) return wrong(`n${s}`, answer, "input_invalid");
    return v === s ? ok() : wrong(`n${s}`, answer, numberError(s, v, { [item.params.have]: "other" }));
  },
  explain(item) {
    const { a, b } = item.params;
    const s = a + b;
    return [`نحسب السؤال في أسفل البطاقة: ${a} + ${b} = ${s}`, `البطاقة التالية تبدأ بالناتج: «أنا ${s}».`];
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, LoopNextParams>, item)];
  },
};

/* add-2d1d ---------------------------------------------------------- */

export interface Add2d1dParams {
  a: number;
  b: number;
  /** Level 3 writes the one-digit number first (7 + 46). */
  oneDigitFirst: boolean;
}

export const add2d1d: QuizMechanic<TwoOneConfig, Add2d1dParams> = {
  id: "GEN-ADD-2D1D",
  version: 1,
  mechanicId: "add-2d1d",
  difficulties: [1, 2, 3],
  validateConfig: twoOneProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const ab = drawTwoOne(rng, config.max, "+", difficulty > 1);
      if (!ab) return null;
      const { a, b } = ab;
      const oneDigitFirst = difficulty === 3;
      const [x, y] = oneDigitFirst ? [b, a] : [a, b];
      return makeItem(this, seed, difficulty, {
        params: { a, b, oneDigitFirst },
        prompt: `من هو ${x} + ${y}؟`,
        visual: { type: "sentenceCard", x, op: "+", y, z: null },
        input: { type: "number", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return item.params.a + item.params.b;
  },
  check(item, answer) {
    const { a, b } = item.params;
    const s = a + b;
    if (answer === s) return ok();
    // 46 + 7 = 43: added the ones but forgot to carry the new ten.
    const extra: Record<number, ErrorType> = { [a - b]: "operation_confusion" };
    if (bridges(a, b)) extra[s - 10] = "place_value_error";
    return wrong(s, answer, numberError(s, answer, extra));
  },
  explain(item) {
    const { a, b } = item.params;
    const s = a + b;
    if (!bridges(a, b)) return [`نبدأ بالعدد الأكبر ${a}.`, `نجمع الآحاد: ${a % 10} + ${b} = ${(a % 10) + b}`, `${a} + ${b} = ${s}`];
    const toTen = 10 - (a % 10);
    const next = a + toTen;
    if (toTen === b) return [`نبدأ بالعدد الأكبر ${a}.`, `${a % 10} + ${b} = 10، فنصل إلى العشرة التالية.`, `${a} + ${b} = ${s}`];
    return [`نبدأ بالعدد الأكبر ${a} ونكمل إلى العشرة التالية: ${a} + ${toTen} = ${next}`, `نضيف الباقي: ${next} + ${b - toTen} = ${s}`, `إذن ${a} + ${b} = ${s}`];
  },
  checkIntegrity(item) {
    const { a, b } = item.params;
    return a >= 10 && a <= 99 && b >= 1 && b <= 9 && item.input.type === "number" ? [] : ["need a two-digit and a one-digit number"];
  },
};

/* ------------------------------------------------------------------ */
/* difference-rows and difference-sentence (p.39)                       */
/* ------------------------------------------------------------------ */

export type RowKind = "star" | "face" | "car" | "fish" | "button" | "heart";
export interface DifferenceConfig {
  max: number;
}
export interface DifferenceRowsParams {
  top: number;
  bottom: number;
  kind: RowKind;
}
export interface DifferenceSentenceParams extends DifferenceRowsParams {
  options: Array<Eq & { id: string }>;
}

function drawRows(rng: Rng, difficulty: 1 | 2 | 3, max: number): { top: number; bottom: number; kind: RowKind } | null {
  // Like the book: 9/4, 10/6, 8/5, 13/9, 18/12. Level 1: to 10, difference to 4.
  // Level 2: to 15, difference 2-6. Level 3: to max, difference 3-9.
  const [tMin, tMax, dMin, dMax] = byLevel(difficulty, [
    [4, Math.min(10, max), 1, 4],
    [6, Math.min(15, max), 2, 6],
    [10, max, 3, 9],
  ] as const);
  const top = randInt(rng, tMin, tMax);
  const d = randInt(rng, dMin, dMax);
  const bottom = top - d;
  if (bottom < 1) return null;
  return { top, bottom, kind: pickOne<RowKind>(rng, ["star", "face", "car", "fish", "button", "heart"]) };
}

const diffProblems = (c: DifferenceConfig) => (isWholeNumber(c.max) && c.max >= 12 && c.max <= 30 ? [] : ["max must be 12..30"]);

export const differenceRows: QuizMechanic<DifferenceConfig, DifferenceRowsParams> = {
  id: "GEN-DIFFERENCE-ROWS",
  version: 1,
  mechanicId: "difference-rows",
  difficulties: [1, 2, 3],
  validateConfig: diffProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const rows = drawRows(rng, difficulty, config.max);
      if (!rows) return null;
      return makeItem(this, seed, difficulty, {
        params: rows,
        prompt: "كم الفرق بين الصفين؟",
        visual: { type: "differenceRows", ...rows },
        input: { type: "number", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return item.params.top - item.params.bottom;
  },
  check(item, answer) {
    const { top, bottom } = item.params;
    const d = top - bottom;
    if (answer === d) return ok();
    return wrong(d, answer, numberError(d, answer, { [top + bottom]: "operation_confusion", [top]: "partial_answer", [bottom]: "partial_answer" }));
  },
  explain(item) {
    const { top, bottom } = item.params;
    return [`في الصف الأول ${top} وفي الصف الثاني ${bottom}.`, "نرسم خطًا عند آخر الصف الأقصر ونعدّ ما بعده في الصف الأطول.", `${top} ${MINUS} ${bottom} = ${top - bottom}`];
  },
  checkIntegrity(item) {
    const { top, bottom } = item.params;
    return top > bottom && bottom >= 1 && item.input.type === "number" ? [] : ["top row must be longer"];
  },
};

const diffMatches = (p: DifferenceRowsParams, e: Eq) => e.op === "-" && e.x === p.top && e.y === p.bottom && e.z === p.top - p.bottom;

export const differenceSentence: QuizMechanic<DifferenceConfig, DifferenceSentenceParams> = {
  id: "GEN-DIFFERENCE-SENTENCE",
  version: 1,
  mechanicId: "difference-sentence",
  difficulties: [1, 2, 3],
  validateConfig: diffProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const rows = drawRows(rng, difficulty, config.max);
      if (!rows) return null;
      const { top, bottom } = rows;
      const d = top - bottom;
      const off = pickOne(rng, [1, -1]);
      // Distractors: smaller number first, adding instead of subtracting, a miscounted difference.
      const pool: Eq[] = [
        { x: bottom, op: "-", y: top, z: d },
        { x: top, op: "+", y: bottom, z: top + bottom },
        { x: top, op: "-", y: bottom, z: d + off === 0 ? d + 1 : d + off },
      ];
      const distractors = difficulty === 1 ? shuffle(rng, pool).slice(0, 2) : pool;
      const options = shuffle(rng, [{ x: top, op: "-" as const, y: bottom, z: d }, ...distractors]).map((e, i) => ({ id: `e${i}`, ...e }));
      return makeItem(this, seed, difficulty, {
        params: { ...rows, options },
        prompt: "أي جملة عددية تبيّن الفرق بين الصفين؟",
        visual: { type: "differenceRows", ...rows },
        input: { type: "choice", options: options.map((o) => ({ id: o.id, label: eqLabel(o) })) },
      });
    });
  },
  solution(item) {
    return item.params.options.find((o) => diffMatches(item.params, o))?.id ?? null;
  },
  check(item, answer) {
    const expected = this.solution(item);
    const e = item.params.options.find((o) => o.id === answer);
    if (!e) return wrong(expected, answer, "input_invalid");
    if (diffMatches(item.params, e)) return ok();
    const { top, bottom } = item.params;
    const type: ErrorType = e.op === "+" ? "operation_confusion" : e.x === bottom && e.y === top ? "comparison_direction" : e.x === top && e.y === bottom ? "off_by_one" : "other";
    return wrong(expected, answer, type);
  },
  explain(item) {
    const { top, bottom } = item.params;
    return [`نبدأ بالعدد الأكبر ${top}.`, `الأكبر ${MINUS} الأصغر = الفرق`, `${top} ${MINUS} ${bottom} = ${top - bottom}`];
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, DifferenceSentenceParams>, item)];
  },
};

export const OPERATION_MECHANICS = [addMany, equivalence, balance, inverseSentence, storySentence, loopNext, add2d1d, differenceRows, differenceSentence] as const;
