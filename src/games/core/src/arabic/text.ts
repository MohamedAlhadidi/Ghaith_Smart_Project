/**
 * Arabic text rules used by the «أحب لغتي» mechanics. Everything is computed from the
 * printed word itself (letters, diacritics, joining rules), so validators never need a
 * stored answer.
 */

/** Short vowels, tanwīn, shadda, sukūn, dagger alif (U+064B–U+0652, U+0670). */
const DIACRITICS = /[ً-ْٰ]/g;
const TATWEEL = /ـ/g;

/** The word without diacritics and without tatweel (kashida). */
export function bare(text: string): string {
  return text.replace(DIACRITICS, "").replace(TATWEEL, "");
}

/** Remove only the tatweel (the syllable cards of the book print «لَـ», «ـمِيـ»). */
export const noTatweel = (text: string): string => text.replace(TATWEEL, "");

/** Punctuation that may follow a printed word in the book. */
const PUNCT = /[.،؛:!؟?«»"()\-–…]/g;

/** Words of a printed sentence: split on spaces, punctuation removed, empty pieces dropped. */
export function words(sentence: string): string[] {
  return sentence
    .replace(PUNCT, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => bare(w).length > 0);
}

/** Letters of the Arabic alphabet as single code points (bare skeleton). */
export const isArabicLetter = (ch: string): boolean => /[ء-ي]/.test(ch);

/** The 14 sun letters (اللام الشمسية): ت ث د ذ ر ز س ش ص ض ط ظ ل ن. */
export const SUN_LETTERS = new Set(["ت", "ث", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ل", "ن"]);

/**
 * Classify the «ال» of a word that starts with it: "sun" or "moon"; null when the word does
 * not start with ال followed by a letter.
 */
export function lamType(word: string): "sun" | "moon" | null {
  // The article is always written with a plain alif (hamzat waṣl): «أَلْعَبُ» is not «ال».
  const b = bare(word);
  if (!b.startsWith("ال") || b.length < 3) return null;
  const next = b[2]!;
  if (!isArabicLetter(next)) return null;
  return SUN_LETTERS.has(next) ? "sun" : "moon";
}

/** Letters that never join the following letter (الحروف التي لا تتصل بما بعدها). */
export const NON_JOINING = new Set(["ا", "أ", "إ", "آ", "د", "ذ", "ر", "ز", "و", "ؤ", "ء", "ة", "ى"]);

export type LetterPosition = "start" | "middle" | "end";

/**
 * Positions of `letter` in the word skeleton, as a child sees it in the book: «أول الكلمة»,
 * «وسطها», «آخرها» (by place in the word, not by glyph shape).
 */
export function letterPositions(word: string, letter: string): LetterPosition[] {
  const b = bare(word);
  const out: LetterPosition[] = [];
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== letter) continue;
    out.push(i === 0 ? "start" : i === b.length - 1 ? "end" : "middle");
  }
  return out;
}

/** True when the bare word contains the letter. */
export const hasLetter = (word: string, letter: string): boolean => bare(word).includes(letter);

/**
 * Replace the first occurrence of `letter` (with its diacritics) by a blank «ـــ».
 * Returns null when the letter is absent.
 */
export function blankLetter(word: string, letter: string): { shown: string; index: number } | null {
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== letter) continue;
    let j = i + 1;
    while (j < chars.length && /[ً-ْٰ]/.test(chars[j]!)) j++;
    return { shown: [...chars.slice(0, i), "؟", ...chars.slice(j)].join(""), index: i };
  }
  return null;
}

/**
 * Write every shadda as two letters, the first with sukūn (عَمُّها → عَمْمُها), the way the
 * book's syllable cards split it («عَمْـ» «ـمُـ» «ـها»). Accepts either order of shadda/vowel.
 */
export function expandShadda(text: string): string {
  return text.replace(/([\u0621-\u064A])(?:\u0651([\u064B-\u0650]?)|([\u064B-\u0650])\u0651)/g, (_m, l: string, v1?: string, v2?: string) => `${l}\u0652${l}${v1 || v2 || ""}`);
}

/** Inverse of expandShadda for display: letter + sukūn + same letter → letter + shadda. */
export const contractShadda = (text: string): string => text.replace(/([\u0621-\u064A])\u0652\1/g, "$1\u0651");

/** Equality on printed text ignoring tatweel and surrounding spaces (diacritics kept). */
export const sameText = (a: string, b: string): boolean => noTatweel(a).trim() === noTatweel(b).trim();

/** Equality on the bare skeleton (diacritics ignored). */
export const sameBare = (a: string, b: string): boolean => bare(a).trim() === bare(b).trim();

export type TaaForm = "open" | "tied-joined" | "tied-alone";

/**
 * Final taa of a word, as in the book's table (p. 94): «ت» (مفتوحة), «ـة» (مربوطة متصلة:
 * the letter before it joins it), «ة» (مربوطة منفصلة: the letter before it never joins).
 * null when the word does not end in a taa.
 */
export function taaForm(word: string): TaaForm | null {
  const b = bare(word);
  const last = b[b.length - 1];
  if (last === "ت") return "open";
  if (last !== "ة") return null;
  const prev = b[b.length - 2];
  if (prev === undefined) return null;
  return NON_JOINING.has(prev) ? "tied-alone" : "tied-joined";
}
