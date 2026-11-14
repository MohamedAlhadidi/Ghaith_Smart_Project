import { describe, expect, it } from "vitest";
import { COMPOSE_SHAPES, trianglesCompose } from "../../src/math/M_compose";
import { exerciseMechanic } from "./harness";

describe("triangles-compose (L15 p.18)", () => {
  it("1000 seeds × 3 levels", () => exerciseMechanic(trianglesCompose, {}));
  it("book shapes have the expected number of small triangles", () => {
    const counts = Object.fromEntries(Object.entries(COMPOSE_SHAPES).map(([id, s]) => [id, s.tris.length]));
    expect(counts).toEqual({ rhombus: 2, trapezoid: 3, triangle4: 4, parallelogram: 4, hexagon: 6, triangle9: 9, star: 12 });
  });
  it("every shape is edge-connected and has no duplicate triangles", () => {
    for (const [id, s] of Object.entries(COMPOSE_SHAPES)) {
      const item = { ...trianglesCompose.generate(1, s.level, {}), params: { shapeId: id, tris: s.tris, rotation: 0 } };
      expect(trianglesCompose.checkIntegrity(item), id).toEqual([]);
    }
  });
  it("a near miss is a counting error", () => {
    const item = trianglesCompose.generate(3, 3, {});
    const n = trianglesCompose.solution(item) as number;
    expect(trianglesCompose.check(item, n - 1).errors[0]!.errorType).toBe("counting_error");
  });
});
