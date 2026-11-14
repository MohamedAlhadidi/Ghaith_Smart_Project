/**
 * Place value, comparing and ordering (MATH-S1 L23/L24 ordering results, L28 tens and ones,
 * L29 greater than / less than).
 */
import type { ErrorType } from "../types";
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
import { numberError, pickOne, reverseDigits, tensWord } from "./A_common";

/* ------------------------------------------------------------------ */
/* place-value-build: one tens card + one ones card                     */
/* ------------------------------------------------------------------ */

export interface PlaceValueBuildConfig {
  tensCards: number[];
  onesCards: number[];
}
export interface PvCard {
  id: string;
  value: number;
  kind: "tens" | "ones";
}
export interface PlaceValueBuildParams {
  target: number;
  cards: PvCard[];
}

export const placeValueBuild: QuizMechanic<PlaceValueBuildConfig, PlaceValueBuildParams> = {
  id: "GEN-PLACE-VALUE-BUILD",
  version: 1,
  mechanicId: "place-value-build",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!Array.isArray(c.tensCards) || c.tensCards.length < 3 || c.tensCards.some((t) => !isWholeNumber(t) || t % 10 !== 0 || t < 10 || t > 90)) p.push("tensCards: at least 3 of 10..90");
    if (!Array.isArray(c.onesCards) || c.onesCards.length < 3 || c.onesCards.some((o) => !isWholeNumber(o) || o < 1 || o > 9)) p.push("onesCards: at least 3 of 1..9");
    return p;
  },
  generate(seed, difficulty, config) {
    const perKind = byLevel(difficulty, [2, 3, 3] as const);
    return sample(seed, (rng) => {
      const tens = pickOne(rng, config.tensCards);
      const ones = pickOne(rng, config.onesCards);
      const t = tens / 10;
      if (difficulty === 3 && t === ones) return null;
      // Level 3 always offers the digit-swapped cards (37: 70 and 3).
      const tensPool = [tens, ...(difficulty === 3 && config.tensCards.includes(ones * 10) ? [ones * 10] : []), ...shuffle(rng, config.tensCards)];
      const onesPool = [ones, ...(difficulty === 3 && config.onesCards.includes(t) ? [t] : []), ...shuffle(rng, config.onesCards)];
      const tensVals = [...new Set(tensPool)].slice(0, perKind);
      const onesVals = [...new Set(onesPool)].slice(0, perKind);
      if (tensVals.length < 2 || onesVals.length < 2) return null;
      const cards = shuffle(rng, [
        ...tensVals.map((v) => ({ id: `t${v}`, value: v, kind: "tens" as const })),
        ...onesVals.map((v) => ({ id: `o${v}`, value: v, kind: "ones" as const })),
      ]);
      const target = tens + ones;
      return makeItem(this, seed, difficulty, {
        params: { target, cards },
        prompt: `ركّب العدد ${target}: اختر بطاقة العشرات وبطاقة الآحاد.`,
        visual: { type: "none" },
        input: { type: "multi", exactly: 2, options: cards.map((c) => ({ id: c.id, label: String(c.value) })) },
      });
    });
  },
  solution(item) {
    const { target, cards } = item.params;
    const t = cards.find((c) => c.kind === "tens" && c.value === Math.floor(target / 10) * 10);
    const o = cards.find((c) => c.kind === "ones" && c.value === target % 10);
    return t && o ? [t.id, o.id] : [];
  },
  check(item, answer) {
    const { target, cards } = item.params;
    const expected = this.solution(item);
    const ids = asStringArray(answer);
    if (!ids || ids.length !== 2 || ids[0] === ids[1]) return wrong(expected, answer, "input_invalid");
    const picked = ids.map((id) => cards.find((c) => c.id === id));
    if (picked.some((c) => !c)) return wrong(expected, answer, "input_invalid");
    const a = picked[0]!;
    const b = picked[1]!;
    if (a.kind !== b.kind) {
      if (a.value + b.value === target) return ok();
      const tc = a.kind === "tens" ? a : b;
      const oc = a.kind === "tens" ? b : a;
      const swapped = oc.value * 10 + tc.value / 10;
      return wrong(expected, answer, swapped === target ? "tens_ones_confusion" : "other");
    }
    return wrong(expected, answer, "place_value_error");
  },
  explain(item) {
    const { target } = item.params;
    const t = Math.floor(target / 10);
    const o = target % 10;
    return [`${target} فيه ${tensWord(t)}، ورقم آحاده ${o}.`, `بطاقة العشرات ${t * 10} وبطاقة الآحاد ${o}.`, `${t * 10} + ${o} = ${target}`];
  },
  checkIntegrity(item) {
    const { target, cards } = item.params;
    const p = item.input.type === "multi" ? optionProblems(item.input.options) : ["expects multi input"];
    if (target < 11 || target > 99 || target % 10 === 0) p.push("target must be 11..99, not a multiple of 10");
    if ((this.solution(item) as string[]).length !== 2) p.push("target cannot be built");
    if (!cards.some((c) => c.kind === "tens" && c.value !== Math.floor(target / 10) * 10)) p.push("needs a distractor tens card");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* tens-count: how many tens in n                                       */
/* ------------------------------------------------------------------ */

export interface TensCountConfig {
  max: number;
}
export interface TensCountParams {
  n: number;
}

export const tensCount: QuizMechanic<TensCountConfig, TensCountParams> = {
  id: "GEN-TENS-COUNT",
  version: 1,
  mechanicId: "tens-count",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.max) && c.max >= 20 && c.max <= 100 ? [] : ["max must be 20..100"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1: tens and ones drawn as rods and cubes. Level 2: a two-digit number only.
      // Level 3: also 100 (= 10 tens) when the lesson goes to 100.
      let n: number;
      if (difficulty === 3 && config.max >= 100 && rng() < 0.25) n = 100;
      else n = randInt(rng, 11, Math.min(99, config.max));
      if (n % 10 === 0 && n !== 100 && difficulty > 1) return null;
      return makeItem(this, seed, difficulty, {
        params: { n },
        prompt: `كم عشرة في العدد ${n}؟`,
        visual: difficulty === 1 ? { type: "baseTenBlocks", tens: Math.floor(n / 10), ones: n % 10 } : { type: "none" },
        input: { type: "number", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return Math.floor(item.params.n / 10);
  },
  check(item, answer) {
    const { n } = item.params;
    const t = Math.floor(n / 10);
    if (answer === t) return ok();
    const extra: Record<number, ErrorType> = { [n]: "place_value_error", [t * 10]: "place_value_error" };
    if (n % 10 !== t && n < 100) extra[n % 10] = "tens_ones_confusion";
    return wrong(t, answer, numberError(t, answer, extra));
  },
  explain(item) {
    const { n } = item.params;
    if (n === 100) return ["نعدّ بالعشرات: 10، 20، 30، ...، 100.", "عددنا 10 مرات.", "إذن في 100 عشر عشرات."];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return [`${n} = ${t * 10} + ${o}`, `${t * 10} فيها ${tensWord(t)}.`, o === 0 ? `إذن في ${n} ${tensWord(t)}. الجواب ${t}.` : `إذن في ${n} ${tensWord(t)} ورقم الآحاد ${o}. الجواب ${t}.`];
  },
  checkIntegrity(item) {
    const { n } = item.params;
    return n >= 10 && n <= 100 && item.input.type === "number" ? [] : ["n out of range"];
  },
};

/* ------------------------------------------------------------------ */
/* order-values                                                          */
/* ------------------------------------------------------------------ */

export interface OrderValuesConfig {
  count: number;
  min: number;
  max: number;
  direction: "asc" | "desc";
}
export interface OrderValuesParams {
  /** Values in the order they are shown (ids v0, v1, ...). */
  values: number[];
  direction: "asc" | "desc";
}

const isSorted = (vals: number[], dir: "asc" | "desc") => vals.every((v, i) => i === 0 || (dir === "asc" ? vals[i - 1]! < v : vals[i - 1]! > v));

export const orderValues: QuizMechanic<OrderValuesConfig, OrderValuesParams> = {
  id: "GEN-ORDER-VALUES",
  version: 1,
  mechanicId: "order-values",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!isWholeNumber(c.count) || c.count < 3 || c.count > 6) p.push("count 3..6");
    if (!isWholeNumber(c.min) || !isWholeNumber(c.max) || c.min < 0 || c.max > 999 || c.max - c.min < 3 * c.count) p.push("range too small");
    if (c.direction !== "asc" && c.direction !== "desc") p.push("direction asc|desc");
    return p;
  },
  generate(seed, difficulty, config) {
    const { count, min, max, direction } = config;
    return sample(seed, (rng) => {
      const values = new Set<number>();
      const tensOf = (v: number) => Math.floor(v / 10);
      if (difficulty === 1) {
        // Different tens digits so comparing the tens is enough.
        const decades = shuffle(
          rng,
          Array.from({ length: tensOf(max) - tensOf(min) + 1 }, (_, i) => tensOf(min) + i),
        );
        for (const d of decades) {
          if (values.size >= count) break;
          const v = randInt(rng, Math.max(min, d * 10), Math.min(max, d * 10 + 9));
          values.add(v);
        }
        // Narrow ranges with fewer decades than values: fill the rest at random.
        let fill = 0;
        while (values.size < count && fill++ < 100) values.add(randInt(rng, min, max));
      } else {
        // Level 2: at least two values share their tens. Level 3: also a digit-swap pair (37 / 73) or neighbours.
        const a = randInt(rng, min, max);
        values.add(a);
        const sameTens = randInt(rng, Math.max(min, tensOf(a) * 10), Math.min(max, tensOf(a) * 10 + 9));
        values.add(sameTens);
        if (difficulty === 3) {
          const swap = reverseDigits(a);
          if (swap !== null && swap >= min && swap <= max) values.add(swap);
          else if (a + 1 <= max) values.add(a + 1);
        }
        let guard = 0;
        while (values.size < count && guard++ < 100) values.add(randInt(rng, min, max));
      }
      const list = shuffle(rng, [...values]);
      if (list.length !== count) return null;
      if (difficulty > 1 && new Set(list.map(tensOf)).size === count) return null;
      if (isSorted(list, "asc") || isSorted(list, "desc")) return null;
      return makeItem(this, seed, difficulty, {
        params: { values: list, direction },
        prompt: direction === "asc" ? "رتّب الأعداد من الأصغر إلى الأكبر." : "رتّب الأعداد من الأكبر إلى الأصغر.",
        visual: { type: "none" },
        input: { type: "order", items: list.map((v, i) => ({ id: `v${i}`, label: String(v) })) },
      });
    });
  },
  solution(item) {
    const { values, direction } = item.params;
    return values
      .map((v, i) => ({ v, id: `v${i}` }))
      .sort((p, q) => (direction === "asc" ? p.v - q.v : q.v - p.v))
      .map((x) => x.id);
  },
  check(item, answer) {
    const { values, direction } = item.params;
    const expected = this.solution(item);
    const ids = asStringArray(answer);
    if (!ids || ids.length !== values.length || new Set(ids).size !== ids.length) return wrong(expected, answer, "input_invalid");
    const vals = ids.map((id) => (/^v\d+$/.test(id) ? values[Number(id.slice(1))] : undefined));
    if (vals.some((v) => v === undefined)) return wrong(expected, answer, "input_invalid");
    const nums = vals as number[];
    if (isSorted(nums, direction)) return ok();
    if (isSorted(nums, direction === "asc" ? "desc" : "asc")) return wrong(expected, answer, "comparison_direction");
    const byOnes = [...nums].map((v) => v % 10);
    const onesSorted = byOnes.every((v, i) => i === 0 || (direction === "asc" ? byOnes[i - 1]! <= v : byOnes[i - 1]! >= v));
    return wrong(expected, answer, onesSorted ? "tens_ones_confusion" : "other");
  },
  explain(item) {
    const { values, direction } = item.params;
    const sorted = [...values].sort((a, b) => (direction === "asc" ? a - b : b - a));
    const sign = direction === "asc" ? " < " : " > ";
    return ["نقارن العشرات أولًا.", "إذا تساوت العشرات نقارن الآحاد.", sorted.join(sign)];
  },
  checkIntegrity(item) {
    const { values } = item.params;
    const p = item.input.type === "order" ? optionProblems(item.input.items) : ["expects order input"];
    if (new Set(values).size !== values.length) p.push("values must be distinct");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* compare-sign: < > =                                                  */
/* ------------------------------------------------------------------ */

export interface CompareSignConfig {
  min: number;
  max: number;
}
export interface CompareSignParams {
  a: number;
  b: number;
}

export type Relation = "lt" | "gt" | "eq";
export const relationOf = (a: number, b: number): Relation => (a < b ? "lt" : a > b ? "gt" : "eq");
export const RELATION_SIGN: Record<Relation, string> = { lt: "<", gt: ">", eq: "=" };

export const compareSign: QuizMechanic<CompareSignConfig, CompareSignParams> = {
  id: "GEN-COMPARE-SIGN",
  version: 1,
  mechanicId: "compare-sign",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.min) && isWholeNumber(c.max) && c.min >= 0 && c.max <= 999 && c.max - c.min >= 20 ? [] : ["need 0 <= min, max <= 999, max - min >= 20"];
  },
  generate(seed, difficulty, config) {
    const { min, max } = config;
    return sample(seed, (rng) => {
      const a = randInt(rng, min, max);
      let b: number;
      const tens = Math.floor(a / 10);
      if (difficulty === 1) {
        // Different tens, at least 10 apart.
        b = randInt(rng, min, max);
        if (Math.floor(b / 10) === tens || Math.abs(a - b) < 10 || reverseDigits(a) === b) return null;
      } else if (difficulty === 2) {
        // Same tens (compare the ones) or swapped digits (34 / 43).
        const swap = reverseDigits(a);
        b = swap !== null && swap >= min && swap <= max && rng() < 0.4 ? swap : randInt(rng, Math.max(min, tens * 10), Math.min(max, tens * 10 + 9));
        if (b === a) return null;
      } else {
        // A quarter of the items are equal; the rest are within 3.
        b = rng() < 0.25 ? a : a + pickOne(rng, [-3, -2, -1, 1, 2, 3]);
        if (b < min || b > max) return null;
      }
      return makeItem(this, seed, difficulty, {
        params: { a, b },
        prompt: `اختر الرمز المناسب: ${a} ؟ ${b}`,
        visual: { type: "compareSentence", a, b },
        input: {
          type: "choice",
          options: (["lt", "gt", "eq"] as const).map((r) => ({ id: r, label: RELATION_SIGN[r] })),
        },
      });
    });
  },
  solution(item) {
    return relationOf(item.params.a, item.params.b);
  },
  check(item, answer) {
    const rel = relationOf(item.params.a, item.params.b);
    if (answer !== "lt" && answer !== "gt" && answer !== "eq") return wrong(rel, answer, "input_invalid");
    if (answer === rel) return ok();
    return wrong(rel, answer, rel !== "eq" && answer !== "eq" ? "comparison_direction" : "other");
  },
  explain(item) {
    const { a, b } = item.params;
    const rel = relationOf(a, b);
    const ta = Math.floor(a / 10);
    const tb = Math.floor(b / 10);
    const steps = [`نقارن العشرات: ${ta} و ${tb}.`];
    if (ta === tb) steps.push(`العشرات متساوية، فنقارن الآحاد: ${a % 10} و ${b % 10}.`);
    steps.push(`${a} ${RELATION_SIGN[rel]} ${b}`);
    if (rel !== "eq") steps.push("الفتحة الكبيرة للرمز تتجه نحو العدد الأكبر.");
    return steps;
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, CompareSignParams>, item)];
  },
};

/* ------------------------------------------------------------------ */
/* digit-sentence: AB < CD from four digit cards (p.32)                 */
/* ------------------------------------------------------------------ */

export interface DigitSentenceConfig {
  digits: number;
}
export interface DigitCard {
  id: string;
  digit: number;
}
export interface DigitSentenceParams {
  cards: DigitCard[];
  sign: "<" | ">";
}

function sentenceTrue(d: number[], sign: "<" | ">"): boolean {
  if (d[0] === 0 || d[2] === 0) return false;
  const left = d[0]! * 10 + d[1]!;
  const right = d[2]! * 10 + d[3]!;
  return sign === "<" ? left < right : left > right;
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

function firstSolution(p: DigitSentenceParams): string[] | null {
  for (const perm of permutations(p.cards)) if (sentenceTrue(perm.map((c) => c.digit), p.sign)) return perm.map((c) => c.id);
  return null;
}

export const digitSentence: QuizMechanic<DigitSentenceConfig, DigitSentenceParams> = {
  id: "GEN-DIGIT-SENTENCE",
  version: 1,
  mechanicId: "digit-sentence",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return c.digits === 4 ? [] : ["digits must be 4 (two two-digit numbers)"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1: four different digits 1-9. Level 2: a repeated digit allowed (the book's cards repeat 7 and 8).
      // Level 3: a 0 card may appear; it can only be a ones digit.
      const lo = difficulty === 3 ? 0 : 1;
      const digits = Array.from({ length: config.digits }, () => randInt(rng, lo, 9));
      if (difficulty === 1 && new Set(digits).size !== digits.length) return null;
      if (difficulty === 2 && new Set(digits).size < digits.length - 1) return null;
      if (digits.filter((d) => d === 0).length > 1) return null;
      const sign = rng() < 0.5 ? "<" : ">";
      const cards = digits.map((d, i) => ({ id: `d${i}`, digit: d }));
      const params = { cards, sign } as DigitSentenceParams;
      if (!firstSolution(params)) return null;
      // The cards as dealt must not already read as a true sentence.
      if (sentenceTrue(digits, sign)) return null;
      return makeItem(this, seed, difficulty, {
        params,
        prompt: `ضع البطاقات في المربعات لتصبح الجملة صحيحة: عدد من رقمين ${sign} عدد من رقمين.`,
        visual: { type: "digitSentence", cards, sign },
        input: { type: "visual" },
      });
    });
  },
  solution(item) {
    return firstSolution(item.params);
  },
  check(item, answer) {
    const { cards, sign } = item.params;
    const expected = firstSolution(item.params);
    const ids = asStringArray(answer);
    if (!ids || ids.length !== cards.length || new Set(ids).size !== ids.length) return wrong(expected, answer, "input_invalid");
    const placed = ids.map((id) => cards.find((c) => c.id === id));
    if (placed.some((c) => !c)) return wrong(expected, answer, "input_invalid");
    const d = (placed as DigitCard[]).map((c) => c.digit);
    if (d[0] === 0 || d[2] === 0) return wrong(expected, answer, "place_value_error");
    if (sentenceTrue(d, sign)) return ok();
    const left = d[0]! * 10 + d[1]!;
    const right = d[2]! * 10 + d[3]!;
    return wrong(expected, answer, left !== right ? "comparison_direction" : "other");
  },
  explain(item) {
    const { cards, sign } = item.params;
    const sol = firstSolution(item.params)!;
    const d = sol.map((id) => cards.find((c) => c.id === id)!.digit);
    return [
      `نكوّن عددين من رقمين بالبطاقات ${cards.map((c) => c.digit).join("، ")}.`,
      sign === "<" ? "نضع العدد الأصغر أولًا." : "نضع العدد الأكبر أولًا.",
      `مثلًا: ${d[0]}${d[1]} ${sign} ${d[2]}${d[3]}`,
      "توجد جمل صحيحة أخرى أيضًا. الفتحة الكبيرة للرمز تتجه نحو العدد الأكبر.",
    ];
  },
  checkIntegrity(item) {
    const p: string[] = [];
    if (item.params.cards.length !== 4) p.push("needs four cards");
    if (!firstSolution(item.params)) p.push("no true sentence possible");
    if (item.input.type !== "visual") p.push("expects visual input");
    return p;
  },
};

export const PLACE_VALUE_MECHANICS = [placeValueBuild, tensCount, orderValues, compareSign, digitSentence] as const;
