/**
 * Shared helpers for executor-C English mechanics (Team Together Oman 2A, semester 1).
 * Everything here is book data or presentation rules; no answer is ever stored, the
 * validators recompute it from item params.
 */
import type { Difficulty, ErrorType, ValidationResult } from "../types";
import { asStringArray, exactlyOneCorrect, ok, optionProblems, wrong, type ChoiceOption, type QuizItem, type QuizMechanic } from "../quiz";
import type { Rng } from "../rng";
import { WORDS, drawDistinct, optId, optIndex } from "./common";

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;
export const shuffleAll = <T>(rng: Rng, items: readonly T[]): T[] => drawDistinct(rng, items, items.length);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const randBetween = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/* ------------------------------------------------------------------ */
/* Choice options                                                      */
/* ------------------------------------------------------------------ */

export const labelled = (labels: readonly string[]): ChoiceOption[] => labels.map((label, i) => ({ id: optId(i), label }));

export function choiceOf<T>(values: readonly T[], answer: unknown): T | undefined {
  const i = optIndex(answer);
  return i === null ? undefined : values[i];
}

export function solutionOf<T>(values: readonly T[], isCorrect: (v: T) => boolean): string {
  return optId(values.findIndex(isCorrect));
}

export function checkChoice<T>(values: readonly T[], answer: unknown, isCorrect: (v: T) => boolean, errorType: ErrorType = "other"): ValidationResult {
  const expected = solutionOf(values, isCorrect);
  const v = choiceOf(values, answer);
  if (v === undefined) return wrong(expected, answer, "input_invalid");
  return isCorrect(v) ? ok() : wrong(expected, answer, errorType);
}

/** Integrity shared by English single-choice items. */
export function choiceIntegrity<P>(mech: QuizMechanic<never, P>, item: QuizItem<P>, count: number): string[] {
  const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
  if (item.input.type === "choice" && item.input.options.length !== count) p.push("options do not match params");
  if (item.lang !== "en") p.push("English items must set lang en");
  if (!item.promptAr) p.push("missing Arabic helper line");
  return [...p, ...exactlyOneCorrect(mech, item)];
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
/* Pictures                                                            */
/* ------------------------------------------------------------------ */

/** Words the app draws as simple SVG because the word bank has no emoji for them. */
export const DRAWN: readonly string[] = ["eraser", "desk", "table", "cupboard", "shelf"];

/** Emoji from the word bank, or "draw:<word>" for an SVG drawn by the web renderer. */
export function pictureOf(word: string): string | null {
  const e = WORDS[word];
  if (e?.picture) return e.picture;
  return DRAWN.includes(word) ? `draw:${word}` : null;
}

/**
 * Pairs whose (different) pictures could also be read as the other word, so they are
 * never offered in the same item: 🙌 hands / 👏 clap / 🖐️ fingers, touch / ✋ hand ...
 */
const CONFUSABLE: ReadonlyArray<readonly [string, string]> = [
  ["hands", "clap"],
  ["hands", "fingers"],
  ["hands", "touch"],
  ["hand", "fingers"],
  ["hand", "touch"],
  ["hand", "hands"],
  ["hand", "clap"],
  ["arm", "arms"],
  ["leg", "legs"],
  ["foot", "feet"],
  ["eyes", "look"],
  ["eyes", "sight"],
  ["ears", "hearing"],
  ["nose", "smell"],
  ["car", "drive"],
];

export function confusable(a: string, b: string): boolean {
  if (a === b) return true;
  const pa = pictureOf(a);
  if (pa !== null && pa === pictureOf(b)) return true;
  return CONFUSABLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Draw `n` words whose pictures are all different and not confusable, including `must`. */
export function drawPictured(rng: Rng, pool: readonly string[], n: number, must?: string): string[] | null {
  const out: string[] = must ? [must] : [];
  for (const w of shuffleAll(rng, pool)) {
    if (out.length >= n) break;
    if (out.some((o) => confusable(o, w))) continue;
    out.push(w);
  }
  return out.length === n ? out : null;
}

export function picturesClash(words: readonly string[]): boolean {
  for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) if (confusable(words[i]!, words[j]!)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Ordering tiles (letters, graphemes, words)                          */
/* ------------------------------------------------------------------ */

/** Shuffle tokens so that the dealt order does NOT already spell the target. */
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

/** Tile ids (by dealt position) that spell `tokens`; repeated tokens take the first unused tile. */
export function tileSolution(tiles: readonly string[], tokens: readonly string[]): string[] {
  const used = new Set<number>();
  return tokens.map((tok) => {
    const i = tiles.findIndex((t, j) => t === tok && !used.has(j));
    used.add(i);
    return `t${i}`;
  });
}

/** The tokens in the order the child chose, or null when the answer is not a full permutation of the tiles. */
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

/** Order inputs are validated on the resulting STRING, so equal tiles may come in any order. */
export function checkTiles(tiles: readonly string[], joiner: string, target: string, answer: unknown, tokens: readonly string[]): ValidationResult {
  const expected = tileSolution(tiles, tokens);
  const chosen = tilesChosen(tiles, answer);
  if (!chosen) return wrong(expected, answer, "input_invalid");
  return chosen.join(joiner) === target ? ok() : wrong(expected, answer, "other");
}

export function tileIntegrity(item: QuizItem<unknown>, tiles: readonly string[], tokens: readonly string[], joiner: string): string[] {
  const p: string[] = [];
  if (item.input.type !== "order") return ["expects order input"];
  if (item.input.items.length !== tiles.length) p.push("tiles do not match params");
  if (new Set(item.input.items.map((i) => i.id)).size !== item.input.items.length) p.push("duplicate tile ids");
  if ([...tiles].sort().join("|") !== [...tokens].sort().join("|")) p.push("tiles are not the target's pieces");
  if (tiles.join(joiner) === tokens.join(joiner)) p.push("dealt already in the correct order");
  if (item.lang !== "en") p.push("English items must set lang en");
  if (!item.promptAr) p.push("missing Arabic helper line");
  return p;
}

/* ------------------------------------------------------------------ */
/* Book data: numbers, colours                                         */
/* ------------------------------------------------------------------ */

/** Class Book Welcome unit p14: one – ten. */
export const NUMBER_WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"] as const;
export const numberWord = (n: number): string => NUMBER_WORDS[n - 1] ?? String(n);

/**
 * Class Book Welcome unit p15 colours. Shades are far apart (checked by a test) so no two options
 * look alike; white is drawn with an outline. `near` = neighbouring hues used for harder distractors.
 */
export const COLOURS: Readonly<Record<string, { hex: string; outline?: boolean; near: readonly string[] }>> = {
  red: { hex: "#dc2626", near: ["orange", "pink"] },
  orange: { hex: "#f97316", near: ["red", "yellow"] },
  yellow: { hex: "#facc15", near: ["orange", "green"] },
  green: { hex: "#16a34a", near: ["blue", "yellow"] },
  blue: { hex: "#2563eb", near: ["purple", "green"] },
  purple: { hex: "#9333ea", near: ["blue", "pink"] },
  pink: { hex: "#f472b6", near: ["red", "purple"] },
  brown: { hex: "#7a3e10", near: ["orange", "black"] },
  black: { hex: "#111111", near: ["brown"] },
  white: { hex: "#ffffff", outline: true, near: ["yellow"] },
};

export function colourDistance(a: string, b: string): number {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return Math.sqrt(x.reduce((s, v, i) => s + (v - y[i]!) ** 2, 0));
}

/** Regular plural used by the book for the taught nouns (add -s). */
export const plural = (noun: string) => `${noun}s`;
