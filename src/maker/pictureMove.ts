// Moving a picture by one prose paragraph, as a pure step. The caption is re-checked against the
// paragraph it lands after: it stays if it still quotes the text there, else it is re-picked from
// that paragraph. Nothing here touches the author's words.
import { isBreak } from "../inline";
import { isProse } from "../parse";
import { captionFor } from "../stage/auto";
import { captionIsQuoted, guardScenes } from "../stage/guard";
import type { Block, SceneRef } from "../types";

/** The next prose paragraph (not a heading, not a scene break) before or after `from`, or -1. */
export function neighbourProse(blocks: Block[], from: number, dir: -1 | 1): number {
  for (let i = from + dir; i >= 0 && i < blocks.length; i += dir) if (isProse(blocks[i]) && !isBreak(blocks[i].text)) return i;
  return -1;
}

export interface Moved { scenes: SceneRef[]; /** Index of the moved picture in the result. */ index: number; recaptioned: boolean }

/** Move picture `k` one paragraph up (-1) or down (1). Null when there is nowhere to go. */
export function movePicture(blocks: Block[], scenes: SceneRef[], k: number, dir: -1 | 1): Moved | null {
  const s = scenes[k];
  if (!s) return null;
  const to = neighbourProse(blocks, s.after, dir);
  if (to < 0) return null;
  const quoted = captionIsQuoted(s.caption, blocks, to);
  const caption = quoted ? s.caption : captionFor(blocks[to].text, s.scene);
  const next = scenes.map((x, i) => (i === k ? { ...x, after: to, caption } : { ...x }));
  const out = guardScenes(blocks, next).scenes;
  let index = out.findIndex((x) => x.after === to && x.scene === s.scene && x.img === s.img);
  if (index < 0) index = Math.min(out.length - 1, k);
  return { scenes: out, index, recaptioned: !quoted };
}

/** Where a picture can still go: used to disable the arrows. */
export function canMove(blocks: Block[], s: SceneRef): { up: boolean; down: boolean } {
  return { up: neighbourProse(blocks, s.after, -1) >= 0, down: neighbourProse(blocks, s.after, 1) >= 0 };
}
