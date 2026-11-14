import { describe, expect, it } from "vitest";
import { neighbor, numberAt, positionOf, screenCol, walk } from "../src/hundredSquare";
import { createRng, randInt, shuffle } from "../src/rng";

describe("seeded rng", () => {
  it("is reproducible for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it("randInt stays within inclusive bounds", () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = randInt(rng, 1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });
  it("shuffle keeps all elements", () => {
    expect(shuffle(createRng(1), [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("hundred square model", () => {
  it("round-trips every number 1..100", () => {
    for (let n = 1; n <= 100; n++) expect(numberAt(positionOf(n))).toBe(n);
  });

  it("rejects numbers off the board", () => {
    expect(() => positionOf(0)).toThrow();
    expect(() => positionOf(101)).toThrow();
    expect(() => positionOf(2.5)).toThrow();
  });

  // Facts read from MATH-S1-STU printed p.4 (PDF p.15), Arabic RTL layout.
  describe("matches the book's RTL layout", () => {
    it("row ١٦ ١٧ ١٨ increases to the left", () => {
      expect(neighbor(16, "left", "rtl")).toBe(17);
      expect(neighbor(17, "left", "rtl")).toBe(18);
      expect(neighbor(18, "right", "rtl")).toBe(17);
    });
    it("٨٨ is directly above ٩٨", () => {
      expect(neighbor(88, "down", "rtl")).toBe(98);
      expect(neighbor(98, "up", "rtl")).toBe(88);
    });
    it("blue diagonal ٤١ → ٥٢ → ٦٣ is down-and-left (+11)", () => {
      expect(walk(41, ["down", "left"], "rtl")).toBe(52);
      expect(walk(52, ["down", "left"], "rtl")).toBe(63);
    });
    it("1 is drawn in the top-right corner", () => {
      expect(screenCol(positionOf(1), "rtl")).toBe(9);
      expect(screenCol(positionOf(10), "rtl")).toBe(0);
    });
  });

  it("LTR layout mirrors left/right", () => {
    expect(neighbor(16, "right", "ltr")).toBe(17);
    expect(screenCol(positionOf(1), "ltr")).toBe(0);
  });

  it("never wraps around a row edge", () => {
    expect(neighbor(10, "left", "rtl")).toBeNull(); // 10 is the left-most cell of row 1
    expect(neighbor(11, "right", "rtl")).toBeNull();
    expect(neighbor(1, "up", "rtl")).toBeNull();
    expect(neighbor(100, "down", "rtl")).toBeNull();
  });
});
