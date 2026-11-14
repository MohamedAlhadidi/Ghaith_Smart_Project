/**
 * Number sense to 100/120 (MATH-S1 L02 decades, L03/L30 counting, L04 ranges,
 * L07 number line, L08 rounding, L30 estimation).
 */
import type { Difficulty, ErrorType } from "../types";
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
import { levelRange, minGap, multiProblems, numberError, pickOne, reverseDigits, roundTen, scatter, scatterGap, SCATTER_H, SCATTER_W } from "./A_common";

/* ------------------------------------------------------------------ */
/* tens-bounds: the two multiples of 10 around a number                 */
/* ------------------------------------------------------------------ */

export interface TensBoundsConfig {
  min: number;
  max: number;
}
export interface TensBoundsParams {
  n: number;
  /** Lower bounds of the decades offered. */
  lowers: number[];
}

const boundsLabel = (lo: number) => `${lo} و ${lo + 10}`;

export const tensBounds: QuizMechanic<TensBoundsConfig, TensBoundsParams> = {
  id: "GEN-TENS-BOUNDS",
  version: 1,
  mechanicId: "tens-bounds",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!isWholeNumber(c.min) || !isWholeNumber(c.max) || c.min < 1 || c.max > 119 || c.max - c.min < 10) p.push("need 1 <= min, max <= 119, max - min >= 10");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1: numbers below 60, far decades as distractors. Level 2: up to 99 with the
      // neighbouring decades. Level 3: the whole range (to 119) plus the digit-swap decade.
      const hi = byLevel(difficulty, [Math.min(config.max, 59), Math.min(config.max, 99), config.max] as const);
      const n = randInt(rng, config.min, Math.max(config.min, hi));
      if (n % 10 === 0) return null;
      const lo = Math.floor(n / 10) * 10;
      const valid = (d: number) => d >= 0 && d + 10 <= 120 && d !== lo;
      let distractors: number[];
      if (difficulty === 1) {
        distractors = shuffle(
          rng,
          Array.from({ length: 12 }, (_, i) => i * 10).filter((d) => valid(d) && Math.abs(d - lo) >= 20),
        ).slice(0, 2);
      } else {
        const near = [lo - 10, lo + 10].filter(valid);
        const swap = reverseDigits(n);
        const extra = difficulty === 3 && swap !== null ? [Math.floor(swap / 10) * 10] : [];
        const far = shuffle(
          rng,
          Array.from({ length: 12 }, (_, i) => i * 10).filter((d) => valid(d) && Math.abs(d - lo) >= 20),
        );
        distractors = [...new Set([...near, ...extra.filter(valid), ...far])].slice(0, 3);
      }
      const lowers = shuffle(rng, [lo, ...distractors]);
      if (lowers.length < 3) return null;
      return makeItem(this, seed, difficulty, {
        params: { n, lowers },
        prompt: `بين أي عددين عقديين يقع العدد ${n}؟`,
        visual: { type: "none" },
        input: { type: "choice", options: lowers.map((l) => ({ id: `b${l}`, label: boundsLabel(l) })) },
      });
    });
  },
  solution(item) {
    return `b${Math.floor(item.params.n / 10) * 10}`;
  },
  check(item, answer) {
    const { n, lowers } = item.params;
    const lo = Math.floor(n / 10) * 10;
    const expected = `b${lo}`;
    const m = typeof answer === "string" ? /^b(\d+)$/.exec(answer) : null;
    const given = m ? Number(m[1]) : null;
    if (given === null || !lowers.includes(given)) return wrong(expected, answer, "input_invalid");
    if (given === lo) return ok();
    const swap = reverseDigits(n);
    const type: ErrorType =
      Math.abs(given - lo) === 10 ? "place_value_error" : swap !== null && given === Math.floor(swap / 10) * 10 ? "tens_ones_confusion" : "other";
    return wrong(expected, answer, type);
  },
  explain(item) {
    const { n } = item.params;
    const lo = Math.floor(n / 10) * 10;
    return [`العدد العقدي ينتهي بصفر.`, `قبل ${n} يأتي العدد العقدي ${lo}، وبعده ${lo + 10}.`, `${lo} < ${n} < ${lo + 10}`];
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    if (item.params.n % 10 === 0) p.push("n must not be a multiple of 10");
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, TensBoundsParams>, item)];
  },
};

/* ------------------------------------------------------------------ */
/* decade-fill: one blank in a decade strip 10a .. 10a+10               */
/* ------------------------------------------------------------------ */

export interface DecadeConfig {
  maxTens: number;
}
export interface DecadeFillParams {
  tens: number;
  /** Position of the blank in the strip (0..10). */
  blank: number;
  /** Positions printed on the strip (the others are empty). */
  shown: number[];
}

export const decadeFill: QuizMechanic<DecadeConfig, DecadeFillParams> = {
  id: "GEN-DECADE-FILL",
  version: 1,
  mechanicId: "decade-fill",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.maxTens) && c.maxTens >= 1 && c.maxTens <= 11 ? [] : ["maxTens must be 1..11"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1: every other number shown. Level 2: the blank's neighbours are hidden (the blank may be
      // the closing multiple of 10). Level 3: only the two multiples of 10 at the ends are shown.
      const tens = randInt(rng, difficulty === 1 ? 1 : 0, byLevel(difficulty, [Math.min(5, config.maxTens), Math.min(9, config.maxTens), config.maxTens] as const));
      const blank = difficulty === 2 ? randInt(rng, 1, 10) : randInt(rng, 1, 9);
      const positions = Array.from({ length: 11 }, (_, i) => i);
      const shown =
        difficulty === 1
          ? positions.filter((i) => i !== blank)
          : difficulty === 2
            ? positions.filter((i) => Math.abs(i - blank) >= 2)
            : [0, 10].filter((i) => i !== blank);
      const cells = positions.map((i) => (shown.includes(i) ? tens * 10 + i : null));
      return makeItem(this, seed, difficulty, {
        params: { tens, blank, shown },
        prompt: "اكتب العدد الناقص في شريط العقد.",
        visual: { type: "decadeStrip", cells, blank },
        input: { type: "number", maxDigits: 3 },
      });
    });
  },
  solution(item) {
    return item.params.tens * 10 + item.params.blank;
  },
  check(item, answer) {
    const expected = item.params.tens * 10 + item.params.blank;
    return answer === expected ? ok() : wrong(expected, answer, numberError(expected, answer));
  },
  explain(item) {
    const { tens, blank } = item.params;
    const s = tens * 10;
    const counted = blank <= 4 ? Array.from({ length: blank + 1 }, (_, i) => s + i).join("، ") : `${s}، ${s + 1}، ${s + 2}، ...، ${s + blank}`;
    return [`الشريط يبدأ بالعدد ${s} وينتهي بالعدد ${s + 10}.`, `نعدّ واحدًا واحدًا: ${counted}`, `العدد الناقص ${s + blank}.`];
  },
  checkIntegrity(item) {
    const { tens, blank, shown } = item.params;
    const p: string[] = [];
    if (tens < 0 || tens > 11 || blank < 0 || blank > 10) p.push("out of range");
    if (shown.length === 0 || shown.includes(blank)) p.push("bad shown cells");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* midpoint: the number half-way through a decade                       */
/* ------------------------------------------------------------------ */

export interface MidpointParams {
  tens: number;
  /** "ends": only 10a and 10a+10 shown; "nine": the nine numbers 10a+1..10a+9. */
  mode: "ends" | "nine";
  values: number[];
}

export const midpoint: QuizMechanic<DecadeConfig, MidpointParams> = {
  id: "GEN-MIDPOINT",
  version: 1,
  mechanicId: "midpoint",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.maxTens) && c.maxTens >= 1 && c.maxTens <= 11 ? [] : ["maxTens must be 1..11"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const tens = randInt(rng, difficulty === 1 ? 1 : 0, difficulty === 1 ? Math.min(5, config.maxTens) : config.maxTens);
      const s = tens * 10;
      const mid = s + 5;
      const mode = difficulty === 3 ? "nine" : "ends";
      // Level 1: distractors near the ends of the decade. Level 2/3: one away from the middle.
      const distractors = difficulty === 1 ? [s + 1, s + 9, s + 2, s + 8] : shuffle(rng, [mid - 1, mid + 1, mid + 10 <= 120 ? mid + 10 : mid - 2, mid + 2]);
      const options = numberOptions(rng, mid, difficulty === 1 ? shuffle(rng, distractors) : distractors, difficulty === 1 ? 3 : 4);
      const values = options.map((o) => optionValue(o.id)!);
      return makeItem(this, seed, difficulty, {
        params: { tens, mode, values },
        prompt: mode === "ends" ? `ما العدد الذي يقع في المنتصف بين ${s} و ${s + 10}؟` : "ما العدد الذي يقع في منتصف هذه الأعداد التسعة؟",
        visual: { type: "decadeMidpoint", start: s, end: s + 10, numbers: mode === "nine" ? Array.from({ length: 9 }, (_, i) => s + 1 + i) : null },
        input: { type: "choice", options },
      });
    });
  },
  solution(item) {
    return `n${item.params.tens * 10 + 5}`;
  },
  check(item, answer) {
    const mid = item.params.tens * 10 + 5;
    const v = optionValue(answer);
    if (v === null || !item.params.values.includes(v)) return wrong(`n${mid}`, answer, "input_invalid");
    return v === mid ? ok() : wrong(`n${mid}`, answer, numberError(mid, v));
  },
  explain(item) {
    const s = item.params.tens * 10;
    if (item.params.mode === "nine")
      return [`الأعداد من ${s + 1} إلى ${s + 9}.`, `قبل ${s + 5} أربعة أعداد: ${s + 1}، ${s + 2}، ${s + 3}، ${s + 4}.`, `وبعده أربعة أعداد: ${s + 6}، ${s + 7}، ${s + 8}، ${s + 9}. المنتصف ${s + 5}.`];
    return [`من ${s} إلى ${s + 10} عشر خطوات.`, `نصف العشرة 5: ${s} + 5 = ${s + 5}`, `في كل عقد، المنتصف ينتهي بالرقم 5.`];
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    if (item.params.values.some((v) => v < 0 || v > 120)) p.push("option out of range");
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, MidpointParams>, item)];
  },
};

/* ------------------------------------------------------------------ */
/* count-objects: count a scattered set                                 */
/* ------------------------------------------------------------------ */

export type CountKind = "shell" | "counter" | "marble" | "bead";
const COUNT_NOUN: Record<CountKind, string> = { shell: "صدفةً", counter: "قرصًا", marble: "كرةً زجاجية", bead: "خرزةً" };

export interface CountObjectsConfig {
  min: number;
  max: number;
  groupBy: number[];
}
export interface CountObjectsParams {
  positions: Array<[number, number]>;
  kind: CountKind;
  groupBy: number[];
}

export const countObjects: QuizMechanic<CountObjectsConfig, CountObjectsParams> = {
  id: "GEN-COUNT-OBJECTS",
  version: 1,
  mechanicId: "count-objects",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!isWholeNumber(c.min) || !isWholeNumber(c.max) || c.min < 1 || c.max > 100 || c.min >= c.max) p.push("need 1 <= min < max <= 100");
    if (!Array.isArray(c.groupBy) || c.groupBy.length === 0 || c.groupBy.some((g) => !isWholeNumber(g) || g < 2 || g > 10)) p.push("groupBy 2..10");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const [lo, hi] = levelRange(config.min, config.max, difficulty);
      const n = randInt(rng, lo, hi);
      const kind = pickOne<CountKind>(rng, ["shell", "counter", "marble", "bead"]);
      const positions = scatter(rng, n);
      return makeItem(this, seed, difficulty, {
        params: { positions, kind, groupBy: [...config.groupBy] },
        prompt: `كم ${COUNT_NOUN[kind]} في الصورة؟`,
        visual: { type: "scatterCount", positions, kind, groupBy: [...config.groupBy] },
        input: { type: "number", maxDigits: 3 },
      });
    });
  },
  solution(item) {
    return item.params.positions.length;
  },
  check(item, answer) {
    const n = item.params.positions.length;
    if (answer === n) return ok();
    let type = numberError(n, answer, {}, "counting_error");
    if (type === "other" && isWholeNumber(answer) && Math.abs(answer - n) <= 5) type = "counting_error";
    return wrong(n, answer, type);
  },
  explain(item) {
    const n = item.params.positions.length;
    const g = Math.max(...item.params.groupBy);
    const q = Math.floor(n / g);
    const r = n % g;
    const jumps = q <= 4 ? Array.from({ length: q }, (_, i) => (i + 1) * g).join("، ") : `${g}، ${2 * g}، ...، ${q * g}`;
    return [
      `نرتّب الأشياء في مجموعات من ${g}.`,
      `عدد المجموعات ${q}${r ? ` ويبقى ${r}` : ""}.`,
      `نعدّ بالقفز ${g}: ${jumps}${r ? `، ثم نعدّ الباقي حتى ${n}` : ""}.`,
    ];
  },
  checkIntegrity(item) {
    const { positions } = item.params;
    const p: string[] = [];
    if (positions.length < 1 || positions.length > 100) p.push("count out of range");
    if (positions.some(([x, y]) => x < 0 || x > SCATTER_W || y < 0 || y > SCATTER_H)) p.push("object outside the picture");
    if (positions.length > 1 && minGap(positions) < scatterGap(positions.length)) p.push("objects overlap");
    if (JSON.stringify(item.visual.positions) !== JSON.stringify(positions)) p.push("visual does not match params");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* range-fit: bag labels with exclusive bounds (p.7)                    */
/* ------------------------------------------------------------------ */

export interface Bag {
  id: string;
  lo: number;
  hi: number;
  label: string;
}

/** Labels printed on the bags in the book (all bounds exclusive). */
export const BOOK_BAGS: readonly Bag[] = [
  { id: "r95-100", lo: 95, hi: 100, label: "ما بين 95 و 100" },
  { id: "r60-70", lo: 60, hi: 70, label: "ما بين 60 و 70" },
  { id: "r80-90", lo: 80, hi: 90, label: "ما بين 80 و 90" },
  { id: "r70-80", lo: 70, hi: 80, label: "ما بين 70 و 80" },
  { id: "r40-60", lo: 40, hi: 60, label: "أكثر من 40 وأقل من 60" },
  { id: "r70-80b", lo: 70, hi: 80, label: "أقل من 80 وأكثر من 70" },
  { id: "r50-70", lo: 50, hi: 70, label: "ما بين 50 و 70" },
];

const inBag = (b: Pick<Bag, "lo" | "hi">, n: number) => n > b.lo && n < b.hi;
const overlap = (a: Bag, b: Bag) => a.lo < b.hi && b.lo < a.hi;

export interface RangeFitConfig {
  mode: "which-bag" | "select-numbers";
}
export type RangeFitParams = { mode: "which-bag"; n: number; bags: Bag[] } | { mode: "select-numbers"; bag: Bag; values: number[] };

function pickBags(rng: Rng, count: number, adjacent: boolean): Bag[] | null {
  const chosen: Bag[] = [];
  for (const b of shuffle(rng, BOOK_BAGS)) {
    if (chosen.length >= count) break;
    if (chosen.some((c) => overlap(c, b))) continue;
    if (!adjacent && chosen.some((c) => c.hi === b.lo || b.hi === c.lo)) continue;
    chosen.push(b);
  }
  if (chosen.length !== count) return null;
  if (adjacent && !chosen.some((a) => chosen.some((b) => a.hi === b.lo))) return null;
  return chosen;
}

export const rangeFit: QuizMechanic<RangeFitConfig, RangeFitParams> = {
  id: "GEN-RANGE-FIT",
  version: 1,
  mechanicId: "range-fit",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return c.mode === "which-bag" || c.mode === "select-numbers" ? [] : ["mode must be which-bag or select-numbers"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      if (config.mode === "which-bag") {
        // Level 1: 2 bags far apart. Level 2: 3 bags. Level 3: 3-4 bags sharing a bound, n next to it.
        const count = difficulty === 1 ? 2 : difficulty === 2 ? 3 : randInt(rng, 3, 4);
        const bags = pickBags(rng, count, difficulty === 3);
        if (!bags) return null;
        const home = pickOne(rng, bags);
        let n: number;
        if (difficulty === 3) {
          const nearBound = [home.lo + 1, home.lo + 2, home.hi - 1, home.hi - 2].filter((v) => inBag(home, v));
          n = pickOne(rng, nearBound);
        } else {
          const inner = Array.from({ length: home.hi - home.lo - 1 }, (_, i) => home.lo + 1 + i).filter((v) => difficulty === 2 || (v >= home.lo + 2 && v <= home.hi - 2));
          if (inner.length === 0) return null;
          n = pickOne(rng, inner);
        }
        if (bags.filter((b) => inBag(b, n)).length !== 1) return null;
        return makeItem(this, seed, difficulty, {
          params: { mode: "which-bag", n, bags },
          prompt: `عدد الحبات ${n}. في أي كيس نضعها؟`,
          visual: { type: "rangeBags", bags: bags.map((b) => b.label), count: n },
          input: { type: "choice", options: bags.map((b) => ({ id: b.id, label: b.label })) },
        });
      }
      // select-numbers. Level 1: outside numbers far away. Level 2: a few steps outside.
      // Level 3: next to the bounds (one either side) and digit swaps.
      const bag = pickOne(rng, BOOK_BAGS);
      const total = byLevel(difficulty, [5, 6, 6] as const);
      const inside = Array.from({ length: bag.hi - bag.lo - 1 }, (_, i) => bag.lo + 1 + i);
      const inPick = difficulty === 3 ? [bag.lo + 1, bag.hi - 1, ...shuffle(rng, inside)] : shuffle(rng, inside);
      const nIn = randInt(rng, 2, 3);
      const yes = [...new Set(inPick)].slice(0, nIn);
      const outside = (v: number) => v >= 1 && v <= 99 && !inBag(bag, v) && v !== bag.lo && v !== bag.hi;
      let pool: number[];
      if (difficulty === 1) pool = Array.from({ length: 99 }, (_, i) => i + 1).filter((v) => v < bag.lo - 9 || v > bag.hi + 9);
      else if (difficulty === 2) pool = Array.from({ length: 99 }, (_, i) => i + 1).filter((v) => (v >= bag.lo - 9 && v <= bag.lo - 3) || (v >= bag.hi + 3 && v <= bag.hi + 9));
      else {
        const swaps = inside.map(reverseDigits).filter((v): v is number => v !== null);
        pool = [bag.lo - 1, bag.hi + 1, bag.lo - 2, bag.hi + 2, ...swaps];
      }
      const no = shuffle(rng, [...new Set(pool.filter(outside))]).slice(0, total - yes.length);
      if (no.length < 2) return null;
      const values = shuffle(rng, [...yes, ...no]);
      return makeItem(this, seed, difficulty, {
        params: { mode: "select-numbers", bag, values },
        prompt: `اختر كل الأعداد التي يمكن أن تكون عدد الحبات في الكيس «${bag.label}».`,
        visual: { type: "rangeBags", bags: [bag.label], count: null },
        input: { type: "multi", options: values.map((v) => ({ id: `n${v}`, label: String(v) })) },
      });
    });
  },
  solution(item) {
    const p = item.params;
    if (p.mode === "which-bag") return p.bags.find((b) => inBag(b, p.n))?.id ?? null;
    return p.values.filter((v) => inBag(p.bag, v)).map((v) => `n${v}`);
  },
  check(item, answer) {
    const p = item.params;
    const expected = this.solution(item);
    if (p.mode === "which-bag") {
      const bag = p.bags.find((b) => b.id === answer);
      if (!bag) return wrong(expected, answer, "input_invalid");
      if (inBag(bag, p.n)) return ok();
      const near = Math.min(Math.abs(p.n - bag.lo), Math.abs(p.n - bag.hi)) <= 10;
      return wrong(expected, answer, near ? "comparison_direction" : "other");
    }
    const ids = asStringArray(answer);
    if (!ids || ids.length === 0) return wrong(expected, answer, "input_invalid");
    const vals = ids.map(optionValue);
    if (vals.some((v) => v === null || !p.values.includes(v))) return wrong(expected, answer, "input_invalid");
    if (vals.some((v) => !inBag(p.bag, v!))) return wrong(expected, answer, "comparison_direction");
    return (expected as string[]).every((id) => ids.includes(id)) ? ok() : wrong(expected, answer, "partial_answer");
  },
  explain(item) {
    const p = item.params;
    if (p.mode === "which-bag") {
      const home = p.bags.find((b) => inBag(b, p.n))!;
      return [`نقارن ${p.n} بحدّي كل ملصق.`, `${home.lo} < ${p.n} < ${home.hi}`, `إذن نضعها في الكيس «${home.label}».`];
    }
    const yes = p.values.filter((v) => inBag(p.bag, v)).sort((a, b) => a - b);
    return [`الملصق «${p.bag.label}»: العدد أكبر من ${p.bag.lo} وأصغر من ${p.bag.hi}.`, `الحدّان ${p.bag.lo} و ${p.bag.hi} ليسا في الكيس.`, `الأعداد المناسبة: ${yes.join("، ")}.`];
  },
  checkIntegrity(item) {
    const p = item.params;
    if (p.mode === "which-bag") {
      const problems = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
      if (p.bags.some((b) => b.lo === p.n || b.hi === p.n)) problems.push("n equals a bound");
      for (let i = 0; i < p.bags.length; i++) for (let j = i + 1; j < p.bags.length; j++) if (overlap(p.bags[i]!, p.bags[j]!)) problems.push("bags overlap");
      return [...problems, ...exactlyOneCorrect(this as QuizMechanic<never, RangeFitParams>, item)];
    }
    const problems = multiProblems(item, this.solution(item) as string[]);
    if (p.values.some((v) => v === p.bag.lo || v === p.bag.hi)) problems.push("value equals a bound");
    return problems;
  },
};

/* ------------------------------------------------------------------ */
/* Number line 0..max, drawn left to right as on p.10                   */
/* ------------------------------------------------------------------ */

export interface NumberLineConfig {
  max: number;
  tick: number;
  tolerance?: number;
}

function lineConfigProblems(c: NumberLineConfig): string[] {
  const p: string[] = [];
  if (!isWholeNumber(c.max) || !isWholeNumber(c.tick) || c.tick < 2 || c.tick % 2 !== 0 || c.max % c.tick !== 0) p.push("max must be a multiple of an even tick");
  else if (c.max / c.tick < 2 || c.max / c.tick > 20) p.push("2..20 tick intervals");
  return p;
}

/** Offsets inside an interval for each level: half-way, next to a tick, in between. */
function offsetsFor(tick: number, difficulty: Difficulty): number[] {
  const half = tick / 2;
  const all = Array.from({ length: tick - 1 }, (_, i) => i + 1);
  if (difficulty === 1) return [half];
  if (difficulty === 2) return all.filter((o) => o <= 2 || o >= tick - 2);
  const mid = all.filter((o) => o > 2 && o < tick - 2 && o !== half);
  return mid.length ? mid : all;
}

function lineNumber(rng: Rng, max: number, tick: number, difficulty: Difficulty): number {
  const o = pickOne(rng, offsetsFor(tick, difficulty));
  const k = randInt(rng, 0, max / tick - 1);
  return k * tick + o;
}

export interface NumberLinePlaceParams {
  n: number;
  max: number;
  tick: number;
  tolerance: number;
}

export const numberLinePlace: QuizMechanic<NumberLineConfig, NumberLinePlaceParams> = {
  id: "GEN-NUMBERLINE-PLACE",
  version: 1,
  mechanicId: "numberline-place",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = lineConfigProblems(c);
    if (!isWholeNumber(c.tolerance) || c.tolerance! < 0 || c.tolerance! * 2 >= c.tick) p.push("tolerance must be below half a tick");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const n = lineNumber(rng, config.max, config.tick, difficulty);
      const params = { n, max: config.max, tick: config.tick, tolerance: config.tolerance ?? 0 };
      return makeItem(this, seed, difficulty, {
        params,
        prompt: `ضع العدد ${n} في مكانه على خط الأعداد.`,
        visual: { type: "tickLine", mode: "place", max: config.max, tick: config.tick, minor: null, target: n },
        input: { type: "visual" },
      });
    });
  },
  solution(item) {
    return item.params.n;
  },
  check(item, answer) {
    const { n, max, tick, tolerance } = item.params;
    if (!isWholeNumber(answer) || answer < 0 || answer > max) return wrong(n, answer, "input_invalid");
    if (Math.abs(answer - n) <= tolerance) return ok();
    let type: ErrorType = "other";
    if (Math.abs(answer - (max - n)) <= tolerance) type = "rtl_direction_confusion";
    else if (Math.abs(Math.abs(answer - n) - tick) <= tolerance) type = "place_value_error";
    return wrong(n, answer, type);
  },
  explain(item) {
    const { n, tick } = item.params;
    const lo = Math.floor(n / tick) * tick;
    const nearer = n - lo < lo + tick - n ? lo : n - lo > lo + tick - n ? lo + tick : null;
    return [
      "خط الأعداد يبدأ بالصفر من اليسار ويكبر نحو اليمين.",
      `${n} يقع بين ${lo} و ${lo + tick}.`,
      nearer === null ? `${n} في المنتصف تمامًا بين ${lo} و ${lo + tick}.` : `${n} أقرب إلى ${nearer}.`,
    ];
  },
  checkIntegrity(item) {
    const { n, max, tick } = item.params;
    const p: string[] = [];
    if (n <= 0 || n >= max || n % tick === 0) p.push("n must lie strictly between ticks");
    if (item.input.type !== "visual") p.push("expects visual input");
    return p;
  },
};

export interface NumberLineReadParams {
  n: number;
  max: number;
  tick: number;
  values: number[];
}

export const numberLineRead: QuizMechanic<NumberLineConfig, NumberLineReadParams> = {
  id: "GEN-NUMBERLINE-READ",
  version: 1,
  mechanicId: "numberline-read",
  difficulties: [1, 2, 3],
  validateConfig: lineConfigProblems,
  generate(seed, difficulty, config) {
    const { max, tick } = config;
    const half = tick / 2;
    return sample(seed, (rng) => {
      const n = lineNumber(rng, max, tick, difficulty);
      const mirror = max - n;
      const inRange = (v: number) => v >= 0 && v <= max && Math.abs(v - n) >= half;
      // Level 1: far distractors (±tick, mirrored). Level 2/3 add half a tick either side.
      const pool = difficulty === 1 ? [mirror, n + tick, n - tick] : shuffle(rng, [mirror, n - half, n + half, n + tick, n - tick]);
      const distractors = pool.filter(inRange);
      if (difficulty === 3 && !distractors.includes(n - half) && !distractors.includes(n + half)) return null;
      const options = numberOptions(rng, n, distractors, difficulty === 1 ? 3 : 4);
      if (options.length < 3) return null;
      return makeItem(this, seed, difficulty, {
        params: { n, max, tick, values: options.map((o) => optionValue(o.id)!) },
        prompt: "ما العدد الذي يشير إليه السهم على خط الأعداد؟",
        // Levels 1-2 draw small unlabelled half-way marks; level 3 only the labelled ticks (as in the book).
        visual: { type: "tickLine", mode: "read", max, tick, minor: difficulty === 3 ? null : half, marker: n },
        input: { type: "choice", options },
      });
    });
  },
  solution(item) {
    return `n${item.params.n}`;
  },
  check(item, answer) {
    const { n, max, tick } = item.params;
    const v = optionValue(answer);
    if (v === null || !item.params.values.includes(v)) return wrong(`n${n}`, answer, "input_invalid");
    if (v === n) return ok();
    return wrong(`n${n}`, answer, v === max - n ? "rtl_direction_confusion" : Math.abs(v - n) === tick ? "place_value_error" : "other");
  },
  explain(item) {
    const { n, tick } = item.params;
    const lo = Math.floor(n / tick) * tick;
    return ["خط الأعداد يبدأ بالصفر من اليسار.", `السهم بين العلامتين ${lo} و ${lo + tick}.`, `هو بعد ${lo} بـ ${n - lo}: ${lo} + ${n - lo} = ${n}`];
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    if (item.params.values.some((v) => v < 0 || v > item.params.max)) p.push("option off the line");
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, NumberLineReadParams>, item)];
  },
};

export interface SpotMarker {
  value: number;
  /** Where the marker is drawn. Equal to value except for the misplaced one. */
  at: number;
}
export interface NumberLineSpotParams {
  max: number;
  tick: number;
  markers: SpotMarker[];
}

export const numberLineSpot: QuizMechanic<NumberLineConfig, NumberLineSpotParams> = {
  id: "GEN-NUMBERLINE-SPOT",
  version: 1,
  mechanicId: "numberline-spot",
  difficulties: [1, 2, 3],
  validateConfig: lineConfigProblems,
  generate(seed, difficulty, config) {
    const { max, tick } = config;
    const gap = Math.max(3, Math.round(max * 0.06));
    return sample(seed, (rng) => {
      const values = new Set<number>();
      let guard = 0;
      while (values.size < 4 && guard++ < 50) {
        const v = randInt(rng, 1, max - 1);
        if (v % tick !== 0) values.add(v);
      }
      const list = [...values];
      if (list.length !== 4) return null;
      const wrongValue = list[0]!;
      // Level 1: drawn mirrored (from the wrong end). Level 2: two ticks away. Level 3: one tick away.
      const shift = difficulty === 1 ? [max - wrongValue] : difficulty === 2 ? [wrongValue + 2 * tick, wrongValue - 2 * tick] : [wrongValue + tick, wrongValue - tick];
      const at = pickOne(rng, shift);
      if (at <= 0 || at >= max || Math.abs(at - wrongValue) < (difficulty === 1 ? 3 * tick : tick)) return null;
      const markers = shuffle(
        rng,
        list.map((v) => ({ value: v, at: v === wrongValue ? at : v })),
      );
      const positions = markers.map((m) => m.at).sort((a, b) => a - b);
      if (positions.some((p, i) => i > 0 && p - positions[i - 1]! < gap)) return null;
      return makeItem(this, seed, difficulty, {
        params: { max, tick, markers },
        prompt: "أحد الأعداد في المكان الخطأ على خط الأعداد. ما هو؟",
        visual: { type: "tickLine", mode: "spot", max, tick, minor: null, markers },
        input: { type: "choice", options: markers.map((m) => ({ id: `n${m.value}`, label: String(m.value) })) },
      });
    });
  },
  solution(item) {
    const m = item.params.markers.find((k) => k.at !== k.value);
    return m ? `n${m.value}` : null;
  },
  check(item, answer) {
    const expected = this.solution(item);
    const v = optionValue(answer);
    const m = item.params.markers.find((k) => k.value === v);
    if (!m) return wrong(expected, answer, "input_invalid");
    return m.at !== m.value ? ok() : wrong(expected, answer, "other");
  },
  explain(item) {
    const { tick } = item.params;
    const m = item.params.markers.find((k) => k.at !== k.value)!;
    const lo = Math.floor(m.value / tick) * tick;
    const alo = Math.floor(m.at / tick) * tick;
    return [`نتحقق من كل عدد: بين أي علامتين يجب أن يكون؟`, `${m.value} يجب أن يكون بين ${lo} و ${lo + tick}.`, `لكنه مرسوم بين ${alo} و ${alo + tick}، إذن ${m.value} في المكان الخطأ.`];
  },
  checkIntegrity(item) {
    const { markers, tick, max } = item.params;
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    const misplaced = markers.filter((m) => m.at !== m.value);
    if (misplaced.length !== 1) p.push("exactly one marker must be misplaced");
    if (misplaced.some((m) => Math.abs(m.at - m.value) < tick)) p.push("misplacement must be at least one tick");
    if (markers.some((m) => m.at <= 0 || m.at >= max)) p.push("marker off the line");
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, NumberLineSpotParams>, item)];
  },
};

/* ------------------------------------------------------------------ */
/* round-ten and round-reverse (p.11)                                   */
/* ------------------------------------------------------------------ */

export interface RoundTenConfig {
  min: number;
  max: number;
}
export interface RoundTenParams {
  n: number;
  values: number[];
}

export const roundTenMech: QuizMechanic<RoundTenConfig, RoundTenParams> = {
  id: "GEN-ROUND-TEN",
  version: 1,
  mechanicId: "round-ten",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.min) && isWholeNumber(c.max) && c.min >= 1 && c.max <= 99 && c.max - c.min >= 10 ? [] : ["need 1 <= min, max <= 99, max - min >= 10"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1: ones far from 5 (1, 2, 8, 9). Level 2: 3, 4, 6, 7. Level 3: ones = 5, or the edges (1-4 -> 0, 95+ -> 100).
      const ones = byLevel(difficulty, [[1, 2, 8, 9], [3, 4, 6, 7], [5]] as const);
      const edges = [1, 2, 3, 4, 95, 96, 97, 98, 99].filter((v) => v >= config.min && v <= config.max);
      const n = difficulty === 3 && edges.length > 0 && rng() < 0.35 ? pickOne(rng, edges) : Math.floor(randInt(rng, config.min, config.max) / 10) * 10 + pickOne(rng, ones);
      if (n < config.min || n > config.max) return null;
      const r = roundTen(n);
      const other = r > n ? r - 10 : r + 10;
      const swap = reverseDigits(n);
      const distractors = shuffle(rng, [other, ...(difficulty === 3 && swap !== null ? [roundTen(swap)] : []), r + 10, r - 10, r + 20, r - 20].filter((v) => v >= 0 && v <= 100 && v !== r));
      const ordered = [other, ...distractors.filter((d) => d !== other)];
      const options = numberOptions(rng, r, ordered, difficulty === 1 ? 3 : 4);
      return makeItem(this, seed, difficulty, {
        params: { n, values: options.map((o) => optionValue(o.id)!) },
        prompt: `قرّب العدد ${n} إلى أقرب 10.`,
        visual: { type: "roundLine", low: Math.floor(n / 10) * 10, high: Math.floor(n / 10) * 10 + 10, n },
        input: { type: "choice", options },
      });
    });
  },
  solution(item) {
    return `n${roundTen(item.params.n)}`;
  },
  check(item, answer) {
    const { n } = item.params;
    const r = roundTen(n);
    const v = optionValue(answer);
    if (v === null || !item.params.values.includes(v)) return wrong(`n${r}`, answer, "input_invalid");
    if (v === r) return ok();
    const lo = Math.floor(n / 10) * 10;
    const swap = reverseDigits(n);
    const type: ErrorType = v === lo || v === lo + 10 ? "rounding_error" : swap !== null && v === roundTen(swap) ? "tens_ones_confusion" : "other";
    return wrong(`n${r}`, answer, type);
  },
  explain(item) {
    const { n } = item.params;
    const o = n % 10;
    const lo = Math.floor(n / 10) * 10;
    return [
      `${n} يقع بين ${lo} و ${lo + 10}، ورقم الآحاد ${o}.`,
      o < 5 ? `${o} أقل من 5، فنقرّب إلى الأدنى.` : `${o} يساوي 5 أو أكثر، فنقرّب إلى الأعلى.`,
      `${n} ← ${roundTen(n)}`,
    ];
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    if (item.params.n % 10 === 0) p.push("n must not be a multiple of 10");
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, RoundTenParams>, item)];
  },
};

export interface RoundReverseConfig {
  tensMin: number;
  tensMax: number;
}
export interface RoundReverseParams {
  target: number;
  values: number[];
}

export const roundReverse: QuizMechanic<RoundReverseConfig, RoundReverseParams> = {
  id: "GEN-ROUND-REVERSE",
  version: 1,
  mechanicId: "round-reverse",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const ok10 = (v: number) => isWholeNumber(v) && v % 10 === 0 && v >= 10 && v <= 90;
    return ok10(c.tensMin) && ok10(c.tensMax) && c.tensMin <= c.tensMax ? [] : ["tensMin/tensMax: multiples of 10 in 10..90"];
  },
  generate(seed, difficulty, config) {
    const total = byLevel(difficulty, [5, 6, 6] as const);
    return sample(seed, (rng) => {
      const target = randInt(rng, config.tensMin / 10, config.tensMax / 10) * 10;
      const inside = Array.from({ length: 10 }, (_, i) => target - 5 + i).filter((v) => v !== target);
      // Level 1: inside numbers near the target, outside ones in other decades. Level 2: a few steps
      // outside. Level 3: the boundary cases (target - 5 rounds up to it, target + 5 does not).
      const yesPool = difficulty === 3 ? [target - 5, target + 4, ...shuffle(rng, inside)] : shuffle(rng, inside.filter((v) => Math.abs(v - target) <= (difficulty === 1 ? 3 : 4)));
      const nYes = randInt(rng, 2, 3);
      const yes = [...new Set(yesPool)].slice(0, nYes);
      const outPool =
        difficulty === 1
          ? Array.from({ length: 99 }, (_, i) => i + 1).filter((v) => Math.abs(v - target) >= 12 && v % 10 !== 0)
          : difficulty === 2
            ? [target - 9, target - 8, target - 7, target + 6, target + 7, target + 8, target + 9]
            : [target + 5, target - 6, target + 6, target - 7];
      const no = shuffle(rng, outPool.filter((v) => v >= 1 && v <= 99 && roundTen(v) !== target)).slice(0, total - yes.length);
      if (no.length < 2) return null;
      const values = shuffle(rng, [...yes, ...no]);
      return makeItem(this, seed, difficulty, {
        params: { target, values },
        prompt: `اختر كل الأعداد التي تقرَّب إلى ${target}.`,
        visual: { type: "none" },
        input: { type: "multi", options: values.map((v) => ({ id: `n${v}`, label: String(v) })) },
      });
    });
  },
  solution(item) {
    return item.params.values.filter((v) => roundTen(v) === item.params.target).map((v) => `n${v}`);
  },
  check(item, answer) {
    const ids = asStringArray(answer);
    const expected = this.solution(item) as string[];
    if (!ids || ids.length === 0) return wrong(expected, answer, "input_invalid");
    const vals = ids.map(optionValue);
    if (vals.some((v) => v === null || !item.params.values.includes(v))) return wrong(expected, answer, "input_invalid");
    if (vals.some((v) => roundTen(v!) !== item.params.target)) return wrong(expected, answer, "rounding_error");
    return expected.every((id) => ids.includes(id)) ? ok() : wrong(expected, answer, "partial_answer");
  },
  explain(item) {
    const { target } = item.params;
    const yes = item.params.values.filter((v) => roundTen(v) === target).sort((a, b) => a - b);
    return [
      `الأعداد التي تقرَّب إلى ${target} تقع بين ${target - 5} و ${target + 4}.`,
      `${target + 5} يقرَّب إلى ${target + 10} لأن آحاده 5.`,
      `الأعداد المناسبة هنا: ${yes.join("، ")}.`,
    ];
  },
  checkIntegrity(item) {
    return multiProblems(item, this.solution(item) as string[]);
  },
};

/* ------------------------------------------------------------------ */
/* estimate-pick: the best estimate of a quantity of dots (p.33)        */
/* ------------------------------------------------------------------ */

export interface EstimateConfig {
  min: number;
  max: number;
}
export interface EstimateParams {
  positions: Array<[number, number]>;
  size: "big" | "small";
  values: number[];
}

/** An estimate is good when it is within 20% of the true quantity. */
export const goodEstimate = (n: number, v: number) => Math.abs(v - n) <= 0.2 * n;

function bestEstimate(n: number): number {
  const ten = Math.round(n / 10) * 10;
  if (goodEstimate(n, ten)) return ten;
  return Math.round(n / 5) * 5;
}

export const estimatePick: QuizMechanic<EstimateConfig, EstimateParams> = {
  id: "GEN-ESTIMATE-PICK",
  version: 1,
  mechanicId: "estimate-pick",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.min) && isWholeNumber(c.max) && c.min >= 10 && c.max <= 100 && c.min < c.max ? [] : ["need 10 <= min < max <= 100"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const [lo, hi] = levelRange(config.min, config.max, difficulty);
      const n = randInt(rng, lo, hi);
      const best = bestEstimate(n);
      // Distractors are always outside ±20%; how far depends on the level (60%, 45%, 30%).
      const far = byLevel(difficulty, [0.6, 0.45, 0.3] as const);
      const step = difficulty === 1 ? 10 : 5;
      const pool = Array.from({ length: 100 / step }, (_, i) => (i + 1) * step).filter((v) => Math.abs(v - n) > far * n && !goodEstimate(n, v));
      const count = difficulty === 1 ? 3 : 4;
      const below = shuffle(rng, pool.filter((v) => v < n));
      const above = shuffle(rng, pool.filter((v) => v > n));
      const mixed: number[] = [];
      while (mixed.length < count - 1 && (below.length || above.length)) {
        const fromBelow = above.length === 0 || (below.length > 0 && rng() < 0.5);
        mixed.push((fromBelow ? below : above).shift()!);
      }
      if (mixed.length < count - 1) return null;
      const options = numberOptions(rng, best, mixed, count);
      const size = difficulty === 1 ? "big" : pickOne(rng, ["big", "small"] as const);
      const positions = scatter(rng, n);
      return makeItem(this, seed, difficulty, {
        params: { positions, size, values: options.map((o) => optionValue(o.id)!) },
        prompt: "لا تعدّ واحدًا واحدًا. ما أفضل تقدير لعدد النقاط؟",
        visual: { type: "estimateDots", positions, size },
        input: { type: "choice", options },
      });
    });
  },
  solution(item) {
    const n = item.params.positions.length;
    const v = item.params.values.find((x) => goodEstimate(n, x));
    return v === undefined ? null : `n${v}`;
  },
  check(item, answer) {
    const n = item.params.positions.length;
    const expected = this.solution(item);
    const v = optionValue(answer);
    if (v === null || !item.params.values.includes(v)) return wrong(expected, answer, "input_invalid");
    return goodEstimate(n, v) ? ok() : wrong(expected, answer, "other");
  },
  explain(item) {
    const n = item.params.positions.length;
    const best = item.params.values.find((x) => goodEstimate(n, x)) ?? bestEstimate(n);
    return ["نتخيّل مجموعة من 10 نقاط ونقارن الصورة بها.", `الكمية قريبة من ${best}.`, `عند العدّ نجد ${n}، والتقدير ${best} قريب منه.`];
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    if (item.params.positions.length > 1 && minGap(item.params.positions) < scatterGap(item.params.positions.length)) p.push("dots overlap");
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, EstimateParams>, item)];
  },
};

export const NUMBER_SENSE_MECHANICS = [
  tensBounds,
  decadeFill,
  midpoint,
  countObjects,
  rangeFit,
  numberLinePlace,
  numberLineRead,
  numberLineSpot,
  roundTenMech,
  roundReverse,
  estimatePick,
] as const;
