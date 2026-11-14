/**
 * Every lessons.json game that uses an executor-A mechanic: 1000 seeds × 3 levels with the
 * exact catalogue config (integrity, solution accepted, null rejected, explain, determinism).
 */
import { describe, expect, it } from "vitest";
import catalog from "../../../../../content/curriculum/math/s1/lessons.json";
import { MECHANICS_A } from "../../src/math/registryA";
import { exerciseMechanic } from "./harness";

const byId = new Map(MECHANICS_A.map((m) => [m.mechanicId, m]));
const games = catalog.lessons.flatMap((l) => l.games.map((g) => ({ lesson: l.lesson_id, id: g.game_id, mechanic: g.mechanic, config: g.config as unknown })));
const mine = games.filter((g) => byId.has(g.mechanic));

describe("executor A mechanics × catalogue configs", () => {
  it("registers 28 distinct mechanics", () => {
    expect(MECHANICS_A.length).toBe(28);
    expect(byId.size).toBe(28);
  });

  it("every A mechanic is used by at least one catalogue game", () => {
    const used = new Set(mine.map((g) => g.mechanic));
    expect([...byId.keys()].filter((id) => !used.has(id))).toEqual([]);
  });

  for (const g of mine) {
    it(`${g.lesson} ${g.id} (${g.mechanic}) 1000 seeds × 3 levels`, () => exerciseMechanic(byId.get(g.mechanic)!, g.config, 1000));
  }

  it("every visual type is one the web renderers know (VISUALS_A in src/web or the core 'none')", () => {
    const known = new Set([
      "none",
      "hundredPattern",
      "decadeStrip",
      "decadeMidpoint",
      "scatterCount",
      "rangeBags",
      "tickLine",
      "roundLine",
      "digitGroup",
      "equivalenceMachine",
      "balancePans",
      "baseTenBlocks",
      "compareSentence",
      "digitSentence",
      "estimateDots",
      "oddOneOutCards",
      "sentenceCard",
      "loopCard",
      "differenceRows",
    ]);
    for (const g of mine) {
      const mech = byId.get(g.mechanic)!;
      for (const d of [1, 2, 3] as const)
        for (let seed = 1; seed <= 60; seed++) expect(known.has(mech.generate(seed, d, g.config).visual.type), g.mechanic).toBe(true);
    }
  });

  it("explanations are 2-4 steps with Western digits only", () => {
    for (const g of mine) {
      const mech = byId.get(g.mechanic)!;
      for (const d of [1, 2, 3] as const)
        for (let seed = 1; seed <= 40; seed++) {
          const item = mech.generate(seed, d, g.config);
          const steps = mech.explain(item);
          expect(steps.length, `${g.mechanic} ${seed}`).toBeGreaterThanOrEqual(2);
          expect(steps.length, `${g.mechanic} ${seed}`).toBeLessThanOrEqual(4);
          expect(/[٠-٩]/.test(steps.join(" ") + item.prompt), `${g.mechanic} uses logical Western digits`).toBe(false);
        }
    }
  });
});
