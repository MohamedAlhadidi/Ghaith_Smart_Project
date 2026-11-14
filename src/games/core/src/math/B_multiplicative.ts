/**
 * Multiplicative thinking (MATH-S1 L03 p6, L14 p17, L19 p22, L26 p29, L32 p35, L37-L40 p40-43):
 * equal groups and skip counting, doubles and halves, arrays, sharing and division sentences.
 *
 * Book notation (p.40): a × b = a groups of b, e.g. 5 + 5 + 5 + 5 = 20 -> 4 × 5 = 20.
 * The × sign is introduced on p.17, so the p.6 (generic) skip-counting items never use it.
 */
import type { Difficulty, ErrorType } from "../types";
import {
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
import type { Rng } from "../rng";
import { checkMulti, checkWhole, choiceId, countOf, multiProblems, NOUNS, pickOne, repeatAdd, skipSequence } from "./B_common";

/* ------------------------------------------------------------------ */
/* equal groups: skip-count-groups and groups-reverse                  */
/* ------------------------------------------------------------------ */

export type GroupContext = "generic" | "shoes" | "hands" | "tricycles";
const GROUP_CONTEXTS: readonly GroupContext[] = ["generic", "shoes", "hands", "tricycles"];
/** Book group sizes: a pair of shoes per box (p.41), five fingernails per hand (p.42), three wheels (p.17). */
const CONTEXT_SIZE: Record<Exclude<GroupContext, "generic">, number> = { shoes: 2, hands: 5, tricycles: 3 };

function groupSizeProblems(context: GroupContext, sizes: unknown): string[] {
  const p: string[] = [];
  if (!GROUP_CONTEXTS.includes(context)) p.push(`unknown context ${String(context)}`);
  if (!Array.isArray(sizes) || sizes.length === 0) return [...p, "sizes required"];
  for (const s of sizes) {
    if (!isWholeNumber(s) || s < 2 || s > 10) p.push(`bad size ${String(s)}`);
    else if (context !== "generic" && GROUP_CONTEXTS.includes(context) && s !== CONTEXT_SIZE[context]) p.push(`context ${context} needs size ${CONTEXT_SIZE[context]}`);
  }
  return p;
}

/** Number of groups per level: small counts first, the full book range at level 3. */
function groupCountRange(d: Difficulty, kMax: number): [number, number] {
  const hi = byLevel(d, [Math.max(3, Math.round(kMax * 0.4)), Math.max(4, Math.round(kMax * 0.7)), kMax] as const);
  const lo = byLevel(d, [2, 3, Math.ceil(kMax / 2)] as const);
  return [Math.min(lo, hi), hi];
}

export interface SkipCountConfig {
  sizes: number[];
  kMax: number;
  context: GroupContext;
}
export interface SkipCountParams {
  size: number;
  groups: number;
  context: GroupContext;
  /** "earn": p.17 story, Khalfan earns one rial per wheel he repairs. */
  story: "count" | "earn";
}

function skipPrompt(p: SkipCountParams): string {
  const { size: s, groups: k } = p;
  switch (p.context) {
    case "shoes":
      return `في كل علبة زوج من الأحذية. عدد العلب ${k}. كم حذاءً في العلب كلها؟`;
    case "hands":
      return `في كل يد ${s} أظافر. عدد الأيدي ${k}. كم ظفرًا يمكنك أن ترى؟`;
    case "tricycles":
      return p.story === "earn"
        ? `يكسب خلفان ريالًا واحدًا عن كل عجلة يصلحها. أصلح عجلات ${k} من الدراجات الثلاثية. كم ريالًا يكسب؟`
        : `للدراجة الثلاثية ${s} عجلات. عدد الدراجات ${k}. كم عجلة في الدراجات كلها؟`;
    default:
      return `عدد المجموعات ${k}، وفي كل مجموعة ${s}. كم نقطة في المجموعات كلها؟ عُدّ بالقفز.`;
  }
}

export const skipCountGroups: QuizMechanic<SkipCountConfig, SkipCountParams> = {
  id: "GEN-SKIP-COUNT-GROUPS",
  version: 1,
  mechanicId: "skip-count-groups",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = groupSizeProblems(c.context, c.sizes);
    if (!isWholeNumber(c.kMax) || c.kMax < 4 || c.kMax > 20) p.push("kMax must be 4..20");
    else if (Array.isArray(c.sizes) && Math.max(...c.sizes) * c.kMax > 100) p.push("totals must stay within 100");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const size = pickOne(rng, config.sizes);
      const [lo, hi] = groupCountRange(difficulty, config.kMax);
      const groups = randInt(rng, lo, hi);
      const story: SkipCountParams["story"] = config.context === "tricycles" && difficulty === 3 && rng() < 0.5 ? "earn" : "count";
      const params: SkipCountParams = { size, groups, context: config.context, story };
      return makeItem(this, seed, difficulty, {
        params,
        prompt: skipPrompt(params),
        visual: { type: "b-groups", context: config.context, size, groups },
        input: { type: "number", maxDigits: 3, unit: story === "earn" ? "ريال" : undefined },
      });
    });
  },
  solution(item) {
    return item.params.size * item.params.groups;
  },
  check(item, answer) {
    const { size: s, groups: k } = item.params;
    return checkWhole(s * k, answer, [
      [s + k, "operation_confusion"],
      [s * (k - 1), "counting_error"],
      [s * (k + 1), "counting_error"],
    ]);
  },
  explain(item) {
    const { size: s, groups: k, context } = item.params;
    const steps = [`عدد المجموعات ${k}، وفي كل مجموعة ${s}.`, `نعدّ بالقفز ${s} في كل مرة: ${skipSequence(s, k).join("، ")}.`];
    if (context === "generic") steps.push(k <= 6 ? `${repeatAdd(s, k)} = ${s * k}` : `العدد كله ${s * k}.`);
    else steps.push(`${k} × ${s} = ${s * k}`);
    return steps;
  },
  checkIntegrity(item) {
    const { size: s, groups: k } = item.params;
    const p: string[] = [];
    if (!(s >= 2 && k >= 2 && s * k <= 100)) p.push("groups out of range");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

export interface GroupsReverseConfig {
  sizes: number[];
  maxTotal: number;
  context: GroupContext;
}
export interface GroupsReverseParams {
  size: number;
  total: number;
  context: GroupContext;
}

function reversePrompt(p: GroupsReverseParams): string {
  const { size: s, total: t } = p;
  switch (p.context) {
    case "shoes":
      return `عدد الأحذية ${t}، وفي كل علبة زوج واحد (حذاءان). كم علبة نحتاج؟`;
    case "hands":
      return `عدد الأظافر ${t}، وفي كل يد ${s} أظافر. كم يدًا؟`;
    case "tricycles":
      return `عدد العجلات ${t}، ولكل دراجة ثلاثية ${s} عجلات. كم دراجة؟`;
    default:
      return `عدد النقاط ${t}، ونضع في كل مجموعة ${s}. كم مجموعة نكوّن؟`;
  }
}

export const groupsReverse: QuizMechanic<GroupsReverseConfig, GroupsReverseParams> = {
  id: "GEN-GROUPS-REVERSE",
  version: 1,
  mechanicId: "groups-reverse",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = groupSizeProblems(c.context, c.sizes);
    if (!isWholeNumber(c.maxTotal) || c.maxTotal < 8 || c.maxTotal > 100) p.push("maxTotal must be 8..100");
    else if (Array.isArray(c.sizes)) for (const s of c.sizes) if (isWholeNumber(s) && s > 0 && Math.floor(c.maxTotal / s) < 4) p.push(`maxTotal too small for size ${s}`);
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const size = pickOne(rng, config.sizes);
      const kMax = Math.floor(config.maxTotal / size);
      // Level 1 stays within ten groups; level 3 reaches the book's 68 shoes -> 34 boxes.
      const hi = byLevel(difficulty, [Math.max(3, Math.min(10, Math.round(kMax * 0.4))), Math.max(4, Math.round(kMax * 0.7)), kMax] as const);
      const lo = byLevel(difficulty, [2, 3, Math.ceil(kMax / 2)] as const);
      const groups = randInt(rng, Math.min(lo, hi), hi);
      const params: GroupsReverseParams = { size, total: size * groups, context: config.context };
      return makeItem(this, seed, difficulty, {
        params,
        prompt: reversePrompt(params),
        visual: { type: "b-groups-total", context: config.context, size, total: params.total },
        input: { type: "number", maxDigits: 3 },
      });
    });
  },
  solution(item) {
    return item.params.total / item.params.size;
  },
  check(item, answer) {
    const { size: s, total: t } = item.params;
    return checkWhole(t / s, answer, [
      [t * s, "operation_confusion"],
      [t - s, "operation_confusion"],
      [t + s, "operation_confusion"],
    ]);
  },
  explain(item) {
    const { size: s, total: t } = item.params;
    const k = t / s;
    const count = k <= 12 ? `نعدّ بالقفز ${s} حتى نصل إلى ${t}: ${skipSequence(s, k).join("، ")}.` : `نعدّ بالقفز ${s} حتى نصل إلى ${t}، ونعدّ مرات القفز.`;
    return [count, `عدد مرات القفز ${k}.`, `${k} × ${s} = ${t}`];
  },
  checkIntegrity(item) {
    const { size: s, total: t } = item.params;
    const p: string[] = [];
    if (!(s >= 2 && t % s === 0 && t / s >= 2 && t <= 100)) p.push("total must be a multiple of the group size");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* doubles and halves (p.29 recipe, p.35 double lines)                 */
/* ------------------------------------------------------------------ */

type RecipeUnit = "g" | "egg" | "big-spoon" | "small-spoon";
interface Ingredient {
  key: string;
  name: string;
  /** Amount for 5 biscuits in the book recipe (p.29). */
  amount: number;
  unit: RecipeUnit;
}
/** Book recipe for 5 biscuits (p.29). */
export const BOOK_RECIPE: readonly Ingredient[] = [
  { key: "flour", name: "الدقيق", amount: 70, unit: "g" },
  { key: "ginger", name: "الزنجبيل", amount: 1, unit: "small-spoon" },
  { key: "butter", name: "الزبدة", amount: 20, unit: "g" },
  { key: "sugar", name: "السكر البني", amount: 35, unit: "g" },
  { key: "egg", name: "البيض", amount: 1, unit: "egg" },
  { key: "honey", name: "العسل", amount: 2, unit: "big-spoon" },
];
const GRAM_KEYS = ["flour", "butter", "sugar"];

function ingredient(key: string): Ingredient {
  const ing = BOOK_RECIPE.find((i) => i.key === key);
  if (!ing) throw new Error(`unknown ingredient ${key}`);
  return ing;
}

/** Amount with its unit, e.g. «70 غ», «بيضتان», «4 ملاعق كبيرة». */
export function amountText(amount: number, unit: RecipeUnit): string {
  if (unit === "g") return `${amount} غ`;
  if (unit === "egg") return amount === 1 ? "بيضة واحدة" : amount === 2 ? "بيضتان" : `${amount} بيضات`;
  const size = unit === "big-spoon" ? ["كبيرة", "كبيرتان", "كبيرة"] : ["صغيرة", "صغيرتان", "صغيرة"];
  if (amount === 1) return `ملعقة ${size[0]}`;
  if (amount === 2) return `ملعقتان ${size[1]}`;
  return `${amount} ملاعق ${size[2]}`;
}
const UNIT_QUESTION: Record<RecipeUnit, string> = { g: "كم غرامًا", egg: "كم بيضة", "big-spoon": "كم ملعقة كبيرة", "small-spoon": "كم ملعقة صغيرة" };
/** «70 غ من الدقيق»; eggs are counted without «من البيض». */
const amountOf = (ing: Ingredient, amount: number) => (ing.unit === "egg" ? amountText(amount, "egg") : `${amountText(amount, ing.unit)} من ${ing.name}`);
const questionOf = (ing: Ingredient) => (ing.unit === "egg" ? "كم بيضة" : `${UNIT_QUESTION[ing.unit]} من ${ing.name}`);
const UNIT_SHORT: Record<RecipeUnit, string> = { g: "غ", egg: "بيضة", "big-spoon": "ملعقة كبيرة", "small-spoon": "ملعقة صغيرة" };

function recipeVisual(key: string, shown: number, book: boolean, fromCount: number, toCount: number) {
  const ing = ingredient(key);
  const source = book ? BOOK_RECIPE : [ing];
  const lines = source.map((i) => ({ name: i.name, text: amountText(i.key === key ? shown : fromCount === 5 ? i.amount : 2 * i.amount, i.unit) }));
  return { type: "b-recipe", fromCount, toCount, lines, ask: source.indexOf(ing), askUnit: UNIT_SHORT[ing.unit] };
}

/** Tens-and-ones worked step for doubling a two-digit number, e.g. 37 -> 60 + 14 = 74. */
function doubleSteps(n: number): string[] {
  const tens = n - (n % 10);
  const ones = n % 10;
  if (n < 10 || ones === 0) return [`${n} + ${n} = ${2 * n}`];
  return [`نضاعف العشرات: ${tens} + ${tens} = ${2 * tens}، ونضاعف الآحاد: ${ones} + ${ones} = ${2 * ones}.`, `${2 * tens} + ${2 * ones} = ${2 * n}`];
}

export interface DoubleConfig {
  context: "line" | "recipe";
  max: number;
}
export type DoubleParams =
  | { context: "line"; n: number; lineMax: number; tick: number }
  | { context: "recipe"; ingredient: string; amount: number; book: boolean };

const doubledValue = (p: DoubleParams) => (p.context === "line" ? p.n : p.amount);

export const double: QuizMechanic<DoubleConfig, DoubleParams> = {
  id: "GEN-DOUBLE",
  version: 1,
  mechanicId: "double",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (c.context !== "line" && c.context !== "recipe") p.push("context must be line or recipe");
    if (!isWholeNumber(c.max)) p.push("max required");
    else if (c.context === "line" && (c.max < 12 || c.max > 50)) p.push("line max must be 12..50 (doubles within 100)");
    else if (c.context === "recipe" && (c.max < 70 || c.max > 100 || c.max % 5 !== 0)) p.push("recipe max must be a multiple of 5 in 70..100 (book flour 70 g)");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      let params: DoubleParams;
      let prompt: string;
      let visual;
      if (config.context === "line") {
        // p.35 lines: 0-20 by ones, then 0-50 by tens; level 3 any number up to max.
        const lineMax = difficulty === 1 ? 20 : 50;
        const tick = difficulty === 1 ? 1 : 10;
        const n =
          difficulty === 1 ? randInt(rng, 1, 10) : difficulty === 2 ? 5 * randInt(rng, 1, Math.floor(Math.min(config.max, 50) / 5)) : randInt(rng, 11, config.max);
        if (difficulty === 3 && n % 5 === 0) return null;
        params = { context: "line", n, lineMax, tick };
        prompt = `ما ضعف العدد ${n}؟ اكتب العدد الذي يوضع فوقه على خط الضعف.`;
        visual = { type: "b-doubleline", lineMax, tick, value: n, role: "double" };
      } else {
        // Level 1: small book amounts; level 2: book grams; level 3: another recipe (multiples of 5).
        let key: string;
        let amount: number;
        let book = true;
        if (difficulty === 1) {
          key = pickOne(rng, ["ginger", "egg", "honey", "butter"]);
          amount = ingredient(key).amount;
        } else if (difficulty === 2) {
          key = pickOne(rng, GRAM_KEYS);
          amount = ingredient(key).amount;
        } else {
          key = pickOne(rng, GRAM_KEYS);
          amount = 5 * randInt(rng, 3, Math.floor(config.max / 5));
          if (amount === ingredient(key).amount) return null;
          book = false;
        }
        const ing = ingredient(key);
        params = { context: "recipe", ingredient: key, amount, book };
        prompt = `${book ? "وصفة الكتاب" : "وصفة أخرى"} لصنع 5 قطع من البسكويت فيها ${amountOf(ing, amount)}. ${questionOf(ing)} نحتاج لصنع 10 قطع؟`;
        visual = recipeVisual(key, amount, book, 5, 10);
      }
      return makeItem(this, seed, difficulty, { params, prompt, visual, input: { type: "number", maxDigits: 3 } });
    });
  },
  solution(item) {
    return 2 * doubledValue(item.params);
  },
  check(item, answer) {
    const n = doubledValue(item.params);
    const specific: Array<readonly [number, ErrorType]> = [[n + 2, "operation_confusion"]];
    if (item.params.context === "recipe") specific.unshift([n + 5, "operation_confusion"], [n + 10, "operation_confusion"]);
    return checkWhole(2 * n, answer, specific);
  },
  explain(item) {
    const n = doubledValue(item.params);
    const first =
      item.params.context === "recipe"
        ? "10 قطع ضعف 5 قطع، لذلك نضاعف الكمية."
        : `الضعف يعني العدد مرتين: ${n} + ${n}.`;
    return [first, ...doubleSteps(n), `إذن ضعف ${n} هو ${2 * n}.`].slice(0, 4);
  },
  checkIntegrity(item) {
    const n = doubledValue(item.params);
    const p: string[] = [];
    if (!(isWholeNumber(n) && n >= 1 && 2 * n <= 200)) p.push("number out of range");
    if (item.params.context === "line" && n > item.params.lineMax) p.push("number not on the line");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

export interface DoubleReverseConfig {
  maxDouble: number;
  context: "line" | "recipe";
}
export type DoubleReverseParams =
  | { context: "line"; total: number; lineMax: number; tick: number }
  | { context: "recipe"; ingredient: string; total: number; book: boolean };

export const doubleReverse: QuizMechanic<DoubleReverseConfig, DoubleReverseParams> = {
  id: "GEN-DOUBLE-REVERSE",
  version: 1,
  mechanicId: "double-reverse",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (c.context !== "line" && c.context !== "recipe") p.push("context must be line or recipe");
    if (!isWholeNumber(c.maxDouble) || c.maxDouble % 2 !== 0) p.push("maxDouble must be an even whole number");
    else if (c.context === "line" && (c.maxDouble < 24 || c.maxDouble > 100)) p.push("line maxDouble must be 24..100");
    else if (c.context === "recipe" && (c.maxDouble < 140 || c.maxDouble > 200 || c.maxDouble % 10 !== 0)) p.push("recipe maxDouble must be a multiple of 10 in 140..200 (book flour 70 g doubled)");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      let params: DoubleReverseParams;
      let prompt: string;
      let visual;
      if (config.context === "line") {
        const lineMax = difficulty === 1 ? 20 : 100;
        const tick = difficulty === 1 ? 1 : 10;
        const total =
          difficulty === 1 ? 2 * randInt(rng, 1, 10) : difficulty === 2 ? 10 * randInt(rng, 1, Math.floor(config.maxDouble / 10)) : 2 * randInt(rng, 11, config.maxDouble / 2);
        if (difficulty === 3 && (total / 2) % 5 === 0) return null;
        params = { context: "line", total, lineMax, tick };
        prompt = `العدد ${total} هو ضعف أي عدد؟`;
        visual = { type: "b-doubleline", lineMax, tick, value: total, role: "half" };
      } else {
        let key: string;
        let total: number;
        let book = true;
        if (difficulty === 1) {
          key = pickOne(rng, ["ginger", "egg", "honey", "butter"]);
          total = 2 * ingredient(key).amount;
        } else if (difficulty === 2) {
          key = pickOne(rng, GRAM_KEYS);
          total = 2 * ingredient(key).amount;
        } else {
          key = pickOne(rng, GRAM_KEYS);
          total = 10 * randInt(rng, 3, Math.floor(config.maxDouble / 10));
          if (total === 2 * ingredient(key).amount) return null;
          book = false;
        }
        const ing = ingredient(key);
        params = { context: "recipe", ingredient: key, total, book };
        prompt = `وصفة لصنع 10 قطع من البسكويت فيها ${amountOf(ing, total)}. ${questionOf(ing)} نحتاج لصنع 5 قطع؟`;
        visual = recipeVisual(key, total, book, 10, 5);
      }
      return makeItem(this, seed, difficulty, { params, prompt, visual, input: { type: "number", maxDigits: 3 } });
    });
  },
  solution(item) {
    return item.params.total / 2;
  },
  check(item, answer) {
    const t = item.params.total;
    const specific: Array<readonly [number, ErrorType]> = [
      [t * 2, "operation_confusion"],
      [t - 2, "operation_confusion"],
    ];
    if (item.params.context === "recipe") specific.push([t - 5, "operation_confusion"]);
    return checkWhole(t / 2, answer, specific);
  },
  explain(item) {
    const t = item.params.total;
    const h = t / 2;
    const first = item.params.context === "recipe" ? "5 قطع نصف 10 قطع، لذلك نأخذ نصف الكمية." : `نبحث عن العدد الذي ضعفه ${t}.`;
    const tens = h - (h % 10);
    const mid = h >= 10 && h % 10 !== 0 ? `نصف ${2 * tens} هو ${tens}، ونصف ${2 * (h % 10)} هو ${h % 10}.` : null;
    return [first, ...(mid ? [mid] : []), `${h} + ${h} = ${t}`, `إذن نصف ${t} هو ${h}.`];
  },
  checkIntegrity(item) {
    const t = item.params.total;
    const p: string[] = [];
    if (!(isWholeNumber(t) && t >= 2 && t % 2 === 0)) p.push("total must be even");
    if (item.params.context === "line" && t > item.params.lineMax) p.push("total not on the line");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* arrays (p.17, p.22, p.40)                                           */
/* ------------------------------------------------------------------ */

export type ArrayIcon = "star" | "flower" | "dot";
const ARRAY_ICONS: readonly ArrayIcon[] = ["star", "flower", "dot"];

function arrayConfigProblems(c: { maxRows: number; maxCols: number }): string[] {
  const p: string[] = [];
  if (!isWholeNumber(c.maxRows) || c.maxRows < 3 || c.maxRows > 10) p.push("maxRows must be 3..10");
  if (!isWholeNumber(c.maxCols) || c.maxCols < 4 || c.maxCols > 10) p.push("maxCols must be 4..10");
  return p;
}

/** Rows/columns per level, clamped to the config: small arrays first. */
function arrayDims(rng: Rng, d: Difficulty, maxRows: number, maxCols: number): { rows: number; cols: number } {
  const [rLo, rHi] = byLevel(d, [[2, 3], [2, 4], [3, maxRows]] as const);
  const [cLo, cHi] = byLevel(d, [[2, 5], [3, 6], [4, maxCols]] as const);
  const rows = randInt(rng, Math.min(rLo, maxRows), Math.min(rHi, maxRows));
  const cols = randInt(rng, Math.min(cLo, maxCols), Math.min(cHi, maxCols));
  return { rows, cols };
}

/** Row count in words for labels: «صفّان» for 2, «3 صفوف» otherwise. */
const rowsText = (r: number) => countOf(r, { one: "صف واحد", two: "صفّان", few: "صفوف", many: "صفًّا" });
const rowsAcc = (r: number) => countOf(r, { one: "صفًّا واحدًا", two: "صفّين", few: "صفوف", many: "صفًّا" });

export interface ArraySentence {
  id: string;
  kind: "mul" | "add";
  terms: number[];
  total: number;
}
export interface ArraySentencesConfig {
  maxRows: number;
  maxCols: number;
}
export interface ArraySentencesParams {
  rows: number;
  cols: number;
  icon: ArrayIcon;
  sentences: ArraySentence[];
}

/** A sentence describes an r×c array iff it is r × c / c × r, or a repeated addition of a row or a column, with total r·c. */
export function describesArray(rows: number, cols: number, s: Omit<ArraySentence, "id">): boolean {
  if (s.total !== rows * cols) return false;
  if (s.kind === "mul") return s.terms.length === 2 && ((s.terms[0] === rows && s.terms[1] === cols) || (s.terms[0] === cols && s.terms[1] === rows));
  const all = (v: number) => s.terms.every((x) => x === v);
  return (s.terms.length === rows && all(cols)) || (s.terms.length === cols && all(rows));
}
const sentenceLabel = (s: Omit<ArraySentence, "id">) => `${s.terms.join(s.kind === "mul" ? " × " : " + ")} = ${s.total}`;
const fill = (v: number, n: number) => Array.from({ length: n }, () => v);

export const arraySentences: QuizMechanic<ArraySentencesConfig, ArraySentencesParams> = {
  id: "GEN-ARRAY-SENTENCES",
  version: 1,
  mechanicId: "array-sentences",
  difficulties: [1, 2, 3],
  validateConfig: arrayConfigProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const { rows: r, cols: c } = arrayDims(rng, difficulty, config.maxRows, config.maxCols);
      const t = r * c;
      const trues: Omit<ArraySentence, "id">[] = [
        { kind: "mul", terms: [r, c], total: t },
        { kind: "add", terms: fill(c, r), total: t },
        { kind: "mul", terms: [c, r], total: t },
      ];
      if (c <= 6) trues.push({ kind: "add", terms: fill(r, c), total: t });
      // Plausible false sentences: wrong totals (a row miscounted), r + c, a repeated addition with one row too many/few.
      const wrongTotals: Omit<ArraySentence, "id">[] = [
        { kind: "mul", terms: [r, c], total: t + c },
        { kind: "mul", terms: [c, r], total: t - c },
        { kind: "add", terms: fill(c, r), total: t + 1 },
      ];
      const conceptual: Omit<ArraySentence, "id">[] = [
        { kind: "add", terms: [r, c], total: t },
        { kind: "add", terms: fill(c, r + 1), total: (r + 1) * c },
        ...(r - 1 >= 2 ? [{ kind: "add" as const, terms: fill(c, r - 1), total: (r - 1) * c }] : []),
      ];
      const pool = difficulty === 1 ? wrongTotals : difficulty === 2 ? [...wrongTotals, conceptual[0]!] : [...conceptual, ...wrongTotals];
      const nTrue = byLevel(difficulty, [2, 3, 4] as const);
      const nFalse = byLevel(difficulty, [1, 2, 3] as const);
      const seen = new Set<string>();
      const pickedTrue = trues.filter((s) => !seen.has(sentenceLabel(s)) && !!seen.add(sentenceLabel(s))).slice(0, nTrue);
      const pickedFalse = shuffle(rng, pool)
        .filter((s) => !describesArray(r, c, s) && !seen.has(sentenceLabel(s)) && !!seen.add(sentenceLabel(s)))
        .slice(0, nFalse);
      if (pickedFalse.length < nFalse) return null;
      const sentences = shuffle(rng, [...pickedTrue, ...pickedFalse]).map((s, i) => ({ id: `s${i}`, ...s }));
      const icon = pickOne(rng, ARRAY_ICONS);
      return makeItem(this, seed, difficulty, {
        params: { rows: r, cols: c, icon, sentences },
        prompt: "اختر كل الجمل التي تصف المصفوفة.",
        visual: { type: "b-array", rows: r, cols: c, icon },
        input: { type: "multi", options: sentences.map((s) => ({ id: s.id, label: sentenceLabel(s) })) },
      });
    });
  },
  solution(item) {
    const { rows, cols, sentences } = item.params;
    return sentences.filter((s) => describesArray(rows, cols, s)).map((s) => s.id);
  },
  check(item, answer) {
    const { rows, cols, sentences } = item.params;
    return checkMulti(
      this.solution(item) as string[],
      sentences.map((s) => s.id),
      answer,
      (falseIds) => {
        const picked = sentences.filter((s) => falseIds.includes(s.id));
        // A sum of a row and a column (terms not all equal) is an operation confusion; the rest are miscounts.
        return picked.some((s) => s.kind === "add" && new Set(s.terms).size > 1) ? "operation_confusion" : "counting_error";
      },
    );
  },
  explain(item) {
    const { rows: r, cols: c } = item.params;
    const t = r * c;
    return [`عدد الصفوف ${r}، وفي كل صف ${c}.`, `${repeatAdd(c, r)} = ${t}`, r === c ? `${r} × ${c} = ${t}` : `${r} × ${c} = ${t}، وأيضًا ${c} × ${r} = ${t}.`];
  },
  checkIntegrity(item) {
    const { rows, cols, sentences } = item.params;
    return multiProblems(item.input, sentences.filter((s) => describesArray(rows, cols, s)).length);
  },
};

export interface ArrayBuildConfig {
  maxRows: number;
  maxCols: number;
}
export interface ArrayBuildParams {
  a: number;
  b: number;
  /** words: «a rows, b in each row» (orientation fixed); add: b + b + ... (a terms); mul: a × b = t. */
  form: "words" | "add" | "mul";
  gridRows: number;
  gridCols: number;
}
export interface ArrayBuildAnswer {
  rows: number;
  cols: number;
}

function buildAnswer(v: unknown, p: ArrayBuildParams): ArrayBuildAnswer | null {
  if (typeof v !== "object" || v === null) return null;
  const { rows, cols } = v as Record<string, unknown>;
  if (!isWholeNumber(rows) || !isWholeNumber(cols) || rows < 1 || cols < 1 || rows > p.gridRows || cols > p.gridCols) return null;
  return { rows, cols };
}

export const arrayBuild: QuizMechanic<ArrayBuildConfig, ArrayBuildParams> = {
  id: "GEN-ARRAY-BUILD",
  version: 1,
  mechanicId: "array-build",
  difficulties: [1, 2, 3],
  validateConfig: arrayConfigProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const { rows, cols } = arrayDims(rng, difficulty, config.maxRows, config.maxCols);
      const form = byLevel(difficulty, ["words", "add", "mul"] as const);
      // Sentences (not words) may name the factors in either order; either orientation is accepted.
      const swap = form !== "words" && rng() < 0.5;
      const a = swap ? cols : rows;
      const b = swap ? rows : cols;
      const t = a * b;
      const sentence = form === "words" ? `عدد الصفوف ${a}، وفي كل صف ${b}` : form === "add" ? `${repeatAdd(b, a)} = ${t}` : `${a} × ${b} = ${t}`;
      return makeItem(this, seed, difficulty, {
        params: { a, b, form, gridRows: config.maxRows, gridCols: config.maxCols },
        prompt: form === "words" ? `ابنِ مصفوفة: ${sentence}. المس المربع الأخير ثم اضغط «تحقّق».` : `ابنِ مصفوفة تناسب الجملة: ${sentence}`,
        visual: { type: "b-array-build", gridRows: config.maxRows, gridCols: config.maxCols },
        input: { type: "visual" },
      });
    });
  },
  solution(item) {
    const { a, b, form, gridRows, gridCols } = item.params;
    if (form === "words" || (a <= gridRows && b <= gridCols)) return { rows: a, cols: b };
    return { rows: b, cols: a };
  },
  check(item, answer) {
    const p = item.params;
    const expected = this.solution(item);
    const got = buildAnswer(answer, p);
    if (!got) return wrong(expected, answer, "input_invalid");
    const exact = got.rows === p.a && got.cols === p.b;
    const swapped = got.rows === p.b && got.cols === p.a;
    if (exact || (swapped && p.form !== "words")) return ok();
    if (swapped) return wrong(expected, answer, "other"); // rows and columns exchanged in the words form
    const oneMatches = got.rows === p.a || got.cols === p.b || (p.form !== "words" && (got.rows === p.b || got.cols === p.a));
    return wrong(expected, answer, oneMatches ? "counting_error" : "other");
  },
  explain(item) {
    const { a, b, form } = item.params;
    const sol = this.solution(item) as ArrayBuildAnswer;
    const first =
      form === "words"
        ? `نحتاج ${rowsAcc(a)}، وفي كل صف ${b}.`
        : form === "add"
          ? `في الجملة نجمع العدد ${b}، وعدد مرات الجمع ${a}.`
          : `${a} × ${b} تعني: عدد المجموعات ${a}، وفي كل مجموعة ${b}.`;
    return [first, `نلوّن ${rowsAcc(sol.rows)}، وفي كل صف ${countOf(sol.cols, NOUNS.square)}.`, form === "mul" ? `${a} × ${b} = ${a * b}` : `${repeatAdd(b, a)} = ${a * b}`];
  },
  checkIntegrity(item) {
    const p = item.params;
    const sol = this.solution(item) as ArrayBuildAnswer;
    const problems: string[] = [];
    if (sol.rows > p.gridRows || sol.cols > p.gridCols) problems.push("array does not fit the grid");
    if (p.a < 2 || p.b < 2) problems.push("array too small");
    if (item.input.type !== "visual") problems.push("expects visual input");
    return problems;
  },
};

export interface ArrayCountConfig {
  maxRows: number;
  maxCols: number;
  context?: "box";
}
export interface ArrayCountParams {
  rows: number;
  cols: number;
}

export const arrayCount: QuizMechanic<ArrayCountConfig, ArrayCountParams> = {
  id: "GEN-ARRAY-COUNT",
  version: 1,
  mechanicId: "array-count",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!isWholeNumber(c.maxRows) || c.maxRows < 3 || c.maxRows > 8) p.push("maxRows must be 3..8");
    if (!isWholeNumber(c.maxCols) || c.maxCols < 4 || c.maxCols > 8) p.push("maxCols must be 4..8");
    if (c.context !== undefined && c.context !== "box") p.push("context must be box");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const [rLo, rHi] = byLevel(difficulty, [[2, 3], [2, config.maxRows - 1], [4, config.maxRows]] as const);
      const [cLo, cHi] = byLevel(difficulty, [[2, 4], [3, config.maxCols], [4, config.maxCols]] as const);
      const rows = randInt(rng, rLo, rHi);
      const cols = randInt(rng, cLo, cHi);
      return makeItem(this, seed, difficulty, {
        params: { rows, cols },
        prompt: "رُتّبت المكعبات في العلبة بانتظام. كم مكعبًا في العلبة؟",
        visual: { type: "b-box", rows, cols },
        input: { type: "number", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return item.params.rows * item.params.cols;
  },
  check(item, answer) {
    const { rows: r, cols: c } = item.params;
    const t = r * c;
    return checkWhole(t, answer, [
      [r + c, "operation_confusion"],
      [t - c, "counting_error"],
      [t + c, "counting_error"],
      [t - r, "counting_error"],
      [t + r, "counting_error"],
    ]);
  },
  explain(item) {
    const { rows: r, cols: c } = item.params;
    return [`في كل صف ${countOf(c, NOUNS.cube)}، وعدد الصفوف ${r}.`, `نعدّ بالقفز ${c}: ${skipSequence(c, r).join("، ")}.`, `${r} × ${c} = ${r * c}`];
  },
  checkIntegrity(item) {
    const { rows, cols } = item.params;
    const p: string[] = [];
    if (rows < 2 || cols < 2) p.push("layer too small");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

export interface ArrayFactorsConfig {
  totals: number[];
}
export interface ArrayFactorsParams {
  total: number;
  options: Array<{ id: string; rows: number; cols: number }>;
}

/** Arrays with at least 2 rows and 2 in each row, up to 10 × 10. */
function factorPairs(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 2; r <= 10; r++) if (n % r === 0 && n / r >= 2 && n / r <= 10) out.push([r, n / r]);
  return out;
}

export const arrayFactors: QuizMechanic<ArrayFactorsConfig, ArrayFactorsParams> = {
  id: "GEN-ARRAY-FACTORS",
  version: 1,
  mechanicId: "array-factors",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!Array.isArray(c.totals) || c.totals.length === 0) return ["totals required"];
    for (const t of c.totals) if (!isWholeNumber(t) || t < 4 || t > 100 || factorPairs(t).length === 0) p.push(`total ${t} has no array with 2+ rows of 2+`);
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const sorted = [...config.totals].sort((x, y) => x - y);
      const pool = difficulty === 1 ? sorted.slice(0, Math.ceil(sorted.length / 3)) : difficulty === 2 ? sorted.slice(0, Math.ceil((2 * sorted.length) / 3)) : sorted;
      const total = pickOne(rng, pool);
      const pairs = factorPairs(total);
      const nTrue = Math.min(pairs.length, byLevel(difficulty, [2, 3, 4] as const));
      // Level 3 lists every array for the total; lower levels a subset.
      const trues = (difficulty === 3 ? pairs : shuffle(rng, pairs)).slice(0, nTrue);
      const near: Array<[number, number]> = [];
      for (const [r, c] of pairs) near.push([r, c + 1], [r, c - 1], [r + 1, c], [r - 1, c]);
      const sums: Array<[number, number]> = [];
      for (let r = 2; r <= total - 2 && r <= 10; r++) if (total - r <= 10 && r * (total - r) !== total) sums.push([r, total - r]);
      const candidates = difficulty === 1 ? shuffle(rng, near) : shuffle(rng, [...near, ...sums]);
      const nFalse = byLevel(difficulty, [1, 2, 3] as const);
      const falses: Array<[number, number]> = [];
      if (difficulty === 3 && sums.length) falses.push(pickOne(rng, sums));
      for (const [r, c] of candidates) {
        if (falses.length >= nFalse) break;
        if (r < 2 || c < 2 || r > 10 || c > 10 || r * c === total) continue;
        if (falses.some(([x, y]) => x === r && y === c)) continue;
        falses.push([r, c]);
      }
      if (falses.length < nFalse) return null;
      const options = shuffle(rng, [...trues, ...falses]).map(([rows, cols], i) => ({ id: `a${i}`, rows, cols }));
      return makeItem(this, seed, difficulty, {
        params: { total, options },
        prompt: `اختر كل المصفوفات التي عدد المكعبات فيها ${total}.`,
        visual: { type: "b-total", total },
        input: { type: "multi", options: options.map((o) => ({ id: o.id, label: `${rowsText(o.rows)}، في كل صف ${o.cols}` })) },
      });
    });
  },
  solution(item) {
    return item.params.options.filter((o) => o.rows * o.cols === item.params.total).map((o) => o.id);
  },
  check(item, answer) {
    const { total, options } = item.params;
    return checkMulti(
      this.solution(item) as string[],
      options.map((o) => o.id),
      answer,
      (falseIds) => (options.some((o) => falseIds.includes(o.id) && o.rows + o.cols === total) ? "operation_confusion" : "counting_error"),
    );
  },
  explain(item) {
    const { total, options } = item.params;
    const t = options.filter((o) => o.rows * o.cols === total);
    const first = t[0]!;
    return [
      `نتحقق من كل مصفوفة: عدد الصفوف × العدد في كل صف.`,
      `${first.rows} × ${first.cols} = ${total}`,
      `المصفوفات الصحيحة: ${t.map((o) => `${o.rows} × ${o.cols}`).join("، ")}.`,
    ];
  },
  checkIntegrity(item) {
    const { total, options } = item.params;
    const p = multiProblems(item.input, options.filter((o) => o.rows * o.cols === total).length);
    if (new Set(options.map((o) => `${o.rows}x${o.cols}`)).size !== options.length) p.push("duplicate arrays");
    return p;
  },
};

export interface CompareQuantityConfig {
  maxRows: number;
  maxCols: number;
}
export interface CompareQuantityParams {
  a: { rows: number; cols: number };
  b: { rows: number; cols: number };
}
const COMPARE_OPTIONS = [
  { id: "A", label: "العلبة (أ)" },
  { id: "B", label: "العلبة (ب)" },
  { id: "eq", label: "في العلبتين العدد نفسه" },
];

export const compareQuantity: QuizMechanic<CompareQuantityConfig, CompareQuantityParams> = {
  id: "GEN-COMPARE-QUANTITY",
  version: 1,
  mechanicId: "compare-quantity",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!isWholeNumber(c.maxRows) || c.maxRows < 3 || c.maxRows > 8) p.push("maxRows must be 3..8");
    if (!isWholeNumber(c.maxCols) || c.maxCols < 4 || c.maxCols > 8) p.push("maxCols must be 4..8");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const dim = (lo: number) => ({ rows: randInt(rng, lo, config.maxRows), cols: randInt(rng, lo, config.maxCols) });
      const a = dim(2);
      let b = dim(2);
      const wantEqual = difficulty === 1 ? false : rng() < byLevel(difficulty, [0, 0.2, 0.35] as const);
      if (difficulty === 1) {
        // Same row count, clearly different row length (or the reverse).
        b = rng() < 0.5 ? { rows: a.rows, cols: b.cols } : { rows: b.rows, cols: a.cols };
      }
      const ta = a.rows * a.cols;
      const tb = b.rows * b.cols;
      const diff = Math.abs(ta - tb);
      if (a.rows === b.rows && a.cols === b.cols) return null;
      if (wantEqual ? diff !== 0 : diff === 0) return null;
      if (!wantEqual) {
        if (difficulty === 1 && diff < 4) return null;
        if (difficulty === 2 && diff < 3) return null;
        if (difficulty === 3 && diff > 3) return null;
      }
      return makeItem(this, seed, difficulty, {
        params: { a, b },
        prompt: "في كل علبة طبقة مرتبة من المكعبات. أي علبة فيها مكعبات أكثر؟",
        visual: { type: "b-boxes", boxes: [{ label: "أ", ...a }, { label: "ب", ...b }] },
        input: { type: "choice", options: COMPARE_OPTIONS },
      });
    });
  },
  solution(item) {
    const ta = item.params.a.rows * item.params.a.cols;
    const tb = item.params.b.rows * item.params.b.cols;
    return ta === tb ? "eq" : ta > tb ? "A" : "B";
  },
  check(item, answer) {
    const expected = this.solution(item) as string;
    const id = choiceId(answer, item.input);
    if (id === null) return wrong(expected, answer, "input_invalid");
    if (id === expected) return ok();
    // Picking the box with fewer cubes reverses the comparison; "equal" vs unequal is a miscount.
    return wrong(expected, answer, id !== "eq" && expected !== "eq" ? "comparison_direction" : "counting_error");
  },
  explain(item) {
    const { a, b } = item.params;
    const ta = a.rows * a.cols;
    const tb = b.rows * b.cols;
    const verdict = ta === tb ? "في العلبتين العدد نفسه." : ta > tb ? `${ta} > ${tb}، إذن في العلبة (أ) مكعبات أكثر.` : `${tb} > ${ta}، إذن في العلبة (ب) مكعبات أكثر.`;
    return [`العلبة (أ): ${a.rows} × ${a.cols} = ${ta}`, `العلبة (ب): ${b.rows} × ${b.cols} = ${tb}`, verdict];
  },
  checkIntegrity(item) {
    return [...exactlyOneCorrect(this, item), ...(item.input.type === "choice" ? optionProblems(item.input.options) : [])];
  },
};

/* ------------------------------------------------------------------ */
/* division (p.43): sharing biscuits                                   */
/* ------------------------------------------------------------------ */

export interface DivisionConfig {
  maxTotal: number;
  divisors: number[];
}

function divisionConfigProblems(c: DivisionConfig): string[] {
  const p: string[] = [];
  if (!isWholeNumber(c.maxTotal) || c.maxTotal < 4 || c.maxTotal > 50) p.push("maxTotal must be 4..50");
  if (!Array.isArray(c.divisors) || c.divisors.length === 0) return [...p, "divisors required"];
  for (const d of c.divisors) if (!isWholeNumber(d) || d < 2 || d > 10 || 2 * d > c.maxTotal) p.push(`bad divisor ${d}`);
  return p;
}

/** A total in (minTotal, cap] that is a multiple of a divisor, with a quotient of at least 2. */
function drawDivision(rng: Rng, config: DivisionConfig, cap: number, minTotal: number): { total: number; divisor: number } | null {
  const qLow = (d: number) => Math.max(2, Math.floor(minTotal / d) + 1);
  const fitting = config.divisors.filter((d) => qLow(d) * d <= cap);
  if (!fitting.length) return null;
  const divisor = pickOne(rng, fitting);
  const quotient = randInt(rng, qLow(divisor), Math.floor(cap / divisor));
  return { total: divisor * quotient, divisor };
}
/** Level 1: up to 10 biscuits; level 2: up to maxTotal; level 3: more than half of maxTotal. */
const levelCap = (d: Difficulty, c: DivisionConfig) =>
  d === 1 ? Math.min(c.maxTotal, Math.max(10, 2 * Math.min(...c.divisors))) : c.maxTotal;
const levelMin = (d: Difficulty, c: DivisionConfig) => (d === 3 ? Math.floor(c.maxTotal / 2) : 0);

export interface DivisionShareParams {
  total: number;
  divisor: number;
  /** share: total shared onto `divisor` plates; group: groups of `divisor`. */
  mode: "share" | "group";
}

export const divisionShare: QuizMechanic<DivisionConfig, DivisionShareParams> = {
  id: "GEN-DIVISION-SHARE",
  version: 1,
  mechanicId: "division-share",
  difficulties: [1, 2, 3],
  validateConfig: divisionConfigProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const draw = drawDivision(rng, config, levelCap(difficulty, config), levelMin(difficulty, config));
      if (!draw) return null;
      const mode: DivisionShareParams["mode"] = difficulty === 1 ? "share" : rng() < 0.5 ? "share" : "group";
      const { total: n, divisor: d } = draw;
      const prompt =
        mode === "share"
          ? `عدد قطع البسكويت ${n}، وعدد الأطباق ${d}. نوزّع القطع على الأطباق بالتساوي. كم قطعة في كل طبق؟`
          : `عدد قطع البسكويت ${n}. نريد أن يكون في كل كيس ${countOf(d, NOUNS.piece)} بالضبط. كم كيسًا نحتاج؟`;
      return makeItem(this, seed, difficulty, {
        params: { total: n, divisor: d, mode },
        prompt,
        visual: { type: "b-share", total: n, divisor: d, mode, distributed: false, showItems: difficulty < 3 },
        input: { type: "number", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return item.params.total / item.params.divisor;
  },
  check(item, answer) {
    const { total: n, divisor: d } = item.params;
    return checkWhole(n / d, answer, [
      [n * d, "operation_confusion"],
      [n - d, "operation_confusion"],
      [n + d, "operation_confusion"],
    ]);
  },
  explain(item) {
    const { total: n, divisor: d, mode } = item.params;
    const q = n / d;
    if (mode === "share") return [`نضع قطعة واحدة في كل طبق، ونكرر حتى تنتهي القطع.`, `${n} ÷ ${d} = ${q}`, `نتحقق: ${d} × ${q} = ${n}`];
    return [`نعدّ بالقفز ${d}: ${skipSequence(d, q).join("، ")}.`, `عدد المجموعات ${q}.`, `${n} ÷ ${d} = ${q}`];
  },
  checkIntegrity(item) {
    const { total: n, divisor: d } = item.params;
    const p: string[] = [];
    if (!(n % d === 0 && n / d >= 2)) p.push("total must be a multiple of the divisor");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

export interface DivisionSentenceParams {
  total: number;
  divisor: number;
  options: Array<{ id: string; x: number; op: "÷" | "×" | "-"; y: number; z: number }>;
}

/** Correct iff the sentence is total ÷ plates = biscuits per plate. */
const isShareSentence = (p: DivisionSentenceParams, o: DivisionSentenceParams["options"][number]) =>
  o.op === "÷" && o.x === p.total && o.y === p.divisor && o.z === p.total / p.divisor;

export const divisionSentence: QuizMechanic<DivisionConfig, DivisionSentenceParams> = {
  id: "GEN-DIVISION-SENTENCE",
  version: 1,
  mechanicId: "division-sentence",
  difficulties: [1, 2, 3],
  validateConfig: divisionConfigProblems,
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const draw = drawDivision(rng, config, levelCap(difficulty, config), levelMin(difficulty, config));
      if (!draw) return null;
      const { total: n, divisor: d } = draw;
      const q = n / d;
      // The other true reading (n ÷ q = d) is never offered, so exactly one option is right.
      const reversed = { x: d, op: "÷" as const, y: n, z: q };
      const wrongQ = { x: n, op: "÷" as const, y: d, z: q + (rng() < 0.5 || q <= 2 ? 1 : -1) };
      const mulSign = { x: n, op: "×" as const, y: d, z: q };
      const minus = { x: n, op: "-" as const, y: d, z: n - d };
      const distractors = difficulty === 1 ? [reversed, wrongQ] : difficulty === 2 ? [reversed, wrongQ, mulSign] : shuffle(rng, [reversed, wrongQ, mulSign, minus]).slice(0, 3);
      const all = shuffle(rng, [{ x: n, op: "÷" as const, y: d, z: q }, ...distractors]).map((o, i) => ({ id: `d${i}`, ...o }));
      return makeItem(this, seed, difficulty, {
        params: { total: n, divisor: d, options: all },
        prompt: "وزّعنا قطع البسكويت على الأطباق بالتساوي كما في الصورة. اختر جملة القسمة المناسبة.",
        visual: { type: "b-share", total: n, divisor: d, mode: "share", distributed: true, showItems: true },
        input: { type: "choice", options: all.map((o) => ({ id: o.id, label: `${o.x} ${o.op} ${o.y} = ${o.z}` })) },
      });
    });
  },
  solution(item) {
    return item.params.options.find((o) => isShareSentence(item.params, o))?.id ?? null;
  },
  check(item, answer) {
    const expected = this.solution(item);
    const id = choiceId(answer, item.input);
    const picked = item.params.options.find((o) => o.id === id);
    if (!picked) return wrong(expected, answer, "input_invalid");
    if (isShareSentence(item.params, picked)) return ok();
    if (picked.op !== "÷") return wrong(expected, answer, "operation_confusion");
    if (picked.x === item.params.total && picked.y === item.params.divisor) return wrong(expected, answer, "counting_error");
    return wrong(expected, answer, "other"); // numbers in the wrong order
  },
  explain(item) {
    const { total: n, divisor: d } = item.params;
    return [`عدد القطع ${n}، وعدد الأطباق ${d}.`, `في كل طبق ${countOf(n / d, NOUNS.piece)}.`, `${n} ÷ ${d} = ${n / d}`];
  },
  checkIntegrity(item) {
    const p = [...exactlyOneCorrect(this, item), ...(item.input.type === "choice" ? optionProblems(item.input.options) : [])];
    if (item.params.total % item.params.divisor !== 0) p.push("total must be a multiple of the divisor");
    return p;
  },
};

export const MULTIPLICATIVE_MECHANICS = [
  skipCountGroups,
  groupsReverse,
  double,
  doubleReverse,
  arraySentences,
  arrayBuild,
  arrayCount,
  arrayFactors,
  compareQuantity,
  divisionShare,
  divisionSentence,
] as const;
