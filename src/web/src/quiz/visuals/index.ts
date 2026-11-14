import type { VisualRenderer } from "../types";
import { CORE_VISUALS } from "./core";
import { VISUALS_A } from "./registryA";
import { VISUALS_B } from "./registryB";
import { VISUALS_C } from "./registryC";
import { ENGLISH_VISUALS } from "./M_english";

export const VISUALS: Record<string, VisualRenderer> = { ...CORE_VISUALS, ...VISUALS_A, ...VISUALS_B, ...ENGLISH_VISUALS, ...VISUALS_C };

export function visualFor(type: string): VisualRenderer | undefined {
  return VISUALS[type];
}
