import { describe, expect, it } from "vitest";
import {
  GOT_COUNT,
  PLACE_PREPS,
  articleFor,
  faceFor,
  featureTrue,
  grammarAAn,
  grammarGotCount,
  grammarHeShe,
  grammarPrep,
  grammarThere,
  grammarThisThese,
  grammarWhosThis,
  grammarYesNo,
  monsterCounts,
  prepPlausible,
  thereLabel,
} from "../../src/english/C_grammar";

const labels = (item: { input: { type: string; options?: Array<{ label: string }> } }) => (item.input.options ?? []).map((o) => o.label);
const correctLabel = (mech: { solution(i: never): unknown }, item: { input: { type: string; options?: Array<{ id: string; label: string }> } }) =>
  item.input.options!.find((o) => o.id === mech.solution(item as never))!.label;

describe("grammar-a-an", () => {
  const nouns = ["car", "plane", "puzzle", "yo-yo", "doll", "action figure", "robot", "teddy", "dinosaur", "building set"];
  it("an only before a vowel letter (book: an action figure)", () => {
    expect(articleFor("action figure")).toBe("an");
    expect(articleFor("yo-yo")).toBe("a");
  });
  it("both answers come up, and level 3 asks for the whole sentence about the picture", () => {
    const answers = new Set(Array.from({ length: 100 }, (_, s) => correctLabel(grammarAAn, grammarAAn.generate(s + 1, 1, { nouns }))));
    expect(answers).toEqual(new Set(["a", "an"]));
    const hard = grammarAAn.generate(7, 3, { nouns });
    expect(labels(hard).every((l) => /^It's an? .+\.$/.test(l))).toBe(true);
    expect(correctLabel(grammarAAn, hard)).toBe(`It's ${articleFor(hard.params.noun)} ${hard.params.noun}.`);
  });
});

describe("grammar-yes-no", () => {
  const nouns = ["kite", "bike", "slide", "scooter", "ball", "car", "plane", "robot", "teddy", "dinosaur"];
  it("Yes exactly when the picture is the asked toy; level 3 'No' must name the toy in the picture", () => {
    for (const d of [1, 2, 3] as const)
      for (let seed = 1; seed <= 200; seed++) {
        const item = grammarYesNo.generate(seed, d, { nouns });
        const right = correctLabel(grammarYesNo, item);
        if (item.params.shown === item.params.asked) expect(right).toBe("Yes, it is.");
        else expect(right).toBe(d === 3 ? `No, it isn't. It's ${articleFor(item.params.shown)} ${item.params.shown}.` : "No, it isn't.");
      }
  });
});

describe("grammar-this-these", () => {
  const nouns = ["bag", "book", "pen", "pencil", "crayon", "ruler", "eraser"];
  it("one → This is my pen. several → These are my pens. (level 3 adds agreement mistakes)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const item = grammarThisThese.generate(seed, 3, { nouns });
      const { noun, count } = item.params;
      expect(correctLabel(grammarThisThese, item)).toBe(count === 1 ? `This is my ${noun}.` : `These are my ${noun}s.`);
      expect(labels(item).length).toBe(4);
    }
  });
});

describe("grammar-prep", () => {
  const cfg = { objects: ["pencil", "book", "ruler", "pen", "bag", "crayon"], places: ["desk", "table", "chair", "cupboard", "shelf"] };
  it("'in' only where things can go inside; a school bag never inside a desk", () => {
    expect(PLACE_PREPS.table).not.toContain("in");
    expect(PLACE_PREPS.shelf).toEqual(["on"]);
    expect(prepPlausible("bag", "desk", "in")).toBe(false);
    for (const d of [1, 2, 3] as const)
      for (let seed = 1; seed <= 300; seed++) {
        const { object, place, prep } = grammarPrep.generate(seed, d, cfg).params;
        expect(prepPlausible(object, place, prep)).toBe(true);
      }
  });
  it("level 3's wrong-place option never uses a look-alike place (desk / table)", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const item = grammarPrep.generate(seed, 3, cfg);
      for (const o of item.params.options) if (o.place !== item.params.place) expect([o.place, item.params.place].sort().join()).not.toBe("desk,table");
    }
  });
});

describe("grammar-got-count", () => {
  it("uses the chant's facts: one head, two arms, ten toes", () => {
    expect(GOT_COUNT).toMatchObject({ head: 1, face: 1, tummy: 1, arms: 2, knees: 2, feet: 2, fingers: 10, toes: 10 });
    const item = grammarGotCount.generate(3, 2, { parts: ["toes"] });
    expect(correctLabel(grammarGotCount, item)).toBe("ten");
    expect(grammarGotCount.validateConfig({ parts: ["nose"] }).length).toBeGreaterThan(0);
  });
});

describe("grammar-whos-this", () => {
  it("never asks or offers 'me' ('It's my me.' is not English)", () => {
    const people = ["grandma", "grandad", "mum", "dad", "brother", "sister", "me"];
    for (const d of [1, 2, 3] as const) for (let seed = 1; seed <= 200; seed++) expect(grammarWhosThis.generate(seed, d, { people }).params.options).not.toContain("me");
  });
});

describe("grammar-he-she", () => {
  const cfg = {
    people: ["grandma", "grandad", "mum", "dad", "brother", "sister", "uncle", "aunt"],
    features: ["blue eyes", "brown hair", "green eyes", "black hair", "red hair", "big ears", "a big mouth", "a small nose"],
  };
  it("He for grandad, dad, brother, uncle; She for grandma, mum, sister, aunt", () => {
    for (const [p, he] of [["uncle", "He"], ["aunt", "She"], ["grandad", "He"], ["sister", "She"]] as const) {
      const item = grammarHeShe.generate(1, 2, { people: [p], features: ["blue eyes"] });
      expect(correctLabel(grammarHeShe, item)).toBe(`${he}'s got blue eyes.`);
    }
  });
  it("the drawn face shows the feature; level 3's extra feature is false for that face", () => {
    expect(featureTrue(faceFor("mum", "red hair"), "red hair")).toBe(true);
    expect(featureTrue(faceFor("mum", "red hair"), "black hair")).toBe(false);
    for (let seed = 1; seed <= 300; seed++) {
      const item = grammarHeShe.generate(seed, 3, cfg);
      for (const o of item.params.options) if (o.feature !== item.params.feature) expect(featureTrue(item.params.face, o.feature)).toBe(false);
    }
  });
});

describe("grammar-there", () => {
  it("There is one … / There are k …s; exactly one true sentence (book: There are four arms.)", () => {
    expect(thereLabel("arm", { are: true, n: 4, pluralNoun: true })).toBe("There are four arms.");
    expect(thereLabel("eye", { are: false, n: 1, pluralNoun: false })).toBe("There is one eye.");
    for (const d of [1, 2, 3] as const)
      for (let seed = 1; seed <= 200; seed++) {
        const item = grammarThere.generate(seed, d, { parts: ["head", "leg", "arm", "hand", "eye"] });
        const { part, k } = item.params;
        expect(correctLabel(grammarThere, item)).toBe(thereLabel(part, { are: k !== 1, n: k, pluralNoun: k !== 1 }));
        expect(labels(item).length).toBe(d + 1);
      }
  });
  it("the monster drawing has k of the asked part (hands sit on the arms)", () => {
    expect(monsterCounts("hand", 3)).toEqual({ head: 1, eye: 2, arm: 3, leg: 2 });
    expect(monsterCounts("eye", 1).eye).toBe(1);
  });
});
