import { describe, expect, it } from "vitest";
import { dueForReview, reviewSchedule, REVIEW_LADDER } from "../src/lib/review";
import { fingerprintOf, type Attempt } from "../src/lib/progress";

const base: Attempt = {
  id: "x", at: "2026-11-10T08:00:00Z", sessionId: "s", lessonId: "L", gameId: "g", skillId: "SK", mechanicId: "m",
  generatorId: "G", generatorVersion: 1, seed: 1, difficulty: 1, tryNumber: 1, correct: true, errorTypes: [], hintsUsed: 0,
};
const day = (d: string, n: number, correct: number): Attempt[] =>
  Array.from({ length: n }, (_, i) => ({ ...base, id: `${d}-${i}`, at: `${d}T08:00:00Z`, correct: i < correct }));
const DAY = 86_400_000;

describe("spaced review", () => {
  it("a successful first day schedules review after 1 day", () => {
    const [s] = reviewSchedule(day("2026-11-10", 5, 5));
    expect(s!.successfulDays).toBe(1);
    expect(s!.dueAt).toBe(Date.parse("2026-11-10T00:00:00Z") + REVIEW_LADDER[0] * DAY);
  });
  it("spacing grows with successful days", () => {
    const [s] = reviewSchedule([...day("2026-11-10", 5, 5), ...day("2026-11-11", 4, 4)]);
    expect(s!.successfulDays).toBe(2);
    expect(s!.dueAt).toBe(Date.parse("2026-11-11T00:00:00Z") + REVIEW_LADDER[1] * DAY);
  });
  it("a weak day brings review back to tomorrow", () => {
    const [s] = reviewSchedule([...day("2026-11-10", 5, 5), ...day("2026-11-11", 5, 2)]);
    expect(s!.dueAt).toBe(Date.parse("2026-11-11T00:00:00Z") + DAY);
  });
  it("hinted or second-try answers do not count as independent", () => {
    const hinted = day("2026-11-10", 5, 5).map((a) => ({ ...a, hintsUsed: 1 }));
    expect(reviewSchedule(hinted)[0]!.successfulDays).toBe(0);
    const second = day("2026-11-10", 5, 5).map((a) => ({ ...a, tryNumber: 2 }));
    expect(reviewSchedule(second)).toEqual([]);
  });
  it("only due skills are returned, at most the limit", () => {
    const attempts = [...day("2026-11-10", 5, 5), ...day("2026-11-12", 5, 5).map((a) => ({ ...a, skillId: "SK2" }))];
    const now = Date.parse("2026-11-11T12:00:00Z");
    expect(dueForReview(attempts, now).map((s) => s.skillId)).toEqual(["SK"]);
    expect(dueForReview(attempts, now, 0)).toEqual([]);
  });
});

describe("fingerprint", () => {
  it("is stable and distinguishes different problems", () => {
    expect(fingerprintOf({ a: 1, b: [2, 3] })).toBe(fingerprintOf({ a: 1, b: [2, 3] }));
    expect(fingerprintOf({ a: 1 })).not.toBe(fingerprintOf({ a: 2 }));
  });
});
