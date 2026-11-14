/**
 * Shared helpers for executor-B mechanics (multiplicative thinking, geometry, measurement, money).
 * Everything here is pure and deterministic; validators recompute answers from item params.
 */
import type { ErrorType, ValidationResult } from "../types";
import { asStringArray, isWholeNumber, ok, optionProblems, randInt, wrong, type AnswerInput } from "../quiz";
import type { Rng } from "../rng";

export type Range = readonly [number, number];

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError("pick from empty list");
  return items[randInt(rng, 0, items.length - 1)]!;
}

/** Distance rules used after the specific confusions: ±1 -> off_by_one, ±10 -> counting_error. */
export const DEFAULT_NEAR: Readonly<Record<number, ErrorType>> = { 1: "off_by_one", 10: "counting_error" };

/**
 * Validate a whole-number answer. `specific` lists known confusions (value -> error type), tried in
 * order; then `near` maps the distance from the expected value to an error type; else "other".
 */
export function checkWhole(
  expected: number,
  given: unknown,
  specific: ReadonlyArray<readonly [number, ErrorType]> = [],
  near: Readonly<Record<number, ErrorType>> = DEFAULT_NEAR,
): ValidationResult {
  if (given === expected) return ok();
  if (!isWholeNumber(given)) return wrong(expected, given, "input_invalid");
  for (const [value, type] of specific) if (value !== expected && value === given) return wrong(expected, given, type);
  return wrong(expected, given, near[Math.abs(given - expected)] ?? "other");
}

/**
 * Validate a multi-select answer against the ids that are true. Unknown/duplicate/empty -> input_invalid;
 * any false id picked -> `falseError(falseIds)`; true ids missing -> partial_answer.
 */
export function checkMulti(
  trueIds: readonly string[],
  allIds: readonly string[],
  answer: unknown,
  falseError: (falseIds: string[]) => ErrorType,
): ValidationResult {
  const ids = asStringArray(answer);
  if (!ids || ids.length === 0 || new Set(ids).size !== ids.length || ids.some((id) => !allIds.includes(id))) {
    return wrong(trueIds, answer, "input_invalid");
  }
  const falsePicked = ids.filter((id) => !trueIds.includes(id));
  if (falsePicked.length) return wrong(trueIds, answer, falseError(falsePicked));
  return trueIds.every((id) => ids.includes(id)) ? ok() : wrong(trueIds, answer, "partial_answer");
}

/** Integrity for multi-select items: unique options, at least one true and one false option. */
export function multiProblems(input: AnswerInput, trueCount: number): string[] {
  if (input.type !== "multi") return ["expects multi input"];
  const p = optionProblems(input.options);
  if (trueCount < 1) p.push("needs at least one correct option");
  if (trueCount >= input.options.length) p.push("needs at least one incorrect option");
  return p;
}

/** The id picked in a single-choice answer, or null when it is not one of the options. */
export function choiceId(answer: unknown, input: AnswerInput): string | null {
  if (typeof answer !== "string") return null;
  if (input.type !== "choice") return null;
  return input.options.some((o) => o.id === answer) ? answer : null;
}

export const skipSequence = (step: number, count: number): number[] => Array.from({ length: count }, (_, i) => step * (i + 1));

export const repeatAdd = (term: number, times: number): string => Array.from({ length: times }, () => String(term)).join(" + ");

/** Rial amount as printed on p.30: «1 ريال», «2 ريال», «5 ريالات», «20 ريالًا». */
export function rials(n: number): string {
  return `${n} ${n >= 3 && n <= 10 ? "ريالات" : n >= 11 ? "ريالًا" : "ريال"}`;
}

/** Sign-symmetric rounding to 2 decimals, so mirrored coordinates stay exact mirrors. */
export function round2(v: number): number {
  const r = Math.round(Math.abs(v) * 100) / 100;
  return v < 0 && r !== 0 ? -r : r;
}

/** Arabic counted-noun forms: 1, 2, 3-10 (plural), 11+ (singular accusative). */
export interface NounForms {
  one: string;
  two: string;
  few: string;
  many: string;
}
export function countOf(n: number, f: NounForms): string {
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  return `${n} ${n >= 3 && n <= 10 ? f.few : f.many}`;
}
export const NOUNS = {
  square: { one: "مربع واحد", two: "مربعان", few: "مربعات", many: "مربعًا" },
  squareAcc: { one: "مربعًا واحدًا", two: "مربعين", few: "مربعات", many: "مربعًا" },
  cube: { one: "مكعب واحد", two: "مكعبان", few: "مكعبات", many: "مكعبًا" },
  piece: { one: "قطعة واحدة", two: "قطعتان", few: "قطع", many: "قطعة" },
  second: { one: "ثانية واحدة", two: "ثانيتان", few: "ثوانٍ", many: "ثانية" },
  minuteAcc: { one: "دقيقة واحدة", two: "دقيقتين", few: "دقائق", many: "دقيقة" },
} satisfies Record<string, NounForms>;
