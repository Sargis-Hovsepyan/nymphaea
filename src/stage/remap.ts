// When the author edits the Markdown, the pictures stay with their paragraphs: each scene (and
// beat) follows its anchor paragraph's exact text to its new position. If that paragraph is gone,
// the picture is dropped. The Guard then checks every caption again.
import { isProse } from "../parse";
import type { Block, SceneRef } from "../types";
import { guardScenes } from "./guard";

function find(oldBlocks: Block[], newBlocks: Block[], at: number): number {
  const b = oldBlocks[at];
  if (!isProse(b)) return -1;
  let best = -1;
  newBlocks.forEach((n, j) => {
    if (n.type === b.type && n.text === b.text && (best < 0 || Math.abs(j - at) < Math.abs(best - at))) best = j;
  });
  return best;
}

export function remapScenes(oldBlocks: Block[], newBlocks: Block[], scenes: SceneRef[]): { scenes: SceneRef[]; lost: number } {
  let lost = 0;
  const moved: SceneRef[] = [];
  scenes.forEach((s) => {
    const j = find(oldBlocks, newBlocks, s.after);
    if (j < 0) lost++;
    else moved.push({ ...s, after: j });
  });
  return { scenes: guardScenes(newBlocks, moved).scenes, lost };
}

export function remapBeats(oldBlocks: Block[], newBlocks: Block[], beats: number[] | undefined): number[] | undefined {
  if (!beats) return beats;
  return beats.map((b) => find(oldBlocks, newBlocks, b)).filter((j) => j >= 0);
}
