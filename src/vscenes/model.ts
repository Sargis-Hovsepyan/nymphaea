// A vector scene without a DOM: its markup parsed into a small tree that update() can drive. It
// lets every canvas style (dither, halftone, ascii, glass, engrave, stipple, riso) draw any vector
// scene as a greyscale source, and lets the EPUB export save a finished frame as a standalone SVG.
// Used by scenes/index.ts (canvas versions of the vector-only scenes) and epub/book.ts.
import type { Ctx } from "../scenes/helpers";
import { VSCENES, type VApi } from "./index";

interface Node { tag: string; attrs: Record<string, string>; style: Record<string, string>; kids: Node[] }

const TAG = /<(\/?)(path|circle|rect|g)\b([^>]*?)(\/?)>/g;
const ATTR = /([\w:-]+)="([^"]*)"/g;

function parse(markup: string): { root: Node; keys: Record<string, Node> } {
  const body = markup.replace(/<defs>[\s\S]*?<\/defs>/g, "");
  const root: Node = { tag: "g", attrs: {}, style: {}, kids: [] }, stack = [root], keys: Record<string, Node> = {};
  for (const m of body.matchAll(TAG)) {
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    const attrs: Record<string, string> = {};
    for (const a of m[3].matchAll(ATTR)) attrs[a[1]] = a[2];
    const n: Node = { tag: m[2], attrs, style: {}, kids: [] };
    stack[stack.length - 1].kids.push(n);
    if (attrs["data-a"]) keys[attrs["data-a"]] = n;
    if (m[2] === "g" && !m[4]) stack.push(n);
  }
  return { root, keys };
}

export interface SceneModel { api: VApi; root: Node; lv: number }

export function sceneModel(name: string): SceneModel {
  const vs = VSCENES[name] || VSCENES.lamp;
  const { root, keys } = parse(vs.build("m"));
  const model: SceneModel = { root, lv: 1, api: null as unknown as VApi };
  const els: Record<string, SVGElement> = {};
  model.api = {
    a(k) {
      if (els[k]) return els[k];
      const n = keys[k] || { tag: "g", attrs: {}, style: {}, kids: [] };
      return (els[k] = { setAttribute: (a: string, v: string) => { n.attrs[a] = String(v); }, style: n.style } as unknown as SVGElement);
    },
    light(v) { model.lv = Math.max(0, Math.min(1, v)); },
  };
  return model;
}

function role(n: Node): string { return (n.attrs.class || "").split(/\s+/).find((c) => c && c !== "s") || ""; }

/** Grey levels (0–255) of each role on the greyscale source canvas. */
const GREY: Record<string, number> = { bg2: 46, edge: 72, board: 58, far: 122, key: 220, lit: 255, fig: 12 };

function applyTransform(c: Ctx, tr: string | undefined): void {
  if (!tr) return;
  for (const m of tr.matchAll(/(translate|scale|rotate)\(([^)]*)\)/g)) {
    const a = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (m[1] === "translate") c.translate(a[0] || 0, a[1] || 0);
    else if (m[1] === "scale") c.scale(a[0] ?? 1, a[1] ?? a[0] ?? 1);
    else { const r = (a[0] || 0) * Math.PI / 180; if (a.length >= 3) { c.translate(a[1], a[2]); c.rotate(r); c.translate(-a[1], -a[2]); } else c.rotate(r); }
  }
}

/** Draw the model into a greyscale canvas of size w×h (the scene is 320×200). */
export function drawModel(m: SceneModel, c: Ctx, w: number, h: number): void {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.fillStyle = "rgb(8,8,8)"; c.fillRect(0, 0, w, h);
  c.scale(w / 320, h / 200);
  const walk = (n: Node, alpha: number) => {
    const op = n.style.opacity != null && n.style.opacity !== "" ? Number(n.style.opacity) : 1;
    const a = alpha * (Number.isFinite(op) ? op : 1);
    if (a <= 0.001) return;
    c.save();
    applyTransform(c, n.attrs.transform);
    const r = role(n);
    c.globalAlpha = a;
    if (n.tag === "circle" && r === "pool") {
      const cx = +n.attrs.cx || 0, cy = +n.attrs.cy || 0, rr = Math.max(0.1, +n.attrs.r || 1);
      const gr = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
      gr.addColorStop(0, "rgba(255,255,255," + (0.5 * m.lv).toFixed(3) + ")");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = gr; c.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    } else if (n.tag === "path" && n.attrs.d && n.attrs.d.length > 4 && typeof Path2D !== "undefined") {
      const p = new Path2D(n.attrs.d);
      if (r === "line") { c.strokeStyle = "rgb(150,150,150)"; c.lineWidth = 1.4; c.stroke(p); }
      else if (r === "beam") { c.fillStyle = "rgba(255,255,255," + (0.32 * m.lv).toFixed(3) + ")"; c.fill(p); }
      else if (r === "pool") { c.fillStyle = "rgba(255,255,255," + (0.25 * m.lv).toFixed(3) + ")"; c.fill(p); }
      else { const g = GREY[r] ?? 122; c.fillStyle = "rgb(" + g + "," + g + "," + g + ")"; c.fill(p); }
    }
    n.kids.forEach((k) => walk(k, a));
    c.restore();
  };
  walk(m.root, 1);
  c.setTransform(1, 0, 0, 1, 0, 0);
}

/** A standalone SVG of the model's current frame, coloured by role (for the EPUB export). */
export function modelSvg(m: SceneModel, colours: { bg: string; ink: string; accent: string; light: string; mid: string; dark: string }, label: string): string {
  const fill: Record<string, string> = { bg2: colours.mid, edge: colours.dark, board: colours.mid, far: colours.ink, key: colours.accent, lit: colours.light, fig: colours.ink };
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" } as Record<string, string>)[c]);
  const out = (n: Node): string => {
    const r = role(n), op = n.style.opacity ? ' opacity="' + esc(n.style.opacity) + '"' : "";
    const tr = n.attrs.transform ? ' transform="' + esc(n.attrs.transform) + '"' : "";
    if (n.tag === "g") return "<g" + tr + op + ">" + n.kids.map(out).join("") + "</g>";
    if (n.tag === "circle") return r === "pool" ? '<circle cx="' + esc(n.attrs.cx || "0") + '" cy="' + esc(n.attrs.cy || "0") + '" r="' + esc(n.attrs.r || "0") + '" fill="' + colours.accent + '" opacity="' + (0.12 * m.lv).toFixed(3) + '"/>' : "";
    if (n.tag !== "path" || !n.attrs.d) return "";
    const d = ' d="' + esc(n.attrs.d) + '"';
    if (r === "line") return "<path" + tr + op + d + ' fill="none" stroke="' + colours.ink + '" stroke-width="1.3" stroke-linecap="round"/>';
    if (r === "beam") return "<path" + tr + d + ' fill="' + colours.accent + '" opacity="' + (0.25 * m.lv).toFixed(3) + '"/>';
    return "<path" + tr + op + d + ' fill="' + (fill[r] || colours.ink) + '"/>';
  };
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img" aria-label="' + esc(label) + '"><rect width="320" height="200" fill="' + colours.bg + '"/>' + out(m.root) + "</svg>";
}

/** A canvas scene function for any vector scene (see scenes/index.ts). */
export function canvasScene(name: string): (c: Ctx, t: number, tm: number) => void {
  let m: SceneModel | null = null;
  return (c, t, tm) => {
    if (!m) m = sceneModel(name);
    (VSCENES[name] || VSCENES.lamp).update(m.api, t, tm);
    const cv = (c as CanvasRenderingContext2D).canvas, ok = cv && typeof cv.width === "number";
    drawModel(m, c, ok ? cv.width : 192, ok ? cv.height : 120);
  };
}

/** A scene's finished frame as a small standalone SVG (the Studio's picture cards). */
export function sceneThumb(name: string, colours: Parameters<typeof modelSvg>[1]): string {
  const m = sceneModel(name);
  (VSCENES[name] || VSCENES.lamp).update(m.api, 1, 0);
  return modelSvg(m, colours, name);
}
