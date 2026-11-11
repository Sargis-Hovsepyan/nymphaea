// Which passages deserve a picture and have none. Pure and deterministic: a paragraph is scored by
// how much it says about its own scene (places, hours, weather, things), then kept only if no picture
// is near it and no stronger suggestion is near it. The Storyboard and the Pictures tab share this.
import { concreteness, evidence, trackSpecs } from "../compose/read";
import type { Spec } from "../compose/spec";
import { isBreak, plain } from "../inline";
import { state } from "../state";
import type { Block, SceneRef } from "../types";

export const MIN_SCORE = 3;
/** Words that must lie between a suggestion and the nearest picture (or other suggestion). */
export const MIN_GAP = 220;
const MIN_WORDS = 14;
const MAX_SUGGESTIONS = 24;

export const countWords = (text: string): number => (plain(text).match(/\S+/g) || []).length;

export interface Suggestion { block: number; score: number; strength: number; words: number; spec: Spec | null }

/** 0 to 1, rising quickly then flattening: 3 is about 0.5, 8 about 0.86. */
export const strengthOf = (score: number): number => Math.round((1 - Math.exp(-score / 4)) * 100) / 100;

/** Word offset at the start of each block, and the total. */
export function offsets(blocks: Block[]): { starts: number[]; wc: number[]; total: number } {
  const starts: number[] = [], wc: number[] = [];
  let at = 0;
  blocks.forEach((b) => { starts.push(at); const n = countWords(b.text); wc.push(n); at += n; });
  return { starts, wc, total: at };
}

export interface SuggestOptions { minScore?: number; minGap?: number; max?: number }

export function suggest(blocks: Block[], scenes: SceneRef[], specs: (Spec | null)[], opt: SuggestOptions = {}): Suggestion[] {
  const minScore = opt.minScore ?? MIN_SCORE, minGap = opt.minGap ?? MIN_GAP, max = opt.max ?? MAX_SUGGESTIONS;
  const { starts, wc } = offsets(blocks);
  const mid = (i: number) => starts[i] + wc[i] / 2;
  const pics = scenes.filter((s) => blocks[s.after]).map((s) => mid(s.after));
  const cand: Suggestion[] = [];
  blocks.forEach((b, i) => {
    if (b.type !== "p" || isBreak(b.text) || wc[i] < MIN_WORDS) return;
    const score = Math.round(concreteness(evidence(b.text)) * 10) / 10;
    if (score < minScore) return;
    if (pics.some((p) => Math.abs(p - mid(i)) < minGap)) return;
    cand.push({ block: i, score, strength: strengthOf(score), words: wc[i], spec: specs[i] || null });
  });
  cand.sort((a, b) => b.score - a.score || a.block - b.block);
  const kept: Suggestion[] = [];
  for (const c of cand) {
    if (kept.length >= max) break;
    if (kept.some((k) => Math.abs(mid(k.block) - mid(c.block)) < minGap)) continue;
    kept.push(c);
  }
  return kept.sort((a, b) => a.block - b.block);
}

/** Short tags for a spec: place, hour, weather when it is not clear, and the shot. */
export function tagsOf(sp: Spec | null): string[] {
  if (!sp) return [];
  return [sp.place === "inner" ? "abstract" : sp.place, sp.time, ...(sp.sky !== "clear" ? [sp.sky] : []), sp.shot === "wide" ? "wide" : sp.shot === "mid" ? "mid" : "close"];
}

/** Chapter headings: the highest level of heading the book uses. */
export function chapterBlocks(blocks: Block[]): number[] {
  const hs: { i: number; l: number }[] = [];
  blocks.forEach((b, i) => { if (b.type === "h") hs.push({ i, l: b.level || 1 }); });
  if (!hs.length) return [];
  const top = Math.min(...hs.map((h) => h.l));
  return hs.filter((h) => h.l === top).map((h) => h.i);
}

export interface Group<T> { block: number; title: string; items: T[] }
/** Items placed in the chapter that contains their block. A group with block -1 holds text before the first chapter. */
export function groupByChapter<T>(blocks: Block[], chapters: number[], items: T[], at: (t: T) => number): Group<T>[] {
  const groups: Group<T>[] = chapters.map((i) => ({ block: i, title: plain(blocks[i].text), items: [] }));
  const lead: Group<T> = { block: -1, title: "", items: [] };
  items.forEach((t) => {
    const b = at(t);
    let g = lead;
    for (let k = chapters.length - 1; k >= 0; k--) if (chapters[k] <= b) { g = groups[k]; break; }
    g.items.push(t);
  });
  return lead.items.length || !groups.length ? [lead, ...groups] : groups;
}

/* ---- the memoised wrappers the views use ---- */
let specMemo: { blocks: Block[]; sig: string; specs: (Spec | null)[] } | null = null;
const sigOf = (blocks: Block[]): string => blocks.length + ":" + blocks.reduce((a, b) => a + b.text.length, 0);

/** trackSpecs for the current book, read once per text. */
export function specsOf(blocks: Block[] = state.book.blocks): (Spec | null)[] {
  const sig = sigOf(blocks);
  if (specMemo && specMemo.blocks === blocks && specMemo.sig === sig) return specMemo.specs;
  let specs: (Spec | null)[] = [];
  try { specs = trackSpecs(blocks); } catch { specs = blocks.map(() => null); }
  specMemo = { blocks, sig, specs };
  return specs;
}

let sugMemo: { key: string; list: Suggestion[] } | null = null;
/** The suggestions for the current book and its pictures. */
export function currentSuggestions(): Suggestion[] {
  const B = state.book, key = sigOf(B.blocks) + "|" + B.scenes.map((s) => s.after).join(",");
  if (sugMemo && sugMemo.key === key) return sugMemo.list;
  const list = suggest(B.blocks, B.scenes, specsOf(B.blocks));
  sugMemo = { key, list };
  return list;
}
