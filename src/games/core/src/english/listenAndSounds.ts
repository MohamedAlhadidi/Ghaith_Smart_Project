/**
 * Reference English mechanics:
 *  - listen-touch: hear a word (device speech, slow option, never the microphone) and touch its picture.
 *  - missing-grapheme: a book word with the target sound's letters missing; choose the letters.
 */
import type { ErrorType } from "../types";
import { byLevel, exactlyOneCorrect, makeItem, ok, optionProblems, sample, wrong, type QuizMechanic } from "../quiz";
import { drawDistinct, entry, optId, optIndex, wordProblems } from "./common";
import { drawPictured, picturesClash } from "./C_common";

export interface ListenTouchParams {
  word: string;
  options: string[]; // words whose pictures are offered
}

export const listenTouch: QuizMechanic<{ words: string[] }, ListenTouchParams> = {
  id: "GEN-EN-LISTEN-TOUCH",
  version: 1,
  mechanicId: "listen-touch",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    // Three pictured words are enough (some Sounds and Spelling lessons have only three).
    return wordProblems(c.words, { picture: true, min: 3 });
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const n = Math.min(byLevel(difficulty, [3, 4, 4] as const), config.words.length);
      // Never offer two words with the same or confusable pictures (e.g. fingers / touch).
      const options = drawPictured(rng, config.words, n);
      if (!options) return null;
      const word = options[Math.floor(rng() * options.length)]!;
      return makeItem(this, seed, difficulty, {
        params: { word, options },
        lang: "en",
        prompt: "Listen and touch.",
        promptAr: "استمع إلى الكلمة ثم المس صورتها.",
        // Level 3 hides the written word even when speech is unavailable? No: the fallback always shows text.
        visual: { type: "en-listen", text: word },
        input: { type: "choice", options: options.map((w, i) => ({ id: optId(i), label: entry(w).picture! })) },
      });
    });
  },
  solution(item) {
    return optId(item.params.options.indexOf(item.params.word));
  },
  check(item, answer) {
    const i = optIndex(answer);
    const expected = this.solution(item);
    if (i === null || i >= item.params.options.length) return wrong(expected, answer, "input_invalid");
    return item.params.options[i] === item.params.word ? ok() : wrong(expected, answer, "other");
  },
  explain(item) {
    return [`The word is "${item.params.word}".`, `الكلمة «${item.params.word}» تعني: ${entry(item.params.word).ar}.`];
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    if (new Set(item.params.options).size !== item.params.options.length) p.push("duplicate words");
    if (picturesClash(item.params.options)) p.push("confusable pictures offered together");
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, ListenTouchParams>, item)];
  },
};

/* ------------------------------------------------------------------ */

const SPLIT: Record<string, string> = { a_e: "a", i_e: "i", o_e: "o" };
const label = (s: string) => (s.startsWith("oo") ? "oo" : s.replace("_", "-"));

export interface MissingParams {
  word: string;
  graphemes: string[];
  sound: string;
  /** Sound candidates offered (the lesson's sound and taught distractors). */
  choices: string[];
}

/** Text with the target sound hidden, e.g. "r _ _ n", or "l _ k _" for split digraphs. */
export function hiddenForm(graphemes: string[], sound: string): string {
  const split = SPLIT[sound];
  if (split) {
    const out = graphemes.map((g) => (g === split ? "_" : g));
    out[out.length - 1] = "_"; // final e
    return out.join("");
  }
  const key = sound.startsWith("oo") ? "oo" : sound;
  return graphemes.map((g) => (g === key ? "_".repeat(g.length) : g)).join("");
}

/** Fill the hidden form with a sound's letters and return the spelling. */
export function fillWith(graphemes: string[], target: string, choice: string): string {
  const split = SPLIT[target];
  const key = target.startsWith("oo") ? "oo" : target;
  if (split) {
    const c = SPLIT[choice];
    if (!c) return "";
    return graphemes.map((g, i) => (i === graphemes.length - 1 ? "e" : g === split ? c : g)).join("");
  }
  if (SPLIT[choice]) return "";
  const ck = choice.startsWith("oo") ? "oo" : choice;
  return graphemes.map((g) => (g === key ? ck : g)).join("");
}

export const missingGrapheme: QuizMechanic<{ sound: string; words: string[]; distractors: string[] }, MissingParams> = {
  id: "GEN-EN-MISSING-GRAPHEME",
  version: 1,
  mechanicId: "missing-grapheme",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = wordProblems(c.words, { graphemes: true, min: 3 });
    if (!c.sound) p.push("sound required");
    for (const w of c.words ?? []) {
      const g = entry(w).graphemes ?? [];
      const key = SPLIT[c.sound] ?? (c.sound.startsWith("oo") ? "oo" : c.sound);
      if (!g.includes(key)) p.push(`${w} does not contain ${c.sound}`);
    }
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const word = config.words[Math.floor(rng() * config.words.length)]!;
      const graphemes = entry(word).graphemes!;
      // Distractors: other sounds of the same unit only (taught material); same "shape" (split vs vowel team).
      const sameShape = config.distractors.filter((d) => Boolean(SPLIT[d]) === Boolean(SPLIT[config.sound]));
      const pool = sameShape.length >= 1 ? sameShape : config.distractors;
      const n = byLevel(difficulty, [1, 2, 2] as const);
      const choices = [config.sound, ...drawDistinct(rng, pool, n)];
      if (new Set(choices.map(label)).size !== choices.length) return null;
      const shuffled = drawDistinct(rng, choices, choices.length);
      return makeItem(this, seed, difficulty, {
        params: { word, graphemes, sound: config.sound, choices: shuffled },
        lang: "en",
        prompt: "Which letters are missing?",
        promptAr: "أي حروف تكمل الكلمة؟",
        visual: { type: "en-missing", hidden: hiddenForm(graphemes, config.sound), picture: entry(word).picture, word: difficulty === 1 ? word : null },
        input: { type: "choice", options: shuffled.map((s, i) => ({ id: optId(i), label: label(s) })) },
      });
    });
  },
  solution(item) {
    return optId(item.params.choices.indexOf(item.params.sound));
  },
  check(item, answer) {
    const i = optIndex(answer);
    const expected = this.solution(item);
    if (i === null || i >= item.params.choices.length) return wrong(expected, answer, "input_invalid");
    const spelled = fillWith(item.params.graphemes, item.params.sound, item.params.choices[i]!);
    const type: ErrorType = "other";
    return spelled === item.params.word ? ok() : wrong(expected, answer, type);
  },
  explain(item) {
    return [`${hiddenForm(item.params.graphemes, item.params.sound)} → ${item.params.word}`, `الصوت هو ${label(item.params.sound)}: ${item.params.graphemes.join(" + ")}`];
  },
  checkIntegrity(item) {
    const p = item.input.type === "choice" ? optionProblems(item.input.options) : ["expects choice input"];
    if (item.params.graphemes.join("") !== item.params.word) p.push("graphemes do not spell the word");
    return [...p, ...exactlyOneCorrect(this as QuizMechanic<never, MissingParams>, item)];
  },
};

export const ENGLISH_REFERENCE = [listenTouch, missingGrapheme] as const;
