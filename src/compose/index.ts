// One place that turns any scene id into something drawable: a library id ("lamp", "train"…)
// or a composed id ("gen:…", see compose/spec.ts). Every renderer goes through vscene().
import { SCENE_DESC } from "../stage/keywords";
import { VSCENES, type VScene } from "../vscenes";
import { composeScene } from "./draw";
import { decode, describe, encode } from "./spec";

export function vscene(name: string): VScene {
  const s = decode(name);
  if (s) return composeScene(s, encode(s));
  return VSCENES[name] || VSCENES.lamp;
}

/** Words for a scene, for screen readers and the Studio. */
export function sceneLabel(name: string): string {
  const s = decode(name);
  return s ? describe(s) : SCENE_DESC[name] || name;
}
