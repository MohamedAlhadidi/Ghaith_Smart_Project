/**
 * Every English lessons.json game that uses an executor-C mechanic: 1000 seeds × 3 levels with the
 * exact catalogue config (integrity, solution accepted, null rejected, explain, determinism).
 */
import { describe, expect, it } from "vitest";
import catalog from "../../../../../content/curriculum/english/s1/lessons.json";
import { MECHANICS_C } from "../../src/english/registryC";
import { exerciseMechanic } from "../math/harness";

const byId = new Map(MECHANICS_C.map((m) => [m.mechanicId, m]));
const games = catalog.lessons.flatMap((l) => l.games.map((g) => ({ lesson: l.lesson_id, id: g.game_id, mechanic: g.mechanic, config: g.config as unknown })));
const mine = games.filter((g) => byId.has(g.mechanic));

/** Visual types rendered by src/web/src/quiz/visuals/registryC.tsx (VISUALS_C). */
export const C_VISUAL_TYPES = ["en-c-word", "en-c-scene", "en-c-match", "en-c-tiles", "en-c-sound", "en-c-command"];

describe("executor C mechanics × English catalogue configs", () => {
  it("registers 22 distinct mechanics", () => {
    expect(MECHANICS_C.length).toBe(22);
    expect(byId.size).toBe(22);
  });

  it("every C mechanic is used by at least one catalogue game", () => {
    const used = new Set(mine.map((g) => g.mechanic));
    expect([...byId.keys()].filter((id) => !used.has(id))).toEqual([]);
  });

  for (const g of mine) {
    it(`${g.lesson} ${g.id} (${g.mechanic}) 1000 seeds × 3 levels`, () => exerciseMechanic(byId.get(g.mechanic)!, g.config, 1000));
  }

  it("items are English (lang en + Arabic helper) with a known visual type", () => {
    for (const g of mine) {
      const mech = byId.get(g.mechanic)!;
      for (const d of [1, 2, 3] as const)
        for (let seed = 1; seed <= 60; seed++) {
          const item = mech.generate(seed, d, g.config);
          expect(item.lang, g.id).toBe("en");
          expect(item.promptAr, g.id).toBeTruthy();
          expect(/[؀-ۿ]/.test(item.prompt), `${g.id} English prompt`).toBe(false);
          expect(C_VISUAL_TYPES, g.id).toContain(item.visual.type);
        }
    }
  });

  it("explanations are 2-3 steps with Western digits only", () => {
    for (const g of mine) {
      const mech = byId.get(g.mechanic)!;
      for (const d of [1, 2, 3] as const)
        for (let seed = 1; seed <= 40; seed++) {
          const item = mech.generate(seed, d, g.config);
          const steps = mech.explain(item);
          expect(steps.length, `${g.mechanic} ${seed}`).toBeGreaterThanOrEqual(2);
          expect(steps.length, `${g.mechanic} ${seed}`).toBeLessThanOrEqual(3);
          const text = steps.join(" ") + item.prompt + JSON.stringify(item.input);
          expect(/[٠-٩]/.test(text), `${g.mechanic} uses Western digits`).toBe(false);
        }
    }
  });

  it("levels really differ (option count, item size or support) for every catalogue game", () => {
    const size = (item: ReturnType<(typeof MECHANICS_C)[number]["generate"]>) => {
      const i = item.input;
      const n = i.type === "choice" || i.type === "multi" ? i.options.length : i.type === "order" ? i.items.length : ((item.visual.words as unknown[] | undefined)?.length ?? (item.visual.pictures as unknown[] | undefined)?.length ?? 0);
      return JSON.stringify({ n, v: item.visual, form: (item.params as { form?: string; mode?: string; blank?: string }).form ?? (item.params as { mode?: string }).mode });
    };
    for (const g of mine) {
      const mech = byId.get(g.mechanic)!;
      const profile = (d: 1 | 2 | 3) => {
        const s = new Set<string>();
        for (let seed = 1; seed <= 80; seed++) {
          const item = mech.generate(seed, d, g.config);
          s.add(size(item));
        }
        return s;
      };
      const [a, b, c] = [profile(1), profile(2), profile(3)];
      const same = (x: Set<string>, y: Set<string>) => x.size === y.size && [...x].every((v) => y.has(v));
      expect(same(a, c), `${g.id}: level 1 and 3 identical`).toBe(false);
      expect(same(a, b) && same(b, c), `${g.id}: all levels identical`).toBe(false);
    }
  });
});
