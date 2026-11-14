import { useMemo, useState } from "react";
import { QUIZ_MECHANICS, type Difficulty, type QuizItem, type ValidationResult } from "@ghaith/game-core";
import type { CatalogGame } from "../catalog";
import { adapt, type AdaptState, type ItemOutcome } from "../lib/adapt";
import { toArabicDigits } from "../lib/digits";
import { fingerprintOf, newId, newSeed, saveAttempt } from "../lib/progress";
import { canSpeak, speak } from "../lib/speech";
import { ChoiceAnswer, MultiAnswer, NumberAnswer, OrderAnswer } from "./inputs";
import { visualFor } from "./visuals";

export type PlayMode = "practice" | "assessment" | "review";

export interface PlanSlot {
  lessonId: string;
  game: CatalogGame;
  /** Fixed level (missions/review). Practice adapts from the game's last level. */
  difficulty?: Difficulty;
}

interface Props {
  title: string;
  mode: PlayMode;
  plan: PlanSlot[];
  sessionId: string;
  initialState?: AdaptState;
  /** Fingerprints of practised items; assessment items avoid them (separate bank). */
  avoid?: ReadonlySet<string>;
  /** Fixed seeds for reproducible automated tests. */
  seeds?: number[];
  onFinish: (summary: { firstTryCorrect: number; total: number; state: AdaptState }) => void;
  onExit: () => void;
}

const ASSESSMENT_SEED_BASE = 0x80000000; // practice seeds stay below, assessment seeds above

/** Automated UI tests only (?e2e=1): expose the expected answer so a test can drive the real widgets. */
const E2E = (() => {
  try {
    return new URLSearchParams(window.location.search).get("e2e") === "1";
  } catch {
    return false;
  }
})();

function generateItem(slot: PlanSlot, difficulty: Difficulty, mode: PlayMode, seed: number, avoid?: ReadonlySet<string>): QuizItem {
  const mech = QUIZ_MECHANICS.get(slot.game.mechanic)!;
  if (mode !== "assessment") return mech.generate(seed % ASSESSMENT_SEED_BASE, difficulty, slot.game.config);
  for (let i = 0; i < 50; i++) {
    const item = mech.generate((ASSESSMENT_SEED_BASE + ((seed + i * 7919) % ASSESSMENT_SEED_BASE)) >>> 0, difficulty, slot.game.config);
    if (!avoid?.has(fingerprintOf(item.params))) return item;
  }
  return mech.generate(ASSESSMENT_SEED_BASE + (seed % ASSESSMENT_SEED_BASE), difficulty, slot.game.config);
}

export function QuizPlayer({ title, mode, plan, sessionId, initialState, avoid, seeds, onFinish, onExit }: Props) {
  const [state, setState] = useState<AdaptState>(initialState ?? { difficulty: 1, streak: 0 });
  const [index, setIndex] = useState(0);
  const seedFor = (i: number) => seeds?.[i] ?? newSeed();
  const levelFor = (i: number, s: AdaptState) => plan[i]!.difficulty ?? s.difficulty;
  const [item, setItem] = useState<QuizItem>(() => generateItem(plan[0]!, levelFor(0, state), mode, seedFor(0), avoid));
  const [tryNumber, setTryNumber] = useState(1);
  const [hints, setHints] = useState(0);
  const [feedback, setFeedback] = useState<null | { kind: "correct" | "wrong" | "reveal"; text: string }>(null);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [pendingState, setPendingState] = useState<AdaptState | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const slot = plan[index]!;
  const mech = QUIZ_MECHANICS.get(slot.game.mechanic)!;
  const solution = useMemo(() => mech.solution(item), [mech, item]);
  const hintsAllowed = mode !== "assessment";
  const maxTries = mode === "assessment" ? 1 : 2;

  function onSubmit(answer: unknown) {
    if (feedback && feedback.kind !== "wrong") return;
    const result: ValidationResult = mech.check(item, answer);
    saveAttempt({
      id: newId(),
      at: new Date().toISOString(),
      sessionId,
      lessonId: slot.lessonId,
      gameId: slot.game.game_id,
      skillId: slot.game.skill_id,
      mechanicId: item.mechanicId,
      generatorId: item.generatorId,
      generatorVersion: item.generatorVersion,
      seed: item.seed,
      difficulty: item.difficulty,
      tryNumber,
      correct: result.correct,
      errorTypes: result.errors.map((e) => e.errorType),
      hintsUsed: hints,
      mode,
      fingerprint: fingerprintOf(item.params),
    });
    let outcome: ItemOutcome | null = null;
    if (result.correct) {
      outcome = tryNumber === 1 && hints === 0 ? "independent" : "with_help";
      if (outcome === "independent") setFirstTryCorrect((n) => n + 1);
      setFeedback({ kind: "correct", text: ["أحسنت!", "رائع!", "ممتاز!", "إجابة صحيحة!"][item.seed % 4]! });
    } else if (tryNumber < maxTries) {
      setTryNumber(tryNumber + 1);
      setInputKey((k) => k + 1);
      const inputProblem = result.errors.every((e) => e.errorType === "input_invalid");
      setFeedback({ kind: "wrong", text: inputProblem ? "اكتب إجابتك أولًا، ثم اضغط تحقّق." : "قريب! فكّر مرة أخرى، ويمكنك طلب تلميح." });
    } else {
      outcome = "missed";
      setFeedback({ kind: "reveal", text: mode === "assessment" ? "انتهى هذا السؤال. لنكمل." : "هذه هي الإجابة الصحيحة وطريقة الحل:" });
    }
    if (outcome) setPendingState(adapt(state, outcome));
  }

  function next() {
    const nextState = mode === "practice" ? pendingState ?? state : state;
    if (index + 1 >= plan.length) {
      onFinish({ firstTryCorrect, total: plan.length, state: nextState });
      return;
    }
    setState(nextState);
    setPendingState(null);
    setIndex(index + 1);
    setItem(generateItem(plan[index + 1]!, levelFor(index + 1, nextState), mode, seedFor(index + 1), avoid));
    setTryNumber(1);
    setHints(0);
    setFeedback(null);
    setInputKey((k) => k + 1);
  }

  const locked = feedback !== null && feedback.kind !== "wrong";
  const reveal = feedback?.kind === "reveal" && mode !== "assessment";
  const Visual = visualFor(item.visual.type);
  const common = { locked, reveal, solution, onSubmit, lang: item.lang ?? "ar" };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-4" aria-live="polite" data-testid="quiz" data-mechanic={item.mechanicId}>
      <header className="flex w-full items-center justify-between gap-2">
        <button type="button" onClick={onExit} className="rounded-xl bg-white px-4 py-2 text-lg font-bold shadow">
          → رجوع
        </button>
        <h2 className="text-center text-xl font-extrabold text-sky-900">{plan.length > 1 && mode !== "practice" ? title : slot.game.title}</h2>
        <span className="rounded-xl bg-white px-3 py-2 text-lg font-bold shadow" aria-label="رقم السؤال">
          {toArabicDigits(index + 1)} / {toArabicDigits(plan.length)}
        </span>
      </header>
      {mode === "assessment" && <p className="rounded-xl bg-violet-100 px-3 py-1 text-sm text-violet-900">مهمة الوحدة: أسئلة جديدة، محاولة واحدة، بلا تلميحات ولا وقت.</p>}

      <div className="flex w-full items-center justify-center gap-3">
        {item.lang === "en" ? (
          <div className="flex flex-col items-center gap-1">
            <p dir="ltr" lang="en" className="text-center text-3xl font-bold leading-relaxed" data-testid="instruction">
              {item.prompt}
            </p>
            {item.promptAr && <p className="text-center text-lg text-slate-600">{item.promptAr}</p>}
          </div>
        ) : (
          <p className="text-center text-2xl font-bold leading-relaxed" data-testid="instruction">
            {toArabicDigits(item.prompt)}
          </p>
        )}
        {canSpeak() && (
          <button type="button" aria-label="استمع للتعليمات" onClick={() => (item.lang === "en" ? speak(item.prompt, "en-GB") : speak(item.prompt))} className="rounded-full bg-white p-2 text-2xl shadow">
            🔊
          </button>
        )}
      </div>

      {E2E && <script type="application/json" data-testid="e2e-solution" dangerouslySetInnerHTML={{ __html: JSON.stringify({ solution, input: item.input.type }) }} />}
      {Visual ? (
        <Visual
          key={`v-${index}-${inputKey}`}
          visual={item.visual}
          item={item}
          reveal={reveal}
          solution={solution}
          locked={locked}
          hintLevel={hints}
          onAnswer={item.input.type === "visual" ? onSubmit : undefined}
        />
      ) : (
        <p className="text-rose-700">رسم غير متوفر: {item.visual.type}</p>
      )}

      <div key={`i-${index}-${inputKey}`} className="flex w-full justify-center">
        {item.input.type === "number" && <NumberAnswer {...common} unit={item.input.unit} />}
        {item.input.type === "choice" && <ChoiceAnswer {...common} options={item.input.options} />}
        {item.input.type === "multi" && <MultiAnswer {...common} options={item.input.options} exactly={item.input.exactly} />}
        {item.input.type === "order" && <OrderAnswer {...common} items={item.input.items} />}
      </div>

      {hints > 0 && !locked && (
        <p className="w-full max-w-md rounded-2xl bg-sky-100 p-3 text-center text-lg" data-testid="hint">
          💡 {slot.game.hint_levels[Math.min(hints, slot.game.hint_levels.length) - 1]}
        </p>
      )}

      {feedback && (
        <div
          role="status"
          data-testid="feedback"
          data-kind={feedback.kind}
          className={`w-full max-w-md rounded-2xl p-4 text-center text-xl font-bold ${
            feedback.kind === "correct" ? "bg-emerald-100 text-emerald-900" : feedback.kind === "wrong" ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"
          }`}
        >
          {feedback.text}
          {reveal && (
            <ol className="mt-2 list-inside list-decimal space-y-1 text-start text-lg font-semibold" data-testid="worked-steps">
              {mech.explain(item).map((s, i) => (
                <li key={i}>{item.lang === "en" ? s : toArabicDigits(s)}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {hintsAllowed && !locked && hints < slot.game.hint_levels.length && (
          <button type="button" onClick={() => setHints((h) => h + 1)} className="rounded-2xl bg-sky-100 px-5 py-3 text-lg font-bold shadow">
            💡 تلميح
          </button>
        )}
        {locked && (
          <button type="button" onClick={next} autoFocus className="rounded-2xl bg-sky-600 px-8 py-3 text-xl font-bold text-white shadow-lg active:scale-95">
            {index + 1 >= plan.length ? "إنهاء" : "التالي ←"}
          </button>
        )}
      </div>
    </section>
  );
}

/** Worked example: a level-1 item shown with its solution and steps (exploration phase). */
export function WorkedExample({ game, onClose }: { game: CatalogGame; onClose: () => void }) {
  const mech = QUIZ_MECHANICS.get(game.mechanic)!;
  const [seed, setSeed] = useState(1);
  const item = useMemo(() => mech.generate(seed, 1, game.config), [mech, seed, game.config]);
  const solution = mech.solution(item);
  const Visual = visualFor(item.visual.type);
  const solutionText =
    item.input.type === "number"
      ? String(solution)
      : item.input.type === "choice"
        ? item.input.options.find((o) => o.id === solution)?.label ?? ""
        : item.input.type === "multi"
          ? item.input.options.filter((o) => (solution as string[]).includes(o.id)).map((o) => o.label).join("، ")
          : item.input.type === "order"
            ? (solution as string[]).map((id) => item.input.type === "order" && item.input.items.find((o) => o.id === id)?.label).join("، ")
            : "";
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-4" data-testid="worked-example">
      <header className="flex w-full items-center justify-between">
        <button type="button" onClick={onClose} className="rounded-xl bg-white px-4 py-2 text-lg font-bold shadow">
          → رجوع
        </button>
        <h2 className="text-xl font-extrabold text-sky-900">مثال محلول: {game.title}</h2>
        <span />
      </header>
      <p className="text-center text-2xl font-bold" dir={item.lang === "en" ? "ltr" : undefined}>{item.lang === "en" ? item.prompt : toArabicDigits(item.prompt)}</p>
      {item.promptAr && <p className="text-center text-lg text-slate-600">{item.promptAr}</p>}
      {Visual && <Visual visual={item.visual} item={item} reveal solution={solution} locked hintLevel={3} />}
      {solutionText && (
        <p className="rounded-2xl bg-emerald-100 px-4 py-2 text-2xl font-extrabold">
          الإجابة: <span dir={item.lang === "en" ? "ltr" : undefined}>{item.lang === "en" ? solutionText : toArabicDigits(solutionText)}</span>
        </p>
      )}
      <ol className="w-full max-w-md list-inside list-decimal space-y-2 rounded-2xl bg-white p-4 text-xl shadow">
        {mech.explain(item).map((s, i) => (
          <li key={i}>{item.lang === "en" ? s : toArabicDigits(s)}</li>
        ))}
      </ol>
      <button type="button" onClick={() => setSeed((s) => s + 1)} className="rounded-2xl bg-sky-100 px-5 py-3 text-lg font-bold shadow">
        مثال آخر
      </button>
    </section>
  );
}
