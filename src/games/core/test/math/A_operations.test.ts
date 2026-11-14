import { describe, expect, it } from "vitest";
import { bridges, eqTrue, exprValue } from "../../src/math/A_common";
import {
  add2d1d,
  addMany,
  balance,
  differenceRows,
  differenceSentence,
  equivalence,
  inverseSentence,
  loopNext,
  storySentence,
} from "../../src/math/operations";
import type { Difficulty } from "../../src/types";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const LEVELS = [1, 2, 3] as Difficulty[];

describe("add-many", () => {
  it("book p.14 groups: 8+7+3+4 = 22 and 4+8+9+5+1 = 27; forgetting one number is partial", () => {
    const item = addMany.generate(1, 1, { countMin: 4, countMax: 5 });
    item.params = { digits: [8, 7, 3, 4] };
    expect(addMany.check(item, 22).correct).toBe(true);
    expect(addMany.check(item, 18).errors[0]!.errorType).toBe("partial_answer");
    expect(addMany.explain(item)[0]).toContain("7 + 3 = 10");
    item.params = { digits: [4, 8, 9, 5, 1] };
    expect(addMany.solution(item)).toBe(27);
  });
  it("level 1: 4 numbers with a pair to 10; level 3: 5 numbers", () => {
    for (const seed of range(200)) {
      const d1 = addMany.generate(seed, 1, { countMin: 4, countMax: 5 }).params.digits;
      expect(d1.length).toBe(4);
      expect(d1.some((a, i) => d1.some((b, j) => i < j && a + b === 10))).toBe(true);
      expect(addMany.generate(seed, 3, { countMin: 4, countMax: 5 }).params.digits.length).toBe(5);
    }
  });
});

describe("equivalence", () => {
  it("book p.16: 21 − 5 = 12 + 4 are equivalent cards", () => {
    expect(exprValue({ a: 21, op: "-", b: 5 })).toBe(exprValue({ a: 12, op: "+", b: 4 }));
  });
  it("targets are two-digit ± one-digit within 45; all equal cards and only those are correct", () => {
    for (const d of LEVELS)
      for (const seed of range(200)) {
        const item = equivalence.generate(seed, d, { maxValue: 45 });
        const { target, options } = item.params;
        expect(target.a).toBeGreaterThanOrEqual(10);
        expect(target.b).toBeLessThanOrEqual(9);
        expect(exprValue(target)).toBeLessThanOrEqual(45);
        const v = exprValue(target);
        const sol = equivalence.solution(item) as string[];
        expect(sol).toEqual(options.filter((o) => exprValue(o) === v).map((o) => o.id));
        const bad = options.find((o) => exprValue(o) !== v)!;
        expect(equivalence.check(item, [...sol, bad.id]).correct).toBe(false);
        expect(equivalence.check(item, sol.slice(1)).correct).toBe(sol.length === 0);
      }
  });
  it("level 3 offers the same numbers with the other operation", () => {
    let seen = 0;
    for (const seed of range(200)) {
      const { target, options } = equivalence.generate(seed, 3, { maxValue: 45 }).params;
      const swapped = options.find((o) => o.a === target.a && o.b === target.b && o.op !== target.op);
      if (swapped) {
        seen++;
        expect(equivalence.check(equivalence.generate(seed, 3, { maxValue: 45 }), [swapped.id]).errors[0]!.errorType).toBe("operation_confusion");
      }
    }
    expect(seen).toBeGreaterThan(100);
  });
});

describe("balance", () => {
  it("7 + 5 = 8 + ? is 4; adding everything is an operation confusion", () => {
    const item = balance.generate(1, 1, { maxValue: 20 });
    item.params = { first: [7, 5], second: [8, null] };
    expect(balance.check(item, 4).correct).toBe(true);
    expect(balance.check(item, 20).errors[0]!.errorType).toBe("operation_confusion");
    expect(balance.check(item, 12).errors[0]!.errorType).toBe("partial_answer");
  });
  it("level 3 puts the missing number on the first side; totals stay within maxValue", () => {
    for (const seed of range(300)) {
      for (const d of LEVELS) {
        const p = balance.generate(seed, d, { maxValue: 20 }).params;
        const terms = [...p.first, ...p.second].filter((v): v is number => v !== null);
        expect(Math.max(...terms)).toBeLessThan(20);
        expect(p.first.includes(null)).toBe(d === 3);
      }
      const l1 = balance.generate(seed, 1, { maxValue: 20 }).params;
      expect((l1.first[0] ?? 0) + (l1.first[1] ?? 0)).toBeLessThanOrEqual(10);
    }
  });
});

describe("inverse-sentence", () => {
  it("book p.37: the inverse of 15 + 9 = 24 is 24 − 9 = 15, and 24 − 15 = 9 is never offered", () => {
    for (const d of LEVELS)
      for (const seed of range(300)) {
        const item = inverseSentence.generate(seed, d, { max: 60 });
        const g = item.params.given;
        const sol = item.params.options.find((o) => o.id === inverseSentence.solution(item))!;
        expect(eqTrue(sol)).toBe(true);
        expect(sol.x).toBe(g.z);
        expect(sol.y).toBe(g.y);
        expect(sol.op).not.toBe(g.op);
        if (g.op === "+") expect(item.params.options.some((o) => o.op === "-" && o.x === g.z && o.y === g.x)).toBe(false);
        expect(g.z).toBeLessThanOrEqual(60);
      }
  });
  it("level 1 never bridges a ten; level 3 adds the commuted (true, not inverse) sentence for additions", () => {
    for (const seed of range(200)) {
      const g = inverseSentence.generate(seed, 1, { max: 60 }).params.given;
      expect(g.op).toBe("+");
      expect(bridges(g.x, g.y)).toBe(false);
      const item = inverseSentence.generate(seed, 3, { max: 60 });
      const ig = item.params.given;
      if (ig.op === "+") {
        const commuted = item.params.options.find((o) => o.op === "+" && o.x === ig.y && o.y === ig.x)!;
        expect(eqTrue(commuted)).toBe(true);
        expect(inverseSentence.check(item, commuted.id).errors[0]!.errorType).toBe("operation_confusion");
      }
    }
  });
});

describe("story-sentence", () => {
  it("stories use the six Omani names and match exactly one sentence", () => {
    const names = ["أحمد", "عائشة", "خلفان", "مريم", "سالم", "هدى"];
    for (const d of LEVELS)
      for (const seed of range(200)) {
        const item = storySentence.generate(seed, d, { max: 60 });
        expect(names.some((n) => item.prompt.includes(n))).toBe(true);
        expect(item.prompt).toContain(String(item.params.a));
        expect(item.prompt).toContain(String(item.params.b));
        const swapped = item.params.options.find((o) => o.op !== item.params.op)!;
        expect(storySentence.check(item, swapped.id).errors[0]!.errorType).toBe("operation_confusion");
      }
  });
  it("book numbers fit the generator's range (12 + 6, 24 − 9, 18 − 6, 46 + 7, 15 + 9, 53 − 7)", () => {
    const item = storySentence.generate(1, 2, { max: 60 });
    for (const [a, op, b] of [
      [12, "+", 6],
      [24, "-", 9],
      [18, "-", 6],
      [46, "+", 7],
      [15, "+", 9],
      [53, "-", 7],
    ] as const) {
      const r = op === "+" ? a + b : a - b;
      const test = { ...item, params: { ...item.params, a, op, b, options: [{ id: "e0", x: a, op, y: b, z: r }] } };
      expect(storySentence.check(test, "e0").correct).toBe(true);
      expect(storySentence.checkIntegrity(test).filter((p) => p.includes("grammar"))).toEqual([]);
    }
  });
});

describe("loop-next / add-2d1d", () => {
  it("book p.38: «أنا 34 / من هو 25 + 2؟» leads to «أنا 27»", () => {
    const item = loopNext.generate(1, 1, { max: 60 });
    item.params = { have: 34, a: 25, b: 2, values: [27, 37, 34] };
    expect(loopNext.check(item, "n27").correct).toBe(true);
    expect(loopNext.check(item, "n37").errors[0]!.errorType).toBe("place_value_error");
  });
  it("level 1 never bridges; level 2+ always bridges; level 3 writes the one-digit number first", () => {
    for (const seed of range(300)) {
      const l1 = add2d1d.generate(seed, 1, { max: 60 }).params;
      expect(bridges(l1.a, l1.b)).toBe(false);
      const l2 = add2d1d.generate(seed, 2, { max: 60 }).params;
      expect(bridges(l2.a, l2.b)).toBe(true);
      const l3 = add2d1d.generate(seed, 3, { max: 60 });
      expect(l3.params.oneDigitFirst).toBe(true);
      expect(l3.params.a + l3.params.b).toBeLessThanOrEqual(60);
      expect(l3.prompt.startsWith(`من هو ${l3.params.b} + `)).toBe(true);
    }
  });
  it("46 + 7: forgetting the carried ten (43) is a place-value error", () => {
    const item = add2d1d.generate(1, 2, { max: 60 });
    item.params = { a: 46, b: 7, oneDigitFirst: false };
    expect(add2d1d.check(item, 53).correct).toBe(true);
    expect(add2d1d.check(item, 43).errors[0]!.errorType).toBe("place_value_error");
    expect(add2d1d.check(item, 39).errors[0]!.errorType).toBe("operation_confusion");
  });
});

describe("difference rows / sentence", () => {
  it("book p.39: hearts 6 and 4 have a difference of 2", () => {
    const item = differenceRows.generate(1, 1, { max: 20 });
    item.params = { top: 6, bottom: 4, kind: "heart" };
    expect(differenceRows.check(item, 2).correct).toBe(true);
    expect(differenceRows.check(item, 10).errors[0]!.errorType).toBe("operation_confusion");
  });
  it("rows stay within 20, top is longer; level 1 stays within 10", () => {
    for (const seed of range(300))
      for (const d of LEVELS) {
        const p = differenceRows.generate(seed, d, { max: 20 }).params;
        expect(p.top).toBeLessThanOrEqual(d === 1 ? 10 : 20);
        expect(p.top).toBeGreaterThan(p.bottom);
      }
  });
  it("the sentence must start with the larger number", () => {
    for (const seed of range(200)) {
      const item = differenceSentence.generate(seed, 2, { max: 20 });
      const reversed = item.params.options.find((o) => o.x === item.params.bottom)!;
      expect(differenceSentence.check(item, reversed.id).errors[0]!.errorType).toBe("comparison_direction");
    }
  });
});
