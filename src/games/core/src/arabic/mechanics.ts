/**
 * Arabic mechanics for «أحب لغتي» (grade 2, semester 1, 2026 edition). Every word, sentence,
 * statement and option comes from the lesson catalogue (book pages); the rules that decide
 * an answer (sun/moon lām, letter position, word count, tile order) are computed from the
 * printed text itself.
 */
import { byLevel, makeItem, ok, optionProblems, sample, wrong, type QuizMechanic, type Visual } from "../quiz";
import {
  checkChoice,
  checkMulti,
  checkTiles,
  choiceIntegrity,
  deal,
  drawDistinct,
  isText,
  labelled,
  levelPool,
  listProblems,
  multiSolution,
  pick,
  shuffleAll,
  solutionOf,
  tileIntegrity,
  tileItems,
  tileSolution,
  type Paged,
} from "./common";
import { bare, blankLetter, expandShadda, lamType, letterPositions, noTatweel, sameBare, sameText, words, type LetterPosition } from "./text";

type M<C, P> = QuizMechanic<C, P>;
const asMech = <P>(m: unknown) => m as QuizMechanic<never, P>;
const card = (text: string, extra: Record<string, unknown> = {}): Visual => ({ type: "ar-card", text, ...extra });

/* ------------------------------------------------------------------ */
/* ar-syllables: build a word from the book's syllable cards            */
/* ------------------------------------------------------------------ */

/** The cards spell the word (tatweel ignored; a shadda equals letter+sukūn+letter as on the cards). */
const spells = (syllables: readonly string[], word: string) => expandShadda(noTatweel(syllables.join(""))) === expandShadda(noTatweel(word));

export interface SyllableWord extends Paged {
  word: string;
  syllables: string[];
}
interface SyllablesConfig {
  words: SyllableWord[];
}
interface SyllablesParams {
  word: string;
  syllables: string[];
  tiles: string[];
}

export const AR_SYLLABLES: M<SyllablesConfig, SyllablesParams> = {
  id: "GEN-AR-SYLLABLES",
  version: 1,
  mechanicId: "ar-syllables",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return listProblems(c?.words, "word", 2, (o, i) => {
      const s = o.syllables;
      if (!Array.isArray(s) || s.length < 2 || !s.every(isText)) return [`word[${i}]: needs 2+ syllables`];
      if (new Set(s).size < 2) return [`word[${i}]: syllables must not all be equal`];
      return spells(s as string[], String(o.word)) ? [] : [`word[${i}]: syllables do not spell «${String(o.word)}»`];
    });
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const w = pick(rng, levelPool(c.words, (x) => x.syllables.length, d));
      const tiles = deal(rng, w.syllables, "");
      if (!tiles) return null;
      return makeItem(AR_SYLLABLES, seed, d, {
        params: { word: w.word, syllables: [...w.syllables], tiles },
        prompt: "رَكِّبْ مِنَ الْمَقاطِعِ كَلِمَةً.",
        visual: { type: "none" },
        input: { type: "order", items: tileItems(tiles), joiner: "" },
      });
    });
  },
  check: (item, answer) => checkTiles(item.params.tiles, "", item.params.syllables, answer),
  solution: (item) => tileSolution(item.params.tiles, item.params.syllables),
  explain: (item) => [`الْمَقاطِعُ بِالتَّرْتيبِ: ${item.params.syllables.join(" + ")}`, `الْكَلِمَةُ: ${item.params.word}`],
  checkIntegrity(item) {
    const p = tileIntegrity(item, item.params.tiles, item.params.syllables, "");
    if (!spells(item.params.syllables, item.params.word)) p.push("syllables do not spell the word");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* ar-sentence-build: order the words of a sentence from the text       */
/* ------------------------------------------------------------------ */

interface SentencesConfig {
  sentences: (Paged & { text: string })[];
}
interface SentenceParams {
  sentence: string;
  tokens: string[];
  tiles: string[];
}

const MAX_TILES = 8;

export const AR_SENTENCE_BUILD: M<SentencesConfig, SentenceParams> = {
  id: "GEN-AR-SENTENCE-BUILD",
  version: 1,
  mechanicId: "ar-sentence-build",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return listProblems(c?.sentences, "text", 2, (o, i) => {
      const n = words(String(o.text)).length;
      return n >= 3 && n <= MAX_TILES ? [] : [`sentence[${i}]: needs 3–${MAX_TILES} words, has ${n}`];
    });
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const s = pick(rng, levelPool(c.sentences, (x) => words(x.text).length, d));
      const tokens = words(s.text);
      const tiles = deal(rng, tokens, " ");
      if (!tiles) return null;
      return makeItem(AR_SENTENCE_BUILD, seed, d, {
        params: { sentence: s.text, tokens, tiles },
        prompt: "رَتِّبِ الْكَلِماتِ لِتُكَوِّنَ جُمْلَةً مِنَ النَّصِّ.",
        input: { type: "order", items: tileItems(tiles), joiner: " " },
      });
    });
  },
  check: (item, answer) => checkTiles(item.params.tiles, " ", item.params.tokens, answer),
  solution: (item) => tileSolution(item.params.tiles, item.params.tokens),
  explain: (item) => [`تَبْدَأُ الْجُمْلَةُ بِكَلِمَةِ «${item.params.tokens[0]}».`, `الْجُمْلَةُ: ${item.params.sentence}`],
  checkIntegrity(item) {
    const p = tileIntegrity(item, item.params.tiles, item.params.tokens, " ");
    if (item.params.tokens.length > MAX_TILES) p.push("too many tiles");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* ar-count-words: how many words are in the sentence                   */
/* ------------------------------------------------------------------ */

interface CountParams {
  sentence: string;
}

export const AR_COUNT_WORDS: M<SentencesConfig, CountParams> = {
  id: "GEN-AR-COUNT-WORDS",
  version: 1,
  mechanicId: "ar-count-words",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return listProblems(c?.sentences, "text", 2, (o, i) => (words(String(o.text)).length >= 2 ? [] : [`sentence[${i}]: too short`]));
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const s = pick(rng, levelPool(c.sentences, (x) => words(x.text).length, d));
      return makeItem(AR_COUNT_WORDS, seed, d, {
        params: { sentence: s.text },
        prompt: "اقْرَأِ الْجُمْلَةَ بِصَوْتٍ جَهيرٍ، ثُمَّ عُدَّ كَلِماتِها.",
        visual: card(s.text, { size: "sentence" }),
        input: { type: "number", maxDigits: 2 },
      });
    });
  },
  check(item, answer) {
    const n = words(item.params.sentence).length;
    if (typeof answer !== "number" || !Number.isInteger(answer)) return wrong(n, answer, "input_invalid");
    return answer === n ? ok() : wrong(n, answer, Math.abs(answer - n) <= 2 ? "counting_error" : "other");
  },
  solution: (item) => words(item.params.sentence).length,
  explain(item) {
    const w = words(item.params.sentence);
    return [`الْكَلِماتُ: ${w.map((x, i) => `(${i + 1}) ${x}`).join("  ")}`, `عَدَدُ الْكَلِماتِ: ${w.length}`];
  },
  checkIntegrity(item) {
    const p: string[] = [];
    if (item.input.type !== "number") p.push("expects number input");
    if (words(item.params.sentence).length < 2) p.push("sentence too short");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* ar-sun-moon: اللام الشمسية والقمرية                                   */
/* ------------------------------------------------------------------ */

interface SunMoonConfig {
  words: (Paged & { word: string })[];
}
interface SunMoonParams {
  words: string[];
  /** Level 1: classify one word. Level 2: pick every sun word. Level 3: the odd one out. */
  ask: "classify" | "pick-sun" | "odd";
  odd?: "sun" | "moon";
}
const LAM_LABEL = { sun: "لامٌ شَمْسِيَّةٌ", moon: "لامٌ قَمَرِيَّةٌ" } as const;

export const AR_SUN_MOON: M<SunMoonConfig, SunMoonParams> = {
  id: "GEN-AR-SUN-MOON",
  version: 1,
  mechanicId: "ar-sun-moon",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = listProblems(c?.words, "word", 4, (o, i) => (lamType(String(o.word)) ? [] : [`word[${i}]: «${String(o.word)}» does not start with ال`]));
    if (p.length) return p;
    const sun = c.words.filter((w) => lamType(w.word) === "sun").length;
    if (sun < 2 || c.words.length - sun < 2) p.push("need at least 2 sun and 2 moon words");
    return p;
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const all = c.words.map((w) => w.word);
      if (d === 1) {
        const w = pick(rng, all);
        return makeItem(AR_SUN_MOON, seed, d, {
          params: { words: [w], ask: "classify" },
          prompt: `ما نَوْعُ اللّامِ في كَلِمَةِ «${w}»؟`,
          visual: card(w, { size: "word" }),
          input: { type: "choice", options: [{ id: "sun", label: LAM_LABEL.sun }, { id: "moon", label: LAM_LABEL.moon }] },
        });
      }
      if (d === 2) {
        const ws = drawDistinct(rng, all, Math.min(4, all.length));
        const sun = ws.filter((w) => lamType(w) === "sun").length;
        if (sun === 0 || sun === ws.length) return null;
        return makeItem(AR_SUN_MOON, seed, d, {
          params: { words: ws, ask: "pick-sun" },
          prompt: "اخْتَرِ الْكَلِماتِ الَّتي فيها لامٌ شَمْسِيَّةٌ.",
          input: { type: "multi", options: labelled(ws) },
        });
      }
      const odd: "sun" | "moon" = rng() < 0.5 ? "sun" : "moon";
      const other = odd === "sun" ? "moon" : "sun";
      const one = all.filter((w) => lamType(w) === odd);
      const rest = all.filter((w) => lamType(w) === other);
      if (one.length < 1 || rest.length < 2) return null;
      const ws = shuffleAll(rng, [pick(rng, one), ...drawDistinct(rng, rest, 2)]);
      return makeItem(AR_SUN_MOON, seed, d, {
        params: { words: ws, ask: "odd", odd },
        prompt: `أَيُّ كَلِمَةٍ فيها ${LAM_LABEL[odd]}؟`,
        input: { type: "choice", options: labelled(ws) },
      });
    });
  },
  check(item, answer) {
    const { words: ws, ask, odd } = item.params;
    if (ask === "classify") {
      const t = lamType(ws[0]!)!;
      if (answer !== "sun" && answer !== "moon") return wrong(t, answer, "input_invalid");
      return answer === t ? ok() : wrong(t, answer, "property_error");
    }
    if (ask === "pick-sun") return checkMulti(ws, answer, (w) => lamType(w) === "sun");
    return checkChoice(ws, answer, (w) => lamType(w) === odd, "property_error");
  },
  solution(item) {
    const { words: ws, ask, odd } = item.params;
    if (ask === "classify") return lamType(ws[0]!);
    if (ask === "pick-sun") return multiSolution(ws, (w) => lamType(w) === "sun");
    return solutionOf(ws, (w) => lamType(w) === odd);
  },
  explain(item) {
    return item.params.words.map((w) => {
      const t = lamType(w)!;
      const next = bare(w)[2];
      return t === "sun"
        ? `«${w}»: بَعْدَ «ال» حَرْفُ «${next}»، فَاللّامُ تُكْتَبُ وَلا تُنْطَقُ (شَمْسِيَّةٌ).`
        : `«${w}»: بَعْدَ «ال» حَرْفُ «${next}»، فَاللّامُ تُكْتَبُ وَتُنْطَقُ (قَمَرِيَّةٌ).`;
    });
  },
  checkIntegrity(item) {
    const { words: ws, ask } = item.params;
    const p: string[] = [];
    if (ws.some((w) => lamType(w) === null)) p.push("word without ال");
    if (new Set(ws).size !== ws.length) p.push("duplicate words");
    if (ask === "classify" && item.input.type !== "choice") p.push("expects choice input");
    if (ask === "pick-sun") {
      if (item.input.type !== "multi") p.push("expects multi input");
      else p.push(...optionProblems(item.input.options));
      const sun = ws.filter((w) => lamType(w) === "sun").length;
      if (sun === 0 || sun === ws.length) p.push("needs both kinds");
    }
    if (ask === "odd") p.push(...choiceIntegrity(asMech(AR_SUN_MOON), item, ws.length));
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* ar-fill-word: complete a sentence from the book's word bank          */
/* ------------------------------------------------------------------ */

export interface FillItem extends Paged {
  /** Sentence with «___» where the word goes. */
  text: string;
  answer: string;
}
interface FillConfig {
  bank: string[];
  items: FillItem[];
}
interface FillParams {
  text: string;
  answer: string;
  options: string[];
}
export const BLANK = "___";

export const AR_FILL_WORD: M<FillConfig, FillParams> = {
  id: "GEN-AR-FILL-WORD",
  version: 1,
  mechanicId: "ar-fill-word",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!Array.isArray(c?.bank) || c.bank.length < 2 || !c.bank.every(isText)) return ["bank: need 2+ words"];
    if (new Set(c.bank.map(bare)).size !== c.bank.length) p.push("bank: duplicate words");
    p.push(
      ...listProblems(c.items, "text", 2, (o, i) => {
        const q: string[] = [];
        if (String(o.text).split(BLANK).length !== 2) q.push(`item[${i}]: needs exactly one ${BLANK}`);
        if (!c.bank.some((b) => sameText(b, String(o.answer)))) q.push(`item[${i}]: answer not in bank`);
        return q;
      }),
    );
    return p;
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const it = pick(rng, c.items);
      const others = c.bank.filter((b) => !sameBare(b, it.answer));
      const n = Math.min(byLevel(d, [2, 3, 4] as const), others.length + 1);
      const options = shuffleAll(rng, [it.answer, ...drawDistinct(rng, others, n - 1)]);
      return makeItem(AR_FILL_WORD, seed, d, {
        params: { text: it.text, answer: it.answer, options },
        prompt: "اخْتَرِ الْكَلِمَةَ الْمُناسِبَةَ لِلْفَراغِ.",
        visual: card(it.text, { size: "sentence" }),
        input: { type: "choice", options: labelled(options) },
      });
    });
  },
  check: (item, answer) => checkChoice(item.params.options, answer, (o) => sameText(o, item.params.answer)),
  solution: (item) => solutionOf(item.params.options, (o) => sameText(o, item.params.answer)),
  explain: (item) => [`الْكَلِمَةُ الْمُناسِبَةُ: «${item.params.answer}»`, item.params.text.replace(BLANK, item.params.answer)],
  checkIntegrity(item) {
    const p = choiceIntegrity(asMech(AR_FILL_WORD), item, item.params.options.length);
    if (item.params.text.split(BLANK).length !== 2) p.push("sentence must have one blank");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* ar-text-check: which statement was in the text                       */
/* ------------------------------------------------------------------ */

export interface Statement extends Paged {
  text: string;
  inText: boolean;
}
interface StatementsConfig {
  statements: Statement[];
  /**
   * Optional wording when the book's question is not «ورد في النص» (e.g. «تناسب وصف الكتاب»):
   * `inText` then means "true for this question".
   */
  prompts?: { in: string; notIn: string; allIn: string };
}
interface StatementParams {
  statements: Statement[];
  ask: "in" | "not-in" | "all-in";
}
const TEXT_PROMPTS = { in: "أَيُّ عِبارَةٍ قَرَأْتَها في النَّصِّ؟", notIn: "أَيُّ عِبارَةٍ لَمْ تَرِدْ في النَّصِّ؟", allIn: "اخْتَرْ كُلَّ الْعِباراتِ الَّتي قَرَأْتَها في النَّصِّ." };

export const AR_TEXT_CHECK: M<StatementsConfig, StatementParams> = {
  id: "GEN-AR-TEXT-CHECK",
  version: 1,
  mechanicId: "ar-text-check",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = listProblems(c?.statements, "text", 3, (o, i) => (typeof o.inText === "boolean" ? [] : [`statement[${i}]: inText must be true/false`]));
    if (p.length) return p;
    const t = c.statements.filter((s) => s.inText).length;
    if (t < 1 || c.statements.length - t < 1) p.push("need statements both in and not in the text");
    if (Math.max(t, c.statements.length - t) < 2) p.push("need at least 2 of one kind");
    if (c.prompts && !(isText(c.prompts.in) && isText(c.prompts.notIn) && isText(c.prompts.allIn))) p.push("prompts: need in, notIn and allIn");
    return p;
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const yes = c.statements.filter((s) => s.inText);
      const no = c.statements.filter((s) => !s.inText);
      if (d === 3 && yes.length >= 2) {
        const pickN = Math.min(c.statements.length, 5);
        const ss = drawDistinct(rng, c.statements, pickN);
        const k = ss.filter((s) => s.inText).length;
        if (k === 0 || k === ss.length) return null;
        return makeItem(AR_TEXT_CHECK, seed, d, {
          params: { statements: ss, ask: "all-in" },
          prompt: (c.prompts ?? TEXT_PROMPTS).allIn,
          input: { type: "multi", options: labelled(ss.map((s) => s.text)) },
        });
      }
      // Level 1: 1 in + 1 out; level 2 (or 3 without enough true statements): one odd among 3.
      const wantIn = d === 1 ? no.length >= 1 : no.length >= 2 || yes.length < 2;
      const ask: StatementParams["ask"] = wantIn ? "in" : "not-in";
      const odd = ask === "in" ? yes : no;
      const rest = ask === "in" ? no : yes;
      const n = d === 1 ? 1 : 2;
      if (odd.length < 1 || rest.length < n) return null;
      const ss = shuffleAll(rng, [pick(rng, odd), ...drawDistinct(rng, rest, n)]);
      return makeItem(AR_TEXT_CHECK, seed, d, {
        params: { statements: ss, ask },
        prompt: ask === "in" ? (c.prompts ?? TEXT_PROMPTS).in : (c.prompts ?? TEXT_PROMPTS).notIn,
        input: { type: "choice", options: labelled(ss.map((s) => s.text)) },
      });
    });
  },
  check(item, answer) {
    const { statements: ss, ask } = item.params;
    if (ask === "all-in") return checkMulti(ss, answer, (s) => s.inText);
    return checkChoice(ss, answer, (s) => s.inText === (ask === "in"), "other");
  },
  solution(item) {
    const { statements: ss, ask } = item.params;
    if (ask === "all-in") return multiSolution(ss, (s) => s.inText);
    return solutionOf(ss, (s) => s.inText === (ask === "in"));
  },
  explain: (item) => item.params.statements.map((s) => `${s.inText ? "✓" : "✗"} ${s.text} (ص ${s.page})`),
  checkIntegrity(item) {
    const { statements: ss, ask } = item.params;
    if (ask === "all-in") {
      const p = item.input.type === "multi" ? optionProblems(item.input.options) : ["expects multi input"];
      const k = ss.filter((s) => s.inText).length;
      if (k === 0 || k === ss.length) p.push("needs both kinds");
      return p;
    }
    return choiceIntegrity(asMech(AR_TEXT_CHECK), item, ss.length);
  },
};

/* ------------------------------------------------------------------ */
/* ar-question: closed comprehension question with the book's options   */
/* ------------------------------------------------------------------ */

export interface Question extends Paged {
  q: string;
  options: string[];
  answer: string;
}
interface QuestionConfig {
  questions: Question[];
}
interface QuestionParams {
  q: string;
  answer: string;
  options: string[];
  page: number;
}

export const AR_QUESTION: M<QuestionConfig, QuestionParams> = {
  id: "GEN-AR-QUESTION",
  version: 1,
  mechanicId: "ar-question",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return listProblems(c?.questions, "q", 1, (o, i) => {
      const opts = o.options;
      if (!Array.isArray(opts) || opts.length < 2 || !opts.every(isText)) return [`question[${i}]: needs 2+ options`];
      if (new Set((opts as string[]).map(bare)).size !== opts.length) return [`question[${i}]: duplicate options`];
      return (opts as string[]).filter((x) => sameText(x, String(o.answer))).length === 1 ? [] : [`question[${i}]: answer must be one of the options`];
    });
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const q = pick(rng, c.questions);
      const others = q.options.filter((o) => !sameText(o, q.answer));
      const n = Math.min(byLevel(d, [2, 3, 4] as const), q.options.length);
      const options = shuffleAll(rng, [q.answer, ...drawDistinct(rng, others, n - 1)]);
      return makeItem(AR_QUESTION, seed, d, {
        params: { q: q.q, answer: q.answer, options, page: q.page },
        prompt: q.q,
        input: { type: "choice", options: labelled(options) },
      });
    });
  },
  check: (item, answer) => checkChoice(item.params.options, answer, (o) => sameText(o, item.params.answer)),
  solution: (item) => solutionOf(item.params.options, (o) => sameText(o, item.params.answer)),
  explain: (item) => [`الْإِجابَةُ: ${item.params.answer}`, `ارْجِعْ إِلى النَّصِّ (ص ${item.params.page}).`],
  checkIntegrity: (item) => choiceIntegrity(asMech(AR_QUESTION), item, item.params.options.length),
};

/* ------------------------------------------------------------------ */
/* ar-event-order: order events as they happened in the text            */
/* ------------------------------------------------------------------ */

interface EventsConfig {
  /** Events in the order of the text. */
  events: (Paged & { text: string })[];
  /** Optional book wording, e.g. «رتب كلام القصة المصورة» (default: order the events of the text). */
  prompt?: string;
}
interface EventParams {
  /** Chosen events, in text order. */
  events: string[];
  tiles: string[];
}

export const AR_EVENT_ORDER: M<EventsConfig, EventParams> = {
  id: "GEN-AR-EVENT-ORDER",
  version: 1,
  mechanicId: "ar-event-order",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = listProblems(c?.events, "text", 3);
    if (!p.length && new Set(c.events.map((e) => bare(e.text))).size !== c.events.length) p.push("duplicate events");
    if (c?.prompt !== undefined && !isText(c.prompt)) p.push("prompt must be text");
    return p;
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const n = Math.min(byLevel(d, [3, 4, 5] as const), c.events.length);
      const idx = drawDistinct(rng, c.events.map((_, i) => i), n).sort((a, b) => a - b);
      const events = idx.map((i) => c.events[i]!.text);
      const tiles = deal(rng, events, "\n");
      if (!tiles) return null;
      return makeItem(AR_EVENT_ORDER, seed, d, {
        params: { events, tiles },
        prompt: c.prompt ?? "رَتِّبِ الْأَحْداثَ كَما وَرَدَتْ في النَّصِّ.",
        input: { type: "order", items: tileItems(tiles) },
      });
    });
  },
  check: (item, answer) => checkTiles(item.params.tiles, "\n", item.params.events, answer),
  solution: (item) => tileSolution(item.params.tiles, item.params.events),
  explain: (item) => item.params.events.map((e, i) => `${i + 1}. ${e}`),
  checkIntegrity: (item) => tileIntegrity(item, item.params.tiles, item.params.events, "\n"),
};

/* ------------------------------------------------------------------ */
/* ar-letter-find: the handwriting letter group (e.g. ب ت ث)             */
/* ------------------------------------------------------------------ */

interface LettersConfig {
  /** Letters taught together in the lesson's handwriting section, e.g. ["ب","ت","ث"]. */
  letters: string[];
  words: (Paged & { word: string })[];
}
interface LetterFindParams {
  letters: string[];
  ask: "which-letter" | "which-word" | "position";
  target: string;
  words: string[];
}
const POS_LABEL: Record<LetterPosition, string> = { start: "في أَوَّلِ الْكَلِمَةِ", middle: "في وَسَطِ الْكَلِمَةِ", end: "في آخِرِ الْكَلِمَةِ" };
/** Letters of the group present in the word (bare skeleton). */
const groupIn = (word: string, letters: readonly string[]) => letters.filter((l) => bare(word).includes(l));

export const AR_LETTER_FIND: M<LettersConfig, LetterFindParams> = {
  id: "GEN-AR-LETTER-FIND",
  version: 1,
  mechanicId: "ar-letter-find",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!Array.isArray(c?.letters) || c.letters.length < 2 || !c.letters.every((l) => typeof l === "string" && [...l].length === 1)) return ["letters: need 2+ single letters"];
    p.push(...listProblems(c.words, "word", 3));
    if (p.length) return p;
    const single = c.words.filter((w) => groupIn(w.word, c.letters).length === 1);
    if (single.length < 2) p.push("need 2+ words that contain exactly one letter of the group");
    if (new Set(single.map((w) => groupIn(w.word, c.letters)[0])).size < 2) p.push("words must cover 2+ letters of the group");
    return p;
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const single = c.words.map((w) => w.word).filter((w) => groupIn(w, c.letters).length === 1);
      if (d === 1) {
        const w = pick(rng, single);
        return makeItem(AR_LETTER_FIND, seed, d, {
          params: { letters: [...c.letters], ask: "which-letter", target: groupIn(w, c.letters)[0]!, words: [w] },
          prompt: `أَيُّ هذِهِ الْحُروفِ في كَلِمَةِ «${w}»؟`,
          visual: card(w, { size: "word" }),
          input: { type: "choice", options: labelled(c.letters) },
        });
      }
      if (d === 2) {
        const target = pick(rng, c.letters);
        const yes = single.filter((w) => groupIn(w, c.letters)[0] === target);
        const no = c.words.map((w) => w.word).filter((w) => !bare(w).includes(target) && groupIn(w, c.letters).length > 0);
        if (yes.length < 1 || no.length < 2) return null;
        const ws = shuffleAll(rng, [pick(rng, yes), ...drawDistinct(rng, no, 2)]);
        return makeItem(AR_LETTER_FIND, seed, d, {
          params: { letters: [...c.letters], ask: "which-word", target, words: ws },
          prompt: `اخْتَرِ الْكَلِمَةَ الَّتي فيها حَرْفُ «${target}».`,
          input: { type: "choice", options: labelled(ws) },
        });
      }
      const once = c.words
        .map((w) => w.word)
        .flatMap((w) => c.letters.filter((l) => letterPositions(w, l).length === 1).map((l) => ({ w, l })));
      if (once.length === 0) return null;
      const { w, l } = pick(rng, once);
      return makeItem(AR_LETTER_FIND, seed, d, {
        params: { letters: [...c.letters], ask: "position", target: l, words: [w] },
        prompt: `أَيْنَ جاءَ حَرْفُ «${l}» في كَلِمَةِ «${w}»؟`,
        visual: card(w, { size: "word" }),
        input: { type: "choice", options: (["start", "middle", "end"] as const).map((k) => ({ id: k, label: POS_LABEL[k] })) },
      });
    });
  },
  check(item, answer) {
    const { ask, target, words: ws, letters } = item.params;
    if (ask === "which-letter") return checkChoice(letters, answer, (l) => l === target, "property_error");
    if (ask === "which-word") return checkChoice(ws, answer, (w) => bare(w).includes(target), "property_error");
    const pos = letterPositions(ws[0]!, target)[0];
    if (answer !== "start" && answer !== "middle" && answer !== "end") return wrong(pos, answer, "input_invalid");
    return answer === pos ? ok() : wrong(pos, answer, "property_error");
  },
  solution(item) {
    const { ask, target, words: ws, letters } = item.params;
    if (ask === "which-letter") return solutionOf(letters, (l) => l === target);
    if (ask === "which-word") return solutionOf(ws, (w) => bare(w).includes(target));
    return letterPositions(ws[0]!, target)[0];
  },
  explain(item) {
    const { ask, target, words: ws } = item.params;
    if (ask === "position") return [`«${ws[0]}»: حَرْفُ «${target}» ${POS_LABEL[letterPositions(ws[0]!, target)[0]!]}.`];
    return [`الْحَرْفُ «${target}» في كَلِمَةِ «${ws.find((w) => bare(w).includes(target))}».`, "انْتَبِهْ إِلى عَدَدِ النِّقاطِ وَمَكانِها."];
  },
  checkIntegrity(item) {
    const { ask, target, words: ws, letters } = item.params;
    if (ask === "which-letter") {
      const p = choiceIntegrity(asMech(AR_LETTER_FIND), item, letters.length);
      if (groupIn(ws[0]!, letters).length !== 1) p.push("word must contain exactly one letter of the group");
      return p;
    }
    if (ask === "which-word") return choiceIntegrity(asMech(AR_LETTER_FIND), item, ws.length);
    const p: string[] = [];
    if (letterPositions(ws[0]!, target).length !== 1) p.push("letter must appear exactly once");
    if (item.input.type !== "choice" || item.input.options.length !== 3) p.push("expects 3 position options");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* ar-missing-letter: a book word in its sentence, one letter hidden     */
/* ------------------------------------------------------------------ */

interface MissingConfig {
  letters: string[];
  items: (Paged & { word: string; sentence: string })[];
}
interface MissingParams {
  letters: string[];
  word: string;
  sentence: string;
  letter: string;
  shown: string;
}

export const AR_MISSING_LETTER: M<MissingConfig, MissingParams> = {
  id: "GEN-AR-MISSING-LETTER",
  version: 1,
  mechanicId: "ar-missing-letter",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    if (!Array.isArray(c?.letters) || c.letters.length < 2) return ["letters: need 2+"];
    return listProblems(c.items, "word", 2, (o, i) => {
      const w = String(o.word);
      const q: string[] = [];
      if (!isText(o.sentence) || !String(o.sentence).includes(w)) q.push(`item[${i}]: sentence must contain the word`);
      const hits = c.letters.reduce((n, l) => n + letterPositions(w, l).length, 0);
      if (hits !== 1) q.push(`item[${i}]: «${w}» must contain exactly one letter of the group (has ${hits})`);
      return q;
    });
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const pool = levelPool(c.items, (x) => bare(x.word).length, d);
      const it = pick(rng, pool);
      const letter = c.letters.find((l) => letterPositions(it.word, l).length === 1)!;
      const b = blankLetter(it.word, letter);
      if (!b) return null;
      return makeItem(AR_MISSING_LETTER, seed, d, {
        params: { letters: [...c.letters], word: it.word, sentence: it.sentence, letter, shown: b.shown },
        prompt: "ما الْحَرْفُ النّاقِصُ مِنَ الْكَلِمَةِ الْمُلَوَّنَةِ؟",
        visual: card(it.sentence.replace(it.word, b.shown), { size: "sentence", highlight: b.shown }),
        input: { type: "choice", options: labelled(c.letters) },
      });
    });
  },
  check: (item, answer) => checkChoice(item.params.letters, answer, (l) => l === item.params.letter, "property_error"),
  solution: (item) => solutionOf(item.params.letters, (l) => l === item.params.letter),
  explain: (item) => [`الْكَلِمَةُ: «${item.params.word}»، وَالْحَرْفُ النّاقِصُ «${item.params.letter}».`],
  checkIntegrity(item) {
    const p = choiceIntegrity(asMech(AR_MISSING_LETTER), item, item.params.letters.length);
    if (!item.params.sentence.includes(item.params.word)) p.push("sentence must contain the word");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* ar-word-relation: مرادف / مضاد                                       */
/* ------------------------------------------------------------------ */

export interface RelationPair extends Paged {
  word: string;
  match: string;
  relation: "synonym" | "antonym";
}
interface RelationConfig {
  pairs: RelationPair[];
}
interface RelationParams {
  word: string;
  match: string;
  relation: "synonym" | "antonym";
  options: string[];
}

export const AR_WORD_RELATION: M<RelationConfig, RelationParams> = {
  id: "GEN-AR-WORD-RELATION",
  version: 1,
  mechanicId: "ar-word-relation",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return listProblems(c?.pairs, "word", 3, (o, i) => {
      const q: string[] = [];
      if (!isText(o.match)) q.push(`pair[${i}]: missing match`);
      if (o.relation !== "synonym" && o.relation !== "antonym") q.push(`pair[${i}]: relation must be synonym/antonym`);
      return q;
    });
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const pr = pick(rng, c.pairs);
      // Never offer a word that is linked to the target in ANY listed pair.
      const linked = new Set(c.pairs.filter((x) => sameBare(x.word, pr.word) || sameBare(x.match, pr.word)).flatMap((x) => [bare(x.word), bare(x.match)]));
      const pool = [...new Set(c.pairs.flatMap((x) => [x.word, x.match]))].filter((w) => !linked.has(bare(w)));
      const n = byLevel(d, [2, 3, 4] as const);
      if (pool.length < n - 1) return null;
      const options = shuffleAll(rng, [pr.match, ...drawDistinct(rng, pool, n - 1)]);
      return makeItem(AR_WORD_RELATION, seed, d, {
        params: { word: pr.word, match: pr.match, relation: pr.relation, options },
        prompt: pr.relation === "synonym" ? `ما مُرادِفُ كَلِمَةِ «${pr.word}»؟` : `ما مُضادُّ كَلِمَةِ «${pr.word}»؟`,
        visual: card(pr.word, { size: "word" }),
        input: { type: "choice", options: labelled(options) },
      });
    });
  },
  check: (item, answer) => checkChoice(item.params.options, answer, (o) => sameBare(o, item.params.match)),
  solution: (item) => solutionOf(item.params.options, (o) => sameBare(o, item.params.match)),
  explain: (item) => [`${item.params.relation === "synonym" ? "مُرادِفُ" : "مُضادُّ"} «${item.params.word}» هُوَ «${item.params.match}».`],
  checkIntegrity: (item) => choiceIntegrity(asMech(AR_WORD_RELATION), item, item.params.options.length),
};

/* ------------------------------------------------------------------ */
/* ar-verb-pick: the verb that starts a verbal sentence                  */
/* ------------------------------------------------------------------ */

interface VerbConfig {
  sentences: (Paged & { text: string; verb: string })[];
}
interface VerbParams {
  sentence: string;
  verb: string;
  tokens: string[];
}

export const AR_VERB_PICK: M<VerbConfig, VerbParams> = {
  id: "GEN-AR-VERB-PICK",
  version: 1,
  mechanicId: "ar-verb-pick",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return listProblems(c?.sentences, "text", 2, (o, i) => {
      const t = words(String(o.text));
      const n = t.filter((w) => sameText(w, String(o.verb))).length;
      const q: string[] = [];
      if (n !== 1) q.push(`sentence[${i}]: verb must appear exactly once`);
      if (new Set(t.map(bare)).size !== t.length) q.push(`sentence[${i}]: repeated words`);
      if (t.length < 2 || t.length > MAX_TILES) q.push(`sentence[${i}]: 2–${MAX_TILES} words`);
      return q;
    });
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const s = pick(rng, levelPool(c.sentences, (x) => words(x.text).length, d));
      const tokens = words(s.text);
      return makeItem(AR_VERB_PICK, seed, d, {
        params: { sentence: s.text, verb: s.verb, tokens },
        prompt: "الْجُمْلَةُ الْفِعْلِيَّةُ تَبْدَأُ بِفِعْلٍ. المسِ الْفِعْلَ.",
        visual: card(s.text, { size: "sentence" }),
        input: { type: "choice", options: labelled(tokens) },
      });
    });
  },
  check: (item, answer) => checkChoice(item.params.tokens, answer, (w) => sameText(w, item.params.verb), "property_error"),
  solution: (item) => solutionOf(item.params.tokens, (w) => sameText(w, item.params.verb)),
  explain: (item) => [`الْفِعْلُ: «${item.params.verb}»`, item.params.sentence],
  checkIntegrity: (item) => choiceIntegrity(asMech(AR_VERB_PICK), item, item.params.tokens.length),
};

/* ------------------------------------------------------------------ */
/* ar-poem-gap: complete a verse of the memorisation poem               */
/* ------------------------------------------------------------------ */

interface PoemConfig {
  lines: (Paged & { text: string })[];
}
interface PoemParams {
  line: string;
  answer: string;
  options: string[];
}

/** Words that may be hidden: 3+ letters and appearing once in the line. */
function gapCandidates(line: string): string[] {
  const t = words(line);
  return t.filter((w) => bare(w).length >= 3 && t.filter((x) => sameBare(x, w)).length === 1);
}

export const AR_POEM_GAP: M<PoemConfig, PoemParams> = {
  id: "GEN-AR-POEM-GAP",
  version: 1,
  mechanicId: "ar-poem-gap",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = listProblems(c?.lines, "text", 2, (o, i) => (gapCandidates(String(o.text)).length ? [] : [`line[${i}]: no word to hide`]));
    return p;
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const ln = pick(rng, c.lines);
      const answer = pick(rng, gapCandidates(ln.text));
      const lineWords = new Set(words(ln.text).map(bare));
      const pool = [...new Set(c.lines.flatMap((l) => words(l.text)).filter((w) => bare(w).length >= 3 && !lineWords.has(bare(w))))];
      const n = byLevel(d, [2, 3, 4] as const);
      const distract = drawDistinct(
        rng,
        pool.filter((w, i) => pool.findIndex((x) => sameBare(x, w)) === i),
        n - 1,
      );
      if (distract.length < n - 1) return null;
      const options = shuffleAll(rng, [answer, ...distract]);
      return makeItem(AR_POEM_GAP, seed, d, {
        params: { line: ln.text, answer, options },
        prompt: "أَكْمِلِ الْبَيْتَ كَما حَفِظْتَهُ.",
        visual: card(ln.text.replace(answer, BLANK), { size: "sentence" }),
        input: { type: "choice", options: labelled(options) },
      });
    });
  },
  check: (item, answer) => checkChoice(item.params.options, answer, (o) => sameBare(o, item.params.answer)),
  solution: (item) => solutionOf(item.params.options, (o) => sameBare(o, item.params.answer)),
  explain: (item) => [item.params.line],
  checkIntegrity(item) {
    const p = choiceIntegrity(asMech(AR_POEM_GAP), item, item.params.options.length);
    if (!gapCandidates(item.params.line).some((w) => sameBare(w, item.params.answer))) p.push("hidden word not unique in line");
    return p;
  },
};


/* ------------------------------------------------------------------ */
/* ar-sort: put each word in one of the book's two columns              */
/* ------------------------------------------------------------------ */

export interface SortEntry extends Paged {
  text: string;
  /** Index of the column (0 or 1) in `columns`. */
  column: 0 | 1;
}
interface SortConfig {
  /** The two column headings exactly as printed. */
  columns: [string, string];
  items: SortEntry[];
}
interface SortParams {
  columns: [string, string];
  items: SortEntry[];
  ask: "classify" | "pick" | "odd";
  target: 0 | 1;
}

export const AR_SORT: M<SortConfig, SortParams> = {
  id: "GEN-AR-SORT",
  version: 1,
  mechanicId: "ar-sort",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    if (!Array.isArray(c?.columns) || c.columns.length !== 2 || !c.columns.every(isText)) return ["columns: need 2 headings"];
    const p = listProblems(c.items, "text", 4, (o, i) => (o.column === 0 || o.column === 1 ? [] : [`item[${i}]: column must be 0 or 1`]));
    if (p.length) return p;
    const a = c.items.filter((x) => x.column === 0).length;
    if (a < 2 || c.items.length - a < 2) p.push("need at least 2 entries per column");
    if (new Set(c.items.map((x) => bare(x.text))).size !== c.items.length) p.push("duplicate entries");
    return p;
  },
  generate(seed, d, c) {
    return sample(seed, (rng) => {
      const target: 0 | 1 = rng() < 0.5 ? 0 : 1;
      if (d === 1) {
        const it = pick(rng, c.items);
        return makeItem(AR_SORT, seed, d, {
          params: { columns: c.columns, items: [it], ask: "classify", target: it.column },
          prompt: `في أَيِّ عَمودٍ نَضَعُ «${it.text}»؟`,
          visual: card(it.text, { size: "word" }),
          input: { type: "choice", options: c.columns.map((label, i) => ({ id: `c${i}`, label })) },
        });
      }
      if (d === 2) {
        const its = drawDistinct(rng, c.items, Math.min(4, c.items.length));
        const k = its.filter((x) => x.column === target).length;
        if (k === 0 || k === its.length) return null;
        return makeItem(AR_SORT, seed, d, {
          params: { columns: c.columns, items: its, ask: "pick", target },
          prompt: `اخْتَرْ كُلَّ ما يوضَعُ في عَمودِ «${c.columns[target]}».`,
          input: { type: "multi", options: labelled(its.map((x) => x.text)) },
        });
      }
      const one = c.items.filter((x) => x.column === target);
      const rest = c.items.filter((x) => x.column !== target);
      if (rest.length < 2) return null;
      const its = shuffleAll(rng, [pick(rng, one), ...drawDistinct(rng, rest, 2)]);
      return makeItem(AR_SORT, seed, d, {
        params: { columns: c.columns, items: its, ask: "odd", target },
        prompt: `أَيُّها يوضَعُ في عَمودِ «${c.columns[target]}»؟`,
        input: { type: "choice", options: labelled(its.map((x) => x.text)) },
      });
    });
  },
  check(item, answer) {
    const { items, ask, target } = item.params;
    if (ask === "classify") {
      const exp = `c${items[0]!.column}`;
      if (answer !== "c0" && answer !== "c1") return wrong(exp, answer, "input_invalid");
      return answer === exp ? ok() : wrong(exp, answer, "property_error");
    }
    if (ask === "pick") return checkMulti(items, answer, (x) => x.column === target);
    return checkChoice(items, answer, (x) => x.column === target, "property_error");
  },
  solution(item) {
    const { items, ask, target } = item.params;
    if (ask === "classify") return `c${items[0]!.column}`;
    if (ask === "pick") return multiSolution(items, (x) => x.column === target);
    return solutionOf(items, (x) => x.column === target);
  },
  explain: (item) => item.params.items.map((x) => `«${x.text}» ← ${item.params.columns[x.column]} (ص ${x.page})`),
  checkIntegrity(item) {
    const { items, ask, target } = item.params;
    if (new Set(items.map((x) => bare(x.text))).size !== items.length) return ["duplicate entries"];
    if (ask === "classify") return item.input.type === "choice" && item.input.options.length === 2 ? [] : ["expects 2 column options"];
    if (ask === "pick") {
      const p = item.input.type === "multi" ? optionProblems(item.input.options) : ["expects multi input"];
      const k = items.filter((x) => x.column === target).length;
      if (k === 0 || k === items.length) p.push("needs both columns");
      return p;
    }
    return choiceIntegrity(asMech(AR_SORT), item, items.length);
  },
};

export const ARABIC_MECHANICS = [
  AR_SYLLABLES,
  AR_SENTENCE_BUILD,
  AR_COUNT_WORDS,
  AR_SUN_MOON,
  AR_FILL_WORD,
  AR_TEXT_CHECK,
  AR_QUESTION,
  AR_EVENT_ORDER,
  AR_LETTER_FIND,
  AR_MISSING_LETTER,
  AR_WORD_RELATION,
  AR_VERB_PICK,
  AR_POEM_GAP,
  AR_SORT,
] as unknown as QuizMechanic<never, unknown>[];
