/**
 * Word-level English mechanics (executor C): read-touch, picture-word, match-pairs,
 * word-unscramble, blend-build, sound-sort, number-word, colour-word.
 * Words, pictures and grapheme splits come from the S1 word bank (taken from the books).
 */
import type { Difficulty } from "../types";
import { asStringArray, byLevel, makeItem, ok, optionProblems, sample, wrong, type QuizMechanic } from "../quiz";
import type { Rng } from "../rng";
import { WORDS, drawDistinct, entry, optId, wordProblems } from "./common";
import {
  COLOURS,
  NUMBER_WORDS,
  cap,
  checkChoice,
  choiceOf,
  checkTiles,
  choiceIntegrity,
  colourDistance,
  confusable,
  deal,
  drawPictured,
  labelled,
  levelPool,
  numberWord,
  pick,
  pictureOf,
  picturesClash,
  randBetween,
  shuffleAll,
  solutionOf,
  tileIntegrity,
  tileItems,
  tileSolution,
} from "./C_common";

type M<C, P> = QuizMechanic<C, P>;
const asMech = <P>(m: unknown) => m as QuizMechanic<never, P>;

/* ------------------------------------------------------------------ */
/* read-touch: read the word, touch its picture                        */
/* ------------------------------------------------------------------ */

export interface ReadTouchParams {
  word: string;
  /** Words whose pictures are offered, in option order. */
  options: string[];
}

export const readTouch: M<{ words: string[] }, ReadTouchParams> = {
  id: "GEN-EN-READ-TOUCH",
  version: 1,
  mechanicId: "read-touch",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return wordProblems(c.words, { picture: true, min: 3 });
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const n = Math.min(byLevel(difficulty, [3, 4, 5] as const), config.words.length);
      const word = pick(rng, config.words);
      const chosen = drawPictured(rng, config.words, n, word);
      if (!chosen) return null;
      const options = shuffleAll(rng, chosen);
      return makeItem(this, seed, difficulty, {
        params: { word, options },
        lang: "en",
        prompt: "Read and touch.",
        promptAr: difficulty === 1 ? "اقرأ الكلمة (ويمكنك سماعها) ثم المس صورتها." : "اقرأ الكلمة ثم المس صورتها.",
        // Level 1 may also listen; levels 2-3 are reading only.
        visual: { type: "en-c-word", text: word, speak: difficulty === 1 },
        input: { type: "choice", options: labelled(options.map((w) => pictureOf(w)!)) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (w) => w === item.params.word);
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (w) => w === item.params.word);
  },
  explain(item) {
    const w = item.params.word;
    return [`"${w}" = ${pictureOf(w)}`, `الكلمة «${w}» تعني: ${entry(w).ar}.`];
  },
  checkIntegrity(item) {
    const p = choiceIntegrity(asMech<ReadTouchParams>(this), item, item.params.options.length);
    if (picturesClash(item.params.options)) p.push("two options have the same or confusable pictures");
    if (!item.params.options.includes(item.params.word)) p.push("word not among options");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* picture-word: look at the picture, choose the word                  */
/* ------------------------------------------------------------------ */

/** Spelling closeness used for harder distractors (same first/last letter, similar length). */
function closeness(a: string, b: string): number {
  return (a[0] === b[0] ? 2 : 0) + (a[a.length - 1] === b[b.length - 1] ? 1 : 0) + (Math.abs(a.length - b.length) <= 1 ? 1 : 0);
}

export interface PictureWordParams {
  word: string;
  options: string[];
}

export const pictureWord: M<{ words: string[] }, PictureWordParams> = {
  id: "GEN-EN-PICTURE-WORD",
  version: 1,
  mechanicId: "picture-word",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return wordProblems(c.words, { picture: true, min: 3 });
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const n = Math.min(byLevel(difficulty, [3, 4, 5] as const), config.words.length);
      const word = pick(rng, config.words);
      let chosen: string[] | null;
      if (difficulty === 3) {
        // Closest spellings first (random among equals).
        const ranked = shuffleAll(rng, config.words.filter((w) => w !== word)).sort((a, b) => closeness(word, b) - closeness(word, a));
        chosen = [word];
        for (const w of ranked) if (chosen.length < n && !chosen.some((o) => confusable(o, w))) chosen.push(w);
        if (chosen.length !== n) return null;
      } else chosen = drawPictured(rng, config.words, n, word);
      if (!chosen) return null;
      const options = shuffleAll(rng, chosen);
      return makeItem(this, seed, difficulty, {
        params: { word, options },
        lang: "en",
        prompt: "Look and choose the word.",
        promptAr: "انظر إلى الصورة واختر كلمتها.",
        visual: { type: "en-c-scene", scene: { kind: "thing", picture: pictureOf(word), count: 1 }, text: null, say: null },
        input: { type: "choice", options: labelled(options) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (w) => w === item.params.word);
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (w) => w === item.params.word);
  },
  explain(item) {
    const w = item.params.word;
    return [`${pictureOf(w)} = "${w}"`, `«${w}»: ${entry(w).ar}.`];
  },
  checkIntegrity(item) {
    const p = choiceIntegrity(asMech<PictureWordParams>(this), item, item.params.options.length);
    if (picturesClash(item.params.options)) p.push("an option's picture could also show the target");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* match-pairs: tap a word, then its picture                           */
/* ------------------------------------------------------------------ */

export interface MatchParams {
  /** Word column, top to bottom. */
  words: string[];
  /** Picture column: pics[j] = index of the word whose picture is in slot j. */
  pics: number[];
}

/** Answer: [wordIndex, pictureSlot][] for every word. */
export type MatchAnswer = Array<[number, number]>;

export const matchPairs: M<{ words: string[] }, MatchParams> = {
  id: "GEN-EN-MATCH-PAIRS",
  version: 1,
  mechanicId: "match-pairs",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return wordProblems(c.words, { picture: true, min: 3 });
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const n = Math.min(byLevel(difficulty, [3, 4, 5] as const), config.words.length);
      const words = drawPictured(rng, config.words, n);
      if (!words) return null;
      const pics = shuffleAll(
        rng,
        words.map((_, i) => i),
      );
      if (pics.every((v, i) => v === i)) return null; // never line the pictures up with their words
      return makeItem(this, seed, difficulty, {
        params: { words, pics },
        lang: "en",
        prompt: "Read and match.",
        promptAr: "صِل كل كلمة بصورتها: المس الكلمة ثم المس صورتها، ثم اضغط تحقّق.",
        visual: { type: "en-c-match", words, pictures: pics.map((i) => pictureOf(words[i]!)), speakOnTap: difficulty === 1 },
        input: { type: "visual" },
      });
    });
  },
  solution(item) {
    return item.params.words.map((_, i) => [i, item.params.pics.indexOf(i)]);
  },
  check(item, answer) {
    const { words, pics } = item.params;
    const expected = this.solution(item);
    if (!Array.isArray(answer)) return wrong(expected, answer, "input_invalid");
    const pairs = answer as unknown[];
    const valid = pairs.every(
      (p) => Array.isArray(p) && p.length === 2 && p.every((x) => Number.isInteger(x)) && (p[0] as number) >= 0 && (p[0] as number) < words.length && (p[1] as number) >= 0 && (p[1] as number) < pics.length,
    );
    if (!valid) return wrong(expected, answer, "input_invalid");
    const typed = pairs as Array<[number, number]>;
    if (new Set(typed.map((p) => p[0])).size !== typed.length || new Set(typed.map((p) => p[1])).size !== typed.length) return wrong(expected, answer, "input_invalid");
    if (typed.length !== words.length) return wrong(expected, answer, "partial_answer");
    // Compare pictures (not indices), so the rule is "each word sits with its own picture".
    return typed.every(([i, j]) => pictureOf(words[i]!) === pictureOf(words[pics[j]!]!)) ? ok() : wrong(expected, answer, "other");
  },
  explain(item) {
    const pairs = item.params.words.map((w) => `${w} = ${pictureOf(w)}`);
    return [pairs.join(" · "), "نقرأ كل كلمة ونبحث عن الصورة التي تدل عليها."];
  },
  checkIntegrity(item) {
    const { words, pics } = item.params;
    const p: string[] = [];
    if (item.input.type !== "visual") p.push("expects visual input");
    if (item.lang !== "en") p.push("English items must set lang en");
    if ([...pics].sort((a, b) => a - b).join() !== words.map((_, i) => i).join()) p.push("picture slots are not a permutation");
    if (pics.every((v, i) => v === i)) p.push("pictures already aligned with words");
    if (picturesClash(words)) p.push("two words share or confuse a picture");
    if (words.some((w) => !pictureOf(w))) p.push("word without picture");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* word-unscramble: order the letters                                  */
/* ------------------------------------------------------------------ */

export interface UnscrambleParams {
  word: string;
  /** Letters in dealt order (tile id t<i> = tiles[i]). */
  tiles: string[];
}

/** A cue that names the word without spelling it: picture, colour swatch or digit. */
function wordCue(word: string): { picture: string | null; colour: string | null; outline: boolean; digit: string | null } {
  const n = (NUMBER_WORDS as readonly string[]).indexOf(word);
  const c = COLOURS[word];
  if (n >= 0) return { picture: null, colour: null, outline: false, digit: String(n + 1) };
  if (c) return { picture: null, colour: c.hex, outline: Boolean(c.outline), digit: null };
  return { picture: pictureOf(word), colour: null, outline: false, digit: null };
}

export const wordUnscramble: M<{ words: string[] }, UnscrambleParams> = {
  id: "GEN-EN-WORD-UNSCRAMBLE",
  version: 1,
  mechanicId: "word-unscramble",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = wordProblems(c.words, { min: 2 });
    for (const w of c.words ?? []) {
      if (!/^[a-z]+$/.test(w)) p.push(`${w}: letters only`);
      else if (new Set(w).size < 2) p.push(`${w}: cannot be scrambled`);
    }
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const word = pick(rng, levelPool(config.words, (w) => w.length, difficulty));
      const tiles = deal(rng, [...word], "");
      if (!tiles) return null;
      const ar = entry(word).ar;
      return makeItem(this, seed, difficulty, {
        params: { word, tiles },
        lang: "en",
        prompt: "Look at the letters. Write the word.",
        promptAr: `رتّب الحروف لتكتب الكلمة (${ar}).`,
        // Level 3: longer words and no read-aloud help.
        visual: { type: "en-c-tiles", ...wordCue(word), say: difficulty < 3 ? word : null, gloss: ar, before: null, after: null },
        input: { type: "order", items: tileItems(tiles) },
      });
    });
  },
  solution(item) {
    return tileSolution(item.params.tiles, [...item.params.word]);
  },
  check(item, answer) {
    return checkTiles(item.params.tiles, "", item.params.word, answer, [...item.params.word]);
  },
  explain(item) {
    const w = item.params.word;
    return [`${item.params.tiles.join(" ")} → ${w}`, `${[...w].join("-")}: «${entry(w).ar}».`];
  },
  checkIntegrity(item) {
    return tileIntegrity(item, item.params.tiles, [...item.params.word], "");
  },
};

/* ------------------------------------------------------------------ */
/* blend-build: order the grapheme tiles                               */
/* ------------------------------------------------------------------ */

export interface BlendParams {
  word: string;
  graphemes: string[];
  tiles: string[];
}

function blendPool(words: readonly string[], d: Difficulty): string[] {
  const size = (w: string) => entry(w).graphemes!.length;
  if (d === 1) {
    const short = words.filter((w) => size(w) <= 3);
    const min = Math.min(...words.map(size));
    return short.length ? short : words.filter((w) => size(w) === min);
  }
  if (d === 2) {
    const upTo4 = words.filter((w) => size(w) <= 4);
    return upTo4.length ? upTo4 : [...words];
  }
  return levelPool(words, size, 3);
}

export const blendBuild: M<{ words: string[] }, BlendParams> = {
  id: "GEN-EN-BLEND-BUILD",
  version: 1,
  mechanicId: "blend-build",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = wordProblems(c.words, { graphemes: true, min: 2 });
    for (const w of c.words ?? []) {
      const g = WORDS[w]?.graphemes;
      if (g && g.join("") !== w) p.push(`${w}: graphemes do not spell the word`);
      if (g && new Set(g).size < 2) p.push(`${w}: cannot be shuffled`);
    }
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const word = pick(rng, blendPool(config.words, difficulty));
      const graphemes = [...entry(word).graphemes!];
      const tiles = deal(rng, graphemes, "");
      if (!tiles) return null;
      const ar = entry(word).ar;
      return makeItem(this, seed, difficulty, {
        params: { word, graphemes, tiles },
        lang: "en",
        prompt: "Listen and blend. Make the word.",
        promptAr: difficulty === 3 ? `استمع 🔊 ثم رتّب الأصوات لتكوّن الكلمة (${ar}).` : `رتّب الأصوات لتكوّن الكلمة (${ar}).`,
        // Level 3 hides the picture: the child builds the word from its sound (and meaning).
        visual: { type: "en-c-tiles", picture: difficulty < 3 ? pictureOf(word) : null, colour: null, outline: false, digit: null, say: word, gloss: ar, before: null, after: null },
        input: { type: "order", items: tileItems(tiles) },
      });
    });
  },
  solution(item) {
    return tileSolution(item.params.tiles, item.params.graphemes);
  },
  check(item, answer) {
    return checkTiles(item.params.tiles, "", item.params.word, answer, item.params.graphemes);
  },
  explain(item) {
    const { word, graphemes } = item.params;
    return [`${graphemes.join(" + ")} = ${word}`, `نقول كل صوت ثم نمزجها: ${graphemes.join("-")} ← ${word}.`];
  },
  checkIntegrity(item) {
    const p = tileIntegrity(item, item.params.tiles, item.params.graphemes, "");
    if (item.params.graphemes.join("") !== item.params.word) p.push("graphemes do not spell the word");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* sound-sort: choose every word with the lesson's sound               */
/* ------------------------------------------------------------------ */

const SPLIT: Record<string, string> = { a_e: "a", i_e: "i", o_e: "o" };

/** Rule check from the word bank's grapheme split (oo_short and oo_long are both "oo"). */
export function hasSound(word: string, sound: string): boolean {
  const g = WORDS[word]?.graphemes;
  if (!g) return false;
  const v = SPLIT[sound];
  if (v) return g.length >= 3 && g.includes(v) && g[g.length - 1] === "e";
  return g.includes(sound.startsWith("oo") ? "oo" : sound);
}

export const soundLabel = (s: string) => (s.startsWith("oo") ? "oo" : s.replace("_", "-"));

/**
 * Groups that must never share an item: the same spelling for two sounds (oo in book / moon),
 * and the same sound with two spellings (ai / a-e, ie / i-e, oa / o-e, ue / oo in moon), so a
 * distractor can never also be right whether the child sorts by letters or by sound.
 */
const SOUND_CONFLICTS: ReadonlyArray<readonly [string, string]> = [
  ["oo_short", "oo_long"],
  ["ai", "a_e"],
  ["ie", "i_e"],
  ["oa", "o_e"],
  ["ue", "oo_long"],
];
export const soundsConflict = (a: string, b: string) => SOUND_CONFLICTS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export interface SoundSortParams {
  sound: string;
  /** Each offered word with the book group it came from. */
  words: Array<{ word: string; group: string }>;
  /** A word of the sound shown as a model ("ai as in rain"); never one of the options. */
  example: string | null;
}

export const soundSort: M<{ sound: string; groups: Record<string, string[]> }, SoundSortParams> = {
  id: "GEN-EN-SOUND-SORT",
  version: 1,
  mechanicId: "sound-sort",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!c.groups || !c.groups[c.sound]) return ["groups must include the sound"];
    const seen = new Set<string>();
    for (const [g, words] of Object.entries(c.groups)) {
      p.push(...wordProblems(words, { graphemes: true }));
      for (const w of words) {
        if (seen.has(w)) p.push(`${w} is in two groups`);
        seen.add(w);
        if (WORDS[w]?.graphemes && !hasSound(w, g)) p.push(`${w} does not contain ${g}`);
        if (g !== c.sound && WORDS[w]?.graphemes && hasSound(w, c.sound)) p.push(`${w} (${g}) also contains ${c.sound}`);
      }
    }
    const others = Object.keys(c.groups).filter((g) => g !== c.sound && !soundsConflict(g, c.sound));
    if (others.reduce((n, g) => n + c.groups[g]!.length, 0) < 5) p.push("not enough distractor words");
    if (c.groups[c.sound]!.length < 3) p.push("needs at least 3 words of the sound");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const { sound, groups } = config;
      const own = groups[sound]!;
      // Keep at most one of two mutually conflicting distractor groups (e.g. both oo groups).
      const others: string[] = [];
      for (const g of shuffleAll(rng, Object.keys(groups))) if (g !== sound && !soundsConflict(g, sound) && !others.some((o) => soundsConflict(o, g))) others.push(g);
      const needExample = difficulty < 3 || sound.startsWith("oo");
      const total = byLevel(difficulty, [5, 6, 6] as const);
      const [lo, hi] = byLevel(difficulty, [[2, 3], [2, 4], [1, 4]] as const);
      const maxCorrect = Math.min(hi, own.length - (needExample ? 1 : 0), total - 1);
      if (maxCorrect < lo) return null;
      const nCorrect = randBetween(rng, lo, maxCorrect);
      const correct = drawDistinct(rng, own, nCorrect).map((word) => ({ word, group: sound }));
      const pool = others.flatMap((g) => groups[g]!.map((word) => ({ word, group: g })));
      const wrongs = drawDistinct(rng, pool, total - nCorrect);
      if (wrongs.length !== total - nCorrect) return null;
      if (difficulty === 3 && others.length >= 2 && new Set(wrongs.map((w) => w.group)).size < 2) return null;
      const words = shuffleAll(rng, [...correct, ...wrongs]);
      const rest = own.filter((w) => !correct.some((c) => c.word === w));
      const pictured = rest.filter((w) => pictureOf(w));
      const example = needExample ? pick(rng, pictured.length ? pictured : rest) : null;
      const label = soundLabel(sound);
      return makeItem(this, seed, difficulty, {
        params: { sound, words, example },
        lang: "en",
        prompt: sound.startsWith("oo") ? `Find the words with oo, like "${example}".` : `Find the words with ${label}.`,
        promptAr: sound.startsWith("oo") ? `اختر كل الكلمات التي فيها oo كما في «${example}».` : `اختر كل الكلمات التي فيها ${label}.`,
        visual: { type: "en-c-sound", label, example: example ? { word: example, picture: pictureOf(example) } : null },
        input: { type: "multi", options: labelled(words.map((w) => w.word)) },
      });
    });
  },
  solution(item) {
    return item.params.words.map((w, i) => (w.group === item.params.sound ? optId(i) : null)).filter((x): x is string => x !== null);
  },
  check(item, answer) {
    const expected = this.solution(item) as string[];
    const ids = asStringArray(answer);
    if (!ids || ids.length === 0 || new Set(ids).size !== ids.length) return wrong(expected, answer, "input_invalid");
    const words = item.params.words;
    if (ids.some((id) => !/^o\d+$/.test(id) || Number(id.slice(1)) >= words.length)) return wrong(expected, answer, "input_invalid");
    const picked = ids.map((id) => words[Number(id.slice(1))]!);
    if (picked.some((w) => w.group !== item.params.sound)) return wrong(expected, answer, "property_error");
    return picked.length === expected.length ? ok() : wrong(expected, answer, "partial_answer");
  },
  explain(item) {
    const { sound, words } = item.params;
    const yes = words.filter((w) => w.group === sound).map((w) => w.word);
    const no = words.filter((w) => w.group !== sound).map((w) => `${w.word} (${soundLabel(w.group)})`);
    return [`${soundLabel(sound)}: ${yes.join(", ")}`, `ليست فيها ${soundLabel(sound)}: ${no.join(", ")}`];
  },
  checkIntegrity(item) {
    const { sound, words, example } = item.params;
    const p = item.input.type === "multi" ? optionProblems(item.input.options) : ["expects multi input"];
    if (item.lang !== "en") p.push("English items must set lang en");
    const nCorrect = words.filter((w) => w.group === sound).length;
    if (nCorrect < 1 || nCorrect === words.length) p.push("needs at least one correct and one incorrect word");
    for (const w of words) {
      if (!hasSound(w.word, w.group)) p.push(`${w.word} is not a ${w.group} word`);
      if (w.group !== sound && hasSound(w.word, sound)) p.push(`${w.word} also has ${sound}`);
    }
    const groups = [...new Set([sound, ...words.map((w) => w.group)])];
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) if (soundsConflict(groups[i]!, groups[j]!)) p.push(`${groups[i]} and ${groups[j]} together`);
    if (example && (words.some((w) => w.word === example) || !hasSound(example, sound))) p.push("bad example word");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* number-word: count balloons / digit ↔ word                          */
/* ------------------------------------------------------------------ */

export interface NumberWordParams {
  n: number;
  /** count: N balloons → word; digit-word: digit → word; word-digit: word → digit. */
  mode: "count" | "digit-word" | "word-digit";
  options: number[];
}

const BALLOON_HEX = ["#dc2626", "#2563eb", "#16a34a", "#facc15", "#9333ea", "#f97316", "#f472b6"];

function numberOptions(rng: Rng, n: number, max: number, count: number, near: boolean): number[] | null {
  const all = Array.from({ length: max }, (_, i) => i + 1).filter((v) => v !== n);
  const neighbours = [n - 1, n + 1, n - 2, n + 2].filter((v) => v >= 1 && v <= max);
  const pool = near ? [...neighbours, ...shuffleAll(rng, all.filter((v) => !neighbours.includes(v)))] : shuffleAll(rng, all);
  const picked = [n, ...pool.slice(0, count - 1)];
  return picked.length === count ? shuffleAll(rng, picked) : null;
}

export const numberWordMech: M<{ max: number; mode: "count" | "digit-word" }, NumberWordParams> = {
  id: "GEN-EN-NUMBER-WORD",
  version: 1,
  mechanicId: "number-word",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!Number.isInteger(c.max) || c.max < 4 || c.max > 10) p.push("max must be 4..10 (book numbers one-ten)");
    if (c.mode !== "count" && c.mode !== "digit-word") p.push("mode must be count or digit-word");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const max = config.max;
      const [lo, hi] = byLevel(difficulty, [[1, Math.min(5, max)], [1, max], [Math.floor(max / 2) + 1, max]] as const);
      const n = randBetween(rng, lo, hi);
      const count = byLevel(difficulty, [3, 4, 4] as const);
      const options = numberOptions(rng, n, max, count, difficulty === 3);
      if (!options) return null;
      const mode: NumberWordParams["mode"] = config.mode === "count" ? "count" : difficulty === 3 ? "word-digit" : "digit-word";
      const labels = options.map((v) => (mode === "word-digit" ? String(v) : numberWord(v)));
      const scene =
        mode === "count"
          ? { kind: "balloons", n, colours: Array.from({ length: n }, () => pick(rng, BALLOON_HEX)) }
          : { kind: "card", text: mode === "word-digit" ? numberWord(n) : String(n) };
      return makeItem(this, seed, difficulty, {
        params: { n, mode, options },
        lang: "en",
        prompt: mode === "count" ? "How many balloons?" : mode === "word-digit" ? "Read and choose the number." : "Read and choose the word.",
        promptAr: mode === "count" ? "عُدّ البالونات واختر كلمة العدد." : mode === "word-digit" ? "اقرأ الكلمة واختر العدد." : "اختر الكلمة التي تكتب هذا العدد.",
        visual: { type: "en-c-scene", scene, text: null, say: mode === "word-digit" ? numberWord(n) : null },
        input: { type: "choice", options: labelled(labels) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (v) => v === item.params.n);
  },
  check(item, answer) {
    const { n, options } = item.params;
    const v = choiceOf(options, answer);
    const err = typeof v === "number" && Math.abs(v - n) === 1 ? "counting_error" : "other";
    return checkChoice(options, answer, (x) => x === n, err);
  },
  explain(item) {
    const { n, mode } = item.params;
    const words = NUMBER_WORDS.slice(0, n).join(", ");
    if (mode === "count") return [`Count: ${words}.`, `How many balloons? ${cap(numberWord(n))}. (${n})`];
    return [`${n} = ${numberWord(n)}`, `نعدّ: ${words}.`];
  },
  checkIntegrity(item) {
    const { n, options } = item.params;
    const p = choiceIntegrity(asMech<NumberWordParams>(this), item, options.length);
    if (n < 1 || n > 10) p.push("number out of the book range");
    if (item.visual.type === "en-c-scene" && (item.visual.scene as { kind: string; n?: number }).kind === "balloons" && (item.visual.scene as { n: number }).n !== n) p.push("balloon count mismatch");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* colour-word: what colour is it?                                     */
/* ------------------------------------------------------------------ */

export interface ColourParams {
  colour: string;
  options: string[];
}

const SHAPES = ["balloon", "star", "heart", "splash", "crayon"] as const;
/** Two options must look clearly different (RGB distance; the closest book pair, red/orange, is 84). */
export const MIN_COLOUR_DISTANCE = 80;

export const colourWord: M<{ colours: string[] }, ColourParams> = {
  id: "GEN-EN-COLOUR-WORD",
  version: 1,
  mechanicId: "colour-word",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!Array.isArray(c.colours) || c.colours.length < 3) p.push("needs at least 3 colours");
    for (const col of c.colours ?? []) if (!COLOURS[col]) p.push(`unknown colour ${col}`);
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const colour = pick(rng, config.colours);
      const n = Math.min(byLevel(difficulty, [3, 4, 5] as const), config.colours.length);
      const others = config.colours.filter((c) => c !== colour);
      const near = difficulty === 3 ? COLOURS[colour]!.near.filter((c) => others.includes(c)) : [];
      const first = near.length ? [pick(rng, near)] : [];
      const rest = drawDistinct(
        rng,
        others.filter((c) => !first.includes(c)),
        n - 1 - first.length,
      );
      const options = shuffleAll(rng, [colour, ...first, ...rest]);
      if (options.length !== n) return null;
      const c = COLOURS[colour]!;
      return makeItem(this, seed, difficulty, {
        params: { colour, options },
        lang: "en",
        prompt: "What colour is it?",
        promptAr: "ما لون الشكل؟ اختر كلمة اللون.",
        visual: { type: "en-c-scene", scene: { kind: "swatch", hex: c.hex, outline: Boolean(c.outline), shape: pick(rng, SHAPES) }, text: null, say: null },
        input: { type: "choice", options: labelled(options) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (c) => c === item.params.colour);
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (c) => c === item.params.colour);
  },
  explain(item) {
    const c = item.params.colour;
    return [`What colour is it? It's ${c}.`, `${c} = ${entry(c).ar}`];
  },
  checkIntegrity(item) {
    const p = choiceIntegrity(asMech<ColourParams>(this), item, item.params.options.length);
    const o = item.params.options;
    for (let i = 0; i < o.length; i++)
      for (let j = i + 1; j < o.length; j++) if (colourDistance(COLOURS[o[i]!]!.hex, COLOURS[o[j]!]!.hex) < MIN_COLOUR_DISTANCE) p.push(`${o[i]} and ${o[j]} look alike`);
    return p;
  },
};

export const WORD_MECHANICS_C = [readTouch, pictureWord, matchPairs, wordUnscramble, blendBuild, soundSort, numberWordMech, colourWord] as const;
