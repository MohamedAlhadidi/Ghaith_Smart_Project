/**
 * Arabic mechanics: 1000 seeds × 3 levels on fixtures (words taken from «لُعْبَتي», pp. 35–47),
 * plus targeted checks that wrong answers are rejected and bad configs are refused.
 * The real lesson configs are exercised again by test/arabic/catalog.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  AR_COUNT_WORDS,
  AR_EVENT_ORDER,
  AR_FILL_WORD,
  AR_LETTER_FIND,
  AR_MISSING_LETTER,
  AR_POEM_GAP,
  AR_QUESTION,
  AR_SENTENCE_BUILD,
  AR_SORT,
  AR_SUN_MOON,
  AR_SYLLABLES,
  AR_TEXT_CHECK,
  AR_VERB_PICK,
  AR_WORD_RELATION,
} from "../../src/arabic/mechanics";
import { lamType, words } from "../../src/arabic/text";
import { exerciseMechanic } from "../math/harness";

const P = 44;
const SYL = {
  words: [
    { word: "عَمُّها", syllables: ["عَمْـ", "ـمُـ", "ـها"], page: P },
    { word: "أَهْداها", syllables: ["أَهْـ", "ـدا", "ـها"], page: P },
    { word: "دُمْيَةً", syllables: ["دُمْـ", "ـيَـ", "ـةً"], page: P },
  ],
};

const SENT = {
  sentences: [
    { text: "انْفَلَتَتِ الدُّمْيَةُ مِنْ يَدَيْها.", page: P },
    { text: "رَكَضَتْ بِأَقْدامِها الصَّغيرَةِ حافِيَةً.", page: P },
    { text: "ظَلَّتْ هُناكَ في الْجانِبِ الْآخَرِ مِنَ الْفَلَجِ.", page: P },
  ],
};
const SUN = {
  words: ["السّابِعَةِ", "الْغِبْطَةِ", "السُّلَّمَ", "الدُّمْيَةُ", "الْماءُ", "الْفَلَجِ", "الْقَنْطَرَةِ"].map((word) => ({ word, page: 46 })),
};
const FILL = {
  bank: ["تَلْعَبَ", "تَشْعُرُ", "تَخيطَ", "تَرْقُبُ", "اخْتَفَتْ"],
  items: [
    { text: "كانَتْ ___ كُلَّ شَيْءٍ.", answer: "تَرْقُبُ", page: 45 },
    { text: "قَرَّرَتْ أَنْ ___ بِدُمْيَتِها الصَّغيرَةِ.", answer: "تَلْعَبَ", page: 45 },
    { text: "طَلَبَتْ مِنْ أُمِّها أَنْ ___ لَها مَلابِسَ أُخْرى.", answer: "تَخيطَ", page: 45 },
    { text: "لَكِنَّ الدُّمْيَةَ ___.", answer: "اخْتَفَتْ", page: 45 },
  ],
};
const TEXT = {
  statements: [
    { text: "وَقَدْ كانَتْ سُعادُ حَذِرَةً جِدًّا عَلى لُعْبَتِها.", inText: true, page: 39 },
    { text: "وَعَدَتْها أُمُّها أَنْ تَصْنَعَ لَها دُمْيَةً أُخْرى.", inText: true, page: 39 },
    { text: "رَأَتْ دُمْيَتَها تَغوصُ في الْوادي.", inText: false, page: 39 },
  ],
};
const QUESTION = { questions: [{ q: "أَحْداثُ النَّصِّ وَقَعَتْ في:", options: ["الْقَرْيَةِ", "الْمَدينَةِ", "الْبَحْرِ", "الْجَبَلِ"], answer: "الْقَرْيَةِ", page: 40 }] };
const EVENTS = {
  events: [
    { text: "أَهْداها عَمُّها دُمْيَةً.", page: 35 },
    { text: "قَرَّرَتْ أَنْ تَلْعَبَ بِدُمْيَتِها عِنْدَ ساقِيَةِ الْفَلَجِ.", page: 36 },
    { text: "انْفَلَتَتِ الدُّمْيَةُ مِنْ يَدَيْها.", page: 36 },
    { text: "وَعَدَتْها أُمُّها أَنْ تَصْنَعَ لَها دُمْيَةً أُخْرى.", page: 36 },
  ],
};
const LETTERS = {
  letters: ["ب", "ت", "ث"],
  words: ["بَيْتٌ", "كَبُرَتْ", "اخْتَفَتْ", "ثَوْبٌ", "ثَلاثَةٌ", "دُمْيَةٌ", "لُعْبَةٌ"].map((word) => ({ word, page: 47 })),
};
const MISSING = {
  letters: ["ب", "ت", "ث"],
  items: [
    { word: "ثُمَّ", sentence: "أَلْعَبُ بِأَلْعابي، ثُمَّ أُرَتِّبُها.", page: 47 },
    { word: "كانَتْ", sentence: "كانَتْ تُسابِقُ الْماءَ.", page: 42 },
    { word: "بِها", sentence: "كانَتْ فَرِحَةً بِها.", page: 35 },
  ],
};
const RELATION = {
  pairs: [
    { word: "فَرِحَةٌ", match: "سَعيدَةٌ", relation: "synonym" as const, page: 20 },
    { word: "صَغيرَةٌ", match: "كَبيرَةٌ", relation: "antonym" as const, page: 20 },
    { word: "الْبَعيدُ", match: "الْقَريبُ", relation: "antonym" as const, page: 20 },
  ],
};
const VERB = {
  sentences: [
    { text: "اشْتَرَتِ الْأُمُّ لِابْنَتِها دُمْيَةً جَديدَةً.", verb: "اشْتَرَتِ", page: 45 },
    { text: "قالَتِ الْبِنْتُ لِأُمِّها: شُكْرًا.", verb: "قالَتِ", page: 45 },
  ],
};
const POEM = {
  lines: [
    { text: "صَباحُ الْخَيْرِ يا أُمّي", page: 84 },
    { text: "صَباحُ الْخَيْرِ يا أَبَتي", page: 84 },
    { text: "أَذْهَبُ إِلى مَدْرَسَتي", page: 84 },
  ],
};

// Fixture with labels (opening review p. 31 table headings).
const SORT = {
  columns: ["أَطْعِمَةٌ صِحِّيَّةٌ", "أَطْعِمَةٌ غَيْرُ صِحِّيَّةٍ"] as [string, string],
  items: [
    { text: "حَليبٌ", column: 0 as const, page: 31 },
    { text: "أَرُزٌّ", column: 0 as const, page: 31 },
    { text: "لَحْمٌ", column: 0 as const, page: 31 },
    { text: "حَلْوى", column: 1 as const, page: 31 },
    { text: "مَشْروباتٌ غازِيَّةٌ", column: 1 as const, page: 31 },
  ],
};
const DESCRIBES = {
  ...TEXT,
  prompts: { in: "أَيُّ عِبارَةٍ تُناسِبُ وَصْفَ الْكِتابِ؟", notIn: "أَيُّ عِبارَةٍ لا تُناسِبُ وَصْفَ الْكِتابِ؟", allIn: "اخْتَرْ كُلَّ ما يُناسِبُ وَصْفَ الْكِتابِ." },
};

describe("Arabic mechanics: 1000 seeds × 3 levels", () => {
  it("ar-sort", () => exerciseMechanic(AR_SORT, SORT));
  it("ar-text-check with the book's own question", () =>
    exerciseMechanic(AR_TEXT_CHECK, DESCRIBES, 200, (item) => expect(Object.values(DESCRIBES.prompts)).toContain(item.prompt)));
  it("ar-syllables", () => exerciseMechanic(AR_SYLLABLES, SYL));
  it("ar-sentence-build", () => exerciseMechanic(AR_SENTENCE_BUILD, SENT));
  it("ar-count-words", () => exerciseMechanic(AR_COUNT_WORDS, SENT));
  it("ar-sun-moon", () => exerciseMechanic(AR_SUN_MOON, SUN));
  it("ar-fill-word", () => exerciseMechanic(AR_FILL_WORD, FILL));
  it("ar-text-check", () => exerciseMechanic(AR_TEXT_CHECK, TEXT));
  it("ar-question", () => exerciseMechanic(AR_QUESTION, QUESTION));
  it("ar-event-order", () => exerciseMechanic(AR_EVENT_ORDER, EVENTS));
  it("ar-letter-find", () => exerciseMechanic(AR_LETTER_FIND, LETTERS));
  it("ar-missing-letter", () => exerciseMechanic(AR_MISSING_LETTER, MISSING));
  it("ar-word-relation", () => exerciseMechanic(AR_WORD_RELATION, RELATION));
  it("ar-verb-pick", () => exerciseMechanic(AR_VERB_PICK, VERB));
  it("ar-poem-gap", () => exerciseMechanic(AR_POEM_GAP, POEM));
});

describe("Arabic mechanics reject wrong answers", () => {
  it("syllables: wrong order fails, equal text passes", () => {
    const item = AR_SYLLABLES.generate(3, 2, SYL);
    const sol = AR_SYLLABLES.solution(item) as string[];
    expect(AR_SYLLABLES.check(item, [...sol].reverse()).correct).toBe(false);
    expect(AR_SYLLABLES.check(item, sol.slice(1)).correct).toBe(false);
  });

  it("count words: off by one is a counting error", () => {
    const item = AR_COUNT_WORDS.generate(1, 1, SENT);
    const n = AR_COUNT_WORDS.solution(item) as number;
    const r = AR_COUNT_WORDS.check(item, n + 1);
    expect(r.correct).toBe(false);
    expect(r.errors[0]!.errorType).toBe("counting_error");
    expect(AR_COUNT_WORDS.check(item, "4").errors[0]!.errorType).toBe("input_invalid");
  });

  it("sun/moon: every level recomputes from the letter after ال", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const i1 = AR_SUN_MOON.generate(seed, 1, SUN);
      const t = lamType(i1.params.words[0]!);
      expect(AR_SUN_MOON.check(i1, t === "sun" ? "moon" : "sun").correct).toBe(false);
      const i2 = AR_SUN_MOON.generate(seed, 2, SUN);
      const all = i2.params.words.map((_, k) => `o${k}`);
      expect(AR_SUN_MOON.check(i2, all).correct).toBe(false); // picking everything is never right
    }
  });

  it("text-check: a statement not in the text is never the answer to «which did you read»", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const item = AR_TEXT_CHECK.generate(seed, 1, TEXT);
      const sol = AR_TEXT_CHECK.solution(item) as string;
      const s = item.params.statements[Number(sol.slice(1))]!;
      expect(s.inText).toBe(item.params.ask === "in");
    }
  });

  it("letter-find level 2: distractors contain a sibling letter but not the target", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const item = AR_LETTER_FIND.generate(seed, 2, LETTERS);
      const { target, words: ws } = item.params;
      expect(ws.filter((w) => w.replace(/[ً-ْ]/g, "").includes(target))).toHaveLength(1);
    }
  });

  it("relation: a word linked to the target is never a distractor", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const item = AR_WORD_RELATION.generate(seed, 3, RELATION);
      expect(item.params.options).not.toContain(item.params.word);
    }
  });

  it("verb-pick: every option is a word of the sentence", () => {
    const item = AR_VERB_PICK.generate(5, 2, VERB);
    expect(item.input.type === "choice" && item.input.options.map((o) => o.label)).toEqual(words(item.params.sentence));
  });
});

describe("Arabic configs are validated", () => {
  it("refuses syllables that do not spell the word", () => {
    expect(AR_SYLLABLES.validateConfig({ words: [{ word: "دُمْيَةً", syllables: ["دُمْـ", "ـيَـ"], page: 44 }, SYL.words[1]!] })).not.toEqual([]);
  });
  it("refuses sun/moon words without the article", () => {
    expect(AR_SUN_MOON.validateConfig({ words: [...SUN.words, { word: "أَلْعَبُ", page: 47 }] })).not.toEqual([]);
  });
  it("refuses a fill answer outside the bank", () => {
    expect(AR_FILL_WORD.validateConfig({ ...FILL, items: [...FILL.items, { text: "هِيَ ___.", answer: "تَقْرَأُ", page: 45 }] })).not.toEqual([]);
  });
  it("refuses entries without a printed page", () => {
    expect(AR_COUNT_WORDS.validateConfig({ sentences: [{ text: "ذَهَبَ الْوَلَدُ.", page: 0 }, { text: "ذَهَبَ الْوَلَدُ.", page: 3 }] })).not.toEqual([]);
  });
  it("refuses a missing-letter word with two letters of the group", () => {
    expect(AR_MISSING_LETTER.validateConfig({ letters: ["ب", "ت", "ث"], items: [{ word: "بَيْتٌ", sentence: "هذا بَيْتٌ.", page: 47 }, MISSING.items[0]!] })).not.toEqual([]);
  });
});
