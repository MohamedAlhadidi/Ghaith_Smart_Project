import catalogJson from "../../../content/curriculum/math/s1/lessons.json";
import { LEGACY_MECHANICS, QUIZ_MECHANICS } from "@ghaith/game-core";

export interface CatalogGame {
  game_id: string;
  title: string;
  skill_id: string;
  mechanic: string;
  config: Record<string, unknown>;
  hint_levels: string[];
}

export interface CatalogLesson {
  lesson_id: string;
  lesson_name: string;
  unit_id: string;
  source: { source_book_id: string; source_printed_page: number; source_pdf_page: number; core_activity: string; core_activity_title: string };
  objectives: string[];
  vocabulary: Array<{ term: string; meaning: string }>;
  skills: Array<{ id: string; text: string }>;
  book_tasks: string[];
  games: CatalogGame[];
  interpretation_notes: string;
  content_review_status: string;
}

export interface CatalogUnit {
  unit_id: string;
  title: string;
}

export const MATH_S1 = catalogJson as unknown as { units: CatalogUnit[]; lessons: CatalogLesson[] };

export const isLegacyGame = (g: CatalogGame) => (LEGACY_MECHANICS as readonly string[]).includes(g.mechanic);
/** A game is playable when its engine exists (legacy hundred-square or a registered quiz mechanic). */
export const isPlayable = (g: CatalogGame) => isLegacyGame(g) || QUIZ_MECHANICS.has(g.mechanic);

export function lessonsOfUnit(unitId: string): CatalogLesson[] {
  return MATH_S1.lessons.filter((l) => l.unit_id === unitId);
}

export function findLesson(lessonId: string): CatalogLesson | undefined {
  return MATH_S1.lessons.find((l) => l.lesson_id === lessonId);
}

export function skillName(skillId: string): string {
  for (const l of MATH_S1.lessons) {
    const s = l.skills.find((x) => x.id === skillId);
    if (s) return s.text;
  }
  return skillId;
}

/** Games of a skill that run in the generic quiz player (used by missions and review). */
export function quizGamesForSkill(skillId: string): Array<{ lesson: CatalogLesson; game: CatalogGame }> {
  return MATH_S1.lessons.flatMap((lesson) =>
    lesson.games.filter((g) => g.skill_id === skillId && !isLegacyGame(g) && QUIZ_MECHANICS.has(g.mechanic)).map((game) => ({ lesson, game })),
  );
}
