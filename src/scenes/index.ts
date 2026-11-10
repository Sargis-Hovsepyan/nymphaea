import { candle, city, door, forest, moon, rain, road, sea } from "./world";
import { king, knight, lamp, pawn, queen } from "./chess";
import { lotus } from "./lotus";
import type { Ctx } from "./helpers";
import { SCENE_LIST } from "../stage/keywords";
import { canvasScene } from "../vscenes/model";

/** A scene draws one frame. t = the story beat (0..1, from scroll position), tm = seconds. */
export type SceneFn = (c: Ctx, t: number, tm: number) => void;

/** Hand-drawn canvas scenes; every other library scene is drawn from its vector version. */
export const SCENES: Record<string, SceneFn> = {
  lamp, pawn, knight, queen, king, door, rain, sea, moon, city, forest, candle, road, lotus,
};
SCENE_LIST.forEach((s) => { if (!SCENES[s]) SCENES[s] = canvasScene(s); });
