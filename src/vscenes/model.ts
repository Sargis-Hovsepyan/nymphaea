// A vector scene without a DOM: its markup parsed into a small tree that update() can drive. It
// lets every canvas style (dither, halftone, ascii, glass, engrave, stipple, riso) draw any vector
// scene as a greyscale source, and lets the EPUB export save a finished frame as a standalone SVG.
// Used by scenes/index.ts (canvas versions of the vector-only scenes) and epub/book.ts.
import type { Ctx } from "../scenes/helpers";
import { vscene } from "../compose";
import type { VApi } from "./index";

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

export interface SceneModel { api: VApi; root: Node; lv: number; hour: string }

export function sceneModel(name: string): SceneModel {
  const vs = vscene(name);
  const { root, keys } = parse(vs.build("m"));
  const model: SceneModel = { root, lv: 1, api: null as unknown as VApi, hour: /data-h="(\w+)"/.exec(vs.build("m"))?.[1] || "" };
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
/** The sky by the hour, top and horizon greys; clouds and fog take the horizon's tone. */
const SKY: Record<string, [number, number]> = { dawn: [96, 176], day: [150, 214], dusk: [70, 160], night: [14, 60] };
const HAZE: Record<string, number> = { dawn: 196, day: 236, dusk: 172, night: 52 };

/** Path2D objects by their path data: most of a scene does not move, so most frames rebuild nothing. */
const paths = new Map<string, Path2D>();
function path2d(d: string): Path2D {
  let p = paths.get(d);
  if (!p) { if (paths.size > 4000) paths.clear(); p = new Path2D(d); paths.set(d, p); }
  return p;
}

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
    const raw = n.style.opacity != null && n.style.opacity !== "" ? n.style.opacity : n.attrs.opacity;
    const op = raw != null && raw !== "" ? Number(raw) : 1;
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
      const p = path2d(n.attrs.d);
      if (r === "line") { c.strokeStyle = "rgb(150,150,150)"; c.lineWidth = 1.4; c.stroke(p); }
      else if (r === "sky") {
        const [g0, g1] = SKY[n.attrs["data-h"] || m.hour] || SKY.night, y1 = Math.max(20, +(n.attrs["data-y"] || 200));
        const gr = c.createLinearGradient(0, 0, 0, y1);
        gr.addColorStop(0, "rgb(" + g0 + "," + g0 + "," + g0 + ")"); gr.addColorStop(1, "rgb(" + g1 + "," + g1 + "," + g1 + ")");
        c.fillStyle = gr; c.fill(p);
      }
      else if (r === "haze") { const g = n.attrs["data-dark"] ? Math.round((HAZE[m.hour] ?? 120) * 0.6) : HAZE[m.hour] ?? 120; c.fillStyle = "rgba(" + g + "," + g + "," + g + ",.85)"; c.fill(p); }
      else if (r === "shade") { c.fillStyle = "rgba(0,0,0,.3)"; c.fill(p); }
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
    const r = role(n), o = n.style.opacity || n.attrs.opacity, op = o ? ' opacity="' + esc(o) + '"' : "";
    const tr = n.attrs.transform ? ' transform="' + esc(n.attrs.transform) + '"' : "";
    if (n.tag === "g") return "<g" + tr + op + ">" + n.kids.map(out).join("") + "</g>";
    if (n.tag === "circle") return r === "pool" ? '<circle cx="' + esc(n.attrs.cx || "0") + '" cy="' + esc(n.attrs.cy || "0") + '" r="' + esc(n.attrs.r || "0") + '" fill="url(#mpool)" opacity="' + (0.9 * m.lv).toFixed(3) + '"/>' : "";
    if (n.tag !== "path" || !n.attrs.d) return "";
    const d = ' d="' + esc(n.attrs.d) + '"';
    if (r === "line") return "<path" + tr + op + d + ' fill="none" stroke="' + colours.ink + '" stroke-width="1.3" stroke-linecap="round"/>';
    if (r === "sky") return "<path" + tr + op + d + ' fill="url(#msky)"/>';
    if (r === "haze") return "<path" + tr + op + d + ' fill="' + colours.light + '" opacity=".5"/>';
    if (r === "shade") return "<path" + tr + d + ' fill="#000" opacity=".22"/>';
    if (r === "beam") return "<path" + tr + d + ' fill="' + colours.accent + '" opacity="' + (0.25 * m.lv).toFixed(3) + '"/>';
    return "<path" + tr + op + d + ' fill="' + (fill[r] || colours.ink) + '"/>';
  };
  const sk: Record<string, [string, string]> = { dawn: [colours.mid, colours.accent], day: [colours.light, colours.light], dusk: [colours.dark, colours.accent], night: [colours.dark, colours.mid] };
  const [s0, s1] = sk[m.hour] || sk.night;
  const glow = '<defs><linearGradient id="msky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + s0 + '"/><stop offset="1" stop-color="' + s1 + '" stop-opacity=".8"/></linearGradient><radialGradient id="mpool"><stop offset="0" stop-color="' + colours.accent + '" stop-opacity=".32"/><stop offset="1" stop-color="' + colours.accent + '" stop-opacity="0"/></radialGradient></defs>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img" aria-label="' + esc(label) + '">' + glow + '<rect width="320" height="200" fill="' + colours.bg + '"/>' + out(m.root) + "</svg>";
}

/** A canvas scene function for any vector scene (see scenes/index.ts). */
export function canvasScene(name: string): (c: Ctx, t: number, tm: number, p?: number) => void {
  let m: SceneModel | null = null;
  return (c, t, tm, p) => {
    if (!m) m = sceneModel(name);
    vscene(name).update(m.api, t, tm, p);
    const cv = (c as CanvasRenderingContext2D).canvas, ok = cv && typeof cv.width === "number";
    drawModel(m, c, ok ? cv.width : 192, ok ? cv.height : 120);
  };
}

/** A scene's finished frame as a small standalone SVG (the Studio's picture cards). */
export function sceneThumb(name: string, colours: Parameters<typeof modelSvg>[1]): string {
  const m = sceneModel(name);
  vscene(name).update(m.api, 1, 0);
  return modelSvg(m, colours, name);
}
