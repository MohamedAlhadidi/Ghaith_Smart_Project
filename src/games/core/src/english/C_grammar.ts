/**
 * Grammar mechanics (executor C), each tied to a Class Book grammar box:
 * a/an (U1 p17), Is it a ...? (U1 p20), This is / These are (U2 p27), in/on/under (U2 p30),
 * I've got one/two/ten (U3 p41), Who's this? It's my ... (U4 p51), He's/She's got (U4 p54),
 * There is / There are (LC2 p60-61). Every validator recomputes the answer by rule.
 */
import { byLevel, makeItem, sample, type QuizMechanic } from "../quiz";
import type { Rng } from "../rng";
import { entry, wordProblems } from "./common";
import { checkChoice, choiceIntegrity, confusable, labelled, numberWord, pick, pictureOf, plural, randBetween, shuffleAll, solutionOf } from "./C_common";
import type { FaceSpec } from "./C_sentences";

type M<C, P> = QuizMechanic<C, P>;
const asMech = <P>(m: unknown) => m as QuizMechanic<never, P>;

function picturedProblems(words: unknown, min: number): string[] {
  if (!Array.isArray(words)) return ["list required"];
  const p = wordProblems(words, { min });
  for (const w of words as string[]) if (!pictureOf(w)) p.push(`no picture for ${w}`);
  return p;
}

/* ------------------------------------------------------------------ */
/* grammar-a-an                                                        */
/* ------------------------------------------------------------------ */

/** a / an by the first letter (all taught nouns start with their letter's sound). */
export const articleFor = (noun: string): "a" | "an" => (/^[aeiou]/i.test(noun) ? "an" : "a");

export interface AAnParams {
  noun: string;
  form: "word" | "sentence";
  options: Array<{ article: "a" | "an"; noun: string }>;
}

export const grammarAAn: M<{ nouns: string[] }, AAnParams> = {
  id: "GEN-EN-GRAMMAR-A-AN",
  version: 1,
  mechanicId: "grammar-a-an",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = picturedProblems(c.nouns, 3);
    if (Array.isArray(c.nouns) && !c.nouns.some((n) => articleFor(n) === "an")) p.push("no noun takes an");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const an = config.nouns.filter((n) => articleFor(n) === "an");
      const a = config.nouns.filter((n) => articleFor(n) === "a");
      // Both answers come up often (the unit has one "an" noun: action figure).
      const noun = an.length && a.length ? pick(rng, rng() < 0.4 ? an : a) : pick(rng, config.nouns);
      const right = articleFor(noun);
      const wrongArticle = right === "a" ? "an" : "a";
      let options: AAnParams["options"];
      if (difficulty < 3) options = shuffleAll(rng, [{ article: right, noun }, { article: wrongArticle, noun }]);
      else {
        const others = config.nouns.filter((n) => !confusable(n, noun));
        if (!others.length) return null;
        const other = pick(rng, others);
        options = shuffleAll(rng, [{ article: right, noun }, { article: wrongArticle, noun }, { article: articleFor(other), noun: other }]);
      }
      const sentence = difficulty === 3;
      return makeItem(this, seed, difficulty, {
        params: { noun, form: sentence ? "sentence" : "word", options },
        lang: "en",
        prompt: sentence ? "What's this?" : "a or an?",
        promptAr: sentence ? "انظر إلى الصورة واختر الجملة الصحيحة." : "نقول an قبل الكلمة التي تبدأ بحرف علة (a, e, i, o, u)، وa قبل غيرها.",
        // Level 2 drops the picture: the child reads the noun.
        visual: {
          type: "en-c-scene",
          scene: difficulty === 2 ? null : { kind: "thing", picture: pictureOf(noun), count: 1 },
          text: sentence ? null : `It's ___ ${noun}.`,
          say: null,
        },
        input: { type: "choice", options: labelled(options.map((o) => (sentence ? `It's ${o.article} ${o.noun}.` : o.article))) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (o) => o.noun === item.params.noun && o.article === articleFor(o.noun));
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (o) => o.noun === item.params.noun && o.article === articleFor(o.noun));
  },
  explain(item) {
    const n = item.params.noun;
    const art = articleFor(n);
    return [`"${n}" starts with "${n[0]}".`, `It's ${art} ${n}.`, art === "an" ? "حرف علة ← an" : "ليس حرف علة ← a"];
  },
  checkIntegrity(item) {
    return choiceIntegrity(asMech<AAnParams>(this), item, item.params.options.length);
  },
};

/* ------------------------------------------------------------------ */
/* grammar-yes-no: Is it a ...? Yes, it is. / No, it isn't.            */
/* ------------------------------------------------------------------ */

/** Toys that look or work alike: the harder "No" questions use these. */
const SIMILAR: ReadonlyArray<readonly [string, string]> = [
  ["bike", "scooter"],
  ["car", "bike"],
  ["car", "scooter"],
  ["kite", "plane"],
  ["plane", "car"],
  ["robot", "teddy"],
  ["teddy", "dinosaur"],
  ["robot", "dinosaur"],
  ["ball", "kite"],
  ["slide", "swing"],
  ["doll", "teddy"],
  ["doll", "action figure"],
  ["robot", "action figure"],
];
const similarTo = (w: string) => SIMILAR.flatMap(([a, b]) => (a === w ? [b] : b === w ? [a] : []));

export interface YesNoParams {
  shown: string;
  asked: string;
  /** yes = "Yes, it is."; no = "No, it isn't." (+ "It's a <noun>." at level 3). */
  options: Array<{ yes: boolean; noun: string | null }>;
}

const yesNoLabel = (o: { yes: boolean; noun: string | null }) => (o.yes ? "Yes, it is." : o.noun ? `No, it isn't. It's ${articleFor(o.noun)} ${o.noun}.` : "No, it isn't.");
/** Rule: "Yes" iff the picture is the asked toy; a "No" answer that names a toy must name the shown one. */
const yesNoTrue = (p: YesNoParams, o: { yes: boolean; noun: string | null }) => (p.shown === p.asked ? o.yes : !o.yes && (o.noun === null || o.noun === p.shown));

export const grammarYesNo: M<{ nouns: string[] }, YesNoParams> = {
  id: "GEN-EN-GRAMMAR-YES-NO",
  version: 1,
  mechanicId: "grammar-yes-no",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return picturedProblems(c.nouns, 3);
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const shown = pick(rng, config.nouns);
      const same = rng() < (difficulty === 3 ? 0.4 : 0.5);
      const others = config.nouns.filter((n) => !confusable(n, shown));
      const close = others.filter((n) => similarTo(shown).includes(n));
      const far = others.filter((n) => !close.includes(n));
      // Level 1: clearly different toys; level 3: toys that look alike.
      const pool = difficulty === 1 ? (far.length ? far : others) : difficulty === 3 ? (close.length ? close : others) : others;
      if (!same && !pool.length) return null;
      const asked = same ? shown : pick(rng, pool);
      let options: YesNoParams["options"] = [
        { yes: true, noun: null },
        { yes: false, noun: null },
      ];
      if (difficulty === 3) {
        // The book's full answer: "No, it isn't. It's a scooter." The child must also name the toy.
        const wrongNouns = shuffleAll(rng, others.filter((n) => n !== asked));
        if (wrongNouns.length < 2) return null;
        options = same
          ? [{ yes: true, noun: null }, { yes: false, noun: wrongNouns[0]! }, { yes: false, noun: wrongNouns[1]! }]
          : [{ yes: true, noun: null }, { yes: false, noun: shown }, { yes: false, noun: wrongNouns[0]! }];
      }
      options = shuffleAll(rng, options);
      return makeItem(this, seed, difficulty, {
        params: { shown, asked, options },
        lang: "en",
        prompt: `Is it ${articleFor(asked)} ${asked}?`,
        promptAr: difficulty === 1 ? `انظر إلى الصورة: هل هي «${entry(asked).ar}»؟` : "انظر إلى الصورة وأجب عن السؤال.",
        visual: { type: "en-c-scene", scene: { kind: "thing", picture: pictureOf(shown), count: 1 }, text: null, say: null },
        input: { type: "choice", options: labelled(options.map(yesNoLabel)) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (o) => yesNoTrue(item.params, o));
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (o) => yesNoTrue(item.params, o));
  },
  explain(item) {
    const { shown, asked } = item.params;
    return shown === asked
      ? [`${pictureOf(shown)} = ${shown}`, "Yes, it is."]
      : [`${pictureOf(shown)} = ${shown}, not ${asked}.`, `No, it isn't. It's ${articleFor(shown)} ${shown}.`];
  },
  checkIntegrity(item) {
    const p = choiceIntegrity(asMech<YesNoParams>(this), item, item.params.options.length);
    const { shown, asked, options } = item.params;
    if (shown !== asked && confusable(shown, asked)) p.push("the picture could also show the asked word");
    for (const o of options) if (o.noun && o.noun !== shown && confusable(o.noun, shown)) p.push("a named toy looks like the picture");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* grammar-this-these                                                  */
/* ------------------------------------------------------------------ */

export interface ThisTheseParams {
  noun: string;
  count: number;
  form: "opening" | "sentence";
  options: Array<{ these: boolean; pluralNoun: boolean }>;
}

const thisTheseLabel = (noun: string, o: { these: boolean; pluralNoun: boolean }) => `${o.these ? "These are" : "This is"} my ${o.pluralNoun ? plural(noun) : noun}.`;

export const grammarThisThese: M<{ nouns: string[] }, ThisTheseParams> = {
  id: "GEN-EN-GRAMMAR-THIS-THESE",
  version: 1,
  mechanicId: "grammar-this-these",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return picturedProblems(c.nouns, 2);
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const noun = pick(rng, config.nouns);
      const count = rng() < 0.5 ? 1 : randBetween(rng, 2, 4);
      const many = count > 1;
      const form: ThisTheseParams["form"] = difficulty === 1 ? "opening" : "sentence";
      const base = [
        { these: false, pluralNoun: form === "opening" ? many : false },
        { these: true, pluralNoun: form === "opening" ? many : true },
      ];
      // Level 3 adds the agreement mistakes "This is my pens." / "These are my pen."
      const extra = difficulty === 3 ? [{ these: false, pluralNoun: true }, { these: true, pluralNoun: false }] : [];
      const options = shuffleAll(rng, [...base, ...extra]);
      return makeItem(this, seed, difficulty, {
        params: { noun, count, form, options },
        lang: "en",
        prompt: "Look and choose.",
        promptAr: "واحد: This is my ... — أكثر من واحد: These are my ...s",
        visual: { type: "en-c-scene", scene: { kind: "thing", picture: pictureOf(noun), count }, text: form === "opening" ? `___ my ${many ? plural(noun) : noun}.` : null, say: null },
        input: { type: "choice", options: labelled(options.map((o) => (form === "opening" ? (o.these ? "These are" : "This is") : thisTheseLabel(noun, o)))) },
      });
    });
  },
  solution(item) {
    const many = item.params.count > 1;
    return solutionOf(item.params.options, (o) => o.these === many && (item.params.form === "opening" || o.pluralNoun === many));
  },
  check(item, answer) {
    const many = item.params.count > 1;
    return checkChoice(item.params.options, answer, (o) => o.these === many && (item.params.form === "opening" || o.pluralNoun === many));
  },
  explain(item) {
    const { noun, count } = item.params;
    const many = count > 1;
    return [`${count} ${many ? plural(noun) : noun}`, thisTheseLabel(noun, { these: many, pluralNoun: many }), many ? "أكثر من واحد ← These are + s" : "واحد ← This is"];
  },
  checkIntegrity(item) {
    return choiceIntegrity(asMech<ThisTheseParams>(this), item, item.params.options.length);
  },
};

/* ------------------------------------------------------------------ */
/* grammar-prep: Where's the pencil? It's in / on / under the desk.    */
/* ------------------------------------------------------------------ */

export type Prep = "in" | "on" | "under";
/** Positions that make sense for each place ("in" only where things can be put inside). */
export const PLACE_PREPS: Readonly<Record<string, readonly Prep[]>> = {
  desk: ["in", "on", "under"],
  cupboard: ["in", "on"],
  table: ["on", "under"],
  chair: ["on", "under"],
  shelf: ["on"],
};
/** Places that look alike in a drawing: never one as the other's wrong-place option. */
const SIMILAR_PLACES: ReadonlyArray<readonly [string, string]> = [["desk", "table"]];

export function prepPlausible(object: string, place: string, prep: Prep): boolean {
  if (!PLACE_PREPS[place]?.includes(prep)) return false;
  return !(object === "bag" && place === "desk" && prep === "in"); // a school bag does not go inside a desk
}

export interface PrepParams {
  object: string;
  place: string;
  prep: Prep;
  form: "word" | "sentence";
  options: Array<{ prep: Prep; place: string }>;
}

const PREPS: readonly Prep[] = ["in", "on", "under"];

export const grammarPrep: M<{ objects: string[]; places: string[] }, PrepParams> = {
  id: "GEN-EN-GRAMMAR-PREP",
  version: 1,
  mechanicId: "grammar-prep",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = picturedProblems(c.objects, 1);
    for (const pl of c.places ?? []) if (!PLACE_PREPS[pl]) p.push(`no drawing / positions for place ${pl}`);
    if (!Array.isArray(c.places) || c.places.length < 2) p.push("needs at least 2 places");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const object = pick(rng, config.objects);
      const place = pick(rng, config.places);
      const preps = PREPS.filter((pr) => prepPlausible(object, place, pr));
      if (!preps.length) return null;
      const prep = pick(rng, preps);
      let options: PrepParams["options"];
      if (difficulty === 1) {
        const plausible = preps.filter((p) => p !== prep);
        const other = pick(rng, plausible.length ? plausible : PREPS.filter((p) => p !== prep));
        options = shuffleAll(rng, [prep, other]).map((p) => ({ prep: p, place }));
      } else options = shuffleAll(rng, PREPS).map((p) => ({ prep: p, place }));
      if (difficulty === 3) {
        const wrongPlaces = config.places.filter((pl) => pl !== place && !SIMILAR_PLACES.some(([a, b]) => (a === pl && b === place) || (b === pl && a === place)));
        if (!wrongPlaces.length) return null;
        const wp = pick(rng, wrongPlaces);
        const wprep = pick(
          rng,
          PREPS.filter((p) => prepPlausible(object, wp, p)),
        );
        if (!wprep) return null;
        options = shuffleAll(rng, [...options, { prep: wprep, place: wp }]);
      }
      const sentence = difficulty === 3;
      return makeItem(this, seed, difficulty, {
        params: { object, place, prep, form: sentence ? "sentence" : "word", options },
        lang: "en",
        prompt: `Where's the ${object}?`,
        promptAr: "أين الشيء؟ in = داخل، on = على، under = تحت.",
        visual: { type: "en-c-scene", scene: { kind: "prep", object: pictureOf(object), place, prep }, text: sentence ? null : `It's ___ the ${place}.`, say: null },
        input: { type: "choice", options: labelled(options.map((o) => (sentence ? `It's ${o.prep} the ${o.place}.` : o.prep))) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (o) => o.prep === item.params.prep && o.place === item.params.place);
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (o) => o.prep === item.params.prep && o.place === item.params.place);
  },
  explain(item) {
    const { object, place, prep } = item.params;
    const ar = { in: "داخل", on: "على", under: "تحت" }[prep];
    return [`Where's the ${object}? It's ${prep} the ${place}.`, `${prep} = ${ar}`];
  },
  checkIntegrity(item) {
    const p = choiceIntegrity(asMech<PrepParams>(this), item, item.params.options.length);
    const { object, place, prep } = item.params;
    if (!prepPlausible(object, place, prep)) p.push("implausible scene");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* grammar-got-count: I've got one head / two arms / ten toes.         */
/* ------------------------------------------------------------------ */

/** Class Book U3 p41 chant. */
export const GOT_COUNT: Readonly<Record<string, number>> = { head: 1, face: 1, tummy: 1, arms: 2, hands: 2, legs: 2, knees: 2, feet: 2, fingers: 10, toes: 10 };

export interface GotCountParams {
  part: string;
  options: number[];
}

export const grammarGotCount: M<{ parts: string[] }, GotCountParams> = {
  id: "GEN-EN-GRAMMAR-GOT-COUNT",
  version: 1,
  mechanicId: "grammar-got-count",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    if (!Array.isArray(c.parts) || c.parts.length === 0) return ["parts required"];
    return c.parts.filter((p) => GOT_COUNT[p] === undefined).map((p) => `no book count for ${p}`);
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const part = pick(rng, config.parts);
      const right = GOT_COUNT[part]!;
      const book = [1, 2, 10].filter((n) => n !== right);
      const options = shuffleAll(rng, difficulty === 1 ? [right, pick(rng, book)] : difficulty === 2 ? [right, ...book] : [right, ...book, pick(rng, [3, 4, 5, 8])]);
      return makeItem(this, seed, difficulty, {
        params: { part, options },
        lang: "en",
        prompt: "Read and choose.",
        promptAr: `كم عددها في جسمك؟ (${entry(part).ar})`,
        visual: { type: "en-c-scene", scene: pictureOf(part) ? { kind: "thing", picture: pictureOf(part), count: 1 } : null, text: `I've got ___ ${part}.`, say: null },
        input: { type: "choice", options: labelled(options.map(numberWord)) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (n) => n === GOT_COUNT[item.params.part]);
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (n) => n === GOT_COUNT[item.params.part], "counting_error");
  },
  explain(item) {
    const n = GOT_COUNT[item.params.part]!;
    return [`I've got ${numberWord(n)} ${item.params.part}.`, `${entry(item.params.part).ar}: ${n}`];
  },
  checkIntegrity(item) {
    return choiceIntegrity(asMech<GotCountParams>(this), item, item.params.options.length);
  },
};

/* ------------------------------------------------------------------ */
/* grammar-whos-this: Who's this? It's my ...                          */
/* ------------------------------------------------------------------ */

export const GENDER: Readonly<Record<string, "male" | "female">> = {
  grandad: "male",
  dad: "male",
  brother: "male",
  uncle: "male",
  grandma: "female",
  mum: "female",
  sister: "female",
  aunt: "female",
};

/** "It's my me." is not English (the book says "... and me"), so "me" is never a target or option. */
const whoPool = (people: readonly string[]) => people.filter((p) => p !== "me" && pictureOf(p) && !pictureOf(p)!.startsWith("draw:"));

export interface WhosThisParams {
  person: string;
  options: string[];
}

export const grammarWhosThis: M<{ people: string[] }, WhosThisParams> = {
  id: "GEN-EN-GRAMMAR-WHOS-THIS",
  version: 1,
  mechanicId: "grammar-whos-this",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p = wordProblems(c.people, {});
    if (Array.isArray(c.people) && whoPool(c.people).length < 3) p.push("needs at least 3 pictured family words (not me)");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const pool = whoPool(config.people);
      const person = pick(rng, pool);
      const n = Math.min(byLevel(difficulty, [2, 3, 4] as const), pool.length);
      const others = pool.filter((p) => p !== person);
      // Level 3: same-gender family words first (mum / sister / grandma ...).
      const ranked = difficulty === 3 ? [...shuffleAll(rng, others.filter((p) => GENDER[p] === GENDER[person])), ...shuffleAll(rng, others.filter((p) => GENDER[p] !== GENDER[person]))] : shuffleAll(rng, others);
      const options = shuffleAll(rng, [person, ...ranked.slice(0, n - 1)]);
      return makeItem(this, seed, difficulty, {
        params: { person, options },
        lang: "en",
        prompt: "Who's this?",
        promptAr: "من هذا؟ اختر الكلمة.",
        visual: { type: "en-c-scene", scene: { kind: "thing", picture: pictureOf(person), count: 1 }, text: "It's my ___.", say: null },
        input: { type: "choice", options: labelled(options) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (o) => o === item.params.person);
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (o) => o === item.params.person);
  },
  explain(item) {
    const w = item.params.person;
    return [`Who's this? It's my ${w}.`, `${w} = ${entry(w).ar}`];
  },
  checkIntegrity(item) {
    const p = choiceIntegrity(asMech<WhosThisParams>(this), item, item.params.options.length);
    if (item.params.options.some((o, i) => item.params.options.some((x, j) => i < j && confusable(o, x)))) p.push("two people share a picture");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* grammar-he-she: He's got blue eyes. / She's got blue eyes.          */
/* ------------------------------------------------------------------ */

type FaceAttr = "hair" | "eyes" | "ears" | "mouth" | "nose";

export function parseFeature(f: string): { attr: FaceAttr; value: string } | null {
  let m = /^(blue|green|brown) eyes$/.exec(f);
  if (m) return { attr: "eyes", value: m[1]! };
  m = /^(brown|black|red|fair|grey) hair$/.exec(f);
  if (m) return { attr: "hair", value: m[1]! };
  if (f === "big ears") return { attr: "ears", value: "big" };
  m = /^a (big|small) mouth$/.exec(f);
  if (m) return { attr: "mouth", value: m[1]! };
  if (f === "a small nose") return { attr: "nose", value: "small" };
  return null;
}

export const featureTrue = (face: FaceSpec, f: string) => {
  const p = parseFeature(f);
  return p !== null && face[p.attr] === p.value;
};

const AGE: Readonly<Record<string, FaceSpec["age"]>> = { grandad: "old", grandma: "old", dad: "adult", mum: "adult", uncle: "adult", aunt: "adult", brother: "child", sister: "child" };

/** The drawn face: the asked feature, every other part plain (black or grey hair, brown eyes). */
export function faceFor(person: string, feature: string): FaceSpec {
  const age = AGE[person]!;
  const face: FaceSpec = { gender: GENDER[person]!, age, hair: age === "old" ? "grey" : "black", eyes: "brown", ears: "normal", mouth: "normal", nose: "normal" };
  const f = parseFeature(feature)!;
  (face as unknown as Record<string, string>)[f.attr] = f.value;
  return face;
}

export interface HeSheParams {
  person: string;
  feature: string;
  face: FaceSpec;
  form: "pronoun" | "sentence";
  options: Array<{ pronoun: "He" | "She"; feature: string }>;
}

const pronounOf = (person: string) => (GENDER[person] === "male" ? "He" : "She");

export const grammarHeShe: M<{ people: string[]; features: string[] }, HeSheParams> = {
  id: "GEN-EN-GRAMMAR-HE-SHE",
  version: 1,
  mechanicId: "grammar-he-she",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    for (const x of c.people ?? []) if (!GENDER[x]) p.push(`no he/she for ${x}`);
    for (const f of c.features ?? []) if (!parseFeature(f)) p.push(`cannot draw feature ${f}`);
    if (!c.people?.some((x) => GENDER[x] === "male") || !c.people?.some((x) => GENDER[x] === "female")) p.push("needs male and female people");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const person = pick(rng, config.people);
      const feature = pick(rng, config.features);
      const face = faceFor(person, feature);
      const he = pronounOf(person);
      const she = he === "He" ? "She" : "He";
      const form: HeSheParams["form"] = difficulty === 1 ? "pronoun" : "sentence";
      let options: HeSheParams["options"] = [
        { pronoun: he, feature },
        { pronoun: she, feature },
      ];
      if (difficulty === 3) {
        // A colour feature that is false for this face (sizes are never used as distractors).
        const falseColours = config.features.filter((f) => ["hair", "eyes"].includes(parseFeature(f)!.attr) && !featureTrue(face, f));
        if (falseColours.length) options.push({ pronoun: he, feature: pick(rng, falseColours) });
      }
      options = shuffleAll(rng, options);
      return makeItem(this, seed, difficulty, {
        params: { person, feature, face, form, options },
        lang: "en",
        prompt: "Look and choose.",
        promptAr: "للولد أو الرجل نقول He، وللبنت أو المرأة نقول She.",
        visual: { type: "en-c-scene", scene: { kind: "face", face, caption: `This is my ${person}.` }, text: form === "pronoun" ? `___'s got ${feature}.` : null, say: null },
        input: { type: "choice", options: labelled(options.map((o) => (form === "pronoun" ? o.pronoun : `${o.pronoun}'s got ${o.feature}.`))) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (o) => o.pronoun === pronounOf(item.params.person) && featureTrue(item.params.face, o.feature));
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (o) => o.pronoun === pronounOf(item.params.person) && featureTrue(item.params.face, o.feature));
  },
  explain(item) {
    const { person, feature } = item.params;
    const he = pronounOf(person);
    return [`my ${person} → ${he}`, `${he}'s got ${feature}.`, he === "He" ? "He للمذكر" : "She للمؤنث"];
  },
  checkIntegrity(item) {
    const p = choiceIntegrity(asMech<HeSheParams>(this), item, item.params.options.length);
    if (!featureTrue(item.params.face, item.params.feature)) p.push("face does not show the feature");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* grammar-there: There is one arm. / There are four arms.             */
/* ------------------------------------------------------------------ */

export const PART_PLURAL: Readonly<Record<string, string>> = { head: "heads", leg: "legs", arm: "arms", hand: "hands", eye: "eyes", foot: "feet" };
const PART_AR: Readonly<Record<string, string>> = { head: "الرؤوس", leg: "السيقان", arm: "الأذرع", hand: "الأيدي", eye: "العيون", foot: "الأقدام" };

export interface ThereOption {
  are: boolean;
  n: number;
  pluralNoun: boolean;
}
export interface ThereParams {
  part: string;
  k: number;
  options: ThereOption[];
}

export const thereLabel = (part: string, o: ThereOption) => `There ${o.are ? "are" : "is"} ${numberWord(o.n)} ${o.pluralNoun ? PART_PLURAL[part] : part}.`;
const thereTrue = (k: number, o: ThereOption) => o.n === k && o.are === (k !== 1) && o.pluralNoun === (k !== 1);

/** Monster body-part counts: the asked part has k, the rest are ordinary (hands sit on arms). */
export function monsterCounts(part: string, k: number): { head: number; eye: number; arm: number; leg: number } {
  const c = { head: 1, eye: 2, arm: 2, leg: 2 };
  if (part === "head") c.head = k;
  if (part === "eye") c.eye = k;
  if (part === "arm" || part === "hand") c.arm = k;
  if (part === "leg" || part === "foot") c.leg = k;
  return c;
}

export const grammarThere: M<{ parts: string[] }, ThereParams> = {
  id: "GEN-EN-GRAMMAR-THERE",
  version: 1,
  mechanicId: "grammar-there",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    if (!Array.isArray(c.parts) || c.parts.length === 0) return ["parts required"];
    return c.parts.filter((p) => !PART_PLURAL[p]).map((p) => `unknown part ${p}`);
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng: Rng) => {
      const part = pick(rng, config.parts);
      const maxK = part === "head" ? 4 : 6;
      const [lo, hi] = byLevel(difficulty, [[1, 3], [1, 5], [2, 6]] as const);
      const k = randBetween(rng, lo, Math.min(hi, maxK));
      const many = k !== 1;
      const right: ThereOption = { are: many, n: k, pluralNoun: many };
      const verbErr: ThereOption = { are: !many, n: k, pluralNoun: many };
      const nounErr: ThereOption = { are: many, n: k, pluralNoun: !many };
      const n2 = k === 1 ? 2 : rng() < 0.5 ? k - 1 : k + 1;
      const countErr: ThereOption = { are: n2 !== 1, n: n2, pluralNoun: n2 !== 1 };
      const options = shuffleAll(rng, difficulty === 1 ? [right, verbErr] : difficulty === 2 ? [right, verbErr, nounErr] : [right, verbErr, nounErr, countErr]);
      return makeItem(this, seed, difficulty, {
        params: { part, k, options },
        lang: "en",
        prompt: "Look at the monster. Choose the true sentence.",
        promptAr: `عُدّ ${PART_AR[part]} في الوحش، ثم اختر الجملة الصحيحة: There is للواحد، وThere are لأكثر من واحد.`,
        visual: { type: "en-c-scene", scene: { kind: "monster", part, counts: monsterCounts(part, k) }, text: null, say: null },
        input: { type: "choice", options: labelled(options.map((o) => thereLabel(part, o))) },
      });
    });
  },
  solution(item) {
    return solutionOf(item.params.options, (o) => thereTrue(item.params.k, o));
  },
  check(item, answer) {
    return checkChoice(item.params.options, answer, (o) => thereTrue(item.params.k, o));
  },
  explain(item) {
    const { part, k } = item.params;
    const right = { are: k !== 1, n: k, pluralNoun: k !== 1 };
    return [`${k} ${k === 1 ? part : PART_PLURAL[part]}`, thereLabel(part, right), k === 1 ? "واحد ← There is" : "أكثر من واحد ← There are + s"];
  },
  checkIntegrity(item) {
    return choiceIntegrity(asMech<ThereParams>(this), item, item.params.options.length);
  },
};

export const GRAMMAR_MECHANICS_C = [grammarAAn, grammarYesNo, grammarThisThese, grammarPrep, grammarGotCount, grammarWhosThis, grammarHeShe, grammarThere] as const;
