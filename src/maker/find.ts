// What the command bar matches: passages that contain the words, chapters, and places the text is set
// in. Pure functions, so the matching can be tested without a page.
import type { Place, Spec } from "../compose/spec";
import { isBreak, plain } from "../inline";
import type { Block } from "../types";
import { locate, shown, type Hit } from "../stage/locate";

export const norm = (q: string): string => q.trim().replace(/\s+/g, " ").toLowerCase();

export interface Snip { before: string; match: string; after: string }

/** The first match of `q` in a passage, with a little text each side (cut at word edges). */
export function snippet(text: string, q: string, radius = 46): Snip | null {
  let flat = plain(text).replace(/\s+/g, " ").trim();
  const query = norm(q);
  if (!query) return null;
  let low = flat.toLowerCase();
  if (low.length !== flat.length) flat = low;
  const at = low.indexOf(query);
  if (at < 0) return null;
  let a = Math.max(0, at - radius), b = Math.min(flat.length, at + query.length + radius);
  if (a > 0) { const s = flat.indexOf(" ", a); if (s >= 0 && s < at) a = s + 1; }
  if (b < flat.length) { const s = flat.lastIndexOf(" ", b); if (s > at + query.length) b = s; }
  return {
    before: (a > 0 ? "…" : "") + flat.slice(a, at), match: flat.slice(at, at + query.length),
    after: flat.slice(at + query.length, b) + (b < flat.length ? "…" : ""),
  };
}

export interface TextHit { block: number; snip: Snip; count: number }

/** Paragraphs (not headings, not scene breaks) whose plain text contains the query, in reading order. */
export function textHits(blocks: Block[], q: string, limit = 6): TextHit[] {
  const query = norm(q);
  if (query.length < 2) return [];
  const out: TextHit[] = [];
  for (let i = 0; i < blocks.length && out.length < limit; i++) {
    const b = blocks[i];
    if (b.type === "h" || isBreak(b.text)) continue;
    const s = snippet(b.text, query);
    if (!s) continue;
    const low = plain(b.text).replace(/\s+/g, " ").toLowerCase();
    out.push({ block: i, snip: s, count: low.split(query).length - 1 });
  }
  return out;
}

export interface PassageHit { block: number; snip: Snip; hit: Hit }

/**
 * Passages for a longer query (three words or more), found the way a selection is: through curly
 * quotes, Markdown marks, line breaks between paragraphs and a typo or a missing word. The snippet
 * shows the manuscript's own words.
 */
export function passageHits(blocks: Block[], q: string, limit = 5): PassageHit[] {
  if (norm(q).split(" ").length < 3) return [];
  return locate(blocks, q, { limit }).map((h) => {
    const a = blocks[h.startBlock].text, z = blocks[h.endBlock].text;
    let before = shown(a.slice(Math.max(0, h.startOff - 46), h.startOff)), after = shown(z.slice(h.endOff, h.endOff + 46));
    if (h.startOff > 46) before = "…" + before.replace(/^\S*\s/, "");
    if (h.endOff + 46 < z.length) after = after.replace(/\s\S*$/, "") + "…";
    let match = shown(h.exact);
    if (match.length > 140) match = match.slice(0, 70).trimEnd() + " … " + match.slice(-60).trimStart();
    return { block: h.startBlock, snip: { before: before ? before + " " : "", match, after: after ? " " + after : "" }, hit: h };
  });
}

/** How well `q` matches `label`: -1 none, higher is better. Every word of the query must match,
 *  as a substring (best at a word start) or as letters in order with at most one gap. */
export function fuzzy(label: string, q: string): number {
  const L = label.toLowerCase(), query = norm(q);
  if (!query) return 0;
  let total = 0;
  for (const tok of query.split(" ")) {
    const at = L.indexOf(tok);
    if (at >= 0) { total += 100 - Math.min(at, 60) + (at === 0 || L[at - 1] === " " ? 30 : 0) + (L === tok ? 40 : 0); continue; }
    let k = 0, gaps = 0, last = -1;
    for (let i = 0; i < L.length && k < tok.length; i++) if (L[i] === tok[k]) { if (last >= 0 && i - last > 1) gaps++; last = i; k++; }
    if (k < tok.length || tok.length < 3 || gaps > 1) return -1;
    total += 20 - Math.min(gaps * 3, 15);
  }
  return total;
}

/** The best matches first, at most `limit`. */
export function rank<T>(items: T[], q: string, text: (t: T) => string, limit = 8): T[] {
  const query = norm(q);
  if (!query) return items.slice(0, limit);
  return items
    .map((t, i) => ({ t, i, s: fuzzy(text(t), query) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit).map((x) => x.t);
}

export interface Run { from: number; to: number }

/** Stretches of consecutive passages set in `place`. A heading or a scene break ends a stretch. */
export function placeRuns(specs: (Spec | null)[], place: Place): Run[] {
  const runs: Run[] = [];
  let cur: Run | null = null;
  specs.forEach((s, i) => {
    if (s && s.place === place) { if (cur) cur.to = i; else { cur = { from: i, to: i }; runs.push(cur); } }
    else cur = null;
  });
  return runs;
}

export interface PlaceHit { place: Place; passages: number; runs: Run[] }

/** Places the text is set in whose name matches the query. `names` gives the words to match, e.g. "cafe café". */
export function placeHits(specs: (Spec | null)[], q: string, names: (p: Place) => string, limit = 3): PlaceHit[] {
  const query = norm(q);
  if (query.length < 2) return [];
  const seen = new Map<Place, number>();
  specs.forEach((s) => { if (s && s.place !== "inner") seen.set(s.place, (seen.get(s.place) || 0) + 1); });
  return Array.from(seen.entries())
    .map(([place, passages]) => ({ place, passages, s: fuzzy(names(place), query) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || b.passages - a.passages)
    .slice(0, limit)
    .map((x) => ({ place: x.place, passages: x.passages, runs: placeRuns(specs, x.place) }));
}

/** The passage in a stretch to picture: the one with the highest score, the first on a tie. */
export function pickInRun(run: Run, score: (i: number) => number): number {
  let best = run.from, bs = -Infinity;
  for (let i = run.from; i <= run.to; i++) { const s = score(i); if (s > bs) { bs = s; best = i; } }
  return best;
}

/** Stretches that have no picture inside them, with the passage to picture in each. */
export function placePlan(runs: Run[], pictured: Set<number>, score: (i: number) => number): number[] {
  return runs.filter((r) => { for (let i = r.from; i <= r.to; i++) if (pictured.has(i)) return false; return true; }).map((r) => pickInRun(r, score));
}
