import { describe, expect, it } from "vitest";
import catalog from "../../../../../content/curriculum/math/s1/lessons.json";
import type { QuizItem, QuizMechanic } from "../../src/quiz";
import {
  cubeFaces,
  GEOMETRY_MECHANICS,
  isLineOfSymmetry,
  mirrorCell,
  polygonProblems,
  polygonSides,
  reflect,
  shapeSelect,
  SYM_SHAPES,
  symmetryCheck,
  symmetryComplete,
  symmetryLine,
  type Pt,
} from "../../src/math/B_geometry";
import { exerciseMechanic } from "./harness";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function configsFor(mechanicId: string): any[] {
  const out = catalog.lessons.flatMap((l) => l.games.filter((g) => g.mechanic === mechanicId).map((g) => g.config));
  expect(out.length, `${mechanicId} used in lessons.json`).toBeGreaterThan(0);
  return out;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function common(mech: QuizMechanic<any, any>) {
  return (item: QuizItem<unknown>) => {
    const steps = mech.explain(item as never);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.length).toBeLessThanOrEqual(4);
    expect(item.prompt).not.toMatch(/[٠-٩]/);
  };
}
function withParams<P>(item: QuizItem<P>, params: Partial<P>): QuizItem<P> {
  return { ...item, params: { ...item.params, ...params } };
}

describe("all geometry mechanics: 1000 seeds × 3 levels for every lessons.json config", () => {
  for (const mech of GEOMETRY_MECHANICS) {
    for (const config of configsFor(mech.mechanicId)) {
      it(`${mech.mechanicId} ${JSON.stringify(config)}`, () => exerciseMechanic(mech, config, 1000, common(mech)));
    }
  }
});

describe("polygon-sides / shape-select (p.18)", () => {
  it("level 1 is regular and at most hexagons; level 3 irregular up to octagons", () => {
    const sides = { 1: new Set<number>(), 3: new Set<number>() };
    for (let s = 1; s <= 300; s++) {
      sides[1].add(polygonSides.generate(s, 1, { min: 3, max: 8 }).params.points.length);
      sides[3].add(polygonSides.generate(s, 3, { min: 3, max: 8 }).params.points.length);
    }
    expect(Math.max(...sides[1])).toBe(6);
    expect([...sides[3]].sort()).toEqual([3, 4, 5, 6, 7, 8]);
  });
  it("counting the sides is graded from the coordinates; miscounts by one are counting errors", () => {
    const item = polygonSides.generate(3, 2, { min: 3, max: 8 });
    const n = item.params.points.length;
    expect(polygonSides.check(item, n).correct).toBe(true);
    expect(polygonSides.check(item, n + 1).errors[0]!.errorType).toBe("counting_error");
  });
  it("rejects self-crossing and flat-cornered outlines", () => {
    const bowtie: Pt[] = [[-50, -50], [50, 50], [50, -50], [-50, 50]];
    expect(polygonProblems(bowtie)).toContain("sides cross");
    const flat: Pt[] = [[-60, 0], [0, 1], [60, 0], [0, 60]];
    expect(polygonProblems(flat).some((p) => p.includes("flat"))).toBe(true);
  });
  it("shape-select: picking a shape with another side count is a property error", () => {
    for (let s = 1; s <= 200; s++) {
      const item = shapeSelect.generate(s, 3, { min: 3, max: 8 });
      const sol = shapeSelect.solution(item) as string[];
      const other = item.params.shapes.findIndex((p) => p.length !== item.params.sides);
      expect(shapeSelect.check(item, [...sol, `p${other}`]).errors[0]!.errorType).toBe("property_error");
      expect(shapeSelect.check(item, sol.slice(1)).errors[0]!.errorType).toBe("partial_answer");
      for (const [i, p] of item.params.shapes.entries()) expect(sol.includes(`p${i}`)).toBe(p.length === item.params.sides);
    }
  });
});

describe("cube-faces (p.19)", () => {
  const base = cubeFaces.generate(1, 1, { maxCubes: 3 });
  it("book labels: one cube 3, two joined cubes 3, two separate cubes 6", () => {
    expect(cubeFaces.solution(withParams(base, { mode: "count", solids: [{ length: 1, axis: "x" }] } as never))).toBe(3);
    expect(cubeFaces.solution(withParams(base, { mode: "count", solids: [{ length: 2, axis: "x" }] } as never))).toBe(3);
    expect(cubeFaces.solution(withParams(base, { mode: "count", solids: [{ length: 2, axis: "y" }] } as never))).toBe(3);
    expect(cubeFaces.solution(withParams(base, { mode: "count", solids: [{ length: 1, axis: "x" }, { length: 1, axis: "x" }] } as never))).toBe(6);
  });
  it("counting each joined cube separately or all six faces is a property error", () => {
    const item = withParams(base, { mode: "count", solids: [{ length: 3, axis: "x" }] } as never);
    expect(cubeFaces.check(item, 9).errors[0]!.errorType).toBe("property_error");
    expect(cubeFaces.check(item, 18).errors[0]!.errorType).toBe("property_error");
    expect(cubeFaces.check(item, 7).errors[0]!.errorType).toBe("counting_error"); // every visible square
  });
  it("level 3 asks which arrangement shows the most faces, with one clear winner", () => {
    let most = 0;
    for (let s = 1; s <= 300; s++) {
      const item = cubeFaces.generate(s, 3, { maxCubes: 3 });
      if (item.params.mode === "most") {
        most++;
        const counts = item.params.arrangements.map((a) => a.length);
        const sol = Number(String(cubeFaces.solution(item)).slice(1));
        expect(counts[sol]).toBe(Math.max(...counts));
      }
    }
    expect(most).toBeGreaterThan(50);
  });
});

describe("symmetry-check (p.20-21): truth computed by reflecting the outline", () => {
  const C = (pts: Pt[]) => pts;
  it("known facts follow from the coordinates", () => {
    const v = symmetryLine("vertical");
    const h = symmetryLine("horizontal");
    const d = symmetryLine("diag-down");
    const u = symmetryLine("diag-up");
    expect(isLineOfSymmetry(C(SYM_SHAPES.square.points), d)).toBe(true);
    expect(isLineOfSymmetry(C(SYM_SHAPES.rectangle.points), v)).toBe(true);
    expect(isLineOfSymmetry(C(SYM_SHAPES.rectangle.points), d)).toBe(false); // a rectangle's diagonal is not a mirror line
    expect(isLineOfSymmetry(C(SYM_SHAPES.isosceles.points), v)).toBe(true);
    expect(isLineOfSymmetry(C(SYM_SHAPES.isosceles.points), h)).toBe(false);
    expect(isLineOfSymmetry(C(SYM_SHAPES.star.points), v)).toBe(true);
    expect(isLineOfSymmetry(C(SYM_SHAPES.hexagon.points), h)).toBe(true);
    expect(isLineOfSymmetry(C(SYM_SHAPES.hexagon.points), d)).toBe(false);
    expect(isLineOfSymmetry(C(SYM_SHAPES.circle.points), u)).toBe(true);
    expect(isLineOfSymmetry(C(SYM_SHAPES.parallelogram.points), v)).toBe(false);
    expect(isLineOfSymmetry(C(SYM_SHAPES.parallelogram.points), h)).toBe(false);
    expect(isLineOfSymmetry(C(SYM_SHAPES.square.points), symmetryLine("vertical", 35))).toBe(false);
  });
  it("every item's answer equals the reflection test, and both answers occur at every level", () => {
    for (const d of [1, 2, 3] as const) {
      let yes = 0;
      for (let s = 1; s <= 400; s++) {
        const item = symmetryCheck.generate(s, d, {});
        const truth = isLineOfSymmetry(item.params.points, item.params.line);
        expect(symmetryCheck.solution(item)).toBe(truth ? "yes" : "no");
        if (truth) yes++;
        expect(symmetryCheck.check(item, truth ? "no" : "yes").errors[0]!.errorType).toBe("reflection_error");
      }
      expect(yes).toBeGreaterThan(120);
      expect(yes).toBeLessThan(280);
    }
  });
  it("tampering with the outline changes the computed answer", () => {
    const item = symmetryCheck.generate(1, 1, {});
    const square = withParams(item, { points: SYM_SHAPES.square.points, line: symmetryLine("vertical") });
    expect(symmetryCheck.solution(square)).toBe("yes");
    const skewed = withParams(square, { points: [[-60, -60], [70, -60], [60, 60], [-60, 60]] });
    expect(symmetryCheck.solution(skewed)).toBe("no");
  });
  it("reflect is an involution", () => {
    const l = symmetryLine("diag-up");
    const p: Pt = [13, -41];
    const back = reflect(reflect(p, l), l);
    expect(back[0]).toBeCloseTo(13);
    expect(back[1]).toBeCloseTo(-41);
  });
});

describe("symmetry-complete", () => {
  it("mirror cells come from reflecting cell centres", () => {
    expect(mirrorCell(0, 0, 6, "vertical")).toEqual([0, 5]);
    expect(mirrorCell(1, 2, 6, "horizontal")).toEqual([4, 2]);
    expect(mirrorCell(0, 3, 6, "diag-main")).toEqual([3, 0]);
    expect(mirrorCell(0, 0, 6, "diag-anti")).toEqual([5, 5]);
  });
  it("extra cells are reflection errors, missing cells partial; order does not matter", () => {
    for (let s = 1; s <= 200; s++) {
      const item = symmetryComplete.generate(s, 2, { size: 6, axes: ["vertical", "horizontal", "diagonal"] });
      const sol = symmetryComplete.solution(item) as string[];
      expect(symmetryComplete.check(item, [...sol].reverse()).correct).toBe(true);
      expect(symmetryComplete.check(item, sol.slice(1)).errors[0]!.errorType).toBe("partial_answer");
      expect(symmetryComplete.check(item, [...sol, item.params.given[0]!]).errors[0]!.errorType).toBe("reflection_error");
      expect(symmetryComplete.check(item, []).errors[0]!.errorType).toBe("input_invalid");
      expect(symmetryComplete.check(item, ["9,9"]).errors[0]!.errorType).toBe("input_invalid");
    }
  });
  it("copying the picture instead of mirroring it is a reflection error", () => {
    const item = withParams(symmetryComplete.generate(1, 1, { size: 6, axes: ["vertical"] }), { axis: "vertical", given: ["0,0", "0,1", "1,1"] });
    expect(symmetryComplete.solution(item)).toEqual(["0,4", "0,5", "1,4"]);
    expect(symmetryComplete.check(item, ["0,3", "0,4", "1,4"]).errors[0]!.errorType).toBe("reflection_error");
  });
  it("L17 config never uses a diagonal axis; level 1 keeps to straight axes; level 3 of L18 uses diagonals", () => {
    let diag = 0;
    for (let s = 1; s <= 300; s++) {
      expect(symmetryComplete.generate(s, 3, { size: 6, axes: ["vertical", "horizontal"] }).params.axis).toMatch(/vertical|horizontal/);
      expect(symmetryComplete.generate(s, 1, { size: 6, axes: ["vertical", "horizontal", "diagonal"] }).params.axis).toMatch(/vertical|horizontal/);
      if (symmetryComplete.generate(s, 3, { size: 6, axes: ["vertical", "horizontal", "diagonal"] }).params.axis.startsWith("diag")) diag++;
    }
    expect(diag).toBeGreaterThan(100);
  });
  it("rejects an odd grid", () => {
    expect(symmetryComplete.validateConfig({ size: 5, axes: ["vertical"] }).length).toBeGreaterThan(0);
  });
});
