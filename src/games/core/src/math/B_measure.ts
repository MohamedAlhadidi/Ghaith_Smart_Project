/**
 * Measurement (MATH-S1 L19-L25, p22-28): reading a centimetre ruler, comparing results (farthest,
 * fastest, highest, heaviest), seconds on a stopwatch, minutes and seconds, and a dial scale in grams.
 */
import type { ErrorType } from "../types";
import {
  byLevel,
  exactlyOneCorrect,
  isWholeNumber,
  makeItem,
  ok,
  optionProblems,
  randInt,
  sample,
  shuffle,
  wrong,
  type AnswerInput,
  type QuizMechanic,
  type Visual,
} from "../quiz";
import { checkWhole, choiceId, countOf, NOUNS, pickOne, skipSequence } from "./B_common";

/* ------------------------------------------------------------------ */
/* ruler-read (p.22-24)                                                */
/* ------------------------------------------------------------------ */

export interface RulerConfig {
  maxCm: number;
}
export interface RulerParams {
  start: number;
  end: number;
  maxCm: number;
  object: string;
}
const RULER_OBJECTS = ["القلم", "الشريط", "الخيط", "الممحاة", "الفرشاة", "المفتاح"];

export const rulerRead: QuizMechanic<RulerConfig, RulerParams> = {
  id: "GEN-RULER-READ",
  version: 1,
  mechanicId: "ruler-read",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.maxCm) && c.maxCm >= 10 && c.maxCm <= 30 ? [] : ["maxCm must be 10..30"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1-2 start at 0 (short, then up to the ruler's end); level 3 starts at 1-3 cm.
      const start = difficulty === 3 ? randInt(rng, 1, 3) : 0;
      const [lo, hi] = byLevel(difficulty, [[2, Math.min(10, config.maxCm)], [5, config.maxCm], [start + 3, config.maxCm]] as const);
      const end = randInt(rng, lo, hi);
      const object = pickOne(rng, RULER_OBJECTS);
      return makeItem(this, seed, difficulty, {
        params: { start, end, maxCm: config.maxCm, object },
        prompt: `كم طول ${object} بالسنتيمتر؟`,
        visual: { type: "b-ruler", maxCm: config.maxCm, start, end, object },
        input: { type: "number", unit: "سم", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return item.params.end - item.params.start;
  },
  check(item, answer) {
    const { start, end } = item.params;
    return checkWhole(end - start, answer, [[end, "counting_error"]], { 1: "off_by_one" }); // reading the end mark
  },
  explain(item) {
    const { start, end, object } = item.params;
    if (start === 0) return [`طرف ${object} الأول عند الصفر.`, `الطرف الآخر عند ${end}.`, `إذن الطول ${end} سم.`];
    return [`طرف ${object} الأول عند ${start}، وليس عند الصفر.`, `الطرف الآخر عند ${end}.`, `${end} - ${start} = ${end - start}، إذن الطول ${end - start} سم.`];
  },
  checkIntegrity(item) {
    const { start, end, maxCm } = item.params;
    const p: string[] = [];
    if (!(start >= 0 && end > start + 1 && end <= maxCm)) p.push("object must lie on the ruler");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* compare-winner (p.26-28)                                            */
/* ------------------------------------------------------------------ */

export type WinnerContext = "distance" | "time" | "height" | "mass";
export interface CompareWinnerConfig {
  context: WinnerContext | "mixed";
}
export interface WinnerEntry {
  name: string;
  /** Value in the base unit: steps, seconds, centimetres or grams. */
  value: number;
  /** Mass only: shown in kilograms (1 كغ = 1000 غ). */
  inKg?: boolean;
}
export interface CompareWinnerParams {
  context: WinnerContext;
  entries: WinnerEntry[];
}

const NAMES = ["أمل", "أحمد", "عائشة", "راشد", "هدى", "سالم", "مريم", "خلفان", "سعيد", "خديجة", "فاطمة", "يوسف", "شيخة", "علي"];
/** Book examples: sandbag throws (Amal 5, Ahmed 18, Aisha 11 steps) and a race (Rashid 12 s, Huda 22 s, Ahmed 17 s). */
const BOOK_SETS: Partial<Record<WinnerContext, WinnerEntry[]>> = {
  distance: [{ name: "أمل", value: 5 }, { name: "أحمد", value: 18 }, { name: "عائشة", value: 11 }],
  time: [{ name: "راشد", value: 12 }, { name: "هدى", value: 22 }, { name: "أحمد", value: 17 }],
};
/** The race is won by the shortest time; every other result by the largest. */
const smallestWins = (c: WinnerContext) => c === "time";

export function resultText(context: WinnerContext, e: WinnerEntry): string {
  const v = e.value;
  switch (context) {
    case "distance":
      return `${v} ${v >= 3 && v <= 10 ? "خطوات" : "خطوة"}`;
    case "time":
      return `${v} ${v >= 3 && v <= 10 ? "ثوانٍ" : "ثانية"}`;
    case "height":
      return `${v} سم`;
    default:
      return e.inKg ? `${v / 1000} كغ` : `${v} غ`;
  }
}

function winnerIndex(p: CompareWinnerParams): number {
  const vals = p.entries.map((e) => e.value);
  const target = smallestWins(p.context) ? Math.min(...vals) : Math.max(...vals);
  return vals.indexOf(target);
}

const WINNER_PROMPT: Record<WinnerContext, string> = {
  distance: "رمى الأطفال كيس الرمل، وقاسوا المسافة بالخطوات. من رمى أبعد مسافة؟",
  time: "تسابق الأطفال، وقاسوا وقت كل واحد بالثواني. من الفائز في السباق؟",
  height: "قفز الأطفال إلى أعلى ما يستطيعون، وقاسوا الارتفاع بالسنتيمتر. من قفز أعلى؟",
  mass: "وزن كل طفل كيسًا من التمر. كيس من هو الأثقل؟",
};
const RANGES: Record<WinnerContext, [number, number]> = { distance: [3, 30], time: [8, 40], height: [10, 60], mass: [1, 10] };

export const compareWinner: QuizMechanic<CompareWinnerConfig, CompareWinnerParams> = {
  id: "GEN-COMPARE-WINNER",
  version: 1,
  mechanicId: "compare-winner",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return ["distance", "time", "height", "mass", "mixed"].includes(c.context) ? [] : ["unknown context"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const context: WinnerContext = config.context === "mixed" ? pickOne(rng, ["distance", "time"] as const) : config.context;
      const names = shuffle(rng, NAMES).slice(0, 3);
      let entries: WinnerEntry[];
      const book = BOOK_SETS[context];
      if (difficulty === 1 && book && rng() < 0.4) {
        entries = shuffle(rng, book);
      } else if (context === "mass") {
        // Grams: hundreds at level 1, fifties at level 2; level 3 may mix in 1 كغ = 1000 غ.
        const step = difficulty === 1 ? 100 : 50;
        const vals = [0, 1, 2].map(() => step * randInt(rng, Math.ceil(100 / step), Math.floor(950 / step)));
        entries = names.map((name, i) => ({ name, value: vals[i]! }));
        if (difficulty === 3 && rng() < 0.5) {
          const k = randInt(rng, 0, 2);
          entries[k] = { name: names[k]!, value: 1000, inKg: true };
          if (!entries.some((e, i) => i !== k && e.value >= 500)) return null; // the trap: a large gram number
        }
      } else {
        const [lo, hi] = RANGES[context];
        entries = names.map((name) => ({ name, value: randInt(rng, lo, hi) }));
      }
      const sorted = entries.map((e) => e.value).sort((x, y) => x - y);
      const gaps = [sorted[1]! - sorted[0]!, sorted[2]! - sorted[1]!];
      const minGap = context === "mass" ? byLevel(difficulty, [200, 100, 50] as const) : byLevel(difficulty, [4, 2, 1] as const);
      if (Math.min(...gaps) < minGap) return null;
      if (difficulty === 3 && context !== "mass" && Math.min(...gaps) > 3) return null; // close results
      const params: CompareWinnerParams = { context, entries };
      const options = entries.map((e, i) => ({ id: `p${i}`, label: e.name }));
      return makeItem(this, seed, difficulty, {
        params,
        prompt: WINNER_PROMPT[context],
        visual: { type: "b-results", context, entries: entries.map((e) => ({ name: e.name, text: resultText(context, e) })) },
        input: { type: "choice", options },
      });
    });
  },
  solution(item) {
    return `p${winnerIndex(item.params)}`;
  },
  check(item, answer) {
    const { context, entries } = item.params;
    const expected = this.solution(item) as string;
    const id = choiceId(answer, item.input);
    if (id === null) return wrong(expected, answer, "input_invalid");
    if (id === expected) return ok();
    const picked = entries[Number(id.slice(1))]!;
    const right = entries[winnerIndex(item.params)]!;
    const vals = entries.map((e) => e.value);
    const opposite = smallestWins(context) ? Math.max(...vals) : Math.min(...vals);
    let type: ErrorType = "other";
    if (context === "mass" && right.inKg && !picked.inKg) type = "unit_confusion";
    else if (picked.value === opposite) type = "comparison_direction";
    return wrong(expected, answer, type);
  },
  explain(item) {
    const { context, entries } = item.params;
    const w = entries[winnerIndex(item.params)]!;
    const list = entries.map((e) => `${e.name}: ${resultText(context, e)}`).join("، ");
    const rule =
      context === "time"
        ? "في السباق يفوز صاحب أقصر وقت، أي أصغر عدد من الثواني."
        : context === "distance"
          ? "يفوز من رمى أبعد، أي أكبر عدد من الخطوات."
          : context === "height"
            ? "الأعلى قفزًا صاحب أكبر ارتفاع."
            : entries.some((e) => e.inKg)
              ? "الكيلوغرام 1000 غرام، فنقارن بالغرامات."
              : "الأثقل صاحب أكبر عدد من الغرامات.";
    return [list, rule, `الإجابة: ${w.name} (${resultText(context, w)}).`];
  },
  checkIntegrity(item) {
    const p = [...exactlyOneCorrect(this, item), ...(item.input.type === "choice" ? optionProblems(item.input.options) : [])];
    const vals = item.params.entries.map((e) => e.value);
    if (new Set(vals).size !== vals.length) p.push("results must differ");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* stopwatch-read (p.25)                                               */
/* ------------------------------------------------------------------ */

export interface StopwatchParams {
  seconds: number;
  /** Numbers printed every 5 or every 15 seconds. */
  labelStep: 5 | 15;
}

export const stopwatchRead: QuizMechanic<Record<string, never>, StopwatchParams> = {
  id: "GEN-STOPWATCH-READ",
  version: 1,
  mechanicId: "stopwatch-read",
  difficulties: [1, 2, 3],
  validateConfig() {
    return [];
  },
  generate(seed, difficulty) {
    return sample(seed, (rng) => {
      // Level 1: hand on a printed multiple of 5; level 2: multiples of 5 with fewer numbers printed; level 3: any second.
      const labelStep: 5 | 15 = difficulty === 2 ? 15 : 5;
      const seconds = difficulty === 3 ? randInt(rng, 1, 59) : 5 * randInt(rng, 1, 11);
      if (difficulty === 3 && seconds % 5 === 0) return null;
      if (difficulty === 2 && seconds % 15 === 0) return null;
      return makeItem(this, seed, difficulty, {
        params: { seconds, labelStep },
        prompt: "كم ثانية تُظهر ساعة التوقيت؟",
        visual: { type: "b-stopwatch", seconds, labelStep },
        input: { type: "number", unit: "ثانية", maxDigits: 2 },
      });
    });
  },
  solution(item) {
    return item.params.seconds;
  },
  check(item, answer) {
    const s = item.params.seconds;
    const specific: Array<readonly [number, ErrorType]> = s % 5 === 0 ? [[s / 5, "counting_error"]] : [];
    return checkWhole(s, answer, specific, { 1: "off_by_one", 5: "counting_error", 15: "counting_error" });
  },
  explain(item) {
    const s = item.params.seconds;
    const base = s - (s % 5);
    const reading = `العقرب عند ${countOf(s, NOUNS.second)}.`;
    if (s % 5 === 0) return ["كل علامة كبيرة تزيد 5 ثوانٍ.", `نعدّ بالقفز 5 حتى العقرب: ${skipSequence(5, s / 5).join("، ")}.`, reading];
    if (base === 0) return ["العقرب قبل العلامة الكبيرة 5.", `نعدّ العلامات الصغيرة من البداية: ${s}.`, reading];
    return [`العقرب بعد العلامة الكبيرة ${base}.`, `نعدّ العلامات الصغيرة بعدها: ${s - base}.`, `${base} + ${s - base} = ${s}`, reading];
  },
  checkIntegrity(item) {
    const s = item.params.seconds;
    const p: string[] = [];
    if (!(isWholeNumber(s) && s >= 1 && s <= 59)) p.push("seconds must be 1..59");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

/* ------------------------------------------------------------------ */
/* time-convert (p.25): 1 minute = 60 s, half a minute = 30 s, tallies */
/* ------------------------------------------------------------------ */

export interface TimeConvertConfig {
  maxMinutes: number;
}
export type TimeConvertParams =
  | { kind: "tally"; tallies: number }
  | { kind: "minute-seconds" }
  | { kind: "half-seconds" }
  | { kind: "minute-half-seconds" }
  | { kind: "name-duration"; seconds: number; choices: number[] }
  | { kind: "longer"; a: number; b: number };

/** Durations in words, as on p.25: «دقيقة واحدة», «نصف دقيقة», «دقيقتان». */
export function durationText(seconds: number, asSeconds = false): string {
  if (asSeconds) return `${seconds} ${seconds >= 3 && seconds <= 10 ? "ثوانٍ" : "ثانية"}`;
  const named: Record<number, string> = { 30: "نصف دقيقة", 60: "دقيقة واحدة", 90: "دقيقة ونصف", 120: "دقيقتان", 180: "3 دقائق" };
  return named[seconds] ?? `${seconds} ثانية`;
}

export const timeConvert: QuizMechanic<TimeConvertConfig, TimeConvertParams> = {
  id: "GEN-TIME-CONVERT",
  version: 1,
  mechanicId: "time-convert",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    return isWholeNumber(c.maxMinutes) && c.maxMinutes >= 2 && c.maxMinutes <= 5 ? [] : ["maxMinutes must be 2..5"];
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      const kinds = byLevel(difficulty, [["tally", "minute-seconds"], ["tally", "half-seconds", "name-duration"], ["minute-half-seconds", "name-duration", "longer"]] as const);
      const kind = pickOne(rng, kinds);
      let params: TimeConvertParams;
      let prompt: string;
      let visual: Visual = { type: "b-sandtimer" };
      let input: AnswerInput;
      switch (kind) {
        case "tally": {
          const tallies = randInt(rng, difficulty === 1 ? 1 : 2, config.maxMinutes);
          params = { kind, tallies };
          prompt = "يستخدم أحمد ساعة رملية مدتها دقيقة واحدة، ويرسم علامة عدّ كلما فرغت. كم دقيقة سجّل؟";
          visual = { type: "b-tally", count: tallies };
          input = { type: "number", unit: "دقيقة", maxDigits: 1 };
          break;
        }
        case "minute-seconds":
          params = { kind };
          prompt = "الدقيقة الواحدة = كم ثانية؟";
          input = { type: "number", unit: "ثانية", maxDigits: 3 };
          break;
        case "half-seconds":
          params = { kind };
          prompt = "نصف الدقيقة = كم ثانية؟";
          input = { type: "number", unit: "ثانية", maxDigits: 3 };
          break;
        case "minute-half-seconds":
          params = { kind };
          prompt = "دقيقة واحدة و30 ثانية = كم ثانية؟";
          input = { type: "number", unit: "ثانية", maxDigits: 3 };
          break;
        case "name-duration": {
          const seconds = difficulty === 3 ? pickOne(rng, [30, 60, 90]) : pickOne(rng, [30, 60]);
          const choices = shuffle(rng, difficulty === 3 ? [30, 60, 90, 120] : [30, 60, 120]);
          params = { kind, seconds, choices };
          prompt = `سجّل أحمد ${seconds} ثانية. كم يساوي هذا؟`;
          input = { type: "choice", options: choices.map((s) => ({ id: `t${s}`, label: durationText(s) })) };
          break;
        }
        default: {
          // A named duration against a number of seconds; the larger number is not always the longer time.
          const named = pickOne(rng, [30, 60, 120]);
          const b = 5 * randInt(rng, 4, 20);
          if (Math.abs(named - b) < 10) return null;
          const swap = rng() < 0.5;
          params = { kind: "longer", a: swap ? b : named, b: swap ? named : b };
          prompt = "أيهما أطول وقتًا؟";
          const label = (s: number) => (s === named ? durationText(s) : durationText(s, true));
          input = { type: "choice", options: [{ id: "a", label: label(params.a) }, { id: "b", label: label(params.b) }] };
        }
      }
      return makeItem(this, seed, difficulty, { params, prompt, visual, input });
    });
  },
  solution(item) {
    const p = item.params;
    switch (p.kind) {
      case "tally":
        return p.tallies;
      case "minute-seconds":
        return 60;
      case "half-seconds":
        return 30;
      case "minute-half-seconds":
        return 90;
      case "name-duration":
        return `t${p.seconds}`;
      default:
        return p.a > p.b ? "a" : "b";
    }
  },
  check(item, answer) {
    const p = item.params;
    const expected = this.solution(item);
    switch (p.kind) {
      case "tally":
        return checkWhole(p.tallies, answer, [[60 * p.tallies, "unit_confusion"]], { 1: "counting_error" });
      case "minute-seconds":
        return checkWhole(60, answer, [[100, "unit_confusion"], [1, "unit_confusion"], [30, "other"]], {});
      case "half-seconds":
        return checkWhole(30, answer, [[50, "unit_confusion"], [60, "other"]], {});
      case "minute-half-seconds":
        return checkWhole(90, answer, [[130, "place_value_error"], [31, "unit_confusion"], [60, "partial_answer"], [30, "partial_answer"]], { 1: "off_by_one" });
      default: {
        const id = choiceId(answer, item.input);
        if (id === null) return wrong(expected, answer, "input_invalid");
        return id === expected ? ok() : wrong(expected, answer, "unit_confusion");
      }
    }
  },
  explain(item) {
    const p = item.params;
    switch (p.kind) {
      case "tally":
        return ["كل علامة عدّ تعني أن الساعة الرملية فرغت مرة: دقيقة واحدة.", `عدد العلامات ${p.tallies}.`, `إذن سجّل ${countOf(p.tallies, NOUNS.minuteAcc)}.`];
      case "minute-seconds":
        return ["عقرب الثواني يدور دورة كاملة في دقيقة واحدة.", "الدورة الكاملة 60 ثانية.", "الدقيقة = 60 ثانية."];
      case "half-seconds":
        return ["الدقيقة = 60 ثانية.", "نصف 60 هو 30، لأن 30 + 30 = 60.", "نصف الدقيقة = 30 ثانية."];
      case "minute-half-seconds":
        return ["الدقيقة = 60 ثانية.", "60 + 30 = 90", "دقيقة و30 ثانية = 90 ثانية."];
      case "name-duration":
        return ["الدقيقة = 60 ثانية، ونصف الدقيقة = 30 ثانية.", `${p.seconds} ثانية = ${durationText(p.seconds)}.`];
      default: {
        const longer = Math.max(p.a, p.b);
        const shorter = Math.min(p.a, p.b);
        return ["نحوّل الوقتين إلى ثوانٍ: الدقيقة = 60 ثانية.", `${shorter} < ${longer}`, `الأطول: ${durationText(longer)}${[30, 60, 90, 120].includes(longer) ? ` (${longer} ثانية)` : ""}.`];
      }
    }
  },
  checkIntegrity(item) {
    const p = item.params;
    if (p.kind === "name-duration" || p.kind === "longer") {
      const problems = [...exactlyOneCorrect(this, item), ...(item.input.type === "choice" ? optionProblems(item.input.options) : [])];
      if (p.kind === "longer" && p.a === p.b) problems.push("durations must differ");
      return problems;
    }
    return item.input.type === "number" ? [] : ["expects number input"];
  },
};

/* ------------------------------------------------------------------ */
/* scale-read (p.28): dial scale in grams, 0/max at the top, clockwise  */
/* ------------------------------------------------------------------ */

export interface ScaleReadConfig {
  max: number;
  tick: number;
}
export interface ScaleReadParams {
  value: number;
  max: number;
  tick: number;
  /** Numbers printed every `labelStep` grams. */
  labelStep: number;
}

export const scaleRead: QuizMechanic<ScaleReadConfig, ScaleReadParams> = {
  id: "GEN-SCALE-READ",
  version: 1,
  mechanicId: "scale-read",
  difficulties: [1, 2, 3],
  validateConfig(c) {
    const p: string[] = [];
    if (!isWholeNumber(c.tick) || c.tick < 100 || c.tick % 50 !== 0) p.push("tick must be a multiple of 50, at least 100");
    if (!isWholeNumber(c.max) || c.max > 1000 || c.max % c.tick !== 0 || c.max / c.tick < 4) p.push("max must be a multiple of tick, up to 1000 g");
    return p;
  },
  generate(seed, difficulty, config) {
    return sample(seed, (rng) => {
      // Level 1: on a numbered mark (multiples of 100); level 2: a small 50 g mark; level 3: numbers every other mark.
      // The book's dial (p.28) has 0 and max on the same top mark, so the pointer never rests there (ambiguous).
      const labelStep = difficulty === 3 && (config.max / config.tick) % 2 === 0 ? 2 * config.tick : config.tick;
      const value = difficulty === 1 ? config.tick * randInt(rng, 1, config.max / config.tick - 1) : 50 * randInt(rng, 1, config.max / 50 - 1);
      if (difficulty === 2 && value % config.tick === 0) return null;
      if (difficulty === 3 && value % labelStep === 0) return null;
      return makeItem(this, seed, difficulty, {
        params: { value, max: config.max, tick: config.tick, labelStep },
        prompt: "كم غرامًا يُظهر الميزان؟",
        visual: { type: "b-dial", max: config.max, tick: config.tick, labelStep, value },
        input: { type: "number", unit: "غ", maxDigits: 4 },
      });
    });
  },
  solution(item) {
    return item.params.value;
  },
  check(item, answer) {
    const v = item.params.value;
    return checkWhole(v, answer, v % 100 === 0 ? [[v / 100, "unit_confusion"]] : [], { 50: "counting_error", 100: "counting_error", [item.params.tick]: "counting_error" });
  },
  explain(item) {
    const { value: v, tick, labelStep } = item.params;
    const steps = [`كل علامة كبيرة تزيد ${tick} غ، وكل علامة صغيرة تزيد 50 غ.`];
    const base = v - (v % tick);
    if (labelStep !== tick) steps.push(`بعض العلامات الكبيرة بلا عدد مكتوب: نزيد ${tick} على العدد المكتوب قبلها.`);
    if (v % tick !== 0) steps.push(base === 0 ? "المؤشر عند أول علامة صغيرة بعد الصفر." : `المؤشر بعد ${base} بعلامة صغيرة: ${base} + 50 = ${v}`);
    else if (labelStep !== tick) steps.push(`${v - tick} + ${tick} = ${v}`);
    steps.push(`المؤشر عند ${v} غ.`);
    return steps;
  },
  checkIntegrity(item) {
    const { value, max } = item.params;
    const p: string[] = [];
    if (!(value > 0 && value < max && value % 50 === 0)) p.push("value must be a 50 g mark strictly between 0 and max (they share the top mark)");
    if (item.input.type !== "number") p.push("expects number input");
    return p;
  },
};

export const MEASURE_MECHANICS = [rulerRead, compareWinner, stopwatchRead, timeConvert, scaleRead] as const;
