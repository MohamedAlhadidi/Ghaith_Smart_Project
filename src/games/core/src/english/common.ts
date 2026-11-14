/**
 * Shared helpers for English mechanics (Team Together Oman 2A, semester 1).
 * Words, pictures and grapheme splits come from content/curriculum/english/s1/wordbank.json,
 * which is taken from the official books (pictures are emoji chosen by the app).
 */
import wordbank from "../../../../../content/curriculum/english/s1/wordbank.json";
import type { Rng } from "../rng";

export interface WordEntry {
  picture: string | null;
  ar: string;
  graphemes?: string[];
}

export const WORDS: Readonly<Record<string, WordEntry>> = (wordbank as { words: Record<string, WordEntry> }).words;

export function entry(word: string): WordEntry {
  const e = WORDS[word];
  if (!e) throw new Error(`word "${word}" is not in the word bank`);
  return e;
}

export const hasPicture = (word: string) => Boolean(WORDS[word]?.picture);

/** Draw `n` distinct items from a list (deterministic for a given rng). */
export function drawDistinct<T>(rng: Rng, items: readonly T[], n: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0] as T);
  return out;
}

/** Index of the item in the list; used to build option ids that do not reveal the answer. */
export const optId = (i: number) => `o${i}`;
export const optIndex = (id: unknown): number | null => (typeof id === "string" && /^o\d+$/.test(id) ? Number(id.slice(1)) : null);

/** Validate that every configured word exists (and, if required, has a picture or graphemes). */
export function wordProblems(words: unknown, need: { picture?: boolean; graphemes?: boolean; min?: number } = {}): string[] {
  if (!Array.isArray(words)) return ["words must be a list"];
  const p: string[] = [];
  if (need.min && words.length < need.min) p.push(`needs at least ${need.min} words`);
  for (const w of words) {
    const e = WORDS[w as string];
    if (!e) p.push(`unknown word ${String(w)}`);
    else if (need.picture && !e.picture) p.push(`no picture for ${String(w)}`);
    else if (need.graphemes && !e.graphemes) p.push(`no graphemes for ${String(w)}`);
  }
  return p;
}
