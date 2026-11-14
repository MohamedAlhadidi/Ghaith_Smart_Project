/** Mechanics implemented by executor A (number sense, place value & operations): 28 mechanics. */
import type { QuizMechanic } from "../quiz";
import { PLACE_VALUE_MECHANICS } from "./A_placeValue";
import { NUMBER_SENSE_MECHANICS } from "./numberSense";
import { OPERATION_MECHANICS } from "./operations";
import { PATTERN_MECHANICS } from "./patterns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MECHANICS_A: QuizMechanic<any, any>[] = [...PATTERN_MECHANICS, ...NUMBER_SENSE_MECHANICS, ...PLACE_VALUE_MECHANICS, ...OPERATION_MECHANICS];
