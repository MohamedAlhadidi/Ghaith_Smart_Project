import { describe, expect, it } from "vitest";
import catalog from "../../../../../content/curriculum/math/s1/lessons.json";
import type { QuizItem, QuizMechanic } from "../../src/quiz";
import { compareWinner, MEASURE_MECHANICS, rulerRead, scaleRead, stopwatchRead, timeConvert } from "../../src/math/B_measure";
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

describe("all measurement mechanics: 1000 seeds × 3 levels for every lessons.json config", () => {
  for (const mech of MEASURE_MECHANICS) {
    for (const config of configsFor(mech.mechanicId)) {
      it(`${mech.mechanicId} ${JSON.stringify(config)}`, () => exerciseMechanic(mech, config, 1000, common(mech)));
    }
  }
});

describe("ruler-read", () => {
  it("levels 1-2 start at 0; level 3 starts at 1-3 cm and reading the end mark is a counting error", () => {
    for (let s = 1; s <= 200; s++) {
      expect(rulerRead.generate(s, 1, { maxCm: 15 }).params.start).toBe(0);
      expect(rulerRead.generate(s, 1, { maxCm: 15 }).params.end).toBeLessThanOrEqual(10);
      const item = rulerRead.generate(s, 3, { maxCm: 20 });
      expect(item.params.start).toBeGreaterThanOrEqual(1);
      expect(item.params.start).toBeLessThanOrEqual(3);
      expect(item.params.end).toBeLessThanOrEqual(20);
      expect(rulerRead.check(item, item.params.end).errors[0]!.errorType).toBe("counting_error");
    }
  });
});

describe("compare-winner (p.26-28)", () => {
  const base = compareWinner.generate(1, 1, { context: "distance" });
  it("book sandbag throw: Amal 5, Ahmed 18, Aisha 11 -> Ahmed; picking Amal reverses the comparison", () => {
    const item = withParams(base, { context: "distance", entries: [{ name: "أمل", value: 5 }, { name: "أحمد", value: 18 }, { name: "عائشة", value: 11 }] });
    expect(compareWinner.solution(item)).toBe("p1");
    expect(compareWinner.check(item, "p0").errors[0]!.errorType).toBe("comparison_direction");
    expect(compareWinner.check(item, "p2").errors[0]!.errorType).toBe("other");
  });
  it("book race: Rashid 12 s, Huda 22 s, Ahmed 17 s -> Rashid (shortest time wins)", () => {
    const item = withParams(base, { context: "time", entries: [{ name: "راشد", value: 12 }, { name: "هدى", value: 22 }, { name: "أحمد", value: 17 }] });
    expect(compareWinner.solution(item)).toBe("p0");
    expect(compareWinner.check(item, "p1").errors[0]!.errorType).toBe("comparison_direction");
  });
  it("mass: 1 كغ beats 900 غ; picking the larger gram number is a unit confusion", () => {
    const item = withParams(base, { context: "mass", entries: [{ name: "سالم", value: 900 }, { name: "مريم", value: 1000, inKg: true }, { name: "علي", value: 400 }] });
    expect(compareWinner.solution(item)).toBe("p1");
    expect(compareWinner.check(item, "p0").errors[0]!.errorType).toBe("unit_confusion");
  });
  it("mixed context (L23) produces both distance and time items; level 3 mass mixes units", () => {
    const contexts = new Set<string>();
    let kg = 0;
    for (let s = 1; s <= 300; s++) {
      contexts.add(compareWinner.generate(s, 2, { context: "mixed" }).params.context);
      if (compareWinner.generate(s, 3, { context: "mass" }).params.entries.some((e) => e.inKg)) kg++;
      for (const e of compareWinner.generate(s, 3, { context: "mass" }).params.entries) expect(e.value).toBeLessThanOrEqual(1000);
    }
    expect([...contexts].sort()).toEqual(["distance", "time"]);
    expect(kg).toBeGreaterThan(50);
  });
  it("results get closer with the level", () => {
    const gap = (d: 1 | 2 | 3) => {
      let min = Infinity;
      for (let s = 1; s <= 200; s++) {
        const v = compareWinner.generate(s, d, { context: "height" }).params.entries.map((e) => e.value).sort((a, b) => a - b);
        min = Math.min(min, v[1]! - v[0]!, v[2]! - v[1]!);
      }
      return min;
    };
    expect(gap(1)).toBeGreaterThanOrEqual(4);
    expect(gap(3)).toBe(1);
  });
});

describe("stopwatch-read (p.25)", () => {
  it("levels 1-2 use multiples of 5, level 3 any second", () => {
    for (let s = 1; s <= 200; s++) {
      expect(stopwatchRead.generate(s, 1, {}).params.seconds % 5).toBe(0);
      expect(stopwatchRead.generate(s, 2, {}).params.labelStep).toBe(15);
      expect(stopwatchRead.generate(s, 3, {}).params.seconds % 5).not.toBe(0);
    }
  });
  it("reading the clock numeral (25 s -> 5) is a counting error", () => {
    const item = withParams(stopwatchRead.generate(1, 1, {}), { seconds: 25 });
    expect(stopwatchRead.check(item, 25).correct).toBe(true);
    expect(stopwatchRead.check(item, 5).errors[0]!.errorType).toBe("counting_error");
  });
});

describe("time-convert (p.25)", () => {
  const base = timeConvert.generate(1, 1, { maxMinutes: 3 });
  it("1 minute = 60 s; half a minute = 30 s; 3 tallies = 3 minutes", () => {
    expect(timeConvert.check(withParams(base, { kind: "minute-seconds" } as never), 60).correct).toBe(true);
    expect(timeConvert.check(withParams(base, { kind: "minute-seconds" } as never), 100).errors[0]!.errorType).toBe("unit_confusion");
    expect(timeConvert.check(withParams(base, { kind: "half-seconds" } as never), 30).correct).toBe(true);
    const tally = withParams(base, { kind: "tally", tallies: 3 } as never);
    expect(timeConvert.check(tally, 3).correct).toBe(true);
    expect(timeConvert.check(tally, 180).errors[0]!.errorType).toBe("unit_confusion");
  });
  it("tallies never exceed maxMinutes; level 3 compares a named duration with seconds", () => {
    let longer = 0;
    for (let s = 1; s <= 300; s++) {
      const p = timeConvert.generate(s, 2, { maxMinutes: 3 }).params;
      if (p.kind === "tally") expect(p.tallies).toBeLessThanOrEqual(3);
      const q = timeConvert.generate(s, 3, { maxMinutes: 3 });
      if (q.params.kind === "longer") {
        longer++;
        const sol = timeConvert.solution(q);
        const { a, b } = q.params;
        expect(sol).toBe(a > b ? "a" : "b");
      }
    }
    expect(longer).toBeGreaterThan(50);
  });
});

describe("scale-read (p.28)", () => {
  const cfg = { max: 1000, tick: 100 };
  it("level 1 on numbered 100 g marks, level 2 on 50 g marks, level 3 with numbers every 200 g", () => {
    for (let s = 1; s <= 200; s++) {
      expect(scaleRead.generate(s, 1, cfg).params.value % 100).toBe(0);
      expect(scaleRead.generate(s, 2, cfg).params.value % 100).toBe(50);
      const p3 = scaleRead.generate(s, 3, cfg).params;
      expect(p3.labelStep).toBe(200);
      expect(p3.value % 200).not.toBe(0);
    }
  });
  it("0 and 1000 share the top mark, so the pointer never rests there", () => {
    for (const d of [1, 2, 3] as const)
      for (let s = 1; s <= 300; s++) {
        const v = scaleRead.generate(s, d, cfg).params.value;
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThan(1000);
      }
  });
  it("one small mark off is a counting error", () => {
    const item = withParams(scaleRead.generate(1, 2, cfg), { value: 350 });
    expect(scaleRead.check(item, 350).correct).toBe(true);
    expect(scaleRead.check(item, 300).errors[0]!.errorType).toBe("counting_error");
    expect(scaleRead.check(item, "٣٥٠").errors[0]!.errorType).toBe("input_invalid");
  });
});
