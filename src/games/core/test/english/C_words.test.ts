import { describe, expect, it } from "vitest";
import catalog from "../../../../../content/curriculum/english/s1/lessons.json";
import { COLOURS, colourDistance, confusable, pictureOf } from "../../src/english/C_common";
import { MIN_COLOUR_DISTANCE, blendBuild, colourWord, hasSound, matchPairs, numberWordMech, pictureWord, readTouch, soundSort, wordUnscramble } from "../../src/english/C_words";
import { exerciseMechanic } from "../math/harness";

const U3_SKILLS = ["face", "arms", "hands", "fingers", "legs", "feet", "touch", "clap"];

describe("read-touch / picture-word", () => {
  it("never offers two options with the same or confusable picture (🖐️ fingers / touch, 🙌 hands / 👏 clap)", () => {
    for (const mech of [readTouch, pictureWord])
      for (const d of [1, 2, 3] as const)
        for (let seed = 1; seed <= 400; seed++) {
          const opts = mech.generate(seed, d, { words: U3_SKILLS }).params.options;
          for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) expect(confusable(opts[i]!, opts[j]!), `${opts}`).toBe(false);
        }
  });
  it("level 1 lets the child listen, level 3 is reading only with 5 pictures", () => {
    const words = ["car", "plane", "puzzle", "yo-yo", "doll", "robot"];
    expect(readTouch.generate(3, 1, { words }).visual.speak).toBe(true);
    const hard = readTouch.generate(3, 3, { words });
    expect(hard.visual.speak).toBe(false);
    expect(hard.params.options.length).toBe(5);
  });
  it("rejects a config word without a picture", () => {
    expect(readTouch.validateConfig({ words: ["car", "plane", "swing"] }).length).toBeGreaterThan(0);
  });
});

describe("match-pairs", () => {
  const cfg = { words: ["car", "plane", "puzzle", "yo-yo", "doll", "robot"] };
  it("accepts the pairs in any order and rejects a swapped pair or a partial answer", () => {
    const item = matchPairs.generate(11, 2, cfg);
    const sol = matchPairs.solution(item) as Array<[number, number]>;
    expect(matchPairs.check(item, [...sol].reverse()).correct).toBe(true);
    const swapped = sol.map(([i, j], k) => [i, sol[(k + 1) % sol.length]![1]] as [number, number]);
    expect(matchPairs.check(item, swapped).correct).toBe(false);
    expect(matchPairs.check(item, sol.slice(1)).errors[0]!.errorType).toBe("partial_answer");
    expect(matchPairs.check(item, [sol[0], sol[0]]).errors[0]!.errorType).toBe("input_invalid");
    expect(matchPairs.check(item, [[0, 99]]).errors[0]!.errorType).toBe("input_invalid");
  });
  it("uses 3 / 4 / 5 pairs and never lines the pictures up with the words", () => {
    for (const d of [1, 2, 3] as const) {
      const item = matchPairs.generate(5, d, cfg);
      expect(item.params.words.length).toBe(d + 2);
      for (let seed = 1; seed <= 200; seed++) expect(matchPairs.generate(seed, d, cfg).params.pics.some((v, i) => v !== i)).toBe(true);
    }
  });
});

describe("word-unscramble", () => {
  it("validates the spelled string, so equal letters may be used in any order (scissors has four s)", () => {
    const item = wordUnscramble.generate(1, 3, { words: ["scissors"] });
    const sIds = item.params.tiles.map((t, i) => (t === "s" ? `t${i}` : null)).filter((x): x is string => x !== null);
    expect(sIds.length).toBe(4);
    const sol = wordUnscramble.solution(item) as string[];
    // Swap the ids of two "s" tiles: still spells "scissors".
    const swapped = sol.map((id) => (id === sIds[0] ? sIds[1]! : id === sIds[1] ? sIds[0]! : id));
    expect(swapped).not.toEqual(sol);
    expect(wordUnscramble.check(item, swapped).correct).toBe(true);
    expect(wordUnscramble.check(item, sol.slice(1)).correct).toBe(false);
  });
  it("is never dealt already spelling the word, even for 2-letter 'me'", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const item = wordUnscramble.generate(seed, 1, { words: ["me", "mum", "dad"] });
      expect(item.params.tiles.join("")).not.toBe(item.params.word);
    }
  });
  it("gives a cue that names the word without spelling it: digit, colour swatch, picture or Arabic", () => {
    expect(wordUnscramble.generate(2, 1, { words: ["six", "ten"] }).visual.digit).toMatch(/^(6|10)$/);
    expect(wordUnscramble.generate(2, 1, { words: ["red", "pink"] }).visual.colour).toMatch(/^#/);
    expect(wordUnscramble.generate(2, 1, { words: ["shelf", "desk"] }).visual.picture).toMatch(/^draw:/);
  });
  it("no two words of any catalogue spelling game are anagrams of each other", () => {
    const configs = catalog.lessons.flatMap((l) => l.games.filter((g) => g.mechanic === "word-unscramble").map((g) => (g.config as { words: string[] }).words));
    for (const words of configs) {
      const keys = words.map((w) => [...w].sort().join(""));
      expect(new Set(keys).size, words.join(",")).toBe(words.length);
    }
  });
  it("rejects words that cannot be scrambled", () => {
    expect(wordUnscramble.validateConfig({ words: ["building set", "car"] }).length).toBeGreaterThan(0);
  });
});

describe("blend-build", () => {
  const ai = { words: ["rain", "nail", "train", "chain", "tail", "paint"] };
  it("level 1 uses 2-3 grapheme words, level 3 hides the picture", () => {
    for (let seed = 1; seed <= 100; seed++) expect(blendBuild.generate(seed, 1, { words: ["lie", "tissue", "glue", "clue"] }).params.graphemes.length).toBeLessThanOrEqual(3);
    expect(blendBuild.generate(4, 3, ai).visual.picture).toBeNull();
    const easy = blendBuild.generate(4, 1, ai);
    expect(easy.visual.picture).toBe(pictureOf(easy.params.word));
  });
  it("accepts equal graphemes in either order (n-i-n-e)", () => {
    const item = blendBuild.generate(3, 2, { words: ["nine"] });
    const sol = blendBuild.solution(item) as string[];
    const nIds = item.params.tiles.map((t, i) => (t === "n" ? `t${i}` : null)).filter((x): x is string => x !== null);
    const swapped = sol.map((id) => (id === nIds[0] ? nIds[1]! : id === nIds[1] ? nIds[0]! : id));
    expect(blendBuild.check(item, swapped).correct).toBe(true);
  });
  it("1000 seeds × 3 levels on the book's er blend words", () => exerciseMechanic(blendBuild, { words: ["herb", "fern", "herd"] }));
});

describe("sound-sort", () => {
  const ng = (catalog.lessons.find((l) => l.lesson_id === "ENG-S1-SS2-NG")!.games.find((g) => g.mechanic === "sound-sort")!.config) as { sound: string; groups: Record<string, string[]> };
  const ae = (catalog.lessons.find((l) => l.lesson_id === "ENG-S1-SS1-AE")!.games.find((g) => g.mechanic === "sound-sort")!.config) as { sound: string; groups: Record<string, string[]> };
  it("never shows the oo (book) and oo (moon) groups together", () => {
    for (const d of [1, 2, 3] as const)
      for (let seed = 1; seed <= 500; seed++) {
        const groups = new Set(soundSort.generate(seed, d, ng).params.words.map((w) => w.group));
        expect(groups.has("oo_short") && groups.has("oo_long")).toBe(false);
      }
  });
  it("never uses ai words as distractors for a-e (same sound, other spelling)", () => {
    for (let seed = 1; seed <= 500; seed++) expect(soundSort.generate(seed, 2, ae).params.words.some((w) => w.group === "ai")).toBe(false);
  });
  it("marks a wrong pick and a partial answer differently", () => {
    const item = soundSort.generate(9, 2, ng);
    const sol = soundSort.solution(item) as string[];
    const wrongId = item.params.words.findIndex((w) => w.group !== "ng");
    expect(soundSort.check(item, [...sol, `o${wrongId}`]).errors[0]!.errorType).toBe("property_error");
    if (sol.length > 1) expect(soundSort.check(item, sol.slice(1)).errors[0]!.errorType).toBe("partial_answer");
  });
  it("rule check from graphemes: split digraphs and oo", () => {
    expect(hasSound("cake", "a_e")).toBe(true);
    expect(hasSound("tissue", "i_e")).toBe(false);
    expect(hasSound("perfume", "o_e")).toBe(false);
    expect(hasSound("moon", "oo_short")).toBe(true); // same letters: only the book group tells the sounds apart
  });
});

describe("number-word", () => {
  it("level 3 of digit-word reads a word and chooses the digit; counting uses neighbours", () => {
    const item = numberWordMech.generate(5, 3, { max: 10, mode: "digit-word" });
    expect(item.params.mode).toBe("word-digit");
    expect(item.input.type === "choice" && item.input.options.every((o) => /^\d+$/.test(o.label))).toBe(true);
    const count = numberWordMech.generate(5, 3, { max: 10, mode: "count" });
    expect(count.params.n).toBeGreaterThanOrEqual(6);
    for (const v of count.params.options) expect(Math.abs(v - count.params.n)).toBeLessThanOrEqual(3);
  });
  it("an answer one away is a counting error", () => {
    const item = numberWordMech.generate(5, 3, { max: 10, mode: "count" });
    const off = item.params.options.findIndex((v) => Math.abs(v - item.params.n) === 1);
    expect(numberWordMech.check(item, `o${off}`).errors[0]!.errorType).toBe("counting_error");
  });
});

describe("colour-word", () => {
  it("every pair of book colours is far apart; white has an outline", () => {
    const names = Object.keys(COLOURS);
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) expect(colourDistance(COLOURS[names[i]!]!.hex, COLOURS[names[j]!]!.hex), `${names[i]}/${names[j]}`).toBeGreaterThanOrEqual(MIN_COLOUR_DISTANCE);
    expect(COLOURS.white!.outline).toBe(true);
  });
  it("rejects a colour that is not in the book", () => {
    expect(colourWord.validateConfig({ colours: ["red", "blue", "grey"] }).length).toBeGreaterThan(0);
  });
});
