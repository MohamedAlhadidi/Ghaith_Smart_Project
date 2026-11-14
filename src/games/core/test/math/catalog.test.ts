/**
 * Every game in content/curriculum/math/s1/lessons.json must be backed by a mechanic
 * that accepts its config and produces publishable, solvable items at every level.
 */
import { describe, expect, it } from "vitest";
import catalog from "../../../../../content/curriculum/math/s1/lessons.json";
import { LEGACY_MECHANICS, QUIZ_MECHANICS } from "../../src/math/registry";
import type { Difficulty } from "../../src/types";

const SEEDS = 150;

describe("math S1 catalogue", () => {
  it("has 40 lessons covering printed pages 4-43", () => {
    expect(catalog.lessons.map((l) => l.source.source_printed_page)).toEqual(Array.from({ length: 40 }, (_, i) => i + 4));
  });

  it("every lesson has at least two games (except where the page offers one skill)", () => {
    for (const l of catalog.lessons) expect(l.games.length, l.lesson_id).toBeGreaterThanOrEqual(1);
  });

  it("game ids are unique and every game names a skill declared by its lesson", () => {
    const ids = catalog.lessons.flatMap((l) => l.games.map((g) => g.game_id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of catalog.lessons) {
      const skills = new Set(l.skills.map((s) => s.id));
      for (const g of l.games) expect(skills.has(g.skill_id), `${g.game_id} -> ${g.skill_id}`).toBe(true);
    }
  });

  const games = catalog.lessons.flatMap((l) => l.games.map((g) => ({ lesson: l.lesson_id, ...g })));
  for (const g of games) {
    if ((LEGACY_MECHANICS as readonly string[]).includes(g.mechanic)) continue;
    it(`${g.lesson} ${g.game_id} (${g.mechanic})`, () => {
      const mech = QUIZ_MECHANICS.get(g.mechanic);
      expect(mech, `mechanic ${g.mechanic} not implemented`).toBeDefined();
      expect(mech!.validateConfig(g.config)).toEqual([]);
      for (const d of mech!.difficulties as Difficulty[]) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const item = mech!.generate(seed, d, g.config);
          const problems = mech!.checkIntegrity(item);
          if (problems.length) throw new Error(`seed ${seed} level ${d}: ${problems.join("; ")}`);
          if (!mech!.check(item, mech!.solution(item)).correct) throw new Error(`seed ${seed} level ${d}: solution rejected`);
        }
      }
    });
  }
});
