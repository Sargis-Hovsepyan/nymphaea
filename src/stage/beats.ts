// Beats: short lines that should stand alone on the page. A paragraph is a beat when it is very
// short (≤ 18 characters), or short relative to the paragraphs around it (under a quarter of the
// local median of 9, in dense prose). Explicit beats (from Claude) are taken as given. Pure.
import { isBreak, plain } from "../inline";
import type { Block } from "../types";

export function autoBeats(blocks: Block[]): Set<number> {
  const out = new Set<number>();
  const idx: number[] = [], len: number[] = [];
  blocks.forEach((b, i) => { if (b.type === "p" && !isBreak(b.text)) { idx.push(i); len.push(plain(b.text).length); } });
  idx.forEach((i, j) => {
    const L = len[j];
    if (L <= 18) { out.add(i); return; }
    if (L > 60) return;
    const win = len.slice(Math.max(0, j - 4), j + 5).filter((_, k) => k !== Math.min(4, j)).sort((a, b) => a - b);
    const med = win.length ? win[Math.floor(win.length / 2)] : 0;
    if (med >= 160 && L < med * 0.25 && !/[,;:]$/.test(plain(blocks[i].text))) out.add(i);
  });
  return out;
}
