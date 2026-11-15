/**
 * Every game in content/curriculum/arabic/s1/lessons.json must be backed by a mechanic that
 * accepts its config and produces publishable, solvable items at every level, and every
 * config entry must cite a printed page inside its lesson's page range.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { QUIZ_MECHANICS } from "../../src/math/registry";
import type { Difficulty } from "../../src/types";

// The catalogue holds book text and stays local until the owner approves publishing it
// (the repository is public); in a fresh clone this suite is skipped, not failed silently.
const file = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../content/curriculum/arabic/s1/lessons.json");
const present = existsSync(file);
const catalog = present ? JSON.parse(readFileSync(file, "utf8")) : { units: [], lessons: [] };

const SEEDS = 300;

interface Lesson {
  lesson_id: string;
  unit_id: string;
  source: { source_book_id: string; source_printed_pages: number[] };
  skills: Array<{ id: string }>;
  games: Array<{ game_id: string; mechanic: string; skill_id: string; config: Record<string, unknown>; hint_levels: string[] }>;
}
const lessons = (catalog as { lessons: Lesson[] }).lessons;

/** Every `page` value anywhere inside a config. */
function pagesIn(v: unknown): number[] {
  if (Array.isArray(v)) return v.flatMap(pagesIn);
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => (k === "page" && typeof x === "number" ? [x] : pagesIn(x)));
  return [];
}

describe.skipIf(!present)("Arabic S1 catalogue (local content)", () => {
  it("covers the two axes of semester 1 with their listed sections", () => {
    expect(catalog.units.map((u: { unit_id: string }) => u.unit_id)).toEqual(["ARB-S1-A1", "ARB-S1-A2"]);
    expect(lessons.length).toBe(15);
  });

  it("game ids are unique, every game names a skill of its lesson and has 2+ hints", () => {
    const ids = lessons.flatMap((l) => l.games.map((g) => g.game_id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of lessons) {
      const skills = new Set(l.skills.map((s) => s.id));
      for (const g of l.games) {
        expect(skills.has(g.skill_id), `${g.game_id} -> ${g.skill_id}`).toBe(true);
        expect(g.hint_levels.length, g.game_id).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("every config entry cites a printed page of its own book section", () => {
    for (const l of lessons) {
      const [lo, hi] = [Math.min(...l.source.source_printed_pages), Math.max(...l.source.source_printed_pages)];
      for (const g of l.games) {
        const pages = pagesIn(g.config);
        expect(pages.length, `${g.game_id}: no page cited`).toBeGreaterThan(0);
        for (const p of pages) expect(p >= lo && p <= hi, `${g.game_id}: page ${p} outside ${lo}–${hi}`).toBe(true);
      }
    }
  });

  const games = lessons.flatMap((l) => l.games.map((g) => ({ lesson: l.lesson_id, ...g })));
  for (const g of games) {
    it(`${g.lesson} ${g.game_id} (${g.mechanic})`, () => {
      const mech = QUIZ_MECHANICS.get(g.mechanic);
      expect(mech, `mechanic ${g.mechanic} not implemented`).toBeDefined();
      expect(g.mechanic.startsWith("ar-")).toBe(true);
      expect(mech!.validateConfig(g.config as never)).toEqual([]);
      for (const d of mech!.difficulties as Difficulty[]) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const item = mech!.generate(seed, d, g.config as never);
          expect(item.lang ?? "ar").toBe("ar");
          const problems = mech!.checkIntegrity(item);
          if (problems.length) throw new Error(`seed ${seed} level ${d}: ${problems.join("; ")}`);
          if (!mech!.check(item, mech!.solution(item)).correct) throw new Error(`seed ${seed} level ${d}: solution rejected`);
        }
      }
    });
  }
});
