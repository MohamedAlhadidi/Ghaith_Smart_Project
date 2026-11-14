/** Mechanics implemented by executor B (multiplicative, geometry, measurement, money). */
import type { QuizMechanic } from "../quiz";
import { GEOMETRY_MECHANICS } from "./B_geometry";
import { MEASURE_MECHANICS } from "./B_measure";
import { MONEY_MECHANICS } from "./B_money";
import { MULTIPLICATIVE_MECHANICS } from "./B_multiplicative";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MECHANICS_B: QuizMechanic<any, any>[] = [...MULTIPLICATIVE_MECHANICS, ...GEOMETRY_MECHANICS, ...MEASURE_MECHANICS, ...MONEY_MECHANICS];
