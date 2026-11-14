/**
 * Every game in content/curriculum/english/s1/lessons.json must be backed by a mechanic
 * that accepts its config and produces publishable, solvable English items at every level.
 */
import { describe, expect, it } from "vitest";
import catalog from "../../../../../content/curriculum/english/s1/lessons.json";
import { WORDS } from "../../src/english/common";
import { QUIZ_MECHANICS } from "../../src/math/registry";
import type { Difficulty } from "../../src/types";

const SEEDS = 150;

describe("English S1 catalogue", () => {
  it("has 52 lessons in 11 units", () => {
    expect(catalog.lessons.length).toBe(52);
    expect(catalog.units.length).toBe(11);
  });

  it("game ids are unique and every game names a skill declared by its lesson", () => {
    const ids = catalog.lessons.flatMap((l) => l.games.map((g) => g.game_id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of catalog.lessons) {
      const skills = new Set(l.skills.map((s) => s.id));
      for (const g of l.games) expect(skills.has(g.skill_id), `${g.game_id} -> ${g.skill_id}`).toBe(true);
    }
  });

  it("every lesson word is in the word bank", () => {
    for (const l of catalog.lessons) for (const w of l.words) expect(WORDS[w], `${l.lesson_id}: ${w}`).toBeDefined();
  });

  const games = catalog.lessons.flatMap((l) => l.games.map((g) => ({ lesson: l.lesson_id, ...g })));
  for (const g of games) {
    it(`${g.lesson} ${g.game_id} (${g.mechanic})`, () => {
      const mech = QUIZ_MECHANICS.get(g.mechanic);
      expect(mech, `mechanic ${g.mechanic} not implemented`).toBeDefined();
      expect(mech!.validateConfig(g.config as never)).toEqual([]);
      for (const d of mech!.difficulties as Difficulty[]) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const item = mech!.generate(seed, d, g.config as never);
          expect(item.lang).toBe("en");
          const problems = mech!.checkIntegrity(item);
          if (problems.length) throw new Error(`seed ${seed} level ${d}: ${problems.join("; ")}`);
          if (!mech!.check(item, mech!.solution(item)).correct) throw new Error(`seed ${seed} level ${d}: solution rejected`);
        }
      }
    });
  }
});
