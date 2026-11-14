import { describe, expect, it } from "vitest";
import { compareSign, digitSentence, orderValues, placeValueBuild, relationOf, tensCount } from "../../src/math/A_placeValue";
import type { Difficulty } from "../../src/types";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const LEVELS = [1, 2, 3] as Difficulty[];
const PV = { tensCards: [10, 20, 30, 40, 50, 60, 70, 80, 90], onesCards: [1, 2, 3, 4, 5, 6, 7, 8, 9] };

describe("place-value-build", () => {
  it("37 = 30 + 7; the swapped cards 70 and 3 are a tens/ones confusion", () => {
    const item = placeValueBuild.generate(1, 3, PV);
    item.params = {
      target: 37,
      cards: [
        { id: "t30", value: 30, kind: "tens" },
        { id: "t70", value: 70, kind: "tens" },
        { id: "o7", value: 7, kind: "ones" },
        { id: "o3", value: 3, kind: "ones" },
      ],
    };
    expect(placeValueBuild.check(item, ["o7", "t30"]).correct).toBe(true);
    expect(placeValueBuild.check(item, ["t70", "o3"]).errors[0]!.errorType).toBe("tens_ones_confusion");
    expect(placeValueBuild.check(item, ["t30", "t70"]).errors[0]!.errorType).toBe("place_value_error");
    expect(placeValueBuild.check(item, ["t30"]).errors[0]!.errorType).toBe("input_invalid");
  });
  it("level 3 always offers the swapped-digit cards; every item asks for exactly 2", () => {
    for (const seed of range(300)) {
      const item = placeValueBuild.generate(seed, 3, PV);
      const t = Math.floor(item.params.target / 10);
      const o = item.params.target % 10;
      const ids = item.params.cards.map((c) => c.id);
      expect(ids).toContain(`t${o * 10}`);
      expect(ids).toContain(`o${t}`);
      for (const d of LEVELS) {
        const it2 = placeValueBuild.generate(seed, d, PV);
        expect(it2.input.type === "multi" && it2.input.exactly).toBe(2);
      }
    }
  });
});

describe("tens-count", () => {
  it("37 has 3 tens; answering the ones digit is a tens/ones confusion; 100 has 10 tens", () => {
    const item = tensCount.generate(1, 2, { max: 100 });
    item.params = { n: 37 };
    expect(tensCount.check(item, 3).correct).toBe(true);
    expect(tensCount.check(item, 7).errors[0]!.errorType).toBe("tens_ones_confusion");
    expect(tensCount.check(item, 30).errors[0]!.errorType).toBe("place_value_error");
    item.params = { n: 100 };
    expect(tensCount.solution(item)).toBe(10);
  });
  it("only level 3 includes 100; level 1 draws the blocks", () => {
    expect(range(300).some((s) => tensCount.generate(s, 3, { max: 100 }).params.n === 100)).toBe(true);
    for (const seed of range(300)) {
      expect(tensCount.generate(seed, 2, { max: 100 }).params.n).toBeLessThan(100);
      expect(tensCount.generate(seed, 1, { max: 100 }).visual.type).toBe("baseTenBlocks");
    }
  });
});

describe("order-values", () => {
  const cfgs = [
    { count: 4, min: 3, max: 30, direction: "asc" as const },
    { count: 4, min: 10, max: 60, direction: "desc" as const },
    { count: 5, min: 2, max: 107, direction: "asc" as const },
    { count: 4, min: 10, max: 99, direction: "asc" as const },
  ];
  it("reversed order is a comparison direction error", () => {
    for (const cfg of cfgs) {
      const item = orderValues.generate(2, 2, cfg);
      const sol = orderValues.solution(item) as string[];
      expect(orderValues.check(item, [...sol].reverse()).errors[0]!.errorType).toBe("comparison_direction");
      expect(orderValues.check(item, sol.slice(1)).errors[0]!.errorType).toBe("input_invalid");
    }
  });
  it("level 1 values have different tens; levels 2-3 share a tens digit; never shown already sorted", () => {
    for (const cfg of cfgs)
      for (const seed of range(200)) {
        const l1 = orderValues.generate(seed, 1, cfg).params.values;
        expect(new Set(l1.map((v) => Math.floor(v / 10))).size).toBe(l1.length);
        for (const d of [2, 3] as Difficulty[]) {
          const v = orderValues.generate(seed, d, cfg).params.values;
          expect(new Set(v.map((x) => Math.floor(x / 10))).size).toBeLessThan(v.length);
        }
        for (const d of LEVELS) {
          const item = orderValues.generate(seed, d, cfg);
          expect(orderValues.solution(item)).not.toEqual(item.params.values.map((_, i) => `v${i}`));
        }
      }
  });
});

describe("compare-sign", () => {
  it("book p.32: 23 < 45 is lt; choosing > is a direction error", () => {
    const item = compareSign.generate(1, 1, { min: 10, max: 99 });
    item.params = { a: 23, b: 45 };
    expect(compareSign.check(item, "lt").correct).toBe(true);
    expect(compareSign.check(item, "gt").errors[0]!.errorType).toBe("comparison_direction");
    expect(compareSign.check(item, "<").errors[0]!.errorType).toBe("input_invalid");
  });
  it("level 3 includes equal pairs; levels 1-2 never do; level 2 compares within a decade or swapped digits", () => {
    let equal = 0;
    for (const seed of range(400)) {
      const l3 = compareSign.generate(seed, 3, { min: 10, max: 99 }).params;
      if (l3.a === l3.b) equal++;
      for (const d of [1, 2] as Difficulty[]) {
        const p = compareSign.generate(seed, d, { min: 10, max: 99 }).params;
        expect(relationOf(p.a, p.b)).not.toBe("eq");
      }
      const l2 = compareSign.generate(seed, 2, { min: 10, max: 99 }).params;
      const swap = (l2.a % 10) * 10 + Math.floor(l2.a / 10);
      expect(Math.floor(l2.a / 10) === Math.floor(l2.b / 10) || l2.b === swap).toBe(true);
    }
    expect(equal).toBeGreaterThan(50);
  });
});

describe("digit-sentence", () => {
  it("accepts any true arrangement (property check), not one stored answer", () => {
    const item = digitSentence.generate(1, 1, { digits: 4 });
    item.params = {
      sign: "<",
      cards: [
        { id: "d0", digit: 7 },
        { id: "d1", digit: 2 },
        { id: "d2", digit: 4 },
        { id: "d3", digit: 9 },
      ],
    };
    expect(digitSentence.check(item, ["d1", "d2", "d0", "d3"]).correct).toBe(true); // 24 < 79
    expect(digitSentence.check(item, ["d2", "d0", "d3", "d1"]).correct).toBe(true); // 47 < 92
    expect(digitSentence.check(item, ["d3", "d1", "d0", "d2"]).errors[0]!.errorType).toBe("comparison_direction"); // 92 < 74 false
    expect(digitSentence.check(item, ["d1", "d1", "d0", "d3"]).errors[0]!.errorType).toBe("input_invalid");
  });
  it("a 0 card cannot be a tens digit", () => {
    const item = digitSentence.generate(1, 3, { digits: 4 });
    item.params = {
      sign: ">",
      cards: [
        { id: "d0", digit: 0 },
        { id: "d1", digit: 5 },
        { id: "d2", digit: 3 },
        { id: "d3", digit: 1 },
      ],
    };
    expect(digitSentence.check(item, ["d0", "d1", "d2", "d3"]).errors[0]!.errorType).toBe("place_value_error");
    expect(digitSentence.check(item, ["d1", "d0", "d2", "d3"]).correct).toBe(true); // 50 > 31
  });
  it("every generated item is solvable and the dealt order is not already a solution", () => {
    for (const d of LEVELS)
      for (const seed of range(300)) {
        const item = digitSentence.generate(seed, d, { digits: 4 });
        expect(digitSentence.check(item, item.params.cards.map((c) => c.id)).correct).toBe(false);
        expect(digitSentence.check(item, digitSentence.solution(item)).correct).toBe(true);
        if (d === 1) expect(new Set(item.params.cards.map((c) => c.digit)).size).toBe(4);
      }
  });
});
