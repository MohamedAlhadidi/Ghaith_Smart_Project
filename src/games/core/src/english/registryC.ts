/** English mechanics implemented by executor C (Team Together Oman 2A, semester 1). */
import type { QuizMechanic } from "../quiz";
import { GRAMMAR_MECHANICS_C } from "./C_grammar";
import { SENTENCE_MECHANICS_C } from "./C_sentences";
import { WORD_MECHANICS_C } from "./C_words";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MECHANICS_C: QuizMechanic<any, any>[] = [...WORD_MECHANICS_C, ...SENTENCE_MECHANICS_C, ...GRAMMAR_MECHANICS_C] as QuizMechanic<any, any>[];
