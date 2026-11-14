import { describe, expect, it } from "vitest";
import { complement, factFamily, factTriangle, pairPick } from "../../src/math/pairs";
import { exerciseMechanic } from "./harness";

describe("complement", () => {
  for (const config of [
    { targets: [100], step: 10, visual: "scale", unit: "غ" },
    { targets: [20], step: 1, visual: "tenframes" },
    { targets: [12], step: 1, visual: "clock" },
    { targets: [20, 30], step: 1, visual: "cards" },
  ] as const) {
    it(`1000 seeds × 3 levels: ${config.visual}`, () => exerciseMechanic(complement, config));
  }
  it("classifies adding instead of subtracting", () => {
    const item = complement.generate(3, 2, { targets: [20], step: 1, visual: "cards" });
    const { target, known } = item.params;
    expect(complement.check(item, target + known).errors[0]!.errorType).toBe("operation_confusion");
  });
  it("book example: the other side of a heart card showing 15 for 20 is 5", () => {
    const item = { ...complement.generate(1, 1, { targets: [20], step: 1, visual: "cards" }) };
    item.params = { ...item.params, target: 20, known: 15 };
    expect(complement.check(item, 5).correct).toBe(true);
  });
  it("rejects an impossible config", () => {
    expect(complement.validateConfig({ targets: [30], step: 1, visual: "clock" }).length).toBeGreaterThan(0);
  });
});

describe("pair-pick", () => {
  for (const config of [{ target: 100, step: 10, unit: "غ" }, { target: 20, step: 1 }, { target: 30, step: 1 }, { target: 10, step: 1 }] as const) {
    it(`1000 seeds × 3 levels: target ${config.target}`, () =>
      exerciseMechanic(pairPick, config, 1000, (item) => {
        if (item.input.type === "multi") expect(item.input.exactly).toBe(2);
      }));
  }
  it("rejects a wrong pair and a single card", () => {
    const item = pairPick.generate(7, 2, { target: 20, step: 1 });
    const sol = pairPick.solution(item) as string[];
    const other = item.params.values.map((_, i) => `c${i}`).find((id) => !sol.includes(id))!;
    expect(pairPick.check(item, [sol[0]!, other]).correct).toBe(false);
    expect(pairPick.check(item, [sol[0]!]).correct).toBe(false);
  });
});

describe("fact-triangle / fact-family", () => {
  for (const family of ["tens100", "to20", "to12"] as const) {
    it(`triangle 1000 seeds × 3 levels: ${family}`, () => exerciseMechanic(factTriangle, { family }));
    it(`family 1000 seeds × 3 levels: ${family}`, () => exerciseMechanic(factFamily, { family }));
  }
  it("book example 20 + 80 = 100 family has exactly four true facts", () => {
    const item = factFamily.generate(1, 1, { family: "tens100" });
    expect((factFamily.solution(item) as string[]).length).toBe(4);
  });
  it("picking a false fact is flagged, missing one is partial", () => {
    const item = factFamily.generate(5, 2, { family: "to20" });
    const sol = factFamily.solution(item) as string[];
    const falseId = item.params.equations.find((e) => !sol.includes(e.id))!.id;
    expect(factFamily.check(item, [...sol, falseId]).errors[0]!.errorType).toBe("operation_confusion");
    expect(factFamily.check(item, sol.slice(0, 3)).errors[0]!.errorType).toBe("partial_answer");
  });
});
