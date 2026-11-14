import type { Attempt } from "./progress";

const DAY = 24 * 60 * 60 * 1000;
/** Spacing ladder in days after each successful practice day (draft, adjustable). */
export const REVIEW_LADDER = [1, 3, 7, 14, 30] as const;

export interface ReviewState {
  skillId: string;
  lessonId: string;
  dueAt: number;
  successfulDays: number;
  lastAccuracy: number;
}

/**
 * Spaced review from attempt history (pure, deterministic):
 * - group first tries by skill and calendar day (local date of the attempt);
 * - a day is "successful" if independent first-try accuracy ≥ 80% with ≥ 3 items;
 * - next review = last practice day + ladder[successfulDays-1] days
 *   (or 1 day if the last day was not successful).
 * Assessment attempts count as practice evidence too.
 */
export function reviewSchedule(attempts: Attempt[]): ReviewState[] {
  const bySkill = new Map<string, Attempt[]>();
  for (const a of attempts) if (a.tryNumber === 1) bySkill.set(a.skillId, [...(bySkill.get(a.skillId) ?? []), a]);
  const out: ReviewState[] = [];
  for (const [skillId, list] of bySkill) {
    const days = new Map<string, Attempt[]>();
    for (const a of list) {
      const key = a.at.slice(0, 10);
      days.set(key, [...(days.get(key) ?? []), a]);
    }
    const ordered = [...days.entries()].sort(([x], [y]) => (x < y ? -1 : 1));
    let successfulDays = 0;
    let lastAccuracy = 0;
    for (const [, items] of ordered) {
      const good = items.filter((a) => a.correct && a.hintsUsed === 0).length;
      lastAccuracy = good / items.length;
      if (items.length >= 3 && lastAccuracy >= 0.8) successfulDays++;
    }
    const [lastDay] = ordered[ordered.length - 1]!;
    const lastSuccessful = lastAccuracy >= 0.8 && ordered[ordered.length - 1]![1].length >= 3;
    const gap = lastSuccessful ? REVIEW_LADDER[Math.min(successfulDays, REVIEW_LADDER.length) - 1]! : 1;
    out.push({
      skillId,
      lessonId: list[list.length - 1]!.lessonId,
      dueAt: Date.parse(`${lastDay}T00:00:00Z`) + gap * DAY,
      successfulDays,
      lastAccuracy,
    });
  }
  return out.sort((a, b) => a.dueAt - b.dueAt);
}

export function dueForReview(attempts: Attempt[], now: number, limit = 3): ReviewState[] {
  return reviewSchedule(attempts)
    .filter((s) => s.dueAt <= now)
    .slice(0, limit);
}
