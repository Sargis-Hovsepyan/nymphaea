// Where does the story change scene? TextTiling (Hearst, 1997) over paragraphs: compare the words
// in a window of about 80 words before each gap with the window after it; a deep valley in that
// similarity is a topic shift. Windows are measured in words, not paragraphs, so a run of one-line
// beats doesn't look like a dozen scene changes. Headings and scene breaks ("* * *") are always
// boundaries. Pure.
import { isBreak } from "../inline";
import type { Block } from "../types";
import { contentStems, tokens } from "./stem";

type Vec = Map<string, number>;

function cos(a: Vec, b: Vec): number {
  let dot = 0, na = 0, nb = 0;
  a.forEach((x, k) => { na += x * x; const y = b.get(k); if (y) dot += x * y; });
  b.forEach((y) => { nb += y * y; });
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export interface Segmentation {
  /** Block indices a boundary falls after (the last block of a segment). */
  after: Set<number>;
  /** Depth score per gap after block i. */
  depth: Map<number, number>;
}

export function segment(blocks: Block[], win = 80): Segmentation {
  const idx: number[] = [], st: string[][] = [], wc: number[] = [];
  const after = new Set<number>(), depth = new Map<number, number>();
  blocks.forEach((b, i) => {
    if (b.type === "h" || (b.type === "p" && isBreak(b.text))) { if (idx.length) after.add(idx[idx.length - 1]); return; }
    idx.push(i); st.push(contentStems(b.text)); wc.push(tokens(b.text).length);
  });
  const n = idx.length, total = wc.reduce((a, b) => a + b, 0);
  if (n < 6 || total < win * 4) return { after, depth };
  const window = (from: number, dir: 1 | -1): Vec => {
    const v: Vec = new Map();
    let w = 0;
    for (let j = from; j >= 0 && j < n && w < win; j += dir) { st[j].forEach((s) => v.set(s, (v.get(s) || 0) + 1)); w += wc[j]; }
    return v;
  };
  const sim: number[] = [];
  for (let g = 0; g < n - 1; g++) sim.push(cos(window(g, -1), window(g + 1, 1)));
  const dep = sim.map((s, g) => {
    let l = s, r = s;
    for (let j = g - 1; j >= 0 && sim[j] >= l; j--) l = sim[j];
    for (let j = g + 1; j < sim.length && sim[j] >= r; j++) r = sim[j];
    return (l - s) + (r - s);
  });
  const mean = dep.reduce((a, b) => a + b, 0) / dep.length;
  const sd = Math.sqrt(dep.reduce((a, b) => a + (b - mean) * (b - mean), 0) / dep.length);
  const cut = mean + sd / 2;
  // Strongest valleys first; keep one only if no kept boundary is within half a window of words.
  const cum: number[] = []; let c = 0; wc.forEach((w) => { c += w; cum.push(c); });
  const order = dep.map((d, g) => g).filter((g) => dep[g] > cut && cum[g] >= win / 2 && total - cum[g] >= win / 2).sort((a, b) => dep[b] - dep[a] || a - b);
  const kept: number[] = [];
  order.forEach((g) => { if (kept.every((h) => Math.abs(cum[h] - cum[g]) >= win)) kept.push(g); });
  dep.forEach((d, g) => depth.set(idx[g], d));
  kept.forEach((g) => after.add(idx[g]));
  return { after, depth };
}
