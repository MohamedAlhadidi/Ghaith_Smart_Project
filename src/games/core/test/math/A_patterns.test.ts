import { describe, expect, it } from "vitest";
import { numberAt, positionOf } from "../../src/hundredSquare";
import { hasProp, hsqPattern, multiplesSelect, oddOneOut, statementTrue } from "../../src/math/patterns";
import type { Difficulty } from "../../src/types";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("hsq-pattern", () => {
  const diag = { steps: [1, 10, 11, 9] };
  const skip = { steps: [2, 5, 10] };

  it("book p.4: 41, 52, 63 -> 74 is tapped on the RTL board (row 8, 4th cell from the right)", () => {
    const item = hsqPattern.generate(1, 2, diag);
    item.params = { start: 41, step: 11 };
    const cell = positionOf(74);
    expect(cell).toEqual({ row: 7, col: 3 });
    expect(hsqPattern.check(item, cell).correct).toBe(true);
    expect(hsqPattern.check(item, positionOf(75)).errors[0]!.errorType).toBe("off_by_one");
    // 63 + 9 = 72: went down-right instead of down-left.
    expect(hsqPattern.check(item, positionOf(72)).errors[0]!.errorType).toBe("rtl_direction_confusion");
    expect(hsqPattern.check(item, positionOf(64)).errors[0]!.errorType).toBe("row_step_error");
  });

  it("book p.4: 19, 28, 37 -> 46", () => {
    const item = hsqPattern.generate(1, 2, diag);
    item.params = { start: 19, step: 9 };
    expect(numberAt(hsqPattern.solution(item) as { row: number; col: number })).toBe(46);
  });

  it("mirrored column on the same row is a direction error; bad cells are input errors", () => {
    const item = hsqPattern.generate(3, 2, diag);
    const sol = hsqPattern.solution(item) as { row: number; col: number };
    if (sol.col !== 9 - sol.col) expect(hsqPattern.check(item, { row: sol.row, col: 9 - sol.col }).errors[0]!.errorType).toBe("rtl_direction_confusion");
    expect(hsqPattern.check(item, { row: 10, col: 0 }).errors[0]!.errorType).toBe("input_invalid");
    expect(hsqPattern.check(item, "74").errors[0]!.errorType).toBe("input_invalid");
  });

  it("level 1 uses the smallest step; diagonals never wrap; level 3 numbers only the pattern", () => {
    for (const seed of range(300)) {
      expect(hsqPattern.generate(seed, 1, diag).params.step).toBe(1);
      expect(hsqPattern.generate(seed, 1, skip).params.step).toBe(2);
      const l3 = hsqPattern.generate(seed, 3, diag);
      expect(l3.visual.labels).toBe("pattern");
      expect(l3.params.step).not.toBe(1);
      const { start, step } = l3.params;
      if (step === 9 || step === 11) {
        const cols = [0, 1, 2, 3].map((k) => positionOf(start + k * step).col);
        expect(new Set(cols.map((c, i) => (i ? c - cols[i - 1]! : 0)).values()).size).toBeLessThanOrEqual(2);
      }
      // Skip counting at level 1 starts on a multiple (2, 4, 6...), at level 3 never.
      expect(hsqPattern.generate(seed, 1, skip).params.start % 2).toBe(0);
      const s3 = hsqPattern.generate(seed, 3, skip).params;
      expect(s3.start % s3.step).not.toBe(0);
    }
  });

  it("the validator recomputes from params, not from a stored answer", () => {
    const item = hsqPattern.generate(9, 2, skip);
    const before = hsqPattern.solution(item);
    item.params = { ...item.params, start: item.params.start + 1 };
    expect(hsqPattern.check(item, before).correct).toBe(false);
  });
});

describe("odd-one-out", () => {
  it("book p.36: 7, 25, 60 — several reasons are true at once", () => {
    const nums = [7, 25, 60];
    expect(statementTrue(nums, { x: 0, prop: "oneDigit" })).toBe(true);
    expect(statementTrue(nums, { x: 0, prop: "notMult5" })).toBe(true);
    expect(statementTrue(nums, { x: 2, prop: "even" })).toBe(true);
    expect(statementTrue(nums, { x: 2, prop: "mult10" })).toBe(true);
    expect(statementTrue(nums, { x: 2, prop: "gt50" })).toBe(true);
    // 7 is odd, but so is 25.
    expect(statementTrue(nums, { x: 0, prop: "odd" })).toBe(false);
    expect(statementTrue(nums, { x: 1, prop: "mult5" })).toBe(false);
  });

  it("checks the property: every true statement must be picked, no false one", () => {
    for (const d of [1, 2, 3] as Difficulty[])
      for (const seed of range(100)) {
        const item = oddOneOut.generate(seed, d, { max: 99 });
        const sol = oddOneOut.solution(item) as string[];
        const falseIds = item.params.statements.filter((s) => !sol.includes(s.id)).map((s) => s.id);
        expect(sol.length).toBeGreaterThanOrEqual(1);
        expect(falseIds.length).toBeGreaterThanOrEqual(1);
        expect(oddOneOut.check(item, [...sol, falseIds[0]!]).errors[0]!.errorType).toBe("property_error");
        if (sol.length > 1) expect(oddOneOut.check(item, sol.slice(1)).errors[0]!.errorType).toBe("partial_answer");
        for (const s of item.params.statements) {
          const n = item.params.numbers;
          const alone = n.filter((v) => hasProp(v, s.prop)).length === 1 && hasProp(n[s.x]!, s.prop);
          expect(sol.includes(s.id)).toBe(alone);
        }
      }
  });

  it("level 1 has one one-digit number; level 3 only two-digit numbers", () => {
    for (const seed of range(200)) {
      expect(oddOneOut.generate(seed, 1, { max: 99 }).params.numbers.filter((n) => n < 10).length).toBe(1);
      expect(oddOneOut.generate(seed, 3, { max: 99 }).params.numbers.every((n) => n >= 10)).toBe(true);
    }
  });
});

describe("multiples-select", () => {
  const cfg = { ks: [2, 5, 10], max: 60 };
  it("level 1 asks for multiples of 10; level 3 offers near misses", () => {
    for (const seed of range(200)) {
      expect(multiplesSelect.generate(seed, 1, cfg).params.k).toBe(10);
      const l3 = multiplesSelect.generate(seed, 3, cfg).params;
      const non = l3.values.filter((v) => v % l3.k !== 0);
      // every non-multiple is within 2 of a multiple (or a 5 for tens)
      for (const v of non) expect(Math.min(v % l3.k, l3.k - (v % l3.k)) <= 2 || (l3.k === 10 && v % 5 === 0)).toBe(true);
    }
  });
  it("picking a non-multiple is a property error, missing one is partial", () => {
    const item = multiplesSelect.generate(4, 2, cfg);
    const sol = multiplesSelect.solution(item) as string[];
    const bad = item.params.values.find((v) => v % item.params.k !== 0)!;
    expect(multiplesSelect.check(item, [...sol, `n${bad}`]).errors[0]!.errorType).toBe("property_error");
    expect(multiplesSelect.check(item, sol.slice(1)).errors[0]!.errorType).toBe("partial_answer");
    expect(multiplesSelect.check(item, []).errors[0]!.errorType).toBe("input_invalid");
  });
});
