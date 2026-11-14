import { describe, expect, it } from "vitest";
import { adapt } from "../src/lib/adapt";
import { parseNumberInput, toArabicDigits } from "../src/lib/digits";
import { loadAttempts, masteryStatus, saveAttempt, summariseBySkill, type Attempt } from "../src/lib/progress";
import { LESSON_L01 } from "../src/content";
import { fragmentFillGenerator, locateGenerator, pathMoveGenerator } from "@ghaith/game-core";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const attempt = (over: Partial<Attempt>): Attempt => ({
  id: "x",
  at: "2026-11-14T10:00:00Z",
  sessionId: "s1",
  lessonId: "MATH-S1-U1A-L01",
  gameId: "g",
  skillId: "SK-HSQ-NEIGHBOR",
  mechanicId: "grid-fragment-fill",
  generatorId: "GEN-HSQ-FRAGMENT",
  generatorVersion: 1,
  seed: 1,
  difficulty: 1,
  tryNumber: 1,
  correct: true,
  errorTypes: [],
  hintsUsed: 0,
  ...over,
});

describe("digits", () => {
  it("renders Arabic-Indic digits like the textbook", () => {
    expect(toArabicDigits(47)).toBe("٤٧");
  });
  it("parses Western, Arabic-Indic and extended digits", () => {
    expect(parseNumberInput("47")).toBe(47);
    expect(parseNumberInput("٤٧")).toBe(47);
    expect(parseNumberInput("۴۷")).toBe(47);
    expect(parseNumberInput(" ٤7 ")).toBe(47);
  });
  it("returns null for empty or non-number input", () => {
    expect(parseNumberInput("")).toBeNull();
    expect(parseNumberInput("4.5")).toBeNull();
    expect(parseNumberInput("abc")).toBeNull();
    expect(parseNumberInput("1234")).toBeNull();
  });
});

describe("adaptive difficulty", () => {
  it("moves up after two independent successes", () => {
    let s = adapt({ difficulty: 1, streak: 0 }, "independent");
    expect(s).toEqual({ difficulty: 1, streak: 1 });
    s = adapt(s, "independent");
    expect(s).toEqual({ difficulty: 2, streak: 0 });
  });
  it("help resets the streak, a miss moves down but never below 1", () => {
    expect(adapt({ difficulty: 2, streak: 1 }, "with_help")).toEqual({ difficulty: 2, streak: 0 });
    expect(adapt({ difficulty: 2, streak: 1 }, "missed")).toEqual({ difficulty: 1, streak: 0 });
    expect(adapt({ difficulty: 1, streak: 0 }, "missed")).toEqual({ difficulty: 1, streak: 0 });
  });
  it("caps at level 3", () => {
    expect(adapt({ difficulty: 3, streak: 1 }, "independent")).toEqual({ difficulty: 3, streak: 2 });
  });
});

describe("attempt storage and mastery rule", () => {
  it("saves and reloads attempts", () => {
    const storage = new MemoryStorage();
    saveAttempt(attempt({ id: "a" }), storage);
    saveAttempt(attempt({ id: "b", correct: false }), storage);
    expect(loadAttempts(storage).map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("survives corrupted storage and keeps a backup of the unreadable data", () => {
    const storage = new MemoryStorage();
    storage.setItem("ghaith.attempts.v1", "{not json");
    expect(loadAttempts(storage)).toEqual([]);
    saveAttempt(attempt({ id: "after" }), storage);
    expect(loadAttempts(storage).map((a) => a.id)).toEqual(["after"]);
    const backups = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k) => k?.includes("corrupt"));
    expect(backups).toHaveLength(1);
    expect(storage.getItem(backups[0]!)).toBe("{not json");
  });

  it("keeps attempts of different storages apart", () => {
    const a = new MemoryStorage();
    const b = new MemoryStorage();
    saveAttempt(attempt({ id: "in-a" }), a);
    expect(loadAttempts(b)).toEqual([]);
  });

  it("one perfect round is never 'secure'", () => {
    const list = Array.from({ length: 10 }, (_, i) => attempt({ id: String(i) }));
    expect(masteryStatus(summariseBySkill(list)[0]!)).toBe("practising");
  });

  it("80% over two sessions and two mechanics is 'secure_draft'", () => {
    const list = [
      ...Array.from({ length: 5 }, (_, i) => attempt({ id: `a${i}`, sessionId: "s1" })),
      ...Array.from({ length: 5 }, (_, i) =>
        attempt({ id: `b${i}`, sessionId: "s2", mechanicId: "grid-path-move", correct: i !== 0 }),
      ),
    ];
    const s = summariseBySkill(list)[0]!;
    expect(s.firstTryCorrect).toBe(9);
    expect(masteryStatus(s)).toBe("secure_draft");
  });

  it("hinted successes do not count as independent", () => {
    const list = Array.from({ length: 10 }, (_, i) => attempt({ id: String(i), sessionId: `s${i % 2}`, mechanicId: i % 2 ? "a" : "b", hintsUsed: 1 }));
    expect(masteryStatus(summariseBySkill(list)[0]!)).toBe("practising");
  });
});

describe("lesson content definition", () => {
  it("links every game to the book source and an existing generator", () => {
    const generators = new Map(
      [fragmentFillGenerator, locateGenerator, pathMoveGenerator].map((g) => [g.id, g] as const),
    );
    expect(LESSON_L01.source.source_book_id).toBe("MATH-S1-STU");
    expect(LESSON_L01.source.source_printed_page).toBe(4);
    expect(LESSON_L01.source.source_pdf_page).toBe(15);
    for (const g of LESSON_L01.games) {
      const gen = generators.get(g.item_generator_id);
      expect(gen, g.game_id).toBeDefined();
      expect(gen!.mechanicId).toBe(g.game_mechanic_id);
      expect(gen!.version).toBe(g.generator_version);
      expect(g.hint_levels.length).toBeGreaterThanOrEqual(2);
      expect(g.content_review_status).not.toBe("approved"); // no human review has happened yet
    }
    expect(new Set(LESSON_L01.games.map((g) => g.game_mechanic_id)).size).toBe(3);
  });
});
