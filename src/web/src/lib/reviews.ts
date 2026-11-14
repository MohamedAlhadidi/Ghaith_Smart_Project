/**
 * Human content-review decisions, recorded on the reviewer's device and exported as
 * a JSON file. The app never marks content approved by itself: the repository's
 * lesson catalogue changes only when a human-produced export is applied.
 */
export type ReviewStatus = "approved" | "needs_changes";

export interface ReviewDecision {
  status: ReviewStatus;
  note: string;
  reviewer: string;
  at: string; // ISO time
}

/** decisions[lessonId][gameId | "_lesson"] */
export type ReviewBook = Record<string, Record<string, ReviewDecision>>;

const KEY = "ghaith.reviews.v1";

export function loadReviews(storage: Storage | undefined = safe()): ReviewBook {
  if (!storage) return {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as ReviewBook) : {};
  } catch {
    return {};
  }
}

export function saveDecision(lessonId: string, targetId: string, decision: ReviewDecision, storage: Storage | undefined = safe()): ReviewBook {
  if (!decision.reviewer.trim()) throw new Error("reviewer name is required");
  if (decision.status === "needs_changes" && !decision.note.trim()) throw new Error("a note is required when changes are needed");
  const book = loadReviews(storage);
  book[lessonId] = { ...(book[lessonId] ?? {}), [targetId]: decision };
  try {
    storage?.setItem(KEY, JSON.stringify(book));
  } catch {
    // storage blocked: the export still contains the in-memory book
  }
  return book;
}

/** Lesson status: approved only when the lesson itself and every game are approved. */
export function lessonReviewStatus(book: ReviewBook, lessonId: string, gameIds: string[]): "not_reviewed" | "partial" | "needs_changes" | "approved" {
  const d = book[lessonId] ?? {};
  const targets = ["_lesson", ...gameIds];
  const decided = targets.filter((t) => d[t]);
  if (decided.some((t) => d[t]!.status === "needs_changes")) return "needs_changes";
  if (decided.length === 0) return "not_reviewed";
  return decided.length === targets.length ? "approved" : "partial";
}

export function exportReviews(book: ReviewBook): string {
  return JSON.stringify({ schema: "ghaith-content-review/1", exported_at: new Date().toISOString(), decisions: book }, null, 2);
}

function safe(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
