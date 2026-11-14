/** Shared test harness for QuizMechanics: N seeds × all levels, integrity + solution + rejection. */
import { expect } from "vitest";
import type { QuizItem, QuizMechanic } from "../../src/quiz";
import type { Difficulty } from "../../src/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exerciseMechanic(mech: QuizMechanic<any, any>, config: any, seeds = 1000, check?: (item: QuizItem<any>) => void) {
  expect(mech.validateConfig(config)).toEqual([]);
  for (const difficulty of mech.difficulties as Difficulty[]) {
    for (let seed = 1; seed <= seeds; seed++) {
      let item: QuizItem<unknown> | undefined;
      try {
        item = mech.generate(seed, difficulty, config);
        expect(item.mechanicId).toBe(mech.mechanicId);
        expect(mech.checkIntegrity(item)).toEqual([]);
        const solution = mech.solution(item);
        expect(mech.check(item, solution).correct).toBe(true);
        expect(mech.check(item, null).correct).toBe(false);
        expect(mech.explain(item).length).toBeGreaterThan(0);
        // Determinism: same seed, same item.
        expect(mech.generate(seed, difficulty, config)).toEqual(item);
        check?.(item);
      } catch (err) {
        throw new Error(`${mech.mechanicId} seed=${seed} level=${difficulty} config=${JSON.stringify(config)}: ${(err as Error).message}`);
      }
    }
  }
}
