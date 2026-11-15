import mathJson from "../../../content/curriculum/math/s1/lessons.json";
import englishJson from "../../../content/curriculum/english/s1/lessons.json";
import wordbankJson from "../../../content/curriculum/english/s1/wordbank.json";
import { LEGACY_MECHANICS, QUIZ_MECHANICS } from "@ghaith/game-core";

export type SubjectId = "math" | "english" | "arabic";

export interface CatalogGame {
  game_id: string;
  title: string;
  /** Arabic title for English games. */
  title_ar?: string;
  skill_id: string;
  mechanic: string;
  config: Record<string, unknown>;
  hint_levels: string[];
}

export interface CatalogLesson {
  subject: SubjectId;
  lesson_id: string;
  lesson_name: string;
  lesson_name_ar?: string;
  unit_id: string;
  source: {
    source_book_id: string;
    source_printed_page: number;
    source_printed_pages: number[];
    source_pdf_page: number;
    core_activity: string;
    core_activity_title: string;
  };
  objectives: string[];
  vocabulary: Array<{ term: string; meaning: string }>;
  skills: Array<{ id: string; text: string }>;
  book_tasks: string[];
  games: CatalogGame[];
  interpretation_notes: string;
  content_review_status: string;
  /** Arabic: section kind (reading_lesson, poem, axis_review…). */
  kind?: string;
  /** Book exercises without a game, with the reason (shown to the parent). */
  not_gamed?: Array<{ page: number; what: string; reason: string }>;
}

export interface CatalogUnit {
  unit_id: string;
  title: string;
  title_ar?: string;
  subject: SubjectId;
}

export interface SubjectCatalog {
  id: SubjectId;
  title: string;
  subtitle: string;
  units: CatalogUnit[];
  lessons: CatalogLesson[];
}

type RawMath = { units: Array<{ unit_id: string; title: string }>; lessons: Array<Omit<CatalogLesson, "subject" | "source"> & { source: { source_book_id: string; source_printed_page: number; source_pdf_page: number; core_activity: string; core_activity_title: string } }> };
type RawEnglish = {
  units: Array<{ unit_id: string; title: string; title_ar: string }>;
  lessons: Array<{
    lesson_id: string; unit_id: string; lesson_name: string; lesson_name_ar: string;
    source: { source_book_id: string; source_printed_pages: number[]; source_pdf_pages: number[] };
    objectives: string[]; skills: Array<{ id: string; text: string }>; words: string[]; sentences: string[];
    games: CatalogGame[]; interpretation_notes: string; content_review_status: string;
  }>;
};

const WORDBANK = (wordbankJson as { words: Record<string, { ar: string }> }).words;
const BOOK_NAMES: Record<string, string> = {
  "ENG-S1-CB": "Class Book",
  "ENG-S1-AB": "Activity Book",
  "ENG-S1-SS": "Sounds and Spelling",
  "ARB-S1-P1": "أحب لغتي ج١",
  "ARB-S1-P2": "أحب لغتي ج٢",
};
export const bookName = (id: string) => BOOK_NAMES[id] ?? "كتاب الطالب";

const rawMath = mathJson as unknown as RawMath;
const rawEnglish = englishJson as unknown as RawEnglish;

export const MATH_S1: SubjectCatalog = {
  id: "math",
  title: "الرياضيات",
  subtitle: "الصف الثاني · الفصل الأول",
  units: rawMath.units.map((u) => ({ ...u, subject: "math" as const })),
  lessons: rawMath.lessons.map((l) => ({
    ...l,
    subject: "math" as const,
    source: { ...l.source, source_printed_pages: [l.source.source_printed_page] },
  })),
};

export const ENGLISH_S1: SubjectCatalog = {
  id: "english",
  title: "الإنجليزية",
  subtitle: "Team Together 2A · الفصل الأول",
  units: rawEnglish.units.map((u) => ({ ...u, subject: "english" as const })),
  lessons: rawEnglish.lessons.map((l) => ({
    subject: "english" as const,
    lesson_id: l.lesson_id,
    lesson_name: l.lesson_name,
    lesson_name_ar: l.lesson_name_ar,
    unit_id: l.unit_id,
    source: {
      source_book_id: l.source.source_book_id,
      source_printed_page: l.source.source_printed_pages[0]!,
      source_printed_pages: l.source.source_printed_pages,
      source_pdf_page: l.source.source_pdf_pages[0]!,
      core_activity: "none_printed",
      core_activity_title: "",
    },
    objectives: l.objectives,
    vocabulary: l.words.map((w) => ({ term: w, meaning: WORDBANK[w]?.ar ?? "" })),
    skills: l.skills,
    book_tasks: l.sentences,
    games: l.games,
    interpretation_notes: l.interpretation_notes,
    content_review_status: l.content_review_status,
  })),
};

type RawArabic = { units: Array<{ unit_id: string; title: string }>; lessons: Array<Omit<CatalogLesson, "subject">> };
/**
 * The Arabic catalogue holds book text (full poems) and is kept out of the public repository
 * until the owner approves; when the file is absent the Arabic subject is simply not shown.
 */
const arabicFiles = import.meta.glob("../../../content/curriculum/arabic/s1/lessons.json", { eager: true, import: "default" });
const rawArabic = (Object.values(arabicFiles)[0] as RawArabic | undefined) ?? { units: [], lessons: [] };

export const ARABIC_S1: SubjectCatalog = {
  id: "arabic",
  title: "العربية",
  subtitle: "أحب لغتي · الفصل الأول",
  units: rawArabic.units.map((u) => ({ unit_id: u.unit_id, title: u.title, subject: "arabic" as const })),
  lessons: rawArabic.lessons.map((l) => ({ ...l, subject: "arabic" as const })),
};

export const SUBJECTS: SubjectCatalog[] = [MATH_S1, ENGLISH_S1, ...(ARABIC_S1.lessons.length ? [ARABIC_S1] : [])];
const ALL_LESSONS = SUBJECTS.flatMap((s) => s.lessons);
const ALL_UNITS = SUBJECTS.flatMap((s) => s.units);

export const isLegacyGame = (g: CatalogGame) => (LEGACY_MECHANICS as readonly string[]).includes(g.mechanic);
/** A game is playable when its engine exists (legacy hundred-square or a registered quiz mechanic). */
export const isPlayable = (g: CatalogGame) => isLegacyGame(g) || QUIZ_MECHANICS.has(g.mechanic);

export const subjectOf = (id: SubjectId) => SUBJECTS.find((s) => s.id === id)!;
export const findUnit = (unitId: string) => ALL_UNITS.find((u) => u.unit_id === unitId);
export const lessonsOfUnit = (unitId: string) => ALL_LESSONS.filter((l) => l.unit_id === unitId);
export const findLesson = (lessonId: string) => ALL_LESSONS.find((l) => l.lesson_id === lessonId);

export function skillName(skillId: string): string {
  for (const l of ALL_LESSONS) {
    const s = l.skills.find((x) => x.id === skillId);
    if (s) return s.text;
  }
  return skillId;
}

/** Games of a skill that run in the generic quiz player (used by missions and review). */
export function quizGamesForSkill(skillId: string): Array<{ lesson: CatalogLesson; game: CatalogGame }> {
  return ALL_LESSONS.flatMap((lesson) =>
    lesson.games.filter((g) => g.skill_id === skillId && !isLegacyGame(g) && QUIZ_MECHANICS.has(g.mechanic)).map((game) => ({ lesson, game })),
  );
}

/** Page reference text, e.g. «Class Book ص ١٧–١٨». */
export function pagesLabel(l: CatalogLesson): string {
  const p = l.source.source_printed_pages;
  return p.length > 1 ? `${p[0]}–${p[p.length - 1]}` : `${p[0]}`;
}
