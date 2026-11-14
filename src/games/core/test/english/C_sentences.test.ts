import { describe, expect, it } from "vitest";
import catalog from "../../../../../content/curriculum/english/s1/lessons.json";
import {
  CLOZE_ACCEPTS,
  COMMANDS,
  DIALOGUE_BANK,
  SENSES,
  TRICKY_CLASS,
  blankWord,
  commandPicture,
  dialogueComplete,
  orderParts,
  senseOrgan,
  sentenceOrder,
  storyCheck,
  storyScene,
  trickyCloze,
} from "../../src/english/C_sentences";

const gamesOf = (mechanic: string) => catalog.lessons.flatMap((l) => l.games.filter((g) => g.mechanic === mechanic).map((g) => ({ lesson: l.lesson_id, config: g.config as never })));

describe("tricky-cloze", () => {
  const all = gamesOf("tricky-cloze") as Array<{ lesson: string; config: { sentences: string[]; word: string; known: string[] } }>;
  it("no distractor could also complete the sentence, and never from the target's word class", () => {
    for (const { config } of all)
      for (const d of [1, 2, 3] as const)
        for (let seed = 1; seed <= 200; seed++) {
          const item = trickyCloze.generate(seed, d, config);
          for (const o of item.params.options.filter((o) => o !== config.word)) {
            expect(CLOZE_ACCEPTS[item.params.blanked], item.params.blanked).not.toContain(o);
            if (TRICKY_CLASS[o]) expect(TRICKY_CLASS[o]).not.toBe(TRICKY_CLASS[config.word]);
            expect([...config.known, "is", "it"]).toContain(o);
          }
        }
  });
  it("possessives are never distractors for each other ('This is ___ coat.' never offers his)", () => {
    const oa = all.find((g) => g.config.word === "her")!.config;
    for (let seed = 1; seed <= 300; seed++) expect(trickyCloze.generate(seed, 3, oa).params.options).not.toContain("his");
  });
  it("falls back to Class Book is / it only when fewer than two taught words qualify", () => {
    const ai = all.find((g) => g.config.word === "his")!.config;
    expect(new Set(Array.from({ length: 50 }, (_, s) => trickyCloze.generate(s + 1, 3, ai).params.options).flat())).toEqual(new Set(["his", "is", "it"]));
    const ae = all.find((g) => g.config.word === "have")!.config;
    for (let seed = 1; seed <= 100; seed++) expect(trickyCloze.generate(seed, 3, ae).params.options).not.toContain("is");
  });
  it("keeps capitalisation at the start of a sentence", () => {
    const item = trickyCloze.generate(1, 2, { sentences: ["Who has got a pie?"], word: "who", known: ["his", "her", "who"] });
    expect(item.params.blanked).toBe("___ has got a pie?");
    expect(item.input.type === "choice" && item.input.options.every((o) => /^[A-Z]/.test(o.label))).toBe(true);
    expect(blankWord("Look at all the clouds.", "all")!.blanked).toBe("Look at ___ the clouds.");
  });
  it("a sentence nobody has reviewed for distractors is rejected", () => {
    expect(trickyCloze.validateConfig({ sentences: ["His dog is big."], word: "his", known: ["his"] }).length).toBeGreaterThan(0);
  });
});

describe("sentence-order", () => {
  it("tiles only the longest sentence of a two-sentence line; the other stays as context", () => {
    expect(orderParts("Look! It's Polly.")).toEqual({ before: "Look!", part: "It's Polly.", after: "" });
    expect(orderParts("Is this a school? No, it isn't.")).toEqual({ before: "", part: "Is this a school?", after: "No, it isn't." });
    expect(orderParts("Who's this? It's my uncle.")).toEqual({ before: "Who's this?", part: "It's my uncle.", after: "" });
  });
  it("accepts repeated words in either order and keeps punctuation on its word", () => {
    const item = sentenceOrder.generate(2, 3, { sentences: ["He's got black hair and black eyes."] });
    expect(item.params.tokens).toEqual(["He's", "got", "black", "hair", "and", "black", "eyes."]);
    const sol = sentenceOrder.solution(item) as string[];
    const ids = item.params.tiles.map((t, i) => (t === "black" ? `t${i}` : null)).filter((x): x is string => x !== null);
    const swapped = sol.map((id) => (id === ids[0] ? ids[1]! : id === ids[1] ? ids[0]! : id));
    expect(sentenceOrder.check(item, swapped).correct).toBe(true);
  });
  it("level 3 picks the longer sentences and nothing is dealt in order", () => {
    const sentences = ["Wave goodbye.", "Open your book.", "Pick up your book."];
    for (let seed = 1; seed <= 200; seed++) {
      expect(sentenceOrder.generate(seed, 3, { sentences }).params.tokens.length).toBeGreaterThanOrEqual(3);
      const item = sentenceOrder.generate(seed, 1, { sentences });
      expect(item.params.tiles.join(" ")).not.toBe(item.params.tokens.join(" "));
    }
  });
});

describe("dialogue-complete", () => {
  const configs = gamesOf("dialogue-complete") as Array<{ lesson: string; config: { dialogues: Array<[string, string]> } }>;
  it("the reviewed bank holds exactly the book exchanges of lessons.json (new dialogues need a review)", () => {
    const book = configs.flatMap((g) => g.config.dialogues.map(([l, r]) => `${g.lesson}|${l}|${r}`)).sort();
    expect(DIALOGUE_BANK.map((d) => `${d.lesson}|${d.line}|${d.reply}`).sort()).toEqual(book);
  });
  it("distractors never fit the line; levels 1-2 take them from other lessons only", () => {
    for (const { lesson, config } of configs)
      for (const d of [1, 2, 3] as const)
        for (let seed = 1; seed <= 200; seed++) {
          const item = dialogueComplete.generate(seed, d, config);
          const entry = DIALOGUE_BANK.find((e) => e.line === item.params.line && e.reply === item.params.reply)!;
          for (const o of item.params.options.filter((o) => o !== item.params.reply)) {
            expect(entry.fits).not.toContain(o);
            if (d < 3) expect(DIALOGUE_BANK.some((e) => e.reply === o && e.lesson !== lesson)).toBe(true);
          }
        }
  });
});

describe("story-check", () => {
  const configs = gamesOf("story-check") as Array<{ lesson: string; config: { items: Array<[string, [string, string], string]> } }>;
  it("the book's key is always an option and level 1 shows exactly the book's two words", () => {
    for (const { config } of configs)
      for (let seed = 1; seed <= 100; seed++) {
        const item = storyCheck.generate(seed, 1, config);
        expect(item.params.options).toContain(item.params.answer);
        const book = config.items.find((it) => it[2] === item.params.answer && it[0].replace("___ ", "___") === item.params.sentence)!;
        expect([...item.params.options].sort()).toEqual([...book[1]].sort());
      }
  });
  it("every item has a picture that follows the story (Gymbot: white head, blue body, eight fingers)", () => {
    for (const { config } of configs) for (const [s, , a] of config.items) expect(storyScene(s, a), s).not.toBeNull();
    expect(storyScene("I've got eight ___ .", "fingers")!.scene).toEqual({ kind: "robotHand", fingers: 8 });
  });
});

describe("command-picture", () => {
  it("never shows two commands with the same picture (Read / Open your book share 📖)", () => {
    for (const set of ["classroom", "movement"] as const)
      for (const d of [1, 2, 3] as const)
        for (let seed = 1; seed <= 300; seed++) {
          const opts = commandPicture.generate(seed, d, { set }).params.options;
          expect(opts.includes("Read") && opts.includes("Open your book.")).toBe(false);
        }
  });
  it("uses the book's song line 'Stretch your legs!' and the classroom words of W p10-11", () => {
    expect(COMMANDS.movement.map((c) => c.text)).toContain("Stretch your legs!");
    expect(COMMANDS.classroom.map((c) => c.text)).toEqual(["Stand up.", "Sit down.", "Open your book.", "Close your book.", "Wave goodbye.", "Look", "Listen", "Point", "Read", "Draw", "Write"]);
  });
  it("answers are the option ids of the pictures; anything else is rejected", () => {
    const item = commandPicture.generate(4, 2, { set: "movement" });
    expect(commandPicture.check(item, commandPicture.solution(item)).correct).toBe(true);
    expect(commandPicture.check(item, "o9").errors[0]!.errorType).toBe("input_invalid");
  });
});

describe("sense-organ", () => {
  it("pairs each sense with the book's body part", () => {
    expect(SENSES.map((s) => `${s.verb}-${s.part}`)).toEqual(["see-eyes", "hear-ears", "smell-noses", "taste-tongues", "touch-hands and feet"]);
    for (const d of [1, 2, 3] as const)
      for (let seed = 1; seed <= 100; seed++) {
        const item = senseOrgan.generate(seed, d, {});
        const s = SENSES.find((x) => x.verb === item.params.verb)!;
        const right = item.params.blank === "verb" ? s.verb : s.part;
        expect(item.params.options.filter((o) => o === right).length).toBe(1);
        if (d === 3) expect(item.visual.scene).toBeNull();
      }
  });
});
