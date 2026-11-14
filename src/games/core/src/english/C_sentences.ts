/**
 * Sentence-level English mechanics (executor C): tricky-cloze, sentence-order,
 * dialogue-complete, story-check, command-picture, sense-organ.
 * All sentences come from the books (Class Book / Sounds and Spelling, S1, First Edition 2026).
 */
import { byLevel, makeItem, ok, sample, wrong, type QuizMechanic } from "../quiz";
import { WORDS, drawDistinct, optId, optIndex } from "./common";
import { cap, checkChoice, checkTiles, choiceIntegrity, deal, labelled, levelPool, pick, pictureOf, shuffleAll, solutionOf, tileIntegrity, tileItems, tileSolution } from "./C_common";

type M<C, P> = QuizMechanic<C, P>;
const asMech = <P>(m: unknown) => m as QuizMechanic<never, P>;

/* ------------------------------------------------------------------ */
/* tricky-cloze                                                        */
/* ------------------------------------------------------------------ */

/** Word classes of the S1 tricky words; a distractor never comes from the target's class. */
export const TRICKY_CLASS: Readonly<Record<string, string>> = {
  his: "possessive",
  her: "possessive",
  our: "possessive",
  their: "possessive",
  who: "question",
  why: "question",
  when: "question",
  have: "verb",
  give: "verb",
  come: "verb",
  do: "verb",
  said: "verb",
  all: "quantifier",
  some: "quantifier",
  to: "other",
  so: "other",
};
/** Class Book words used only when fewer than two taught tricky words can be distractors. */
const FALLBACK = ["is", "it"];

/**
 * Hand-checked: for each book sentence with its tricky word blanked, every word (tricky words
 * plus "is" / "it") that would ALSO give an acceptable English sentence. Generous on purpose:
 * a word listed here is never offered as a distractor ("He likes his dive." / "It is all wet!"
 * are English, so his / all are not distractors there).
 */
export const CLOZE_ACCEPTS: Readonly<Record<string, readonly string[]>> = {
  "I ___ got a cake.": ["have", "so"],
  "I ___ got a snake.": ["have", "so"],
  "I ___ got a game.": ["have", "so"],
  "This is ___ train.": ["his", "her", "our", "their", "some", "to"],
  "___ train is red.": ["his", "her", "our", "their", "some"],
  "___ has got a pie?": ["who", "it"],
  "___ has got a tie?": ["who", "it"],
  "This is ___ coat.": ["his", "her", "our", "their", "some", "to"],
  "___ coat is green.": ["his", "her", "our", "their", "some"],
  "It is ___ swing.": ["his", "her", "our", "their", "some", "to"],
  "___ is it hot?": ["when", "why", "so"],
  "___ is it wet?": ["when", "why", "so"],
  "___ are you sad?": ["why", "when", "so"],
  "It is ___ torch.": ["his", "her", "our", "their", "some", "to"],
  "It is ___ game.": ["his", "her", "our", "their", "some", "to"],
  "He likes ___ dive.": ["to", "his", "her", "our", "their", "some"],
  "Can I have ___ oil?": ["some", "his", "her", "our", "their", "all"],
  "They ___ shout.": ["all", "do", "so", "said", "come"],
  "They are ___ loud.": ["all", "so", "some"],
  "Look at ___ the clouds.": ["all"],
  "___ her some glue.": ["give"],
  "I ___ art.": ["do", "have", "said", "give"],
  "We ___ sport.": ["do", "have", "said", "give", "all"],
  "He ___ yes.": ["said"],
  "She ___ no.": ["said"],
  "___ to the lake!": ["come", "why", "when", "all", "some", "who", "so"],
  "___ to the tree!": ["come", "why", "when", "all", "some", "who", "so"],
  "It is ___ big!": ["so", "all", "some"],
  "It is ___ wet!": ["so", "all", "some"],
};

/** Blank the first whole-word occurrence of `word` (any case). */
export function blankWord(sentence: string, word: string): { blanked: string; original: string; capital: boolean } | null {
  const m = new RegExp(`\\b${word}\\b`, "i").exec(sentence);
  if (!m) return null;
  return { blanked: sentence.slice(0, m.index) + "___" + sentence.slice(m.index + m[0].length), original: m[0], capital: m.index === 0 };
}

/** A pictured book word in the sentence (scanning from the end), as context; never the hidden word. */
function contextPicture(sentence: string, hidden: string): string | null {
  const tokens = sentence.toLowerCase().replace(/[^a-z' -]/g, " ").split(/\s+/).filter(Boolean).reverse();
  for (const t of tokens) {
    if (t === hidden) continue;
    const w = WORDS[t]?.picture ? t : t.endsWith("s") && WORDS[t.slice(0, -1)]?.picture ? t.slice(0, -1) : null;
    if (w && w !== "look") return WORDS[w]!.picture;
  }
  return null;
}

function clozeDistractors(word: string, known: readonly string[], accepts: readonly string[]): string[] {
  const fromKnown = known.filter((k) => k !== word && TRICKY_CLASS[k] !== TRICKY_CLASS[word] && !accepts.includes(k));
  return fromKnown.length >= 2 ? fromKnown : [...fromKnown, ...FALLBACK.filter((f) => !accepts.includes(f))];
}

export interface ClozeParams {
  sentence: string;
  word: string;
  blanked: string;
  capital: boolean;
  /** Lower-case option words. */
  options: string[];
}

export const trickyCloze: M<{ sentences: string[]; word: string; known: string[] }, ClozeParams> = {
  id: "GEN-EN-TRICKY-CLOZE",
  version: 1,
  mechanicId: "tricky-cloze",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!TRICKY_CLASS[c.word]) p.push(`unknown tricky word ${c.word}`);
    for (const k of c.known ?? []) if (!TRICKY_CLASS[k]) p.push(`unknown known word ${k}`);
    if (!Array.isArray(c.sentences) || c.sentences.length === 0) p.push("sentences required");
    for (const s of c.sentences ?? []) {
      const b = blankWord(s, c.word);
      if (!b) p.push(`"${s}" does not contain ${c.word}`);
      else if (!CLOZE_ACCEPTS[b.blanked]) p.push(`"${b.blanked}" has not been reviewed for distractors`);
      else if (clozeDistractors(c.word, c.known ?? [], CLOZE_ACCEPTS[b.blanked]!).length === 0) p.push(`no safe distractor for "${s}"`);
    }
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const sentence = pick(rng, config.sentences);
      const b = blankWord(sentence, config.word)!;
      const pool = clozeDistractors(config.word, config.known, CLOZE_ACCEPTS[b.blanked]!);
      const n = Math.min(byLevel(difficulty, [1, 2, 3] as const), pool.length);
      const options = shuffleAll(rng, [config.word, ...drawDistinct(rng, pool, n)]);
      return makeItem(this, seed, difficulty, {
        params: { sentence, word: config.word, blanked: b.blanked, capital: b.capital, options },
        lang: "en",
        prompt: "Read and choose the word.",
        promptAr: "اقرأ الجملة واختر الكلمة الناقصة.",
        visual: { type: "en-c-scene", scene: contextPicture(sentence, config.word) ? { kind: "thing", picture: contextPicture(sentence, config.word), count: 1 } : null, text: b.blanked, say: null },
        input: { type: "choice", options: labelled(options.map((o) => (b.capital ? cap(o) : o))) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (o) => o === item.params.word);
  },
  check(item, answer) {
    // Rule: the filled sentence must be the book sentence.
    const { blanked, sentence, capital } = item.params;
    return checkChoice(item.params.options, answer, (o) => blanked.replace("___", capital ? cap(o) : o) === sentence);
  },
  explain(item) {
    const w = item.params.word;
    return [item.params.sentence, `«${w}» كلمة صعبة (tricky word): نحفظ شكلها ${[...w].join("-")}.`];
  },
  checkIntegrity(item) {
    const { blanked, word, options, sentence } = item.params;
    const p = choiceIntegrity(asMech<ClozeParams>(this), item, options.length);
    const accepts = CLOZE_ACCEPTS[blanked];
    if (!accepts) p.push("sentence not reviewed");
    else for (const o of options) if (o !== word && (accepts.includes(o) || TRICKY_CLASS[o] === TRICKY_CLASS[word])) p.push(`${o} could also fit`);
    if (blanked.replace("___", item.params.capital ? cap(word) : word) !== sentence) p.push("blank does not restore the sentence");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* sentence-order                                                      */
/* ------------------------------------------------------------------ */

/**
 * A config string may hold two book sentences ("Look! It's Polly."). Swapping whole sentences
 * would still be English ("It's Polly. Look!"), so only the longest sentence is tiled and the
 * other(s) stay fixed around it as context.
 */
export function orderParts(text: string): { before: string; part: string; after: string } {
  const parts = text.split(/(?<=[.!?])\s+/);
  let best = 0;
  parts.forEach((s, i) => {
    if (s.split(" ").length > parts[best]!.split(" ").length) best = i;
  });
  return { before: parts.slice(0, best).join(" "), part: parts[best]!, after: parts.slice(best + 1).join(" ") };
}

export interface OrderParams {
  sentence: string;
  before: string;
  after: string;
  /** Book word tokens of the tiled sentence (punctuation stays on its word). */
  tokens: string[];
  tiles: string[];
}

export const sentenceOrder: M<{ sentences: string[] }, OrderParams> = {
  id: "GEN-EN-SENTENCE-ORDER",
  version: 1,
  mechanicId: "sentence-order",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!Array.isArray(c.sentences) || c.sentences.length === 0) return ["sentences required"];
    for (const s of c.sentences) {
      const t = orderParts(s).part.split(" ");
      if (t.length < 2 || new Set(t).size < 2) p.push(`"${s}" is too short to order`);
    }
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const size = (s: string) => orderParts(s).part.split(" ").length;
      const sentence = pick(rng, levelPool(config.sentences, size, difficulty));
      const { before, part, after } = orderParts(sentence);
      const tokens = part.split(" ");
      const tiles = deal(rng, tokens, " ");
      if (!tiles) return null;
      return makeItem(this, seed, difficulty, {
        params: { sentence, before, after, tokens, tiles },
        lang: "en",
        prompt: "Put the words in order.",
        promptAr: "رتّب الكلمات لتكوّن جملة الكتاب: الحرف الكبير في البداية، والنقطة أو علامة السؤال في النهاية.",
        visual: { type: "en-c-tiles", picture: null, colour: null, outline: false, digit: null, say: difficulty === 1 ? sentence : null, gloss: null, before: before || null, after: after || null },
        input: { type: "order", items: tileItems(tiles) },
      });
    });
  },
  solution(item) {
    return tileSolution(item.params.tiles, item.params.tokens);
  },
  check(item, answer) {
    return checkTiles(item.params.tiles, " ", item.params.tokens.join(" "), answer, item.params.tokens);
  },
  explain(item) {
    const t = item.params.tokens;
    return [`${t[0]} … ${t[t.length - 1]}`, item.params.sentence, "نبدأ بالكلمة ذات الحرف الكبير، وننتهي بالكلمة التي عليها علامة الترقيم."];
  },
  checkIntegrity(item) {
    const p = tileIntegrity(item, item.params.tiles, item.params.tokens, " ");
    const { before, after, tokens, sentence } = item.params;
    if ([before, tokens.join(" "), after].filter(Boolean).join(" ") !== sentence) p.push("parts do not rebuild the book sentence");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* dialogue-complete                                                   */
/* ------------------------------------------------------------------ */

interface DialogueEntry {
  lesson: string;
  line: string;
  reply: string;
  /** Other book replies that would ALSO be an acceptable answer to this line (hand-checked). */
  fits: readonly string[];
}

/** Every "English in action" / story exchange of S1, with the replies that could also fit. */
export const DIALOGUE_BANK: readonly DialogueEntry[] = [
  { lesson: "ENG-S1-UW-L02", line: "Hello! I'm Frank. What's your name?", reply: "My name's Carl.", fits: ["Hello! I'm Polly!"] },
  { lesson: "ENG-S1-UW-L02", line: "How old are you?", reply: "I'm seven.", fits: [] },
  { lesson: "ENG-S1-UW-L02", line: "Hello! What's your name?", reply: "Hello! I'm Polly!", fits: ["My name's Carl."] },
  { lesson: "ENG-S1-UW-L02", line: "It's my birthday today.", reply: "Happy birthday!", fits: ["Great!", "Yes, it is.", "Yes, of course.", "Yes. Here you are."] },
  { lesson: "ENG-S1-U1-L06", line: "What's this?", reply: "It's my new scooter.", fits: ["Happy birthday!"] },
  { lesson: "ENG-S1-U1-L06", line: "Can I play with it, please?", reply: "Yes, of course.", fits: ["Yes. Here you are."] },
  { lesson: "ENG-S1-U1-L06", line: "Let's play together.", reply: "Great!", fits: ["Yes, of course.", "Yes. Here you are.", "Thank you."] },
  { lesson: "ENG-S1-U2-L06", line: "Is this your pen?", reply: "Yes, it is.", fits: ["Yes, of course.", "Yes. Here you are.", "Thank you."] },
  { lesson: "ENG-S1-U2-L06", line: "Can I borrow it, please?", reply: "Yes. Here you are.", fits: ["Yes, of course."] },
  { lesson: "ENG-S1-U2-L06", line: "Here you are.", reply: "Thank you.", fits: ["Great!", "Wow! What a cool dinosaur!"] },
  { lesson: "ENG-S1-U3-L06", line: "Look at my picture.", reply: "Wow! What a cool dinosaur!", fits: ["Great!", "Look at the body. It's big.", "Yes, of course."] },
  { lesson: "ENG-S1-U3-L06", line: "What a cool dinosaur!", reply: "Thank you.", fits: ["Great!", "Yes, it is.", "Yes, of course.", "Yes. Here you are.", "Wow! What a cool dinosaur!", "Look at the body. It's big."] },
  { lesson: "ENG-S1-U3-L06", line: "It's a dinosaur costume!", reply: "Look at the body. It's big.", fits: ["Wow! What a cool dinosaur!", "Great!", "Yes, it is.", "Yes, of course."] },
  { lesson: "ENG-S1-U4-L06", line: "Hi, Kim. This is my sister.", reply: "Hello, Jane. Nice to meet you.", fits: ["Hello, Jane.", "Hello! I'm Polly!"] },
  { lesson: "ENG-S1-U4-L06", line: "Nice to meet you.", reply: "Nice to meet you, too.", fits: ["Thank you.", "Hello, Jane.", "Hello, Jane. Nice to meet you.", "My name's Carl.", "Hello! I'm Polly!"] },
  { lesson: "ENG-S1-U4-L06", line: "Her name's Jane.", reply: "Hello, Jane.", fits: ["Hello, Jane. Nice to meet you.", "Great!", "Thank you.", "Yes, it is.", "Yes, of course.", "My name's Carl.", "Hello! I'm Polly!"] },
];

const findDialogue = (line: string, reply: string) => DIALOGUE_BANK.find((d) => d.line === line && d.reply === reply);

export interface DialogueParams {
  line: string;
  reply: string;
  options: string[];
}

export const dialogueComplete: M<{ dialogues: Array<[string, string]> }, DialogueParams> = {
  id: "GEN-EN-DIALOGUE-COMPLETE",
  version: 1,
  mechanicId: "dialogue-complete",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    if (!Array.isArray(c.dialogues) || c.dialogues.length === 0) return ["dialogues required"];
    return c.dialogues.filter(([l, r]) => !findDialogue(l, r)).map(([l, r]) => `dialogue not reviewed: "${l}" → "${r}"`);
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const [line, reply] = pick(rng, config.dialogues);
      const entry = findDialogue(line, reply)!;
      const fine = new Set([reply, ...entry.fits]);
      const replies = (same: boolean) => [...new Set(DIALOGUE_BANK.filter((d) => (d.lesson === entry.lesson) === same).map((d) => d.reply))].filter((r) => !fine.has(r));
      const other = replies(false);
      const sameLesson = replies(true);
      const n = byLevel(difficulty, [1, 2, 3] as const);
      // Levels 1-2: replies from other lessons only; level 3 adds a closer one from the same dialogue.
      const close = difficulty === 3 && sameLesson.length ? [pick(rng, sameLesson)] : [];
      const distractors = [...close, ...drawDistinct(rng, other.filter((r) => !close.includes(r)), n - close.length)];
      if (distractors.length !== n) return null;
      const options = shuffleAll(rng, [reply, ...distractors]);
      return makeItem(this, seed, difficulty, {
        params: { line, reply, options },
        lang: "en",
        prompt: "Read and choose the answer.",
        promptAr: "اقرأ ما قاله الطفل واختر الرد المناسب.",
        visual: { type: "en-c-scene", scene: null, text: line, say: line, bubble: true },
        input: { type: "choice", options: labelled(options) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (o) => o === item.params.reply);
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (o) => o === item.params.reply);
  },
  explain(item) {
    return [`"${item.params.line}"`, `"${item.params.reply}"`, "هذا هو الرد في حوار الكتاب."];
  },
  checkIntegrity(item) {
    const { line, reply, options } = item.params;
    const p = choiceIntegrity(asMech<DialogueParams>(this), item, options.length);
    const entry = findDialogue(line, reply);
    if (!entry) p.push("dialogue not in the reviewed bank");
    else for (const o of options) if (o !== reply && entry.fits.includes(o)) p.push(`"${o}" would also fit`);
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* story-check: the book's "Read and circle" items                     */
/* ------------------------------------------------------------------ */

export type StoryScene =
  | { kind: "thing"; picture: string | null; count: number }
  | { kind: "robot" }
  | { kind: "robotHand"; fingers: number }
  | { kind: "face"; face: FaceSpec };

export interface FaceSpec {
  gender: "male" | "female";
  age: "child" | "adult" | "old" | "baby";
  hair: "brown" | "black" | "red" | "fair" | "grey";
  eyes: "blue" | "green" | "brown";
  ears: "big" | "normal";
  mouth: "big" | "small" | "normal";
  nose: "small" | "normal";
}

/**
 * Pictures for items whose answer is not simply a word-bank picture, following the stories:
 * Gymbot has "a white head and a blue body" and "eight fingers" (CB p42-43); the baby cousin
 * "has got big blue eyes", the uncle "has got brown hair" (CB p52-53). `extras` = other words of
 * the same items that are certainly wrong for this picture (offered at higher levels).
 */
const STORY_SCENES: Readonly<Record<string, { scene: StoryScene; extras: readonly string[] }>> = {
  "I've got a white ___ .|head": { scene: { kind: "robot" }, extras: ["fingers", "hands"] },
  "I've got a blue ___ .|body": { scene: { kind: "robot" }, extras: ["fingers", "hands"] },
  "I've got eight ___ .|fingers": { scene: { kind: "robotHand", fingers: 8 }, extras: ["head", "body"] },
  "Who's this? It's my ___ .|cousin": { scene: { kind: "thing", picture: "👶", count: 1 }, extras: ["hair", "eyes", "ears"] },
  "He's got brown ___ .|hair": {
    scene: { kind: "face", face: { gender: "male", age: "adult", hair: "brown", eyes: "blue", ears: "normal", mouth: "normal", nose: "normal" } },
    extras: ["cousin", "sister"],
  },
  "She's got big blue ___ .|eyes": {
    scene: { kind: "face", face: { gender: "female", age: "baby", hair: "black", eyes: "blue", ears: "normal", mouth: "normal", nose: "normal" } },
    extras: ["hair", "cousin", "sister"],
  },
};

/** Book word → word-bank word (plural answers like "books" use the singular picture, shown 3 times). */
function storyThing(sentence: string, answer: string): StoryScene | null {
  const plural = /^These are/.test(sentence) || (!WORDS[answer]?.picture && answer.endsWith("s"));
  const base = WORDS[answer]?.picture ? answer : answer.endsWith("s") ? answer.slice(0, -1) : answer;
  const pic = pictureOf(base);
  return pic ? { kind: "thing", picture: pic, count: plural ? 3 : 1 } : null;
}

export function storyScene(sentence: string, answer: string): { scene: StoryScene; extras: readonly string[] | null } | null {
  const special = STORY_SCENES[`${sentence}|${answer}`];
  if (special) return special;
  const scene = storyThing(sentence, answer);
  return scene ? { scene, extras: null } : null;
}

type StoryItem = [string, [string, string], string];

export interface StoryParams {
  sentence: string;
  options: string[];
  answer: string;
}

const tidy = (s: string) => s.replace(/___ ([.!?])/, "___$1");

export const storyCheck: M<{ items: StoryItem[] }, StoryParams> = {
  id: "GEN-EN-STORY-CHECK",
  version: 1,
  mechanicId: "story-check",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    if (!Array.isArray(c.items) || c.items.length === 0) return ["items required"];
    const p: string[] = [];
    for (const [s, opts, a] of c.items) {
      if (!s.includes("___")) p.push(`"${s}" has no blank`);
      if (!Array.isArray(opts) || opts.length !== 2 || opts[0] === opts[1]) p.push(`"${s}" needs two different options`);
      if (!opts.includes(a)) p.push(`"${s}": key ${a} is not an option`);
      if (!storyScene(s, a)) p.push(`"${s}": no picture for ${a}`);
    }
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const [sentence, bookOptions, answer] = pick(rng, config.items);
      const { scene, extras } = storyScene(sentence, answer)!;
      // Extra options: words of the other book items that are clearly wrong for this picture.
      const others = [...new Set(config.items.flatMap((it) => it[1]))].filter((w) => !bookOptions.includes(w));
      const safe = extras
        ? others.filter((w) => extras.includes(w))
        : others.filter((w) => {
            const s = storyThing(sentence, w);
            return s && s.kind === "thing" && s.picture !== (scene as { picture: string }).picture;
          });
      const nExtra = Math.min(byLevel(difficulty, [0, 1, 2] as const), safe.length);
      const options = shuffleAll(rng, [...bookOptions, ...drawDistinct(rng, safe, nExtra)]);
      return makeItem(this, seed, difficulty, {
        params: { sentence: tidy(sentence), options, answer },
        lang: "en",
        prompt: "Look, read and circle.",
        promptAr: "انظر إلى الصورة من القصة، واختر الكلمة الصحيحة.",
        visual: { type: "en-c-scene", scene, text: tidy(sentence), say: null },
        input: { type: "choice", options: labelled(options) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (o) => o === item.params.answer);
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (o) => o === item.params.answer);
  },
  explain(item) {
    return [item.params.sentence.replace("___", item.params.answer), "هذا ما قرأناه في القصة وما تظهره الصورة."];
  },
  checkIntegrity(item) {
    const p = choiceIntegrity(asMech<StoryParams>(this), item, item.params.options.length);
    if (!item.params.options.includes(item.params.answer)) p.push("book key is not an option");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* command-picture                                                     */
/* ------------------------------------------------------------------ */

export type Figure = "stand" | "sit" | "clap" | "stamp" | "touch-toes" | "touch-head" | "bend-knees" | "stretch-legs" | "move-body";
export type CommandPicture = { emoji: string } | { figure: Figure };

/**
 * Class Book W p10-11 classroom language and U3 p41-44 movement commands. "Read" and
 * "Open your book" share 📖 and are never offered together. The song (p44) says
 * "Stretch your legs!", so that is used (not "Stretch your arms!").
 */
export const COMMANDS: Readonly<Record<"classroom" | "movement", ReadonlyArray<{ text: string; ar: string; picture: CommandPicture; close: readonly string[] }>>> = {
  classroom: [
    { text: "Stand up.", ar: "قف", picture: { figure: "stand" }, close: ["Sit down."] },
    { text: "Sit down.", ar: "اجلس", picture: { figure: "sit" }, close: ["Stand up."] },
    { text: "Open your book.", ar: "افتح كتابك", picture: { emoji: "📖" }, close: ["Close your book."] },
    { text: "Close your book.", ar: "أغلق كتابك", picture: { emoji: "📕" }, close: ["Open your book."] },
    { text: "Wave goodbye.", ar: "لوّح مودّعًا", picture: { emoji: "👋" }, close: ["Point"] },
    { text: "Look", ar: "انظر", picture: { emoji: "👀" }, close: ["Listen"] },
    { text: "Listen", ar: "استمع", picture: { emoji: "👂" }, close: ["Look"] },
    { text: "Point", ar: "أشر", picture: { emoji: "👉" }, close: ["Wave goodbye."] },
    { text: "Read", ar: "اقرأ", picture: { emoji: "📖" }, close: ["Write", "Look"] },
    { text: "Draw", ar: "ارسم", picture: { emoji: "🖍️" }, close: ["Write"] },
    { text: "Write", ar: "اكتب", picture: { emoji: "✍️" }, close: ["Draw"] },
  ],
  movement: [
    { text: "Clap your hands!", ar: "صفّق بيديك", picture: { figure: "clap" }, close: ["Stamp your feet!"] },
    { text: "Stamp your feet!", ar: "اضرب الأرض بقدميك", picture: { figure: "stamp" }, close: ["Clap your hands!", "Bend your knees!"] },
    { text: "Touch your toes!", ar: "المس أصابع قدميك", picture: { figure: "touch-toes" }, close: ["Touch your head!"] },
    { text: "Touch your head!", ar: "المس رأسك", picture: { figure: "touch-head" }, close: ["Touch your toes!"] },
    { text: "Bend your knees!", ar: "اثنِ ركبتيك", picture: { figure: "bend-knees" }, close: ["Stretch your legs!"] },
    { text: "Stretch your legs!", ar: "مدّ ساقيك", picture: { figure: "stretch-legs" }, close: ["Bend your knees!"] },
    { text: "Move your body!", ar: "حرّك جسمك", picture: { figure: "move-body" }, close: ["Stretch your legs!"] },
  ],
};

const picKey = (p: CommandPicture) => ("emoji" in p ? `e:${p.emoji}` : `f:${p.figure}`);
const commandOf = (set: "classroom" | "movement", text: string) => COMMANDS[set].find((c) => c.text === text);

export interface CommandParams {
  set: "classroom" | "movement";
  command: string;
  options: string[];
}

export const commandPicture: M<{ set: "classroom" | "movement" }, CommandParams> = {
  id: "GEN-EN-COMMAND-PICTURE",
  version: 1,
  mechanicId: "command-picture",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return c.set === "classroom" || c.set === "movement" ? [] : ["set must be classroom or movement"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const all = COMMANDS[config.set];
      const target = pick(rng, all);
      const n = Math.min(byLevel(difficulty, [3, 4, 5] as const), all.length);
      const chosen = [target];
      const add = (t: string) => {
        const c = commandOf(config.set, t);
        if (c && chosen.length < n && !chosen.some((x) => picKey(x.picture) === picKey(c.picture))) chosen.push(c);
      };
      if (difficulty === 3) for (const t of shuffleAll(rng, target.close)) add(t);
      for (const c of shuffleAll(rng, all)) add(c.text);
      if (chosen.length !== n) return null;
      const options = shuffleAll(
        rng,
        chosen.map((c) => c.text),
      );
      return makeItem(this, seed, difficulty, {
        params: { set: config.set, command: target.text, options },
        lang: "en",
        prompt: target.text,
        promptAr: "اقرأ الأمر أو استمع إليه 🔊، ثم المس الصورة المناسبة.",
        visual: { type: "en-c-command", say: target.text, pictures: options.map((t) => commandOf(config.set, t)!.picture) },
        input: { type: "visual" },
      });
    });
  },
  solution(item) {
    return optId(item.params.options.indexOf(item.params.command));
  },
  check(item, answer) {
    const expected = this.solution(item);
    const i = optIndex(answer);
    if (i === null || i >= item.params.options.length) return wrong(expected, answer, "input_invalid");
    return item.params.options[i] === item.params.command ? ok() : wrong(expected, answer, "other");
  },
  explain(item) {
    const c = commandOf(item.params.set, item.params.command)!;
    return [`${c.text} = ${c.ar}`, "ننفّذ الأمر ونختار الصورة التي تُظهره."];
  },
  checkIntegrity(item) {
    const p: string[] = [];
    const { set, command, options } = item.params;
    if (item.input.type !== "visual") p.push("expects visual input");
    if (item.lang !== "en") p.push("English items must set lang en");
    const cs = options.map((t) => commandOf(set, t));
    if (cs.some((c) => !c)) p.push("unknown command");
    else if (new Set(cs.map((c) => picKey(c!.picture))).size !== cs.length) p.push("two commands share a picture");
    if (options.filter((o) => o === command).length !== 1) p.push("expected exactly one matching picture");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* sense-organ (LC1 p38-39)                                            */
/* ------------------------------------------------------------------ */

/** "We can see with our eyes, hear with our ears, smell with our noses, taste with our tongues, touch with our hands and feet." */
export const SENSES = [
  { verb: "see", part: "eyes", picture: "👀", ar: "نرى بأعيننا" },
  { verb: "hear", part: "ears", picture: "👂", ar: "نسمع بآذاننا" },
  { verb: "smell", part: "noses", picture: "👃", ar: "نشمّ بأنوفنا" },
  { verb: "taste", part: "tongues", picture: "👅", ar: "نتذوق بألسنتنا" },
  { verb: "touch", part: "hands and feet", picture: "🖐️🦶", ar: "نلمس بأيدينا وأقدامنا" },
] as const;

export interface SenseParams {
  verb: string;
  blank: "verb" | "part";
  options: string[];
}

const senseOf = (verb: string) => SENSES.find((s) => s.verb === verb)!;
const senseSentence = (verb: string, blank: "verb" | "part" | null) => {
  const s = senseOf(verb);
  return `We can ${blank === "verb" ? "___" : s.verb} with our ${blank === "part" ? "___" : s.part}.`;
};

export const senseOrgan: M<Record<string, never>, SenseParams> = {
  id: "GEN-EN-SENSE-ORGAN",
  version: 1,
  mechanicId: "sense-organ",
  difficulties: [1, 2, 3],
  validateConfig() {
    return [];
  },
  generate(seed, difficulty) {
    return sample(seed, (rng) => {
      const s = pick(rng, SENSES);
      const blank: SenseParams["blank"] = difficulty === 1 ? "verb" : rng() < 0.5 ? "verb" : "part";
      const n = byLevel(difficulty, [3, 4, 5] as const);
      const others = drawDistinct(
        rng,
        SENSES.filter((x) => x !== s),
        n - 1,
      );
      const options = shuffleAll(rng, [s, ...others]).map((x) => (blank === "verb" ? x.verb : x.part));
      // The organ picture is a help for the verb blank (levels 1-2); it would give the part away.
      const showPicture = blank === "verb" && difficulty < 3;
      return makeItem(this, seed, difficulty, {
        params: { verb: s.verb, blank, options },
        lang: "en",
        prompt: "Read and choose.",
        promptAr: "حواسّنا الخمس: اختر الكلمة الناقصة.",
        visual: { type: "en-c-scene", scene: showPicture ? { kind: "thing", picture: s.picture, count: 1 } : null, text: senseSentence(s.verb, blank), say: null },
        input: { type: "choice", options: labelled(options) },
      });
    });
  },
  solution(item) {
    const s = senseOf(item.params.verb);
    return solutionOf(item.params.options, (o) => o === (item.params.blank === "verb" ? s.verb : s.part));
  },
  check(item, answer) {
    // Rule: the option must pair with the sentence's other half in the book's sense table.
    const { verb, blank, options } = item.params;
    const s = senseOf(verb);
    return checkChoice(options, answer, (o) => SENSES.some((x) => (blank === "verb" ? x.verb === o && x.part === s.part : x.part === o && x.verb === s.verb)));
  },
  explain(item) {
    const s = senseOf(item.params.verb);
    return [senseSentence(s.verb, null), `${s.ar}.`];
  },
  checkIntegrity(item) {
    return choiceIntegrity(asMech<SenseParams>(this), item, item.params.options.length);
  },
};

export const SENTENCE_MECHANICS_C = [trickyCloze, sentenceOrder, dialogueComplete, storyCheck, commandPicture, senseOrgan] as const;
