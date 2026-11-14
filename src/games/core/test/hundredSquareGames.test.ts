import { describe, expect, it } from "vitest";
import { numberAt, positionOf, type Cell } from "../src/hundredSquare";
import {
  SHAPES,
  cellKey,
  classifyNumberError,
  fragmentFillGenerator,
  locateGenerator,
  pathMoveGenerator,
  validateFragmentFill,
  validateLocate,
  validatePathMove,
  type FragmentAnswer,
} from "../src/hundredSquareGames";
import type { Difficulty, Generator, ItemMeta } from "../src/types";

const SEEDS = 1000; // policy: >= 1000 generated cases per numeric template
const DIFFICULTIES: Difficulty[] = [1, 2, 3];

/** Runs `check` over 1000 seeds × 3 difficulties; on failure reports the seed so it can be replayed. */
function forEachItem<I extends ItemMeta>(gen: Generator<I>, check: (item: I) => void) {
  for (const difficulty of DIFFICULTIES) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const item = gen.generate(seed, difficulty);
      try {
        check(item);
      } catch (err) {
        throw new Error(`${gen.id} failed for seed=${seed} difficulty=${difficulty}: ${(err as Error).message}`);
      }
    }
  }
}

function solveFragment(cells: { row: number; col: number; given: number | null }[]): FragmentAnswer {
  const answer: FragmentAnswer = {};
  for (const c of cells) if (c.given === null) answer[cellKey(c)] = numberAt(c);
  return answer;
}

describe("book shapes (MATH-S1-STU p.4) are reproduced exactly", () => {
  // Each shape's first offset is the anchor; expected numbers read from the page image.
  const fromBook: Record<string, [number, number[]]> = {
    row3: [16, [16, 17, 18]],
    plus: [34, [34, 24, 44, 35, 33]],
    ell: [39, [39, 49, 48, 47, 57]],
    cup: [74, [74, 84, 85, 86, 76]],
    diag3: [41, [41, 52, 63]],
    diag3r: [19, [19, 28, 37]],
  };
  it("every shape in the generator is backed by a book fixture", () => {
    for (const id of Object.keys(SHAPES)) if (id !== "col3") expect(fromBook[id], id).toBeDefined();
  });
  for (const [shapeId, [anchor, expected]] of Object.entries(fromBook)) {
    it(shapeId, () => {
      const a = positionOf(anchor);
      const cells = SHAPES[shapeId]!.offsets.map(([dr, dx]) => numberAt({ row: a.row + dr, col: a.col - dx }));
      expect(cells).toEqual(expected);
    });
  }
});

describe("grid-fragment-fill generator", () => {
  it("is deterministic", () => {
    expect(fragmentFillGenerator.generate(123, 2)).toEqual(fragmentFillGenerator.generate(123, 2));
  });

  it("1000 seeds × 3 levels: publishable, solvable, wrong answers rejected", () => {
    forEachItem(fragmentFillGenerator, (item) => {
      expect(fragmentFillGenerator.checkIntegrity(item)).toEqual([]);
      expect(SHAPES[item.shapeId]!.difficulty).toBe(item.difficulty);
      const answer = solveFragment(item.cells);
      expect(validateFragmentFill(item, answer).correct).toBe(true);
      const firstBlank = Object.keys(answer)[0]!;
      const wrong = { ...answer, [firstBlank]: (answer[firstBlank] as number) + 2 };
      const result = validateFragmentFill(item, wrong);
      expect(result.correct).toBe(false);
      expect(result.errors).toHaveLength(1);
      for (const c of item.cells) {
        expect(numberAt(c)).toBeGreaterThanOrEqual(1);
        expect(numberAt(c)).toBeLessThanOrEqual(100);
      }
    });
  });

  it("reaches (almost) every legal placement of its shapes, not a few favourites", () => {
    for (const difficulty of [1, 2] as Difficulty[]) {
      // Size of the item space: every on-board anchor for every shape of this level.
      let space = 0;
      for (const shape of Object.values(SHAPES).filter((s) => s.difficulty === difficulty)) {
        for (let row = 0; row < 10; row++)
          for (let col = 0; col < 10; col++)
            if (shape.offsets.every(([dr, dx]) => row + dr >= 0 && row + dr < 10 && col - dx >= 0 && col - dx < 10)) space++;
      }
      const seen = new Set<string>();
      for (let seed = 1; seed <= space * 8; seed++) seen.add(JSON.stringify(fragmentFillGenerator.generate(seed, difficulty).cells));
      expect(seen.size / space).toBeGreaterThan(0.97);
    }
  });

  it("integrity check catches a corrupted item", () => {
    const item = fragmentFillGenerator.generate(5, 1);
    const broken = { ...item, cells: item.cells.map((c) => (c.given !== null ? { ...c, given: c.given + 1 } : c)) };
    expect(fragmentFillGenerator.checkIntegrity(broken).length).toBeGreaterThan(0);
  });

  it("classifies a left/right swap as direction confusion", () => {
    // Anchor 34 in a plus: the child writes 33 where 35 belongs (left of 34 in RTL).
    const item = {
      ...fragmentFillGenerator.generate(1, 2),
      shapeId: "plus",
      cells: [
        { ...positionOf(34), given: 34 },
        { ...positionOf(35), given: null },
      ],
    };
    const result = validateFragmentFill(item, { [cellKey(positionOf(35))]: 33 });
    expect(result.errors[0]!.errorType).toBe("rtl_direction_confusion");
  });

  it("separates input errors from concept errors", () => {
    const item = fragmentFillGenerator.generate(9, 1);
    const result = validateFragmentFill(item, {});
    expect(result.errors.every((e) => e.errorType === "input_invalid")).toBe(true);
  });
});

describe("grid-locate generator", () => {
  it("1000 seeds × 3 levels: target is locatable and only its cell is accepted", () => {
    forEachItem(locateGenerator, (item) => {
      expect(locateGenerator.checkIntegrity(item)).toEqual([]);
      const pos = positionOf(item.target);
      expect(validateLocate(item, pos).correct).toBe(true);
      const other: Cell = { row: pos.row, col: (pos.col + 3) % 10 };
      expect(validateLocate(item, other).correct).toBe(false);
    });
  });

  it("detects a mirrored (LTR-style) tap", () => {
    const item = { ...locateGenerator.generate(1, 3), target: 23 }; // row 3, col 2
    const result = validateLocate(item, { row: 2, col: 7 }); // mirrored column = 28
    expect(result.errors[0]!.errorType).toBe("rtl_direction_confusion");
  });

  it("detects reversed digits", () => {
    const item = { ...locateGenerator.generate(1, 3), target: 34 };
    expect(validateLocate(item, positionOf(43)).errors[0]!.errorType).toBe("tens_ones_confusion");
  });

  it("treats a missing tap as input error", () => {
    expect(validateLocate(locateGenerator.generate(2, 1), null).errors[0]!.errorType).toBe("input_invalid");
  });
});

describe("grid-path-move generator", () => {
  it("1000 seeds × 3 levels: exactly one correct option, distractors explained", () => {
    forEachItem(pathMoveGenerator, (item) => {
      expect(pathMoveGenerator.checkIntegrity(item)).toEqual([]);
      expect(item.path).toHaveLength(item.difficulty);
      const correct = item.options.find((o) => validatePathMove(item, o).correct);
      expect(correct).toBeDefined();
      for (const o of item.options) {
        if (o === correct) continue;
        const r = validatePathMove(item, o);
        expect(r.correct).toBe(false);
        expect(r.errors[0]!.errorType).not.toBe("other");
      }
    });
  });

  it("never uses an immediate back-step", () => {
    forEachItem(pathMoveGenerator, (item) => {
      const opposite = { up: "down", down: "up", left: "right", right: "left" } as const;
      item.path.forEach((d, i) => {
        if (i > 0) expect(opposite[d]).not.toBe(item.path[i - 1]);
      });
    });
  });
});

describe("classifyNumberError", () => {
  it("orders categories deterministically", () => {
    expect(classifyNumberError(34, 35, null)).toBe("off_by_one");
    expect(classifyNumberError(34, 44, null)).toBe("row_step_error");
    expect(classifyNumberError(34, 43, null)).toBe("tens_ones_confusion");
    expect(classifyNumberError(35, 33, 33)).toBe("rtl_direction_confusion");
    expect(classifyNumberError(34, Number.NaN, null)).toBe("input_invalid");
    expect(classifyNumberError(34, 70, null)).toBe("other");
  });
});
