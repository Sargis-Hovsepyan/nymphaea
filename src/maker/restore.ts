// Undoing a picture step puts the earlier pictures back onto the text as it is now. If the text
// is unchanged they simply return; if it was edited since, each picture follows its paragraph.
import { parseDraft } from "../parse";
import { remapBeats, remapScenes } from "../stage/remap";
import { guardScenes } from "../stage/guard";
import type { Block, SceneRef } from "../types";

export interface PicSnap { md: string; title: string; scenes: SceneRef[]; beats?: number[] }

export function restorePictures(curBlocks: Block[], curMd: string, curTitle: string, s: PicSnap): { scenes: SceneRef[]; beats?: number[] } {
  const same = curMd === s.md && curTitle === s.title;
  const old = same ? curBlocks : parseDraft(s.md, s.title).blocks;
  return {
    scenes: same ? guardScenes(curBlocks, s.scenes).scenes : remapScenes(old, curBlocks, s.scenes).scenes,
    beats: same ? s.beats : remapBeats(old, curBlocks, s.beats),
  };
}
