// Vector building blocks for the 320×200 SVG scenes (Ink, Cut paper, Glow styles).
import { clamp } from "../scenes/helpers";

export type Pt = [number, number];

export const f = (n: number): string => (Math.round(n * 100) / 100).toString();
export const seg = (t: number, a: number, b: number): number => clamp((t - a) / (b - a));

export function P(pts: Pt[]): string {
  return "M" + pts.map((p) => f(p[0]) + "," + f(p[1])).join(" L") + " Z";
}
function S(pts: Pt[], s: number): Pt[] { return pts.map((p): Pt => [p[0] * s, -p[1] * s]); }

export function circle(cx: number, cy: number, r: number): string {
  return "M" + f(cx - r) + "," + f(cy) + " a" + f(r) + "," + f(r) + " 0 1,0 " + f(2 * r) + ",0 a" + f(r) + "," + f(r) + " 0 1,0 " + f(-2 * r) + ",0";
}
export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return "M" + f(cx - rx) + "," + f(cy) + " a" + f(rx) + "," + f(ry) + " 0 1,0 " + f(2 * rx) + ",0 a" + f(rx) + "," + f(ry) + " 0 1,0 " + f(-2 * rx) + ",0";
}
export function rect(x: number, y: number, w: number, h: number): string {
  return P([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
}

// Chess pieces (base at 0,0, pointing up), from the v0 engine's proportions.
const BASE: Pt[] = [[-0.26, 0], [0.26, 0], [0.24, 0.07], [-0.24, 0.07]];
const U = 60;
export const PAWN = [P(S(BASE, U)), P(S([[-0.17, 0.07], [0.17, 0.07], [0.07, 0.5], [-0.07, 0.5]], U)), P(S([[-0.13, 0.5], [0.13, 0.5], [0.13, 0.55], [-0.13, 0.55]], U)), circle(0, -40, 7.2)].join(" ");
export const KNIGHT = [P(S(BASE, U)), P(S([[-0.2, 0.07], [0.2, 0.07], [0.18, 0.3], [0.15, 0.5], [0.2, 0.7], [0.12, 0.9], [0.05, 1], [0, 0.96], [-0.04, 1.02], [-0.12, 0.9], [-0.28, 0.7], [-0.32, 0.62], [-0.26, 0.56], [-0.14, 0.6], [-0.04, 0.55], [-0.14, 0.3]], U))].join(" ");
export const KING = [P(S(BASE, U)), P(S([[-0.2, 0.07], [0.2, 0.07], [0.09, 0.7], [-0.09, 0.7]], U)), P(S([[-0.15, 0.7], [0.15, 0.7], [0.18, 0.9], [-0.18, 0.9]], U)), P(S([[-0.025, 0.9], [0.025, 0.9], [0.025, 1.1], [-0.025, 1.1]], U)), P(S([[-0.08, 0.99], [0.08, 0.99], [0.08, 1.04], [-0.08, 1.04]], U))].join(" ");
export const QUEEN = [P(S(BASE, U)), P(S([[-0.2, 0.07], [0.2, 0.07], [0.09, 0.7], [-0.09, 0.7]], U)), P(S([[-0.2, 0.7], [0.2, 0.7], [0.2, 0.84], [-0.2, 0.84]], U)), P(S([[-0.2, 0.84], [-0.17, 0.98], [-0.1, 0.89], [-0.05, 1.02], [0, 0.9], [0.05, 1.02], [0.1, 0.89], [0.17, 0.98], [0.2, 0.84]], U))].join(" ");

// A walking figure (base at 0,0, 100 units tall). Legs swing about the hip.
const TORSO = circle(0, -90, 7) + " M-10,-80 L10,-80 L11,-44 L-11,-44 Z";
const LEG1 = "M-10,-46 L-1,-46 L-2,0 L-9,0 Z", LEG2 = "M1,-46 L10,-46 L9,0 L2,0 Z";
export function figure(key: string): string {
  return '<g class="fig-g" data-a="' + key + '"><path class="s fig" d="' + TORSO + '"/><path class="s fig" data-a="' + key + '1" d="' + LEG1 + '"/><path class="s fig" data-a="' + key + '2" d="' + LEG2 + '"/></g>';
}

/** A chessboard in perspective: the dark squares and the outline. */
export function board(cx: number, yt: number, yb: number, wt: number, wb: number): { dark: string; edge: string } {
  const pt = (r: number, c: number): Pt => { const y = yt + (yb - yt) * r / 8, w = wt + (wb - wt) * r / 8; return [cx - w / 2 + w * c / 8, y]; };
  let dark = "";
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2) dark += P([pt(r, c), pt(r, c + 1), pt(r + 1, c + 1), pt(r + 1, c)]) + " ";
  return { dark, edge: P([pt(0, 0), pt(0, 8), pt(8, 8), pt(8, 0)]) };
}
export function boardSvg(b: { dark: string; edge: string }): string {
  return '<path class="s edge" d="' + b.edge + '"/><path class="s board" d="' + b.dark + '"/>';
}

/** Gradients and grain, with ids unique to one picture. */
export function defs(id: string): string {
  return "<defs>"
    + '<radialGradient id="lp' + id + '"><stop offset="0" stop-color="#e8a93a" stop-opacity=".55"/><stop offset=".55" stop-color="#e8a93a" stop-opacity=".12"/><stop offset="1" stop-color="#e8a93a" stop-opacity="0"/></radialGradient>'
    + '<linearGradient id="bm' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd98a" stop-opacity=".6"/><stop offset="1" stop-color="#e8a93a" stop-opacity="0"/></linearGradient>'
    + '<filter id="gr' + id + '"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>'
    + "</defs>";
}
export const grain = (id: string): string => '<rect class="grain" width="320" height="200" filter="url(#gr' + id + ')"/>';
export const pool = (id: string, cx: number, cy: number, r: number, key = ""): string =>
  '<circle class="s pool"' + (key ? ' data-a="' + key + '"' : "") + ' cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#lp' + id + ')"/>';
export const beamFill = (id: string): string => 'fill="url(#bm' + id + ')"';
