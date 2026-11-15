/**
 * Generic, data-driven item model used by most math mechanics.
 *
 * An item carries `params` (the minimal facts of the problem) plus presentation
 * (`prompt`, `visual`, `input`). It never stores "the correct answer": `check()`
 * recomputes the expected answer from `params`, so a corrupted or tampered item
 * cannot make a wrong answer pass.
 *
 * Prompts are LOGICAL Arabic text with Western digits; the UI converts digits to
 * Arabic-Indic and renders inside an RTL container, which reproduces the book's
 * visual form of equations (e.g. logical "24 - 9 = 15" shows as «١٥ = ٩ − ٢٤»).
 */
import type { Difficulty, ErrorType, ItemMeta, ValidationResult } from "./types";
import { createRng, randInt, shuffle, type Rng } from "./rng";

export interface ChoiceOption {
  id: string;
  /** Logical text (Western digits); rendered with Arabic-Indic digits. */
  label: string;
}

export type AnswerInput =
  | { type: "number"; unit?: string; maxDigits?: number }
  | { type: "choice"; options: ChoiceOption[] }
  | { type: "multi"; options: ChoiceOption[]; exactly?: number }
  /** `joiner` (when set): the UI shows the chosen tiles joined into one text, e.g. "" for syllables → word. */
  | { type: "order"; items: ChoiceOption[]; joiner?: string }
  /** The answer is produced by interacting with the visual (tap cells, place on a line...). */
  | { type: "visual" };

/** Visuals are open-ended: each mechanic defines its own `type` and fields. */
export interface Visual {
  type: string;
  [key: string]: unknown;
}

export const NO_VISUAL: Visual = { type: "none" };

export interface QuizItem<P = unknown> extends ItemMeta {
  kind: "quiz";
  params: P;
  prompt: string;
  visual: Visual;
  input: AnswerInput;
  /** "en" = English content: rendered left-to-right with Western digits; default Arabic. */
  lang?: "ar" | "en";
  /** Short Arabic helper line shown under an English prompt (for the child or parent). */
  promptAr?: string;
}

export interface QuizMechanic<C = Record<string, unknown>, P = unknown> {
  /** Generator id, e.g. GEN-COMPLEMENT. */
  id: string;
  version: number;
  /** Mechanic id used by lesson catalogues, e.g. "complement". */
  mechanicId: string;
  difficulties: readonly Difficulty[];
  /** Problems with a config object; empty list = config usable. */
  validateConfig(config: C): string[];
  generate(seed: number, difficulty: Difficulty, config: C): QuizItem<P>;
  /** Deterministic validation recomputed from params. */
  check(item: QuizItem<P>, answer: unknown): ValidationResult;
  /** A correct answer (for reveal, worked examples and tests), derived from params. */
  solution(item: QuizItem<P>): unknown;
  /** Worked-example steps in Arabic (logical text). */
  explain(item: QuizItem<P>): string[];
  /** Pre-publication checks: empty list = publishable. */
  checkIntegrity(item: QuizItem<P>): string[];
}

/* ------------------------------------------------------------------ */
/* Helpers shared by mechanic modules                                  */
/* ------------------------------------------------------------------ */

export function makeItem<P>(
  mech: Pick<QuizMechanic, "id" | "version" | "mechanicId">,
  seed: number,
  difficulty: Difficulty,
  body: { params: P; prompt: string; visual?: Visual; input: AnswerInput; lang?: "ar" | "en"; promptAr?: string },
): QuizItem<P> {
  return {
    ...(body.lang ? { lang: body.lang } : {}),
    ...(body.promptAr ? { promptAr: body.promptAr } : {}),
    kind: "quiz",
    generatorId: mech.id,
    generatorVersion: mech.version,
    mechanicId: mech.mechanicId,
    seed,
    difficulty,
    layout: "rtl",
    params: body.params,
    prompt: body.prompt,
    visual: body.visual ?? NO_VISUAL,
    input: body.input,
  };
}

/** Run `attempt` with fresh rng draws until it returns a value (rejection sampling). */
export function sample<T>(seed: number, attempt: (rng: Rng) => T | null, tries = 1000): T {
  const rng = createRng(seed);
  for (let i = 0; i < tries; i++) {
    const out = attempt(rng);
    if (out !== null) return out;
  }
  throw new Error(`could not generate an item for seed ${seed}`);
}

export const ok = (): ValidationResult => ({ correct: true, errors: [] });

export function wrong(expected: unknown, given: unknown, errorType: ErrorType, key = "answer"): ValidationResult {
  return { correct: false, errors: [{ key, expected: expected as number, given, errorType }] };
}

export function isWholeNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

/** Build shuffled numeric options (as strings ids "n<value>") from a correct value and distractors. */
export function numberOptions(rng: Rng, correct: number, distractors: number[], count = 4): ChoiceOption[] {
  const values = [correct];
  for (const d of distractors) {
    if (values.length >= count) break;
    if (!values.includes(d)) values.push(d);
  }
  return shuffle(rng, values).map((v) => ({ id: `n${v}`, label: String(v) }));
}

export const optionValue = (id: unknown): number | null =>
  typeof id === "string" && /^n-?\d+$/.test(id) ? Number(id.slice(1)) : null;

/** Integrity: options unique by id and label. */
export function optionProblems(options: ChoiceOption[]): string[] {
  const problems: string[] = [];
  if (new Set(options.map((o) => o.id)).size !== options.length) problems.push("duplicate option ids");
  if (new Set(options.map((o) => o.label)).size !== options.length) problems.push("duplicate option labels");
  return problems;
}

/** Integrity for single-choice items: exactly one option passes `check`. */
export function exactlyOneCorrect<P>(mech: QuizMechanic<never, P>, item: QuizItem<P>): string[] {
  if (item.input.type !== "choice") return ["not a choice item"];
  const correct = item.input.options.filter((o) => mech.check(item, o.id).correct).length;
  return correct === 1 ? [] : [`expected exactly one correct option, found ${correct}`];
}

/** Compare two id lists as sets. */
export function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));
}

export function asStringArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null;
}

/** Pick a value for the difficulty from [easy, medium, hard] tuples. */
export function byLevel<T>(difficulty: Difficulty, values: readonly [T, T, T]): T {
  return values[difficulty - 1] as T;
}

export { randInt, shuffle };
