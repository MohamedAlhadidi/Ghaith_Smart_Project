import type { VisualRenderer } from "../types";
import { CORE_VISUALS } from "./core";
import { VISUALS_A } from "./registryA";
import { VISUALS_B } from "./registryB";

export const VISUALS: Record<string, VisualRenderer> = { ...CORE_VISUALS, ...VISUALS_A, ...VISUALS_B };

export function visualFor(type: string): VisualRenderer | undefined {
  return VISUALS[type];
}
