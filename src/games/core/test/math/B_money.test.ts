import { describe, expect, it } from "vitest";
import catalog from "../../../../../content/curriculum/math/s1/lessons.json";
import type { QuizItem, QuizMechanic } from "../../src/quiz";
import { MONEY_MECHANICS, moneyBaisa, moneyChange, moneyNote, moneyTotal, RIAL_NOTES } from "../../src/math/B_money";
import { rials } from "../../src/math/B_common";
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
    // Plain value cards only: no image assets in any money visual.
    expect(JSON.stringify(item.visual)).not.toMatch(/\.(png|jpe?g|svg|webp)|https?:/i);
  };
}
function withParams<P>(item: QuizItem<P>, params: Partial<P>): QuizItem<P> {
  return { ...item, params: { ...item.params, ...params } };
}

describe("all money mechanics: 1000 seeds × 3 levels for every lessons.json config", () => {
  for (const mech of MONEY_MECHANICS) {
    for (const config of configsFor(mech.mechanicId)) {
      it(`${mech.mechanicId} ${JSON.stringify(config)}`, () => exerciseMechanic(mech, config, 1000, common(mech)));
    }
  }
});

describe("money (p.30)", () => {
  it("rial wording follows the book: 1-2 ريال, 3-10 ريالات, 11+ ريالًا", () => {
    expect(rials(1)).toBe("1 ريال");
    expect(rials(2)).toBe("2 ريال");
    expect(rials(5)).toBe("5 ريالات");
    expect(rials(20)).toBe("20 ريالًا");
  });
  it("book basket: sandwich 1 + book 2 + shoes 5 = 8; forgetting an item is a partial answer", () => {
    const item = withParams(moneyTotal.generate(1, 2, { maxPrice: 10 }), {
      items: [{ name: "شطيرة", price: 1 }, { name: "كتاب", price: 2 }, { name: "حذاء", price: 5 }],
    });
    expect(moneyTotal.check(item, 8).correct).toBe(true);
    expect(moneyTotal.check(item, 3).errors[0]!.errorType).toBe("partial_answer");
  });
  it("level 1 totals stay within 10 rials with two items; level 3 has three items", () => {
    for (let s = 1; s <= 200; s++) {
      const p1 = moneyTotal.generate(s, 1, { maxPrice: 10 }).params;
      expect(p1.items.length).toBe(2);
      expect(p1.items.reduce((a, i) => a + i.price, 0)).toBeLessThanOrEqual(10);
      expect(moneyTotal.generate(s, 3, { maxPrice: 10 }).params.items.length).toBe(3);
      for (const i of moneyTotal.generate(s, 3, { maxPrice: 10 }).params.items) expect(i.price).toBeLessThanOrEqual(10);
    }
  });
  it("book change: pay 10 rials for 7 -> 3; adding is an operation confusion", () => {
    const item = withParams(moneyChange.generate(1, 1, { notes: [5, 10, 20] }), { note: 10, items: [{ name: "كتاب", price: 7 }] });
    expect(moneyChange.check(item, 3).correct).toBe(true);
    expect(moneyChange.check(item, 17).errors[0]!.errorType).toBe("operation_confusion");
  });
  it("book note: items 2 rials, change 3 -> the 5-rial note; exactly one offered note works", () => {
    const item = moneyNote.generate(1, 1, { notes: [1, 5, 10, 20, 50] });
    const book = withParams(item, { items: [{ name: "كتاب", price: 2 }], change: 3, offered: [1, 5, 10] });
    const fixed = { ...book, input: { type: "choice" as const, options: [1, 5, 10].map((v) => ({ id: `n${v}`, label: rials(v) })) } };
    expect(moneyNote.check(fixed, "n5").correct).toBe(true);
    expect(moneyNote.check(fixed, "n10").correct).toBe(false);
    expect(moneyNote.checkIntegrity(fixed)).toEqual([]);
    for (let s = 1; s <= 300; s++) {
      const it3 = moneyNote.generate(s, 3, { notes: [1, 5, 10, 20, 50] });
      const paid = it3.params.items.reduce((a, i) => a + i.price, 0) + it3.params.change;
      expect((RIAL_NOTES as readonly number[]).includes(paid)).toBe(true);
    }
  });
  it("baisa: two 500-baisa in one rial; 6 halves -> 3 rials; answering in rials is a unit confusion", () => {
    const base = moneyBaisa.generate(1, 1, { maxRials: 5 });
    const one = withParams(base, { kind: "halves-in-rials", rials: 1, extraHalf: false } as never);
    expect(moneyBaisa.check({ ...one, input: { type: "number" } }, 2).correct).toBe(true);
    const three = withParams(base, { kind: "halves-in-rials", rials: 3, extraHalf: false } as never);
    expect(moneyBaisa.check({ ...three, input: { type: "number" } }, 3).errors[0]!.errorType).toBe("unit_confusion");
    const halves = withParams(base, { kind: "halves-to-rials", halves: 6 } as never);
    expect(moneyBaisa.check({ ...halves, input: { type: "number" } }, 3).correct).toBe(true);
    expect(moneyBaisa.check({ ...halves, input: { type: "number" } }, 12).errors[0]!.errorType).toBe("operation_confusion");
  });
  it("rejects an unknown note value", () => {
    expect(moneyChange.validateConfig({ notes: [5, 7] }).length).toBeGreaterThan(0);
  });
});
