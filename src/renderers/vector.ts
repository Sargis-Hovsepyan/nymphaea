// Vector picture styles: Ink (lines that draw themselves), Cut paper (flat layers, stop-motion
// steps) and Glow (silhouettes in lamplight). The look is CSS on the scene's role classes.
import { clamp } from "../scenes/helpers";
import { vscene } from "../compose";
import type { VApi } from "../vscenes";
import type { Style } from "../types";

export const VECTOR_STYLES: readonly Style[] = ["ink", "cut", "glow", "wash"];
export const isVector = (s: Style): boolean => VECTOR_STYLES.includes(s);

export interface VecHandle {
  svg: SVGSVGElement;
  api: VApi;
  /** Shapes that draw themselves in (Ink only). */
  strokes: SVGElement[];
  /** The last frame drawn (Cut paper skips repeats) and the beat the ink was last laid at. */
  last?: string;
  inked?: number;
}

let uid = 0;

export function makeVector(style: Style, scene: string, label: string): { wrap: HTMLDivElement; vec: VecHandle } {
  const id = "v" + ++uid, wrap = document.createElement("div");
  wrap.className = "art";
  const vs = vscene(scene);
  wrap.innerHTML = '<svg class="vart ' + style + '" viewBox="0 0 320 200" role="img"></svg>';
  const svg = wrap.firstChild as SVGSVGElement;
  svg.setAttribute("aria-label", label);
  svg.innerHTML = vs.build(id);
  const strokes = style === "ink"
    ? Array.from(svg.querySelectorAll<SVGElement>(".s:not(.pool):not(.beam)"))
    : [];
  strokes.forEach((s) => s.setAttribute("pathLength", "1"));
  const cache: Record<string, SVGElement> = {};
  const api: VApi = {
    a: (k) => cache[k] || (cache[k] = svg.querySelector('[data-a="' + k + '"]') as SVGElement),
    light: (v) => svg.style.setProperty("--lv", clamp(v).toFixed(3)),
  };
  return { wrap, vec: { svg, api, strokes } };
}

/** Draw one frame. p: the play clock (seconds into what happens), or none for the still. */
export function drawVector(vec: VecHandle, style: Style, scene: string, t: number, tm: number, p?: number): void {
  // Cut paper moves "on threes": the beat snaps in 6 steps, ambient motion and the acts at 8 and 12 fps.
  if (style === "cut") {
    t = Math.round(t * 6) / 6; tm = Math.floor(tm * 8) / 8; if (p != null) p = Math.floor(p * 12) / 12;
    // Nothing changed since the last frame: skip it.
    const sig = t + "|" + tm + "|" + p;
    if (vec.last === sig) return;
    vec.last = sig;
  }
  vscene(scene).update(vec.api, t, tm, p);
  if (style === "ink") {
    // Once every stroke is drawn in, the dashes stay as they are.
    if (vec.inked === t) return;
    vec.inked = t;
    const n = vec.strokes.length;
    vec.strokes.forEach((s, i) => {
      const d = clamp(t * 4 - i * (1.6 / Math.max(1, n)));
      s.style.strokeDasharray = "1 1";
      s.style.strokeDashoffset = (1 - d).toFixed(3);
    });
  }
}
