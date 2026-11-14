/**
 * Computes the density/coverage metrics required by the game policy and writes
 * reports/math_s1_coverage.json. Metrics are kept separate on purpose:
 *  - activity_rounds_count: playable (game, level) rounds per lesson
 *  - distinct_mechanics_count: unique mechanics (not skins/colours) per lesson and unit
 *  - objective_coverage_percent: skills with at least one playable game
 * Approval is reported separately and is 0 until a human reviews content.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mathCatalog from "../../../../../content/curriculum/math/s1/lessons.json";
import englishCatalog from "../../../../../content/curriculum/english/s1/lessons.json";
import { LEGACY_MECHANICS, QUIZ_MECHANICS } from "../../src/math/registry";

const here = dirname(fileURLToPath(import.meta.url));
const reports = resolve(here, "../../../../../reports");
const playable = (m: string) => (LEGACY_MECHANICS as readonly string[]).includes(m) || QUIZ_MECHANICS.has(m);
const levelsOf = (m: string) => ((LEGACY_MECHANICS as readonly string[]).includes(m) ? 3 : QUIZ_MECHANICS.get(m)?.difficulties.length ?? 0);

interface AnyCatalog {
  units: Array<{ unit_id: string; title: string }>;
  lessons: Array<{ lesson_id: string; lesson_name: string; unit_id: string; source: Record<string, unknown>; skills: Array<{ id: string }>; games: Array<{ mechanic: string; skill_id: string }>; content_review_status: string }>;
}

function report(catalog: AnyCatalog, file: string) {
  {
    const lessons = catalog.lessons.map((l) => {
      const games = l.games.filter((g) => playable(g.mechanic));
      const skills = l.skills.map((s) => s.id);
      const covered = skills.filter((s) => games.some((g) => g.skill_id === s));
      return {
        lesson_id: l.lesson_id,
        lesson_name: l.lesson_name,
        unit_id: l.unit_id,
        printed_page: (l.source.source_printed_page as number | undefined) ?? (l.source.source_printed_pages as number[])[0],
        games_defined: l.games.length,
        games_playable: games.length,
        activity_rounds_count: games.reduce((n, g) => n + levelsOf(g.mechanic), 0),
        distinct_mechanics_count: new Set(games.map((g) => g.mechanic)).size,
        skills: skills.length,
        skills_with_games: covered.length,
        objective_coverage_percent: Math.round((100 * covered.length) / Math.max(1, skills.length)),
        approved: l.content_review_status === "approved",
      };
    });
    const units = catalog.units.map((u) => {
      const ls = catalog.lessons.filter((l) => l.unit_id === u.unit_id);
      const mech = new Set(ls.flatMap((l) => l.games.filter((g) => playable(g.mechanic)).map((g) => g.mechanic)));
      return { unit_id: u.unit_id, title: u.title, lessons: ls.length, distinct_mechanics_count: mech.size };
    });
    const totals = {
      lessons: lessons.length,
      lessons_with_playable_games: lessons.filter((l) => l.games_playable > 0).length,
      games_defined: lessons.reduce((n, l) => n + l.games_defined, 0),
      games_playable: lessons.reduce((n, l) => n + l.games_playable, 0),
      activity_rounds_count: lessons.reduce((n, l) => n + l.activity_rounds_count, 0),
      mechanics_implemented: new Set(catalog.lessons.flatMap((l) => l.games.map((g) => g.mechanic)).filter(playable)).size,
      mechanics_defined: new Set(catalog.lessons.flatMap((l) => l.games.map((g) => g.mechanic))).size,
      objective_coverage_percent: Math.round(
        (100 * lessons.reduce((n, l) => n + l.skills_with_games, 0)) / lessons.reduce((n, l) => n + l.skills, 0),
      ),
      lessons_approved: lessons.filter((l) => l.approved).length,
    };
    mkdirSync(reports, { recursive: true });
    writeFileSync(resolve(reports, file), JSON.stringify({ generated_at: new Date().toISOString(), totals, units, lessons }, null, 2) + "\n");
    return totals;
  }
}

describe("coverage reports", () => {
  it("math S1", () => expect(report(mathCatalog as unknown as AnyCatalog, "math_s1_coverage.json").lessons).toBe(40));
  it("English S1", () => expect(report(englishCatalog as unknown as AnyCatalog, "english_s1_coverage.json").lessons).toBe(52));
});
