/** Visual renderers owned by executor B (multiplicative, geometry, measurement, money). */
import type { VisualRenderer } from "../types";
import { GEOMETRY_VISUALS } from "./B_geometry";
import { MEASURE_VISUALS } from "./B_measure";
import { MONEY_VISUALS } from "./B_money";
import { MULTIPLICATIVE_VISUALS } from "./B_multiplicative";

export const VISUALS_B: Record<string, VisualRenderer> = {
  ...MULTIPLICATIVE_VISUALS,
  ...GEOMETRY_VISUALS,
  ...MEASURE_VISUALS,
  ...MONEY_VISUALS,
};
