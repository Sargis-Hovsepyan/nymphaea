// The Story line, as data: bands across the text (hour, place, weather, season, mood) sized by words,
// chapters as stations, pictures and suggestions as stops, and the long stretches without a picture.
import type { Spec } from "../compose/spec";
import { DENS } from "../settings";
import { plain } from "../inline";
import type { Block, Density, SceneRef } from "../types";
import { chapterBlocks, offsets, type Suggestion } from "./suggest";

export type BandId = "time" | "place" | "sky" | "season" | "mood";
export interface Seg { from: number; to: number; start: number; words: number; key: string; label: string }
export interface Band { id: BandId; name: string; segs: Seg[] }
export interface Station { block: number; start: number; title: string; num: number }
export interface Stop { block: number; pos: number; k: number; suggested: boolean; caption: string; scene: string; strength?: number }
export interface Gap { start: number; end: number; words: number }
export interface LineModel { total: number; bands: Band[]; stations: Station[]; stops: Stop[]; gaps: Gap[]; limit: number }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const moodKey = (v: number): string => (v < -0.25 ? "dark" : v > 0.25 ? "bright" : "even");

const BANDS: { id: BandId; name: string; of: (s: Spec) => { key: string; label: string } }[] = [
  { id: "time", name: "Hour", of: (s) => ({ key: s.time, label: cap(s.time) }) },
  { id: "place", name: "Place", of: (s) => ({ key: s.place, label: s.place === "inner" ? "Abstract" : cap(s.place) }) },
  { id: "sky", name: "Weather", of: (s) => ({ key: s.sky, label: cap(s.sky) }) },
  { id: "season", name: "Season", of: (s) => ({ key: s.season, label: s.season === "none" ? "Any" : cap(s.season) }) },
  { id: "mood", name: "Mood", of: (s) => { const k = moodKey(s.v); return { key: k, label: cap(k) }; } },
];

/** Runs of equal values over the blocks, sized in words. Blocks without a spec (headings, scene breaks) join the run before them. */
export function bandSegs(specs: (Spec | null)[], starts: number[], wc: number[], of: (s: Spec) => { key: string; label: string }): Seg[] {
  const vals = specs.map((s) => (s ? of(s) : null));
  const first = vals.find((v) => v);
  if (!first) return [];
  let prev = first;
  const filled = vals.map((v) => { if (v) prev = v; return v || prev; });
  const segs: Seg[] = [];
  filled.forEach((v, i) => {
    const last = segs[segs.length - 1];
    if (last && last.key === v.key) { last.to = i; last.words += wc[i]; }
    else segs.push({ from: i, to: i, start: starts[i], words: wc[i], key: v.key, label: v.label });
  });
  if (segs.length) segs[0].start = 0;
  // A run of zero words (an empty block) would be invisible: drop it.
  return segs.filter((s) => s.words > 0);
}

/** Mood moves a little with every sentence; average it over the nearby passages so the band shows the swell, not the flicker. */
export function smoothMood(specs: (Spec | null)[], radius = 3): (Spec | null)[] {
  const idx = specs.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  return specs.map((s, i) => {
    if (!s) return s;
    const k = idx.indexOf(i), win = idx.slice(Math.max(0, k - radius), k + radius + 1);
    return { ...s, v: win.reduce((a, j) => a + specs[j]!.v, 0) / win.length };
  });
}

export function lineModel(blocks: Block[], scenes: SceneRef[], specs: (Spec | null)[], sugg: Suggestion[], density: Density, captionOf: (s: Suggestion) => string): LineModel {
  const { starts, wc, total } = offsets(blocks);
  const limit = Math.round(DENS[density] * 2.5);
  const bands = BANDS.map((b) => ({ id: b.id, name: b.name, segs: bandSegs(b.id === "mood" ? smoothMood(specs) : specs, starts, wc, b.of) })).filter((b) => b.segs.length);
  const stations: Station[] = chapterBlocks(blocks).map((i, n) => ({ block: i, start: starts[i], title: plain(blocks[i].text), num: n + 1 }));
  const end = (i: number) => starts[i] + wc[i];
  const stops: Stop[] = [
    ...scenes.filter((s) => blocks[s.after]).map((s, k) => ({ block: s.after, pos: end(s.after), k, suggested: false, caption: s.caption, scene: s.scene })),
    ...sugg.map((s, k) => ({ block: s.block, pos: end(s.block), k, suggested: true, caption: captionOf(s), scene: "", strength: s.strength })),
  ].sort((a, b) => a.pos - b.pos);
  const anchors = [0, ...stops.filter((s) => !s.suggested).map((s) => s.pos), total];
  const gaps: Gap[] = [];
  for (let i = 1; i < anchors.length; i++) {
    const w = anchors[i] - anchors[i - 1];
    if (w > limit) gaps.push({ start: anchors[i - 1], end: anchors[i], words: w });
  }
  return { total, bands, stations, stops, gaps, limit };
}
