import { describe, expect, it } from "vitest";
import catalog from "../../../../../content/curriculum/math/s1/lessons.json";
import type { QuizItem, QuizMechanic } from "../../src/quiz";
import {
  arrayBuild,
  arrayCount,
  arrayFactors,
  arraySentences,
  compareQuantity,
  describesArray,
  divisionSentence,
  divisionShare,
  double,
  doubleReverse,
  groupsReverse,
  MULTIPLICATIVE_MECHANICS,
  skipCountGroups,
} from "../../src/math/B_multiplicative";
import { exerciseMechanic } from "./harness";

/** Every config the lesson catalogue uses for a mechanic. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function configsFor(mechanicId: string): any[] {
  const out = catalog.lessons.flatMap((l) => l.games.filter((g) => g.mechanic === mechanicId).map((g) => g.config));
  expect(out.length, `${mechanicId} used in lessons.json`).toBeGreaterThan(0);
  return out;
}

/** Steps are 2-4 Arabic lines; prompts carry logical Western digits only. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function common(mech: QuizMechanic<any, any>) {
  return (item: QuizItem<unknown>) => {
    const steps = mech.explain(item as never);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.length).toBeLessThanOrEqual(4);
    expect(item.prompt).not.toMatch(/[٠-٩]/);
    expect(item.prompt).toMatch(/[؀-ۿ]/);
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withParams<P>(item: QuizItem<P>, params: Partial<P>): QuizItem<P> {
  return { ...item, params: { ...item.params, ...params } };
}

describe("all multiplicative mechanics: 1000 seeds × 3 levels for every lessons.json config", () => {
  for (const mech of MULTIPLICATIVE_MECHANICS) {
    for (const config of configsFor(mech.mechanicId)) {
      it(`${mech.mechanicId} ${JSON.stringify(config)}`, () => exerciseMechanic(mech, config, 1000, common(mech)));
    }
  }
});

describe("skip-count-groups", () => {
  const cfg = { sizes: [2], kMax: 20, context: "shoes" as const };
  it("totals stay within the book bounds and grow with the level", () => {
    const max = [0, 0, 0];
    for (const d of [1, 2, 3] as const)
      for (let s = 1; s <= 300; s++) {
        const it = skipCountGroups.generate(s, d, cfg);
        max[d - 1] = Math.max(max[d - 1]!, it.params.groups);
        expect(it.params.size).toBe(2);
      }
    expect(max[0]).toBeLessThan(max[2]!);
    expect(max[2]).toBe(20);
  });
  it("book p.17: wheels on 4 tricycles = 12; adding instead is an operation confusion", () => {
    const item = withParams(skipCountGroups.generate(1, 1, { sizes: [3], kMax: 6, context: "tricycles" }), { groups: 4 });
    expect(skipCountGroups.check(item, 12).correct).toBe(true);
    expect(skipCountGroups.check(item, 7).errors[0]!.errorType).toBe("operation_confusion");
    expect(skipCountGroups.check(item, 9).errors[0]!.errorType).toBe("counting_error");
  });
  it("p.6 generic items never use the × sign (introduced on p.17)", () => {
    for (let s = 1; s <= 200; s++) {
      const item = skipCountGroups.generate(s, 3, { sizes: [2, 5, 10], kMax: 10, context: "generic" });
      expect(skipCountGroups.explain(item).join(" ")).not.toContain("×");
      expect(item.prompt).not.toContain("×");
    }
  });
  it("rejects a context with the wrong group size", () => {
    expect(skipCountGroups.validateConfig({ sizes: [3], kMax: 10, context: "hands" }).length).toBeGreaterThan(0);
  });
});

describe("groups-reverse", () => {
  it("book p.41: 68 shoes -> 34 boxes; p.42: 60 nails -> 12 hands", () => {
    const shoes = withParams(groupsReverse.generate(1, 3, { sizes: [2], maxTotal: 70, context: "shoes" }), { total: 68 });
    expect(groupsReverse.check(shoes, 34).correct).toBe(true);
    expect(groupsReverse.check(shoes, 136).errors[0]!.errorType).toBe("operation_confusion");
    const hands = withParams(groupsReverse.generate(1, 3, { sizes: [5], maxTotal: 60, context: "hands" }), { total: 60 });
    expect(groupsReverse.check(hands, 12).correct).toBe(true);
    expect(groupsReverse.check(hands, 11).errors[0]!.errorType).toBe("off_by_one");
  });
  it("level 3 reaches the book's large totals", () => {
    const totals = Array.from({ length: 300 }, (_, i) => groupsReverse.generate(i + 1, 3, { sizes: [2], maxTotal: 70, context: "shoes" }).params.total);
    expect(Math.max(...totals)).toBe(70);
    expect(Math.min(...totals)).toBeGreaterThanOrEqual(36);
  });
});

describe("double / double-reverse", () => {
  it("level 1-2 recipe items use the book recipe values (p.29); level 3 another multiple of 5", () => {
    const book = new Map([["flour", 70], ["ginger", 1], ["butter", 20], ["sugar", 35], ["egg", 1], ["honey", 2]]);
    for (let s = 1; s <= 300; s++) {
      for (const d of [1, 2] as const) {
        const p = double.generate(s, d, { context: "recipe", max: 70 }).params;
        if (p.context !== "recipe") throw new Error("expected recipe");
        expect(p.amount).toBe(book.get(p.ingredient));
      }
      const p3 = double.generate(s, 3, { context: "recipe", max: 70 }).params;
      if (p3.context !== "recipe") throw new Error("expected recipe");
      expect(p3.amount % 5).toBe(0);
      expect(p3.amount).toBeLessThanOrEqual(70);
      expect(p3.amount).not.toBe(book.get(p3.ingredient));
    }
  });
  it("70 g flour for 5 biscuits -> 140 g for 10; adding 5 is an operation confusion", () => {
    const item = withParams(double.generate(1, 2, { context: "recipe", max: 70 }), { ingredient: "flour", amount: 70 } as never);
    expect(double.check(item, 140).correct).toBe(true);
    expect(double.check(item, 75).errors[0]!.errorType).toBe("operation_confusion");
  });
  it("double line (p.35): 30 -> 60, numbers stay on the 0-50 line", () => {
    const item = withParams(double.generate(1, 2, { context: "line", max: 50 }), { n: 30 } as never);
    expect(double.check(item, 60).correct).toBe(true);
    for (let s = 1; s <= 300; s++) {
      const p = double.generate(s, 3, { context: "line", max: 50 }).params;
      if (p.context !== "line") throw new Error("expected line");
      expect(p.n).toBeLessThanOrEqual(50);
      expect(p.n % 5).not.toBe(0);
    }
  });
  it("halving: doubling instead is an operation confusion", () => {
    const item = withParams(doubleReverse.generate(1, 2, { maxDouble: 100, context: "line" }), { total: 60 } as never);
    expect(doubleReverse.check(item, 30).correct).toBe(true);
    expect(doubleReverse.check(item, 120).errors[0]!.errorType).toBe("operation_confusion");
  });
});

describe("arrays", () => {
  it("array-sentences: truth of every option is recomputed from the array", () => {
    for (let s = 1; s <= 300; s++) {
      const item = arraySentences.generate(s, 3, { maxRows: 5, maxCols: 10 });
      const sol = arraySentences.solution(item) as string[];
      for (const sen of item.params.sentences) expect(sol.includes(sen.id)).toBe(describesArray(item.params.rows, item.params.cols, sen));
    }
  });
  it("array-sentences: 3 rows of 4 -> 3 × 4, 4 × 3, 4 + 4 + 4, 3 + 3 + 3 + 3; 3 + 4 = 12 is not", () => {
    expect(describesArray(3, 4, { kind: "mul", terms: [3, 4], total: 12 })).toBe(true);
    expect(describesArray(3, 4, { kind: "mul", terms: [4, 3], total: 12 })).toBe(true);
    expect(describesArray(3, 4, { kind: "add", terms: [4, 4, 4], total: 12 })).toBe(true);
    expect(describesArray(3, 4, { kind: "add", terms: [3, 3, 3, 3], total: 12 })).toBe(true);
    expect(describesArray(3, 4, { kind: "add", terms: [3, 4], total: 12 })).toBe(false);
    expect(describesArray(3, 4, { kind: "add", terms: [4, 4, 4, 4], total: 16 })).toBe(false);
  });
  it("array-sentences: picking r + c is an operation confusion, missing one is partial", () => {
    for (let s = 1; s <= 200; s++) {
      const item = arraySentences.generate(s, 3, { maxRows: 5, maxCols: 10 });
      const sol = arraySentences.solution(item) as string[];
      const plus = item.params.sentences.find((x) => x.kind === "add" && new Set(x.terms).size > 1);
      if (plus) expect(arraySentences.check(item, [...sol, plus.id]).errors[0]!.errorType).toBe("operation_confusion");
      if (sol.length > 1) expect(arraySentences.check(item, sol.slice(1)).errors[0]!.errorType).toBe("partial_answer");
    }
  });
  it("array-build: sentences accept either orientation; the words form fixes rows", () => {
    const item = arrayBuild.generate(1, 3, { maxRows: 5, maxCols: 10 });
    const mul = withParams(item, { a: 4, b: 5, form: "mul" });
    expect(arrayBuild.check(mul, { rows: 4, cols: 5 }).correct).toBe(true);
    expect(arrayBuild.check(mul, { rows: 5, cols: 4 }).correct).toBe(true);
    expect(arrayBuild.check(mul, { rows: 4, cols: 4 }).errors[0]!.errorType).toBe("counting_error");
    expect(arrayBuild.check(mul, { rows: 9, cols: 4 }).errors[0]!.errorType).toBe("input_invalid");
    expect(arrayBuild.check(mul, "4x5").errors[0]!.errorType).toBe("input_invalid");
    const words = withParams(item, { a: 3, b: 5, form: "words" });
    expect(arrayBuild.check(words, { rows: 3, cols: 5 }).correct).toBe(true);
    expect(arrayBuild.check(words, { rows: 5, cols: 3 }).correct).toBe(false);
    // 2 × 10 cannot be built as 10 rows on a 5-row grid: the solution turns it.
    const turned = withParams(item, { a: 10, b: 2, form: "mul" });
    expect(arrayBuild.solution(turned)).toEqual({ rows: 2, cols: 10 });
  });
  it("array-count: p.22 neat layer; r + c is an operation confusion, a missed row a counting error", () => {
    const item = withParams(arrayCount.generate(1, 2, { maxRows: 6, maxCols: 6, context: "box" }), { rows: 4, cols: 5 });
    expect(arrayCount.check(item, 20).correct).toBe(true);
    expect(arrayCount.check(item, 9).errors[0]!.errorType).toBe("operation_confusion");
    expect(arrayCount.check(item, 15).errors[0]!.errorType).toBe("counting_error");
  });
  it("array-factors: 15 -> 3 rows of 5 and 5 rows of 3; every true array is offered at level 3", () => {
    for (let s = 1; s <= 300; s++) {
      const item = arrayFactors.generate(s, 3, { totals: [6, 8, 10, 12, 15, 16, 18, 20] });
      const sol = arrayFactors.solution(item) as string[];
      const pairs = item.params.options.filter((o) => sol.includes(o.id));
      for (const o of pairs) expect(o.rows * o.cols).toBe(item.params.total);
      const all = [2, 3, 4, 5, 6, 7, 8, 9, 10].filter((r) => item.params.total % r === 0 && item.params.total / r >= 2 && item.params.total / r <= 10);
      expect(pairs.length).toBe(all.length);
    }
  });
  it("compare-quantity: choosing the smaller box is a comparison-direction error; equal boxes occur", () => {
    let equal = 0;
    for (let s = 1; s <= 300; s++) {
      const item = compareQuantity.generate(s, 3, { maxRows: 6, maxCols: 6 });
      const sol = compareQuantity.solution(item);
      if (sol === "eq") equal++;
      else expect(compareQuantity.check(item, sol === "A" ? "B" : "A").errors[0]!.errorType).toBe("comparison_direction");
    }
    expect(equal).toBeGreaterThan(0);
    const item = withParams(compareQuantity.generate(1, 3, { maxRows: 6, maxCols: 6 }), { a: { rows: 2, cols: 6 }, b: { rows: 3, cols: 4 } });
    expect(compareQuantity.solution(item)).toBe("eq");
  });
});

describe("division (p.43)", () => {
  it("10 biscuits on 5 plates -> 2 each; groups of 5 from 15 -> 3 groups", () => {
    const item = divisionShare.generate(1, 1, { maxTotal: 20, divisors: [2, 5, 10] });
    expect(divisionShare.check(withParams(item, { total: 10, divisor: 5, mode: "share" }), 2).correct).toBe(true);
    expect(divisionShare.check(withParams(item, { total: 15, divisor: 5, mode: "group" }), 3).correct).toBe(true);
    expect(divisionShare.check(withParams(item, { total: 10, divisor: 5, mode: "share" }), 50).errors[0]!.errorType).toBe("operation_confusion");
  });
  it("level 1 stays within 10 biscuits and only shares; quotients are at least 2", () => {
    for (let s = 1; s <= 300; s++) {
      const p = divisionShare.generate(s, 1, { maxTotal: 20, divisors: [2, 5, 10] }).params;
      expect(p.total).toBeLessThanOrEqual(10);
      expect(p.mode).toBe("share");
      expect(p.total / p.divisor).toBeGreaterThanOrEqual(2);
    }
  });
  it("division-sentence: exactly one sentence total ÷ plates = each; reversed order flagged", () => {
    for (let s = 1; s <= 300; s++) {
      const item = divisionSentence.generate(s, 2, { maxTotal: 20, divisors: [2, 5, 10] });
      const sol = divisionSentence.solution(item);
      const right = item.params.options.find((o) => o.id === sol)!;
      expect([right.x, right.op, right.y, right.z]).toEqual([item.params.total, "÷", item.params.divisor, item.params.total / item.params.divisor]);
      const mul = item.params.options.find((o) => o.op === "×")!;
      expect(divisionSentence.check(item, mul.id).errors[0]!.errorType).toBe("operation_confusion");
      // The other true reading (total ÷ each = plates) is never offered.
      expect(item.params.options.some((o) => o.op === "÷" && o.x === item.params.total && o.y === item.params.total / item.params.divisor && o.z === item.params.divisor && o.y !== o.z)).toBe(false);
    }
  });
});
