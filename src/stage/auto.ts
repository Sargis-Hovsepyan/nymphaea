import { isBreak } from "../inline";
import { isProse } from "../parse";
import { DENS } from "../settings";
import { concreteness, evidence, readQuoteAt, specStems, trackSpecs } from "../compose/read";
import { decode, encode, type Spec } from "../compose/spec";
import type { Art, Block, Density, SceneRef } from "../types";
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
  const spec = decode(scene);
  const own = spec ? specStems(spec) : new Set(scene && WORDS[scene] ? WORDS[scene].split(" ").map(stem) : []);
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

/** A caption from chosen words: all of them when short, else the clause in them that names the scene. */
export function captionOf(quote: string, scene: string): string {
  const part = quote.split("\n").map((x) => x.trim()).filter(Boolean).sort((a, b) => b.length - a.length)[0] || "";
  if (part.length <= 80 && part.split(/\s+/).length <= 10) return part;
  return captionFor(part, scene);
}

/** The sentences of a paragraph, exactly as written. */
export function sentences(t: string): string[] {
  return (t.match(/[^.!?…]+(?:[.!?…]+["”’)\]]*|$)/g) || []).map((x) => x.trim()).filter((x) => /[\p{L}]/u.test(x));
}

/**
 * The moment in a paragraph to picture: the one or two sentences that say the most about their own
 * scene (a place, an hour, a sky, things, people) and what happens in it. Null when the paragraph is one moment already,
 * or when no part of it is more concrete than the whole.
 */
export function momentOf(t: string): string | null {
  const ss = sentences(t);
  if (ss.length < 2) return null;
  let best: string | null = null, bv = 0.99;
  for (let i = 0; i < ss.length; i++) for (const n of [1, 2]) {
    if (i + n > ss.length || n >= ss.length) continue;
    const w = ss.slice(i, i + n).join(" ");
    const e = evidence(w), len = w.split(/\s+/).length;
    // Something happening (a door opening, the sun rising) makes a moment worth a picture.
    const v = concreteness(e) + (e.one + e.two + e.many > 0 ? 0.4 : 0) + Math.min(2, e.acts.length) * 0.6 - Math.max(0, len - 40) * 0.05 - (n - 1) * 0.3;
    if (v > bv) { bv = v; best = w; }
  }
  // Only when the moment is in the paragraph exactly as written (sentence joins can differ in spacing).
  return best && t.replace(/\s+/g, " ").includes(best.replace(/\s+/g, " ")) ? best : null;
}

/**
 * Shot progression: when a picture shows the same place at the same hour as the one before, the
 * camera moves (wide, then nearer to the people, then close on a thing), so a chapter in one
 * kitchen reads as an establishing shot followed by cuts instead of the same view again.
 */
export function cut(s: Spec, prev: Spec | null): Spec {
  if (!prev || prev.place !== s.place || prev.time !== s.time || s.place === "inner" || s.shot !== prev.shot) return s;
  const order: Spec["shot"][] = ["wide", "mid", "close"];
  for (let k = 1; k <= 3; k++) {
    const shot = order[(order.indexOf(prev.shot) + k) % 3];
    if (shot === "mid" && !s.who) continue;
    if (shot === "close" && !s.props.length) continue;
    // A person acting is never a still life.
    if (shot === "close" && (s.acts || []).some((a) => a.by <= 4)) continue;
    return { ...s, shot };
  }
  // No other shot fits: the camera moves to another spot in the same place (a new layout), so two
  // pictures in a row never show the same view.
  return { ...s, seed: (s.seed + 7919) % 46656, moment: (s.moment + 487) % 1296 };
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
export function autoStage(blocks: Block[], density: Density, art: Art = "mixed"): SceneRef[] {
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
  const specs = art === "library" ? [] : trackSpecs(blocks);
  const out: SceneRef[] = [];
  let last: string | null = null, lastSpec: Spec | null = null;
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
    // A scene composed from the passage itself, when the text says more about its own scene
    // (a place, an hour, a sky, things) than any drawn library scene matches it.
    const spec = specs[p];
    if (spec && art !== "library") {
      const win = blocks.slice(Math.max(0, p - 1), p + 1).filter(isProse).map((b) => b.text).join(" ");
      const comp = concreteness(evidence(win)) * 0.55;
      if (art === "composed" || !bestS || comp > bestV) {
        // The picture shows one moment of the paragraph, not an average of all of it.
        const q = momentOf(blocks[p].text), r = q ? readQuoteAt(blocks, p, q) : null;
        const id = encode(cut(r ? r.spec : spec, lastSpec));
        lastSpec = decode(id);
        out.push(r && q ? { after: p, scene: id, caption: captionOf(q, id), quote: q } : { after: p, scene: id, caption: captionFor(blocks[p].text, id) });
        last = id;
        return;
      }
    }
    let scene: string = bestS || (last === fallback ? "lamp" : fallback);
    if (scene === last) {
      const alt = SCENE_LIST.filter((x) => x !== last);
      scene = fallback !== last ? fallback : alt[out.length % alt.length];
    }
    out.push({ after: p, scene, caption: captionFor(blocks[bestS ? bestJ : p].text, bestS) });
    last = scene; lastSpec = null;
  });
  return out;
}
