/** All quiz mechanics, keyed by mechanic id used in content/curriculum lesson catalogues. */
import type { QuizMechanic } from "../quiz";
import { PAIRS_MECHANICS } from "./pairs";
import { MECHANICS_A } from "./registryA";
import { MECHANICS_B } from "./registryB";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyQuizMechanic = QuizMechanic<any, any>;

/** Mechanics with their own bespoke engines (hundred square), not QuizMechanic. */
export const LEGACY_MECHANICS = ["hsq-fragment", "hsq-locate", "hsq-path"] as const;

export const QUIZ_MECHANICS: ReadonlyMap<string, AnyQuizMechanic> = (() => {
  const map = new Map<string, AnyQuizMechanic>();
  for (const m of [...PAIRS_MECHANICS, ...MECHANICS_A, ...MECHANICS_B] as AnyQuizMechanic[]) {
    if (map.has(m.mechanicId)) throw new Error(`duplicate mechanic id ${m.mechanicId}`);
    map.set(m.mechanicId, m);
  }
  return map;
})();
