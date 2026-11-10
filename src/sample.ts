import { SEED_TEXT, SEED_TITLE } from "./seed";
import type { Book, SceneRef } from "./types";

// Hand-placed scenes for the sample episode. Every caption is an exact quote (the Guard checks).
export const SEED_SCENES: SceneRef[] = [
  { after: 4, scene: "pawn", caption: "e4" },
  { after: 12, scene: "knight", caption: "I captured his knight" },
  { after: 36, scene: "queen", caption: "My queen sliced across the board" },
  { after: 69, scene: "king", caption: "one small, humble square" },
  { after: 86, scene: "lamp", caption: "The lamp hummed again" },
  { after: 100, scene: "door", caption: "I didn’t look back" },
];

export function sampleBook(): Book {
  return {
    title: SEED_TITLE,
    blocks: SEED_TEXT.map((text) => ({ type: "p" as const, text })),
    scenes: SEED_SCENES.map((s) => ({ ...s })),
    source: "hand",
  };
}
