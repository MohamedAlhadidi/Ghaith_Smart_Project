import { describe, expect, it } from "vitest";
import { fillWith, hiddenForm, listenTouch, missingGrapheme } from "../../src/english/listenAndSounds";
import { WORDS } from "../../src/english/common";
import { exerciseMechanic } from "../math/harness";

describe("listen-touch", () => {
  it("1000 seeds × 3 levels on unit 1 toys", () =>
    exerciseMechanic(listenTouch, { words: ["car", "plane", "puzzle", "yo-yo", "building set", "doll", "action figure", "robot", "teddy", "dinosaur"] }));
  it("is English and never puts two copies of a word", () => {
    const item = listenTouch.generate(4, 3, { words: ["car", "plane", "puzzle", "robot", "teddy"] });
    expect(item.lang).toBe("en");
    expect(new Set(item.params.options).size).toBe(item.params.options.length);
  });
  it("rejects a config word without a picture", () => {
    expect(listenTouch.validateConfig({ words: ["car", "plane", "puzzle", "swing"] }).length).toBeGreaterThan(0);
  });
});

describe("missing-grapheme", () => {
  it("1000 seeds × 3 levels for ai with unit 1 distractors", () =>
    exerciseMechanic(missingGrapheme, { sound: "ai", words: ["rain", "nail", "train", "chain", "tail", "paint"], distractors: ["oa", "ie", "a_e"] }));
  it("1000 seeds × 3 levels for split digraph a_e", () =>
    exerciseMechanic(missingGrapheme, { sound: "a_e", words: ["lake", "rake", "flame", "game", "snake", "cake"], distractors: ["ai", "oa", "ie"] }));
  it("hidden forms match the book's write-in tasks", () => {
    expect(hiddenForm(WORDS.rain!.graphemes!, "ai")).toBe("r__n");
    expect(hiddenForm(WORDS.cake!.graphemes!, "a_e")).toBe("c_k_");
    expect(fillWith(WORDS.cake!.graphemes!, "a_e", "a_e")).toBe("cake");
    expect(fillWith(WORDS.rain!.graphemes!, "ai", "oa")).toBe("roan");
  });
  it("every grapheme split in the word bank spells its word", () => {
    for (const [word, e] of Object.entries(WORDS)) if (e.graphemes) expect(e.graphemes.join(""), word).toBe(word);
  });
});
