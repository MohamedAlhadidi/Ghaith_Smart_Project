/**
 * Omani money (MATH-S1 L27 p30): totals, change, which note was paid, rials and baisa.
 * Amounts are whole rials as in the book (plus 500-baisa halves). Visuals are plain value cards:
 * banknote images (marked «نموذج» in the book) are never reproduced.
 */
import type { ErrorType } from "../types";
import {
  byLevel,
  exactlyOneCorrect,
  isWholeNumber,
  makeItem,
  ok,
  optionProblems,
  optionValue,
  randInt,
  sample,
  shuffle,
  wrong,
  type AnswerInput,
  type QuizMechanic,
  type Visual,
} from "../quiz";
import type { Rng } from "../rng";
import { checkWhole, choiceId, pickOne, rials } from "./B_common";

/** Omani rial notes from the p.30 page (the 100- and 500-baisa notes are handled as baisa). */
export const RIAL_NOTES = [1, 5, 10, 20, 50] as const;

interface ShopItem {
  name: string;
  /** Accusative form for «اشتريت ...». */
  acc: string;
  range: [number, number];
}
const SHOP: readonly ShopItem[] = [
  { name: "شطيرة", acc: "شطيرة", range: [1, 2] },
  { name: "كتاب", acc: "كتابًا", range: [2, 5] },
  { name: "حذاء", acc: "حذاءً", range: [5, 10] },
  { name: "قلم", acc: "قلمًا", range: [1, 2] },
  { name: "كرة", acc: "كرة", range: [2, 6] },
  { name: "حقيبة", acc: "حقيبة", range: [5, 10] },
  { name: "عصير", acc: "عصيرًا", range: [1, 2] },
  { name: "لعبة", acc: "لعبة", range: [3, 8] },
  { name: "قميص", acc: "قميصًا", range: [4, 9] },
];
const accOf = (name: string) => SHOP.find((s) => s.name === name)?.acc ?? name;

export interface PricedItem {
  name: string;
  price: number;
}
const priceTags = (items: readonly PricedItem[]) => items.map((i) => ({ name: i.name, text: rials(i.price) }));
const sumOf = (items: readonly PricedItem[]) => items.reduce((s, i) => s + i.price, 0);
const boughtText = (items: readonly PricedItem[]) => items.map((i) => accOf(i.name)).join(" و");

/** A shop item whose usual price range fits the price (cheap things stay cheap). */
function itemForPrice(rng: Rng, price: number, exclude: readonly string[]): string {
  const fits = SHOP.filter((s) => !exclude.includes(s.name) && (price > 10 ? s.range[1] >= 8 : price >= s.range[0] && price <= s.range[1]));
  const any = SHOP.filter((s) => !exclude.includes(s.name));
  return pickOne(rng, fits.length ? fits : any).name;
}

function shopItems(rng: Rng, count: number, maxPrice: number): PricedItem[] {
  return shuffle(rng, SHOP)
    .slice(0, count)
    .map((s) => {
      const hi = Math.min(s.range[1], maxPrice);
      return { name: s.name, price: randInt(rng, Math.min(s.range[0], hi), hi) };
    });
}

function notesProblems(notes: unknown): string[] {
  if (!Array.isArray(notes) || notes.length === 0) return ["notes required"];
  const p: string[] = [];
  for (const n of notes) if (!(RIAL_NOTES as readonly number[]).includes(n)) p.push(`unknown note ${String(n)}`);
  if (new Set(notes).size !== notes.length) p.push("duplicate notes");
  return p;
}

/* ------------------------------------------------------------------ */
/* money-total                                                         */
/* ------------------------------------------------------------------ */

export interface MoneyTotalConfig {
  maxPrice: number;
}
export interface MoneyTotalParams {
  items: PricedItem[];
}
/** Book example (p.30): sandwich 1 rial, book 2 rials, shoes 5 rials. */
const BOOK_BASKET: PricedItem[] = [
  { name: "شطيرة", price: 1 },
  { name: "كتاب", price: 2 },
  { name: "حذاء", price: 5 },
];

export const moneyTotal: QuizMechanic<MoneyTotalConfig, MoneyTotalParams> = {
  id: "GEN-MONEY-TOTAL",
  version: 1,
  mechanicId: "money-total",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.maxPrice) && c.maxPrice >= 5 && c.maxPrice <= 30 ? [] : ["maxPrice must be 5..30"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1: two items within 10 rials; level 2: three items (sometimes the book basket); level 3: three dearer items.
      const items = difficulty === 2 && rng() < 0.2 ? shuffle(rng, BOOK_BASKET) : shopItems(rng, difficulty === 1 ? 2 : 3, config.maxPrice);
      const total = sumOf(items);
      if (difficulty === 1 && total > 10) return null;
      if (difficulty === 2 && total > 20) return null;
      if (difficulty === 3 && total < 15) return null;
      return makeItem(this, seed, difficulty, {
        params: { items },
        prompt: `اشتريت ${boughtText(items)}. كم ريالًا ستدفع؟`,
        visual: { type: "b-price-tags", items: priceTags(items) },
        input: { type: "number", unit: "ريال", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return sumOf(item.params.items);
  },
  check(item, answer) {
    const total = sumOf(item.params.items);
    return checkWhole(
      total,
      answer,
      item.params.items.map((i) => [total - i.price, "partial_answer"] as const), // one item forgotten
    );
  },
  explain(item) {
    const items = item.params.items;
    const total = sumOf(items);
    const desc = [...items].sort((a, b) => b.price - a.price);
    return [
      items.map((i) => `${i.name}: ${rials(i.price)}`).join("، "),
      `نبدأ بأكبر ثمن: ${desc.map((i) => i.price).join(" + ")} = ${total}`,
      `ستدفع ${rials(total)}.`,
    ];
  },
  checkIntegrity(item) {
    const p: string[] = [];
    if (item.params.items.some((i) => !(isWholeNumber(i.price) && i.price >= 1))) p.push("prices must be whole rials");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* money-change                                                        */
/* ------------------------------------------------------------------ */

export interface MoneyNotesConfig {
  notes: number[];
}
export interface MoneyChangeParams {
  note: number;
  items: PricedItem[];
}

export const moneyChange: QuizMechanic<MoneyNotesConfig, MoneyChangeParams> = {
  id: "GEN-MONEY-CHANGE",
  version: 1,
  mechanicId: "money-change",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = notesProblems(c.notes);
    if (Array.isArray(c.notes) && !c.notes.some((n) => n >= 5)) p.push("needs a note of at least 5 rials");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const usable = config.notes.filter((n) => n >= 5);
      const small = usable.filter((n) => n <= 10);
      const big = usable.filter((n) => n >= 10);
      const note = pickOne(rng, difficulty === 1 ? (small.length ? small : usable) : difficulty === 3 ? (big.length ? big : usable) : usable);
      let prices: number[];
      if (difficulty === 1) {
        // Book: 10 rials, buy 7 -> 3 left. Small change first.
        prices = [randInt(rng, Math.max(1, note - 4), note - 1)];
      } else if (difficulty === 2) {
        prices = [randInt(rng, 1, note - 1)];
      } else {
        const p1 = randInt(rng, 1, note - 2);
        prices = [p1, randInt(rng, 1, note - 1 - p1)];
        if (p1 + prices[1]! < note / 2) return null;
      }
      const items: PricedItem[] = [];
      for (const price of prices) items.push({ name: itemForPrice(rng, price, items.map((i) => i.name)), price });
      const priced = items.map((i) => `${accOf(i.name)} بـ ${rials(i.price)}`).join(" و");
      return makeItem(this, seed, difficulty, {
        params: { note, items },
        prompt: `معك ${rials(note)}. اشتريت ${priced}. كم ريالًا يبقى معك؟`,
        visual: { type: "b-pay", paid: rials(note), items: priceTags(items), change: null },
        input: { type: "number", unit: "ريال", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return item.params.note - sumOf(item.params.items);
  },
  check(item, answer) {
    const { note, items } = item.params;
    const cost = sumOf(items);
    const specific: Array<readonly [number, ErrorType]> = [
      [note + cost, "operation_confusion"],
      [cost, "other"],
    ];
    if (items.length > 1) for (const i of items) specific.push([note - i.price, "partial_answer"]);
    return checkWhole(note - cost, answer, specific);
  },
  explain(item) {
    const { note, items } = item.params;
    const cost = sumOf(items);
    const steps = ["الباقي = ما دفعته - الثمن."];
    if (items.length > 1) steps.push(`الثمن: ${items.map((i) => i.price).join(" + ")} = ${cost}`);
    steps.push(`${note} - ${cost} = ${note - cost}`, `نتحقق: ${cost} + ${note - cost} = ${note}`);
    return steps;
  },
  checkIntegrity(item) {
    const { note, items } = item.params;
    const p: string[] = [];
    if (!(RIAL_NOTES as readonly number[]).includes(note)) p.push("unknown note");
    if (!(sumOf(items) >= 1 && sumOf(items) < note)) p.push("price must be less than the note");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* money-note: which note was paid?                                    */
/* ------------------------------------------------------------------ */

export interface MoneyNoteParams {
  items: PricedItem[];
  change: number;
  /** Notes offered as options. */
  offered: number[];
}

export const moneyNote: QuizMechanic<MoneyNotesConfig, MoneyNoteParams> = {
  id: "GEN-MONEY-NOTE",
  version: 1,
  mechanicId: "money-note",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = notesProblems(c.notes);
    if (Array.isArray(c.notes) && c.notes.filter((n) => n >= 5).length < 2) p.push("needs at least two notes of 5 rials or more");
    if (Array.isArray(c.notes) && c.notes.length < 3) p.push("needs at least three notes to offer");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const usable = config.notes.filter((n) => n >= 5);
      const pool = difficulty === 1 ? usable.filter((n) => n <= 10) : difficulty === 2 ? usable.filter((n) => n <= 20) : usable.filter((n) => n >= 10);
      const note = pickOne(rng, pool.length ? pool : usable);
      const p1 = randInt(rng, 1, Math.min(10, note - (difficulty === 3 ? 2 : 1)));
      const prices = difficulty === 3 ? [p1, randInt(rng, 1, Math.min(10, note - 1 - p1))] : [p1];
      const items: PricedItem[] = [];
      for (const price of prices) items.push({ name: itemForPrice(rng, price, items.map((i) => i.name)), price });
      const change = note - sumOf(items);
      const count = byLevel(difficulty, [3, 4, config.notes.length] as const);
      const others = shuffle(rng, config.notes.filter((n) => n !== note)).slice(0, Math.max(0, count - 1));
      const offered = [note, ...others].sort((a, b) => a - b);
      const what = items.length === 1 ? `ثمن ${items[0]!.name} ${rials(items[0]!.price)}` : `اشتريت ${items.map((i) => `${accOf(i.name)} بـ ${rials(i.price)}`).join(" و")}`;
      return makeItem(this, seed, difficulty, {
        params: { items, change, offered },
        prompt: `${what}، وأرجع لك البائع ${rials(change)}. أي ورقة نقدية دفعت؟`,
        visual: { type: "b-pay", paid: null, items: priceTags(items), change: rials(change) },
        input: { type: "choice", options: offered.map((v) => ({ id: `n${v}`, label: rials(v) })) },
      });
    });
  },
  solution(item) {
    return `n${sumOf(item.params.items) + item.params.change}`;
  },
  check(item, answer) {
    const expected = this.solution(item);
    const id = choiceId(answer, item.input);
    const value = optionValue(id);
    if (id === null || value === null) return wrong(expected, answer, "input_invalid");
    const cost = sumOf(item.params.items);
    if (value === cost + item.params.change) return ok();
    return wrong(expected, answer, value === Math.abs(cost - item.params.change) ? "operation_confusion" : "other");
  },
  explain(item) {
    const cost = sumOf(item.params.items);
    const { change } = item.params;
    return ["الورقة التي دفعتها = الثمن + الباقي.", `${cost} + ${change} = ${cost + change}`, `دفعت ورقة من فئة ${rials(cost + change)}.`];
  },
  checkIntegrity(item) {
    const p = [...exactlyOneCorrect(this, item), ...(item.input.type === "choice" ? optionProblems(item.input.options) : [])];
    if (!(RIAL_NOTES as readonly number[]).includes(sumOf(item.params.items) + item.params.change)) p.push("paid note does not exist");
    if (item.params.change < 1) p.push("change must be at least 1 rial");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* money-baisa: 1 rial = 1000 baisa, two 500-baisa make a rial         */
/* ------------------------------------------------------------------ */

export interface MoneyBaisaConfig {
  maxRials: number;
}
export type MoneyBaisaParams =
  | { kind: "rial-baisa" }
  | { kind: "halves-in-rials"; rials: number; extraHalf: boolean }
  | { kind: "halves-to-rials"; halves: number };

const RIAL_CARD = "1 ريال";
const HALF_CARD = "500 بيسة";

export const moneyBaisa: QuizMechanic<MoneyBaisaConfig, MoneyBaisaParams> = {
  id: "GEN-MONEY-BAISA",
  version: 1,
  mechanicId: "money-baisa",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.maxRials) && c.maxRials >= 2 && c.maxRials <= 10 ? [] : ["maxRials must be 2..10"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const kind = pickOne(rng, byLevel(difficulty, [["rial-baisa", "halves-in-rials"], ["halves-in-rials", "halves-to-rials"], ["halves-in-rials", "halves-to-rials"]] as const));
      let params: MoneyBaisaParams;
      let prompt: string;
      let cards: string[];
      let input: AnswerInput;
      if (kind === "rial-baisa") {
        params = { kind };
        prompt = "الريال العُماني الواحد = كم بيسة؟";
        cards = [RIAL_CARD];
        input = { type: "choice", options: shuffle(rng, [10, 100, 500, 1000]).map((v) => ({ id: `n${v}`, label: `${v} بيسة` })) };
      } else if (kind === "halves-in-rials") {
        // Book: how many 500 baisa in one rial? (2). Then more rials; level 3 adds a half rial.
        const extraHalf = difficulty === 3;
        const k = difficulty === 1 ? 1 : randInt(rng, extraHalf ? 1 : 2, extraHalf ? config.maxRials - 1 : config.maxRials);
        params = { kind, rials: k, extraHalf };
        const amount = k === 1 && !extraHalf ? "الريال العُماني الواحد" : `${rials(k)}${extraHalf ? " و500 بيسة" : ""}`;
        prompt = `كم 500 بيسة في ${amount}؟`;
        cards = [...Array.from({ length: k }, () => RIAL_CARD), ...(extraHalf ? [HALF_CARD] : [])];
        input = { type: "number", maxDigits: 2 };
      } else {
        const k = randInt(rng, difficulty === 2 ? 1 : 2, config.maxRials);
        params = { kind, halves: 2 * k };
        prompt = `معك ${2 * k} من فئة 500 بيسة. كم ريالًا معك؟`;
        cards = Array.from({ length: 2 * k }, () => HALF_CARD);
        input = { type: "number", unit: "ريال", maxDigits: 2 };
      }
      const visual: Visual = { type: "b-money-cards", cards };
      return makeItem(this, seed, difficulty, { params, prompt, visual, input });
    });
  },
  solution(item) {
    const p = item.params;
    if (p.kind === "rial-baisa") return "n1000";
    if (p.kind === "halves-in-rials") return 2 * p.rials + (p.extraHalf ? 1 : 0);
    return p.halves / 2;
  },
  check(item, answer) {
    const p = item.params;
    if (p.kind === "rial-baisa") {
      const id = choiceId(answer, item.input);
      if (id === null) return wrong("n1000", answer, "input_invalid");
      return id === "n1000" ? ok() : wrong("n1000", answer, "unit_confusion");
    }
    if (p.kind === "halves-in-rials") {
      const expected = 2 * p.rials + (p.extraHalf ? 1 : 0);
      return checkWhole(expected, answer, [[p.rials, "unit_confusion"], [2 * p.rials, "partial_answer"]], { 1: "off_by_one" });
    }
    return checkWhole(p.halves / 2, answer, [[p.halves * 2, "operation_confusion"], [p.halves, "unit_confusion"], [p.halves * 500, "unit_confusion"]], { 1: "off_by_one" });
  },
  explain(item) {
    const p = item.params;
    if (p.kind === "rial-baisa") return ["الريال العُماني = 1000 بيسة.", "500 + 500 = 1000، إذن نصف الريال 500 بيسة."];
    if (p.kind === "halves-in-rials") {
      const steps = ["في الريال الواحد 500 بيسة مرتين: 500 + 500 = 1000."];
      steps.push(p.rials === 1 ? "إذن في الريال 2 من فئة 500 بيسة." : `في ${rials(p.rials)}: ${p.rials} × 2 = ${2 * p.rials}`);
      if (p.extraHalf) steps.push(`ونضيف 500 بيسة أخرى: ${2 * p.rials} + 1 = ${2 * p.rials + 1}`);
      return steps;
    }
    const k = p.halves / 2;
    return ["كل اثنين من فئة 500 بيسة يساويان ريالًا واحدًا.", `نعدّ أزواجًا: ${Array.from({ length: k }, (_, i) => 2 * (i + 1)).join("، ")}.`, `عدد الأزواج ${k}، إذن معك ${rials(k)}.`];
  },
  checkIntegrity(item) {
    const p = item.params;
    if (p.kind === "rial-baisa") return [...exactlyOneCorrect(this, item), ...(item.input.type === "choice" ? optionProblems(item.input.options) : [])];
    if (p.kind === "halves-to-rials" && p.halves % 2 !== 0) return ["halves must pair into whole rials"];
    return item.input.type === "number" ? [] : ["expects number input"];
  },
};

export const MONEY_MECHANICS = [moneyTotal, moneyChange, moneyNote, moneyBaisa] as const;
