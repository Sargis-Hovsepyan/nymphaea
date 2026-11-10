import { isBreak } from "../inline";
import { isProse } from "../parse";
import { DENS } from "../settings";
import type { Block, Density, SceneRef } from "../types";
import { KW, SCENE_LIST, WORDS, bestScene, scoreOf, words } from "./keywords";
import { placeK, type Cand } from "./place";
import { segment } from "./segment";
import { docModel, isStop, stem, type DocModel } from "./stem";

/**
 * A caption is a clause quoted from the paragraph (shortened with "…" if long). Never invented.
 * Clauses are scored: words of the picture's scene count most, any concrete scene word counts,
 * and 3–8 words reads best as a caption.
 */
export function captionFor(t: string, scene: string | null): string {
  const flatT = t.replace(/\s+/g, " ");
  const clauses = flatT.split(/[.!?…;:]+|,\s|“|”|"/).map((c) => c.trim()).filter((c) => c.length > 1);
  const own = new Set(scene && WORDS[scene] ? WORDS[scene].split(" ").map(stem) : []);
  let pick: string | null = null, best = -Infinity;
  clauses.forEach((c, k) => {
    const ws = words(c), n = c.split(/\s+/).length;
    let s = 0;
    ws.forEach((w) => { if (isStop(w)) return; const st = stem(w); if (own.has(st)) s += 3; else if (KW[st]) s += 1; });
    if (scene && !ws.some((w) => !isStop(w) && own.has(stem(w)))) s -= 2;
    s -= n < 3 ? (3 - n) * 0.6 : n > 8 ? (n - 8) * 0.25 : 0;
    s -= k * 0.05;
    if (s > best) { best = s; pick = c; }
  });
  let out: string = pick || clauses[0] || flatT;
  const w = out.split(/\s+/);
  if (w.length > 7) out = w.slice(0, 6).join(" ") + "…";
  return out;
}

/** The scene that best represents the whole text. */
export function dominant(blocks: Block[]): string {
  const tot: Record<string, number> = {};
  blocks.forEach((b) => {
    const sc = scoreOf(b.text);
    Object.keys(sc).forEach((s) => { tot[s] = (tot[s] || 0) + sc[s]; });
  });
  return bestScene(tot) || "lamp";
}

/**
 * The automatic plan, deterministic for the same blocks and density:
 *   1. K pictures, one per N words (by density);
 *   2. TextTiling finds where the scenes change (stage/segment.ts);
 *   3. dynamic programming picks K paragraphs that are vivid (TF-IDF keyword salience) and sit at
 *      scene changes, with evenly spaced gaps (stage/place.ts);
 *   4. each picture shows the strongest scene in its paragraph or the few before it, never the
 *      same scene twice running, and quotes its caption from the paragraph that named it.
 */
export function autoStage(blocks: Block[], density: Density): SceneRef[] {
  const target = DENS[density] || 450;
  const prose = blocks.map((b, i) => ({ b, i })).filter(({ b }) => isProse(b) && !(b.type === "p" && isBreak(b.text)));
  if (!prose.length) return [];
  const model: DocModel = docModel(prose.map(({ b }) => b.text));
  const seg = segment(blocks);
  let cw = 0;
  const sal = prose.map(({ b }) => { const sc = scoreOf(b.text, model); return Math.max(0, ...Object.values(sc)); });
  const top = Math.max(1, ...sal);
  const cands: Cand[] = prose.map(({ b, i }, j) => {
    cw += words(b.text).length;
    return { i, cw, sal: sal[j] / top + (seg.after.has(i) ? 0.35 : 0) };
  });
  const total = cw, K = Math.max(1, Math.floor(total / target));
  const at = placeK(cands, total, K);
  const fallback = dominant(blocks);
  const out: SceneRef[] = [];
  let last: string | null = null;
  at.forEach((p) => {
    let bestS: string | null = null, bestV = 0, bestJ = p;
    for (let j = p; j >= Math.max(0, p - 6); j--) {
      if (!isProse(blocks[j])) continue;
      if (j < p && out.length && j <= out[out.length - 1].after) break;
      const sc = scoreOf(blocks[j].text, model), s = bestScene(sc, last);
      if (s) {
        const v = sc[s] * (j === p ? 1.15 : 1);
        if (v > bestV) { bestV = v; bestS = s; bestJ = j; }
      }
    }
    let scene: string = bestS || (last === fallback ? "lamp" : fallback);
    if (scene === last) {
      const alt = SCENE_LIST.filter((x) => x !== last);
      scene = fallback !== last ? fallback : alt[out.length % alt.length];
    }
    out.push({ after: p, scene, caption: captionFor(blocks[bestS ? bestJ : p].text, bestS) });
    last = scene;
  });
  return out;
}
