// One place that turns any scene id into something drawable: a library id ("lamp", "train"…)
// or a composed id ("gen:…", see compose/spec.ts). Every renderer goes through vscene().
import { SCENE_DESC } from "../stage/keywords";
import { VSCENES, type VScene } from "../vscenes";
import { composeScene } from "./draw";
import { decode, describe, encode } from "./spec";

const byName = new Map<string, VScene>();
/** The scene for a name, looked up once (the renderers ask on every frame). */
export function vscene(name: string): VScene {
  const hit = byName.get(name);
  if (hit) return hit;
  const s = decode(name);
  const vs = s ? composeScene(s, encode(s)) : VSCENES[name] || VSCENES.lamp;
  if (byName.size > 400) byName.clear();
  byName.set(name, vs);
  return vs;
}

/** How long a scene's acts take to play, and its still moment (0 for a scene with no acts). */
export function sceneTiming(name: string): { loop: number; total: number; still: number } {
  const vs = vscene(name) as VScene & { tl?: { loop: number; total: number; still: number } };
  return vs.tl ? { loop: vs.tl.loop, total: vs.tl.total, still: vs.tl.still } : { loop: 0, total: 0, still: 0 };
}

/** Words for a scene, for screen readers and the Studio. */
export function sceneLabel(name: string): string {
  const s = decode(name);
  return s ? describe(s) : SCENE_DESC[name] || name;
}
