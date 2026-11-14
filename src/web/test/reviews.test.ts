import { describe, expect, it } from "vitest";
import { exportReviews, lessonReviewStatus, loadReviews, saveDecision } from "../src/lib/reviews";

class Mem implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}
const d = (status: "approved" | "needs_changes", note = "") => ({ status, note, reviewer: "ولي الأمر", at: "2026-11-14T10:00:00Z" });

describe("content review decisions", () => {
  it("requires a reviewer name and a note for changes", () => {
    const s = new Mem();
    expect(() => saveDecision("L", "_lesson", { ...d("approved"), reviewer: " " }, s)).toThrow();
    expect(() => saveDecision("L", "G1", d("needs_changes"), s)).toThrow();
    expect(loadReviews(s)).toEqual({});
  });
  it("a lesson is approved only when the lesson and every game are approved", () => {
    const s = new Mem();
    expect(lessonReviewStatus(loadReviews(s), "L", ["G1", "G2"])).toBe("not_reviewed");
    saveDecision("L", "_lesson", d("approved"), s);
    saveDecision("L", "G1", d("approved"), s);
    expect(lessonReviewStatus(loadReviews(s), "L", ["G1", "G2"])).toBe("partial");
    saveDecision("L", "G2", d("approved"), s);
    expect(lessonReviewStatus(loadReviews(s), "L", ["G1", "G2"])).toBe("approved");
    saveDecision("L", "G2", d("needs_changes", "الأعداد كبيرة"), s);
    expect(lessonReviewStatus(loadReviews(s), "L", ["G1", "G2"])).toBe("needs_changes");
  });
  it("exports a versioned file with the decisions", () => {
    const s = new Mem();
    saveDecision("L", "_lesson", d("approved"), s);
    const out = JSON.parse(exportReviews(loadReviews(s)));
    expect(out.schema).toBe("ghaith-content-review/1");
    expect(out.decisions.L._lesson.reviewer).toBe("ولي الأمر");
  });
  it("survives corrupted storage", () => {
    const s = new Mem();
    s.setItem("ghaith.reviews.v1", "{bad");
    expect(loadReviews(s)).toEqual({});
  });
});
