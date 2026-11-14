/** Visual renderers owned by executor C (English, Team Together Oman 2A S1), keyed by visual.type. */
import type { VisualRenderer } from "../types";
import { CommandPick, MatchBoard, SceneCard, SoundCard, TilesCue, WordCard } from "./C_visuals";

export const VISUALS_C: Record<string, VisualRenderer> = {
  "en-c-word": WordCard,
  "en-c-scene": SceneCard,
  "en-c-tiles": TilesCue,
  "en-c-sound": SoundCard,
  "en-c-match": MatchBoard,
  "en-c-command": CommandPick,
};
