/**
 * Shared helpers for the Arabic («أحب لغتي») mechanics. Book data lives in the lesson
 * catalogue (content/curriculum/arabic/s1/lessons.json) and reaches a mechanic as `config`;
 * nothing here stores an answer.
 */
import type { Difficulty, ErrorType, ValidationResult } from "../types";
import { asStringArray, exactlyOneCorrect, ok, optionProblems, wrong, type ChoiceOption, type QuizItem, type QuizMechanic } from "../quiz";
import type { Rng } from "../rng";
import { bare, noTatweel } from "./text";

/** A printed source position: page number as printed in the book. */
export interface Paged {
  page: number;
}

export const optId = (i: number) => `o${i}`;
export const optIndex = (id: unknown): number | null => (typeof id === "string" && /^o\d+$/.test(id) ? Number(id.slice(1)) : null);

export function drawDistinct<T>(rng: Rng, items: readonly T[], n: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0] as T);
  return out;
}

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;
export const shuffleAll = <T>(rng: Rng, items: readonly T[]): T[] => drawDistinct(rng, items, items.length);

export const labelled = (labels: readonly string[]): ChoiceOption[] => labels.map((label, i) => ({ id: optId(i), label }));

/** The option chosen (by id) among `values`, or undefined. */
export function chosen<T>(values: readonly T[], answer: unknown): T | undefined {
  const i = optIndex(answer);
  return i === null ? undefined : values[i];
}

export function solutionOf<T>(values: readonly T[], isCorrect: (v: T) => boolean): string {
  return optId(values.findIndex(isCorrect));
}

export function checkChoice<T>(values: readonly T[], answer: unknown, isCorrect: (v: T) => boolean, errorType: ErrorType = "other"): ValidationResult {
  const expected = solutionOf(values, isCorrect);
  const v = chosen(values, answer);
  if (v === undefined) return wrong(expected, answer, "input_invalid");
  return isCorrect(v) ? ok() : wrong(expected, answer, errorType);
}

/** Single-choice integrity: unique options, option count matches params, exactly one correct. */
export function choiceIntegrity<P>(mech: QuizMechanic<never, P>, item: QuizItem<P>, count: number): string[] {
  const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
  if (item.input.type === "choice" && item.input.options.length !== count) p.push("options do not match params");
  if (item.lang === "en") p.push("Arabic items must not be marked English");
  return [...p, ...exactlyOneCorrect(mech, item)];
}

/** Multi-select: ids of every value that satisfies the rule. */
export function multiSolution<T>(values: readonly T[], isCorrect: (v: T) => boolean): string[] {
  return values.flatMap((v, i) => (isCorrect(v) ? [optId(i)] : []));
}

export function checkMulti<T>(values: readonly T[], answer: unknown, isCorrect: (v: T) => boolean): ValidationResult {
  const expected = multiSolution(values, isCorrect);
  const ids = asStringArray(answer);
  if (!ids || ids.length === 0 || ids.some((id) => optIndex(id) === null || optIndex(id)! >= values.length)) return wrong(expected, answer, "input_invalid");
  const set = new Set(ids);
  if (set.size === expected.length && expected.every((e) => set.has(e))) return ok();
  const partial = ids.every((id) => expected.includes(id));
  return wrong(expected, answer, partial ? "partial_answer" : "property_error");
}

/* ------------------------------------------------------------------ */
/* Levels                                                              */
/* ------------------------------------------------------------------ */

/** Level 1: the smaller half (by `size`), level 2: everything, level 3: the bigger half. */
export function levelPool<T>(items: readonly T[], size: (t: T) => number, d: Difficulty): T[] {
  if (d === 2 || items.length < 2) return [...items];
  const sizes = items.map(size).sort((a, b) => a - b);
  const lo = sizes[Math.floor((sizes.length - 1) / 2)]!;
  const hi = sizes[Math.ceil((sizes.length - 1) / 2)]!;
  return d === 1 ? items.filter((t) => size(t) <= lo) : items.filter((t) => size(t) >= hi);
}

/* ------------------------------------------------------------------ */
/* Ordering tiles (syllables, words, events)                           */
/* ------------------------------------------------------------------ */

/** Shuffle tokens so that the dealt order does NOT already give the target. */
export function deal(rng: Rng, tokens: readonly string[], joiner: string): string[] | null {
  const target = tokens.join(joiner);
  if (new Set(tokens).size < 2) return null;
  for (let i = 0; i < 40; i++) {
    const t = shuffleAll(rng, tokens);
    if (t.join(joiner) !== target) return t;
  }
  return null;
}

export const tileItems = (tiles: readonly string[]): ChoiceOption[] => tiles.map((label, i) => ({ id: `t${i}`, label }));

/** Tile ids (by dealt position) that give `tokens`; repeated tokens take the first unused tile. */
export function tileSolution(tiles: readonly string[], tokens: readonly string[]): string[] {
  const used = new Set<number>();
  return tokens.map((tok) => {
    const i = tiles.findIndex((t, j) => t === tok && !used.has(j));
    used.add(i);
    return `t${i}`;
  });
}

/** The tokens in the order chosen, or null when the answer is not a full permutation of the tiles. */
export function tilesChosen(tiles: readonly string[], answer: unknown): string[] | null {
  const ids = asStringArray(answer);
  if (!ids || ids.length !== tiles.length || new Set(ids).size !== ids.length) return null;
  const out: string[] = [];
  for (const id of ids) {
    if (!/^t\d+$/.test(id)) return null;
    const t = tiles[Number(id.slice(1))];
    if (t === undefined) return null;
    out.push(t);
  }
  return out;
}

/** Validated on the resulting TEXT (tatweel removed), so equal tiles may come in any order. */
export function checkTiles(tiles: readonly string[], joiner: string, tokens: readonly string[], answer: unknown): ValidationResult {
  const expected = tileSolution(tiles, tokens);
  const got = tilesChosen(tiles, answer);
  if (!got) return wrong(expected, answer, "input_invalid");
  return noTatweel(got.join(joiner)) === noTatweel(tokens.join(joiner)) ? ok() : wrong(expected, answer, "other");
}

export function tileIntegrity(item: QuizItem<unknown>, tiles: readonly string[], tokens: readonly string[], joiner: string): string[] {
  const p: string[] = [];
  if (item.input.type !== "order") return ["expects order input"];
  if (item.input.items.length !== tiles.length) p.push("tiles do not match params");
  if (new Set(item.input.items.map((i) => i.id)).size !== item.input.items.length) p.push("duplicate tile ids");
  if ([...tiles].sort().join("|") !== [...tokens].sort().join("|")) p.push("tiles are not the target's pieces");
  if (noTatweel(tiles.join(joiner)) === noTatweel(tokens.join(joiner))) p.push("dealt already in the correct order");
  return p;
}

/* ------------------------------------------------------------------ */
/* Config checks                                                       */
/* ------------------------------------------------------------------ */

export const isText = (v: unknown): v is string => typeof v === "string" && bare(v).trim().length > 0;
export const isPage = (v: unknown): boolean => typeof v === "number" && Number.isInteger(v) && v > 0;

/** Problems with a list of `{ <field>: text, page }` objects. */
export function listProblems(list: unknown, field: string, min: number, extra?: (o: Record<string, unknown>, i: number) => string[]): string[] {
  if (!Array.isArray(list)) return [`${field}: expected a list`];
  const p: string[] = [];
  if (list.length < min) p.push(`${field}: need at least ${min}, got ${list.length}`);
  list.forEach((o: Record<string, unknown>, i) => {
    if (!o || typeof o !== "object") return p.push(`${field}[${i}]: not an object`);
    if (!isText(o[field] ?? o.text ?? o.word)) p.push(`${field}[${i}]: missing text`);
    if (!isPage(o.page)) p.push(`${field}[${i}]: missing printed page`);
    if (extra) p.push(...extra(o, i));
  });
  return p;
}
