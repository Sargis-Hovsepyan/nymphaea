import { candle, city, door, forest, moon, rain, road, sea } from "./world";
import { king, knight, lamp, pawn, queen } from "./chess";
import { lotus } from "./lotus";
import type { Ctx } from "./helpers";
import { SCENE_LIST } from "../stage/keywords";
import { canvasScene } from "../vscenes/model";

/** A scene draws one frame. t = the story beat (0..1, from scroll position), tm = seconds, p = the play clock of what happens. */
export type SceneFn = (c: Ctx, t: number, tm: number, p?: number) => void;

/** Hand-drawn canvas scenes; every other library scene is drawn from its vector version. */
export const SCENES: Record<string, SceneFn> = {
  lamp, pawn, knight, queen, king, door, rain, sea, moon, city, forest, candle, road, lotus,
};
SCENE_LIST.forEach((s) => { if (!SCENES[s]) SCENES[s] = canvasScene(s); });

const composed = new Map<string, SceneFn>();
/** The canvas scene for any id: a library scene, or a composed one drawn from its vector model. */
export function sceneFn(name: string): SceneFn {
  if (SCENES[name]) return SCENES[name];
  let fn = composed.get(name);
  if (!fn) { fn = canvasScene(name); if (composed.size > 200) composed.clear(); composed.set(name, fn); }
  return fn;
}
