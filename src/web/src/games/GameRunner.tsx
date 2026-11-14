import { useState } from "react";
import {
  fragmentFillGenerator,
  locateGenerator,
  pathMoveGenerator,
  type FragmentFillItem,
  type LocateItem,
  type PathMoveItem,
  type ValidationResult,
} from "@ghaith/game-core";
import type { GameDefinition } from "../content";
import { adapt, type AdaptState, type ItemOutcome } from "../lib/adapt";
import { toArabicDigits } from "../lib/digits";
import { newId, newSeed, saveAttempt } from "../lib/progress";
import { canSpeak, speak } from "../lib/speech";
import { FragmentFillGame } from "./FragmentFillGame";
import { LocateGame } from "./LocateGame";
import { PathMoveGame } from "./PathMoveGame";

type AnyItem = FragmentFillItem | LocateItem | PathMoveItem;

const ROUND_LENGTH = 5; // short rounds; the bank is large but a session shows little of it

function generate(game: GameDefinition, state: AdaptState, seed: number): AnyItem {
  switch (game.game_mechanic_id) {
    case "grid-fragment-fill":
      return fragmentFillGenerator.generate(seed, state.difficulty, "rtl");
    case "grid-locate":
      return locateGenerator.generate(seed, state.difficulty, "rtl");
    case "grid-path-move":
      return pathMoveGenerator.generate(seed, state.difficulty, "rtl");
  }
}

function instruction(item: AnyItem): string {
  switch (item.kind) {
    case "fragment-fill":
      return "أكمل الأعداد الناقصة في قطعة لوحة المائة.";
    case "locate":
      return `المس المربع الذي يسكن فيه العدد ${toArabicDigits(item.target)}.`;
    case "path-move":
      return "ابدأ من العدد الأصفر واتبع الأسهم. عند أي عدد تصل؟";
  }
}

interface Props {
  game: GameDefinition;
  lessonId: string;
  sessionId: string;
  initialState?: AdaptState;
  /** Fixed seed list for reproducible tests (e2e); production uses fresh random seeds. */
  seeds?: number[];
  onFinish: (summary: { firstTryCorrect: number; total: number; state: AdaptState }) => void;
  onExit: () => void;
}

export function GameRunner({ game, lessonId, sessionId, initialState, seeds, onFinish, onExit }: Props) {
  const [state, setState] = useState<AdaptState>(initialState ?? { difficulty: 1, streak: 0 });
  const [index, setIndex] = useState(0);
  const seedFor = (i: number) => seeds?.[i] ?? newSeed();
  const [item, setItem] = useState<AnyItem>(() => generate(game, state, seedFor(0)));
  const [tryNumber, setTryNumber] = useState(1);
  const [hints, setHints] = useState(0);
  const [feedback, setFeedback] = useState<null | { kind: "correct" | "wrong" | "reveal"; text: string }>(null);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [pendingState, setPendingState] = useState<AdaptState | null>(null);

  function record(result: ValidationResult) {
    saveAttempt({
      id: newId(),
      at: new Date().toISOString(),
      sessionId,
      lessonId,
      gameId: game.game_id,
      skillId: game.skill_id,
      mechanicId: item.mechanicId,
      generatorId: item.generatorId,
      generatorVersion: item.generatorVersion,
      seed: item.seed,
      difficulty: item.difficulty,
      tryNumber,
      correct: result.correct,
      errorTypes: result.errors.map((e) => e.errorType),
      hintsUsed: hints,
    });
  }

  function onSubmit(result: ValidationResult) {
    if (feedback && feedback.kind !== "wrong") return;
    record(result);
    let outcome: ItemOutcome | null = null;
    if (result.correct) {
      outcome = tryNumber === 1 && hints === 0 ? "independent" : "with_help";
      if (outcome === "independent") setFirstTryCorrect((n) => n + 1);
      setFeedback({ kind: "correct", text: game.feedback_correct });
    } else if (tryNumber === 1) {
      setTryNumber(2);
      setFeedback({ kind: "wrong", text: game.feedback_wrong });
    } else {
      outcome = "missed";
      setFeedback({ kind: "reveal", text: "هذه هي الإجابة الصحيحة. سنتدرب عليها مرة أخرى لاحقًا." });
    }
    if (outcome) setPendingState(adapt(state, outcome));
  }

  function next() {
    const nextState = pendingState ?? state;
    if (index + 1 >= ROUND_LENGTH) {
      onFinish({ firstTryCorrect, total: ROUND_LENGTH, state: nextState });
      return;
    }
    setState(nextState);
    setPendingState(null);
    setIndex(index + 1);
    setItem(generate(game, nextState, seedFor(index + 1)));
    setTryNumber(1);
    setHints(0);
    setFeedback(null);
  }

  const locked = feedback !== null && feedback.kind !== "wrong";
  const reveal = feedback?.kind === "reveal";
  const common = { hintLevel: hints, reveal, locked, onSubmit };
  const text = instruction(item);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-4" aria-live="polite">
      <header className="flex w-full items-center justify-between gap-2">
        <button type="button" onClick={onExit} className="rounded-xl bg-white px-4 py-2 text-lg font-bold shadow">
          → رجوع
        </button>
        <h2 className="text-xl font-extrabold text-sky-900">{game.title}</h2>
        <span className="rounded-xl bg-white px-3 py-2 text-lg font-bold shadow" aria-label="رقم السؤال">
          {toArabicDigits(index + 1)} / {toArabicDigits(ROUND_LENGTH)}
        </span>
      </header>

      <div className="flex w-full items-center justify-center gap-3">
        <p className="text-center text-2xl font-bold" data-testid="instruction">
          {text}
        </p>
        {canSpeak() && (
          <button type="button" aria-label="استمع للتعليمات" onClick={() => speak(text)} className="rounded-full bg-white p-2 text-2xl shadow">
            🔊
          </button>
        )}
      </div>

      {item.kind === "fragment-fill" && <FragmentFillGame key={`${index}`} item={item} {...common} />}
      {item.kind === "locate" && <LocateGame key={`${index}`} item={item} {...common} />}
      {item.kind === "path-move" && <PathMoveGame key={`${index}`} item={item} {...common} />}

      {hints > 0 && !locked && (
        <p className="w-full max-w-md rounded-2xl bg-sky-100 p-3 text-center text-lg" data-testid="hint">
          💡 {game.hint_levels[Math.min(hints, game.hint_levels.length) - 1]}
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
        </div>
      )}

      <div className="flex gap-3">
        {!locked && hints < game.hint_levels.length && (
          <button type="button" onClick={() => setHints((h) => h + 1)} className="rounded-2xl bg-sky-100 px-5 py-3 text-lg font-bold shadow">
            💡 تلميح
          </button>
        )}
        {locked && (
          <button
            type="button"
            onClick={next}
            autoFocus
            className="rounded-2xl bg-sky-600 px-8 py-3 text-xl font-bold text-white shadow-lg active:scale-95"
          >
            {index + 1 >= ROUND_LENGTH ? "إنهاء الجولة" : "التالي ←"}
          </button>
        )}
      </div>
    </section>
  );
}
