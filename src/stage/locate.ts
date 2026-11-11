// Finding any words in the manuscript: what a reader selected in the book, or what an author pasted
// or typed into the find box, even with curly quotes, Markdown stars, a soft hyphen or a typo.
// One matcher for both. Whatever is asked, what comes back is always the manuscript's own
// characters, so a picture is never drawn from words the author did not write. Pure.
import { isBreak } from "../inline";
import type { Block } from "../types";

export interface Norm {
  /** The folded text: lower case, no accents, plain quotes and dashes, one space between words. */
  s: string;
  /** For each character of `s`, the index of the character in the original it came from. */
  map: number[];
}

const FOLD: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'", "`": "'", "´": "'",
  "“": '"', "”": '"', "„": '"', "‟": '"', "″": '"', "«": '"', "»": '"',
  "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-", "−": "-",
};
/** Dropped outright: soft hyphen, zero width characters, Markdown emphasis and code marks. */
const DROP = /[­​-‍⁠﻿*_`]/;
const SPACE = /[\s   ]/;

/** Fold a text for matching, keeping a map back to the original characters. */
export function normalize(text: string): Norm {
  let s = "";
  const map: number[] = [];
  let space = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], code = text.charCodeAt(i);
    // Plain ASCII, most of any book: no regex, no Unicode normalisation.
    if (code < 128) {
      if (code === 42 || code === 95 || code === 96) continue; // * _ `
      if (code === 32 || code === 9 || code === 10 || code === 13) { if (!space) { s += " "; map.push(i); space = true; } continue; }
      s += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : ch; map.push(i); space = false;
      continue;
    }
    if (DROP.test(ch)) continue;
    if (SPACE.test(ch)) { if (!space) { s += " "; map.push(i); space = true; } continue; }
    let out: string;
    if (ch === "…") out = "...";
    else if (FOLD[ch]) out = FOLD[ch];
    else out = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    for (const c of out) { s += c; map.push(i); }
    space = false;
  }
  if (s.endsWith(" ")) { s = s.slice(0, -1); map.pop(); }
  return { s, map };
}

/** Folded paragraphs, kept between searches (a find box asks again on every keystroke). */
const NORM_CACHE = new Map<string, Norm>();
function normalized(text: string): Norm {
  let n = NORM_CACHE.get(text);
  if (!n) { if (NORM_CACHE.size > 6000) NORM_CACHE.clear(); n = normalize(text); NORM_CACHE.set(text, n); }
  return n;
}

const WORD = /[\p{L}\p{N}']/u;

/** A run of prose blocks laid end to end, so a match can cross paragraphs. */
interface Stream { s: string; at: { block: number; off: number }[]; starts: { block: number; from: number; raw: string }[] }

function stream(blocks: Block[], from: number, to: number): Stream {
  let s = "";
  const at: Stream["at"] = [], starts: Stream["starts"] = [];
  for (let b = Math.max(0, from); b <= Math.min(blocks.length - 1, to); b++) {
    const bl = blocks[b];
    if (!bl || bl.type === "h" || isBreak(bl.text)) continue;
    const n = normalized(bl.text);
    if (!n.s) continue;
    if (s) { s += " "; at.push({ block: -1, off: -1 }); }
    starts.push({ block: b, from: s.length, raw: bl.text });
    for (let i = 0; i < n.s.length; i++) { s += n.s[i]; at.push({ block: b, off: n.map[i] }); }
  }
  return { s, at, starts };
}

export interface Hit {
  startBlock: number; startOff: number;
  /** Exclusive end, in the end block's original text. */
  endBlock: number; endOff: number;
  /** The manuscript's own characters, paragraphs joined by a line break. */
  exact: string;
  /** 1 for an exact match, less for a near one. */
  score: number;
  fuzzy: boolean;
}

/** Widen [a, b) in the stream to whole words, so a quote never starts or ends inside a word. */
function wholeWords(s: string, a: number, b: number): [number, number] {
  while (a > 0 && WORD.test(s[a - 1]) && WORD.test(s[a])) a--;
  while (b < s.length && WORD.test(s[b]) && WORD.test(s[b - 1])) b++;
  // Trim spaces and leading or trailing punctuation that is only a separator.
  while (a < b && /[\s,;:]/.test(s[a])) a++;
  while (b > a && /[\s,;:]/.test(s[b - 1])) b--;
  return [a, b];
}

function hitOf(st: Stream, a: number, b: number, score: number, fuzzy: boolean): Hit | null {
  [a, b] = wholeWords(st.s, a, b);
  if (b <= a) return null;
  while (a < b && st.at[a].block < 0) a++;
  while (b > a && st.at[b - 1].block < 0) b--;
  const A = st.at[a], Z = st.at[b - 1];
  // The end in the original text: past the whole last character (a folded "…" maps three to one).
  const endRaw = blocksRaw(st, Z.block);
  let endOff = Z.off + 1;
  // Keep a closing quote mark or emphasis star that belongs to the last word.
  while (endOff < endRaw.length && /[*_]/.test(endRaw[endOff])) endOff++;
  let startOff = A.off;
  const startRaw = blocksRaw(st, A.block);
  while (startOff > 0 && /[*_]/.test(startRaw[startOff - 1])) startOff--;
  const parts: string[] = [];
  st.starts.filter((x) => x.block >= A.block && x.block <= Z.block).forEach((x) => {
    const s0 = x.block === A.block ? startOff : 0, e0 = x.block === Z.block ? endOff : x.raw.length;
    parts.push(x.raw.slice(s0, e0).trim());
  });
  return { startBlock: A.block, startOff, endBlock: Z.block, endOff, exact: parts.join("\n"), score, fuzzy };
}

function blocksRaw(st: Stream, block: number): string {
  const x = st.starts.find((y) => y.block === block);
  return x ? x.raw : "";
}

/** Two reusable rows for the edit distance, so a search over a book allocates nothing per word pair. */
let ROW_A = new Int32Array(64), ROW_B = new Int32Array(64);

/** Edit distance between a and b, or max + 1 as soon as it is clearly more than `max`. */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (ROW_A.length <= b.length) { ROW_A = new Int32Array(b.length * 2 + 2); ROW_B = new Int32Array(b.length * 2 + 2); }
  let prev = ROW_A, cur = ROW_B;
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1));
      cur[j] = v; if (v < low) low = v;
    }
    if (low > max) return max + 1;
    const t = prev; prev = cur; cur = t;
  }
  return Math.min(prev[b.length], max + 1);
}
/** Edit distance at most `max`. */
export const within = (a: string, b: string, max: number): boolean => distance(a, b, max) <= max;

/** How well a query word matches a text word: 2 exact, 1.2 a typo away (one edit from four letters, two from eight), else −1. */
function sim(q: string, t: string): number {
  if (q === t) return 2;
  const n = Math.min(q.length, t.length);
  if (n < 4) return -1;
  const allow = n >= 8 ? 2 : 1;
  return distance(q, t, allow) <= allow ? 1.2 : -1;
}

const tokensOf = (s: string): { w: string; a: number; b: number }[] => {
  const out: { w: string; a: number; b: number }[] = [];
  const re = /[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu;
  for (let m = re.exec(s); m; m = re.exec(s)) out.push({ w: m[0], a: m.index, b: m.index + m[0].length });
  return out;
};

export interface LocateOpts { from?: number; to?: number; limit?: number; fuzzy?: boolean }

/**
 * Where `query` is in the book, best first. Exact (after folding) matches come first, in reading
 * order; when there are none and the query has two words or more, a word-by-word alignment finds
 * passages that differ by a typo, a missing word or an extra one.
 */
export function locate(blocks: Block[], query: string, opts: LocateOpts = {}): Hit[] {
  const q = normalize(query).s.trim();
  const limit = opts.limit ?? 6;
  if (q.length < 2) return [];
  const st = stream(blocks, opts.from ?? 0, opts.to ?? blocks.length - 1);
  if (!st.s) return [];
  const out: Hit[] = [];
  for (let i = st.s.indexOf(q); i >= 0 && out.length < limit; i = st.s.indexOf(q, i + 1)) {
    const h = hitOf(st, i, i + q.length, 1, false);
    if (h && !out.some((o) => o.startBlock === h.startBlock && o.startOff === h.startOff)) out.push(h);
  }
  if (out.length || opts.fuzzy === false) return out;
  return align(st, q, limit);
}

/** Smith-Waterman on words: the best local alignments of the query against the stream. */
function align(st: Stream, q: string, limit: number): Hit[] {
  const qt = tokensOf(q).slice(0, 80).map((t) => t.w), tt = tokensOf(st.s);
  const Q = qt.length;
  if (Q < 2 || !tt.length) return [];
  const GAP = 0.8, need = 2 * Q * 0.7;
  // H[i] and S[i] (start token of the alignment) for the previous and current text token.
  let H = new Float64Array(Q + 1), S = new Int32Array(Q + 1), h2 = new Float64Array(Q + 1), s2 = new Int32Array(Q + 1);
  const found: { score: number; a: number; b: number }[] = [];
  for (let j = 0; j < tt.length; j++) {
    h2[0] = 0;
    let colBest = 0, colStart = j;
    for (let i = 1; i <= Q; i++) {
      const diag = H[i - 1] + sim(qt[i - 1], tt[j].w);
      const up = h2[i - 1] - GAP; // a query word left out of the text
      const left = H[i] - GAP; // an extra word in the text
      let v = 0, s = j;
      if (diag > v) { v = diag; s = H[i - 1] > 0 ? S[i - 1] : j; }
      if (up > v) { v = up; s = s2[i - 1]; }
      if (left > v) { v = left; s = S[i]; }
      h2[i] = v; s2[i] = s;
      if (v > colBest) { colBest = v; colStart = s; }
    }
    if (colBest >= need) found.push({ score: colBest, a: colStart, b: j });
    [H, h2] = [h2, H]; [S, s2] = [s2, S];
  }
  // Best first, without overlaps.
  found.sort((x, y) => y.score - x.score || x.a - y.a);
  const kept: typeof found = [];
  for (const f of found) {
    if (kept.some((k) => f.a <= k.b && f.b >= k.a)) continue;
    kept.push(f);
    if (kept.length >= limit) break;
  }
  // A near match takes the sentence's closing punctuation with it, as the words were written.
  const close = (b: number) => { while (b < st.s.length && /[.!?"')\]]/.test(st.s[b])) b++; return b; };
  return kept.map((k) => hitOf(st, tt[k.a].a, close(tt[k.b].b), Math.min(0.99, k.score / (2 * Q)), true)).filter((h): h is Hit => !!h);
}

/** The text of a hit with Markdown marks removed, for display. */
export const shown = (exact: string): string => exact.replace(/[*_`]+/g, "").replace(/\s+/g, " ").trim();
