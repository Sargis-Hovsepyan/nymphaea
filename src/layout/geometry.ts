// Pure page arithmetic for paged spreads and print (no DOM): used by layout/paged.ts and
// layout/print.ts, and tested directly.
import { PAIRINGS } from "../design/type";
import type { Settings, Trim } from "../types";

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface Geometry { per: number; pageW: number; gap: number; spreadW: number; left: number; top: number; height: number }

/** Page index of a position (px from the start of the flow). */
export function pageAt(x: number, pageW: number, gap: number): number {
  return Math.max(0, Math.floor((x + gap / 2) / (pageW + gap)));
}

/** The geometry of a spread for a viewport and a wanted text column width. */
export function geometry(vw: number, vh: number, col: number, bar: number): Geometry {
  const side = Math.max(16, Math.round(vw * 0.04)), gap = Math.round(clamp((vw - 600) / 1400) * 56 + 40);
  const per = vw >= 900 ? 2 : 1, avail = vw - 2 * side - (per - 1) * gap;
  const pageW = Math.floor(Math.min(col, avail / per)), spreadW = per * pageW + (per - 1) * gap;
  const top = bar + 30, height = Math.max(240, vh - top - 58);
  return { per, pageW, gap, spreadW, left: Math.round((vw - spreadW) / 2), top, height };
}

const SIZE: Record<Trim, { size: string; m: [number, number, number, number]; pt: number }> = {
  // size, margins in mm: top, outer, bottom, inner; body size in pt
  a5: { size: "148mm 210mm", m: [16, 14, 20, 19], pt: 10.5 },
  "6x9": { size: "6in 9in", m: [17, 15, 21, 20], pt: 10.5 },
  a4: { size: "210mm 297mm", m: [22, 20, 26, 26], pt: 11.5 },
  letter: { size: "8.5in 11in", m: [22, 20, 26, 26], pt: 11.5 },
};

/** The print stylesheet for a look: trim size, mirrored margins (wider inside, for the binding),
 *  folios in the page margin, chapters on a new page, nothing on screen that isn't the book. */
export function printCss(S: Settings): string {
  const t = SIZE[S.trim] || SIZE.a5, [top, outer, bottom, inner] = t.m, P = PAIRINGS[S.pairing] || PAIRINGS.literary;
  const folio = "font-family:" + P.body + ";font-size:8.5pt;color:#6b655a";
  return "@page{size:" + t.size + ";margin:" + top + "mm " + outer + "mm " + bottom + "mm " + inner + "mm;"
    + "@bottom-center{content:counter(page);" + folio + "}}"
    + "@page :left{margin-left:" + outer + "mm;margin-right:" + inner + "mm}"
    + "@page :right{margin-left:" + inner + "mm;margin-right:" + outer + "mm}"
    + "@page :first{@bottom-center{content:none}}"
    + "@media print{"
    + ":root{--fs:" + t.pt + "pt!important;--size:" + t.pt + "pt!important}"
    + "html,body{background:transparent!important;height:auto!important;overflow:visible!important}"
    + "body{padding:0!important;color:#1d1b18}"
    + "body::after,.bar,.room,.studio,.scrim,.pg-chrome,.hint,.pg-nav{display:none!important}"
    + ".pages,main{position:static!important;transform:none!important;column-count:auto!important;columns:auto!important;height:auto!important;width:auto!important;max-width:none!important;margin:0!important}"
    + ".cover{min-height:150mm;justify-content:center;break-after:page;padding:0!important}"
    + ".ded{min-height:120mm;break-after:page}"
    + ".ch{break-before:page;min-height:0!important;padding-top:24mm!important;margin-top:0!important;break-after:avoid}"
    + "h3,h4{break-after:avoid}"
    + "figure{break-inside:avoid}"
    + ".text p{orphans:2;widows:2}"
    + ".text>*,.ch,.text p{animation:none!important;opacity:1!important;transform:none!important;filter:none!important;color:inherit!important}"
    // A floated drop cap is painted twice across a page break in Chromium; a native initial
    // letter isn't. Beats stay centred and italic but below heading size, in their own case.
    + ".op-drop .text p.first::first-letter{float:none;initial-letter:3;-webkit-initial-letter:3;padding:0 .08em 0 0}"
    + ".text p.beat{font-size:1.08em}"
    + ".text p.beat.move{text-transform:none;letter-spacing:.04em;font-family:inherit;font-size:1em}"
    + ".end{break-inside:avoid}"
    + ".colophon{break-before:page;padding-top:60mm}"
    + "}";
}
