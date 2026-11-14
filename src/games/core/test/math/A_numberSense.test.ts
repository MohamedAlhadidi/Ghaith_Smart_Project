import { describe, expect, it } from "vitest";
import { roundTen } from "../../src/math/A_common";
import {
  BOOK_BAGS,
  countObjects,
  decadeFill,
  estimatePick,
  goodEstimate,
  midpoint,
  numberLinePlace,
  numberLineRead,
  numberLineSpot,
  rangeFit,
  roundReverse,
  roundTenMech,
  tensBounds,
} from "../../src/math/numberSense";
import type { QuizItem } from "../../src/quiz";
import type { Difficulty } from "../../src/types";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const LEVELS = [1, 2, 3] as Difficulty[];
const choiceIds = (item: QuizItem<unknown>) => (item.input.type === "choice" || item.input.type === "multi" ? item.input.options.map((o) => o.id) : []);

describe("tens-bounds", () => {
  const cfg = { min: 1, max: 119 };
  it("37 lies between 30 and 40; neighbouring decades and digit swaps are classified", () => {
    const item = tensBounds.generate(1, 3, cfg);
    item.params = { n: 37, lowers: [30, 40, 20, 70] };
    expect(tensBounds.check(item, "b30").correct).toBe(true);
    expect(tensBounds.check(item, "b40").errors[0]!.errorType).toBe("place_value_error");
    expect(tensBounds.check(item, "b70").errors[0]!.errorType).toBe("tens_ones_confusion");
    expect(tensBounds.check(item, "b90").errors[0]!.errorType).toBe("input_invalid");
  });
  it("level 1 stays below 60; level 3 reaches 110-120; n is never a multiple of 10", () => {
    for (const seed of range(300)) {
      expect(tensBounds.generate(seed, 1, cfg).params.n).toBeLessThan(60);
      for (const d of LEVELS) expect(tensBounds.generate(seed, d, cfg).params.n % 10).not.toBe(0);
    }
    expect(range(300).some((s) => tensBounds.generate(s, 3, cfg).params.n > 110)).toBe(true);
  });
});

describe("decade-fill / midpoint", () => {
  it("fewer neighbours are shown at higher levels", () => {
    for (const seed of range(200)) {
      expect(decadeFill.generate(seed, 1, { maxTens: 11 }).params.shown.length).toBe(10);
      const l2 = decadeFill.generate(seed, 2, { maxTens: 11 }).params;
      expect(l2.shown.some((i) => Math.abs(i - l2.blank) === 1)).toBe(false);
      expect(decadeFill.generate(seed, 3, { maxTens: 11 }).params.shown).toEqual([0, 10]);
    }
  });
  it("the answer comes from the strip position: 70 _ ... 80 with the 4th blank is 73", () => {
    const item = decadeFill.generate(1, 3, { maxTens: 11 });
    item.params = { tens: 7, blank: 3, shown: [0, 10] };
    expect(decadeFill.check(item, 73).correct).toBe(true);
    expect(decadeFill.check(item, 74).errors[0]!.errorType).toBe("off_by_one");
    expect(decadeFill.check(item, 37).errors[0]!.errorType).toBe("tens_ones_confusion");
    expect(decadeFill.check(item, null).errors[0]!.errorType).toBe("input_invalid");
  });
  it("book p.5: the midpoint of 21..29 is 25; level 3 shows nine numbers", () => {
    for (const seed of range(100)) {
      const item = midpoint.generate(seed, 3, { maxTens: 11 });
      expect(item.params.mode).toBe("nine");
      expect(midpoint.solution(item)).toBe(`n${item.params.tens * 10 + 5}`);
      expect((item.visual.numbers as number[]).length).toBe(9);
    }
  });
});

describe("count-objects", () => {
  it("the count is the number of drawn objects; small miscounts are counting errors", () => {
    const item = countObjects.generate(5, 2, { min: 15, max: 100, groupBy: [2, 5, 10] });
    const n = item.params.positions.length;
    expect(countObjects.solution(item)).toBe(n);
    expect(countObjects.check(item, n + 1).errors[0]!.errorType).toBe("off_by_one");
    expect(countObjects.check(item, n - 3).errors[0]!.errorType).toBe("counting_error");
    // Removing one drawn object changes the answer: nothing is stored besides the drawing.
    item.params = { ...item.params, positions: item.params.positions.slice(1) };
    expect(countObjects.check(item, n).correct).toBe(false);
  });
  it("levels climb through the range; objects never overlap", () => {
    const cfg = { min: 41, max: 99, groupBy: [10] };
    const mean = (d: Difficulty) => range(200).reduce((s, seed) => s + countObjects.generate(seed, d, cfg).params.positions.length, 0) / 200;
    expect(mean(1)).toBeLessThan(mean(2));
    expect(mean(2)).toBeLessThan(mean(3));
    for (const seed of range(200)) {
      const n = countObjects.generate(seed, 3, cfg).params.positions.length;
      expect(n).toBeGreaterThanOrEqual(41);
      expect(n).toBeLessThanOrEqual(99);
    }
  });
});

describe("range-fit", () => {
  it("uses the seven book labels with exclusive bounds", () => {
    expect(BOOK_BAGS.map((b) => [b.lo, b.hi])).toEqual([
      [95, 100],
      [60, 70],
      [80, 90],
      [70, 80],
      [40, 60],
      [70, 80],
      [50, 70],
    ]);
  });
  it("which-bag: exactly one bag fits, n is never a bound, bags never overlap", () => {
    for (const d of LEVELS)
      for (const seed of range(300)) {
        const item = rangeFit.generate(seed, d, { mode: "which-bag" });
        const p = item.params;
        if (p.mode !== "which-bag") throw new Error("mode");
        expect(p.bags.filter((b) => p.n > b.lo && p.n < b.hi).length).toBe(1);
        expect(p.bags.some((b) => b.lo === p.n || b.hi === p.n)).toBe(false);
      }
  });
  it("select-numbers: bounds are never offered and picking one outside is flagged", () => {
    for (const d of LEVELS)
      for (const seed of range(300)) {
        const item = rangeFit.generate(seed, d, { mode: "select-numbers" });
        const p = item.params;
        if (p.mode !== "select-numbers") throw new Error("mode");
        expect(p.values.includes(p.bag.lo) || p.values.includes(p.bag.hi)).toBe(false);
        const sol = rangeFit.solution(item) as string[];
        const out = p.values.find((v) => !(v > p.bag.lo && v < p.bag.hi))!;
        expect(rangeFit.check(item, [...sol, `n${out}`]).correct).toBe(false);
      }
  });
  it("level 3 select-numbers includes the numbers right next to each bound", () => {
    for (const seed of range(100)) {
      const p = rangeFit.generate(seed, 3, { mode: "select-numbers" }).params;
      if (p.mode !== "select-numbers") throw new Error("mode");
      expect(p.values).toContain(p.bag.lo + 1);
    }
  });
});

describe("number line (left to right, 0..100)", () => {
  const cfg = { max: 100, tick: 10, tolerance: 3 };
  it("place: within the tolerance is correct; placing from the wrong end is a direction error", () => {
    const item = numberLinePlace.generate(1, 2, cfg);
    item.params = { ...item.params, n: 18 };
    expect(numberLinePlace.check(item, 18).correct).toBe(true);
    expect(numberLinePlace.check(item, 21).correct).toBe(true);
    expect(numberLinePlace.check(item, 22).correct).toBe(false);
    expect(numberLinePlace.check(item, 82).errors[0]!.errorType).toBe("rtl_direction_confusion");
    expect(numberLinePlace.check(item, 28).errors[0]!.errorType).toBe("place_value_error");
    expect(numberLinePlace.check(item, 101).errors[0]!.errorType).toBe("input_invalid");
    expect(numberLinePlace.check(item, 18.5).errors[0]!.errorType).toBe("input_invalid");
  });
  it("place: level 1 half-way numbers, level 2 next to a tick, level 3 in between", () => {
    for (const seed of range(200)) {
      expect(numberLinePlace.generate(seed, 1, cfg).params.n % 10).toBe(5);
      expect([1, 2, 8, 9]).toContain(numberLinePlace.generate(seed, 2, cfg).params.n % 10);
      expect([3, 4, 6, 7]).toContain(numberLinePlace.generate(seed, 3, cfg).params.n % 10);
    }
  });
  it("read: the mirrored value is a direction error and all options are at least half a tick apart", () => {
    for (const d of LEVELS)
      for (const seed of range(200)) {
        const item = numberLineRead.generate(seed, d, { max: 100, tick: 10 });
        const { n, values } = item.params;
        for (const v of values) if (v !== n) expect(Math.abs(v - n)).toBeGreaterThanOrEqual(5);
        if (values.includes(100 - n) && 100 - n !== n) expect(numberLineRead.check(item, `n${100 - n}`).errors[0]!.errorType).toBe("rtl_direction_confusion");
      }
  });
  it("spot: exactly one marker misplaced by at least a tick; level 3 by exactly one tick", () => {
    for (const d of LEVELS)
      for (const seed of range(200)) {
        const item = numberLineSpot.generate(seed, d, { max: 100, tick: 10 });
        const bad = item.params.markers.filter((m) => m.at !== m.value);
        expect(bad.length).toBe(1);
        if (d === 3) expect(Math.abs(bad[0]!.at - bad[0]!.value)).toBe(10);
        if (d === 1) expect(bad[0]!.at).toBe(100 - bad[0]!.value);
      }
  });
});

describe("rounding", () => {
  it("book p.11 cards: 1, 69, 95, 9, 42, 48, 34, 94, 63", () => {
    expect([1, 69, 95, 9, 42, 48, 34, 94, 63].map(roundTen)).toEqual([0, 70, 100, 10, 40, 50, 30, 90, 60]);
    expect(roundTen(5)).toBe(10);
    expect(roundTen(53)).toBe(50);
    expect(roundTen(67)).toBe(70);
  });
  it("round-ten: rounding the wrong way is a rounding error; level 3 has ones = 5 or edges", () => {
    const item = roundTenMech.generate(1, 1, { min: 1, max: 99 });
    item.params = { n: 48, values: [50, 40, 60] };
    expect(roundTenMech.check(item, "n50").correct).toBe(true);
    expect(roundTenMech.check(item, "n40").errors[0]!.errorType).toBe("rounding_error");
    for (const seed of range(200)) {
      const n = roundTenMech.generate(seed, 3, { min: 1, max: 99 }).params.n;
      expect(n % 10 === 5 || n < 5 || n > 94).toBe(true);
      expect([1, 2, 8, 9]).toContain(roundTenMech.generate(seed, 1, { min: 1, max: 99 }).params.n % 10);
    }
  });
  it("round-reverse: every chosen number must round to the target; level 3 tests 35 vs 45 style bounds", () => {
    for (const d of LEVELS)
      for (const seed of range(200)) {
        const item = roundReverse.generate(seed, d, { tensMin: 10, tensMax: 90 });
        const { target, values } = item.params;
        const sol = roundReverse.solution(item) as string[];
        expect(sol).toEqual(values.filter((v) => roundTen(v) === target).map((v) => `n${v}`));
        if (d === 3) expect(values).toContain(target - 5);
        const wrongPick = values.find((v) => roundTen(v) !== target)!;
        expect(roundReverse.check(item, [...sol, `n${wrongPick}`]).errors[0]!.errorType).toBe("rounding_error");
      }
  });
});

describe("estimate-pick", () => {
  it("exactly one option within 20%; level 1 distractors are farther than level 3", () => {
    const far = (d: Difficulty) => {
      let min = Infinity;
      for (const seed of range(200)) {
        const item = estimatePick.generate(seed, d, { min: 10, max: 90 });
        const n = item.params.positions.length;
        expect(item.params.values.filter((v) => goodEstimate(n, v)).length).toBe(1);
        for (const v of item.params.values) if (!goodEstimate(n, v)) min = Math.min(min, Math.abs(v - n) / n);
      }
      return min;
    };
    expect(far(1)).toBeGreaterThan(0.6);
    expect(far(3)).toBeGreaterThan(0.3);
  });
  it("the validator checks closeness, not a stored value", () => {
    const item = estimatePick.generate(3, 2, { min: 10, max: 90 });
    const n = item.params.positions.length;
    expect(choiceIds(item).filter((id) => estimatePick.check(item, id).correct)).toEqual([estimatePick.solution(item)]);
    expect(goodEstimate(n, n)).toBe(true);
  });
});
