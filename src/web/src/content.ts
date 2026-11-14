import lesson from "../../../content/games/math/s1/MATH-S1-U1A-L01.json";

export interface GameDefinition {
  game_id: string;
  title: string;
  skill_id: string;
  game_mechanic_id: "grid-fragment-fill" | "grid-locate" | "grid-path-move";
  item_generator_id: string;
  generator_version: number;
  feedback_correct: string;
  feedback_wrong: string;
  hint_levels: string[];
  content_review_status: string;
}

export interface LessonDefinition {
  lesson_id: string;
  lesson_name: string;
  source: { source_book_id: string; source_printed_page: number; source_pdf_page: number; core_activity: string };
  content_review_status: string;
  games: GameDefinition[];
}

export const LESSON_L01 = lesson as LessonDefinition;
