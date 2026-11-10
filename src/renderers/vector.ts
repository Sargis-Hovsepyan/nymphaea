// Vector picture styles: Ink (lines that draw themselves), Cut paper (flat layers, stop-motion
// steps) and Glow (silhouettes in lamplight). The look is CSS on the scene's role classes.
import { clamp } from "../scenes/helpers";
import { VSCENES, type VApi } from "../vscenes";
import type { Style } from "../types";

export const VECTOR_STYLES: readonly Style[] = ["ink", "cut", "glow", "wash"];
export const isVector = (s: Style): boolean => VECTOR_STYLES.includes(s);

export interface VecHandle {
  svg: SVGSVGElement;
  api: VApi;
  /** Shapes that draw themselves in (Ink only). */
  strokes: SVGElement[];
}

let uid = 0;

export function makeVector(style: Style, scene: string, label: string): { wrap: HTMLDivElement; vec: VecHandle } {
  const id = "v" + ++uid, wrap = document.createElement("div");
  wrap.className = "art";
  const vs = VSCENES[scene] || VSCENES.lamp;
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

export function drawVector(vec: VecHandle, style: Style, scene: string, t: number, tm: number): void {
  // Cut paper moves "on threes": the beat snaps in 6 steps and ambient motion runs at 8 fps.
  if (style === "cut") { t = Math.round(t * 6) / 6; tm = Math.floor(tm * 8) / 8; }
  (VSCENES[scene] || VSCENES.lamp).update(vec.api, t, tm);
  if (style === "ink") {
    const n = vec.strokes.length;
    vec.strokes.forEach((s, i) => {
      const d = clamp(t * 4 - i * (1.6 / Math.max(1, n)));
      s.style.strokeDasharray = "1 1";
      s.style.strokeDashoffset = (1 - d).toFixed(3);
    });
  }
}
