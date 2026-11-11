// When each act plays. Acts run in the order the words give them, each starting a little before the
// last one ends ("as" and "while" start together), after a short lead-in. Each kind has a length
// and a telling moment: the frame a still picture shows (a thumbnail, the EPUB, reduced motion),
// so "the bird flew away" is a bird leaving, not an empty sky. A playing picture runs once, holds
// its last frame, then starts again. Pure.
import { clamp } from "../scenes/helpers";
import type { Act } from "./acts";

/** Seconds per kind, and where in it the telling moment falls (0..1). */
const LEN: Record<string, [number, number]> = {
  go: [2.6, 0.7], run: [1.8, 0.6], enter: [2.4, 0.8], leave: [2.4, 0.45], cross: [3.2, 0.5], turn: [0.7, 1],
  sit: [1.2, 1], rise: [1.1, 1], lie: [1.6, 1], kneel: [1.2, 1], fall: [0.9, 0.95], jump: [0.9, 0.45], bow: [1.4, 0.5],
  handle: [1.6, 0.5], open: [1.8, 0.75], close: [1.4, 0.85], light: [1.8, 0.8], snuff: [1.4, 0.8], knock: [1.4, 0.5],
  take: [1.6, 0.7], give: [2, 0.55], put: [1.6, 0.6], drop: [1.2, 0.8], throw: [1.4, 0.6], raise: [1.4, 0.7], wave: [2, 0.5],
  point: [1.6, 0.6], look: [1.6, 0.7], drink: [2, 0.55], read: [2.6, 0.6], work: [2.6, 0.5], speak: [2.2, 0.5], nod: [1.2, 0.4],
  shake: [1.2, 0.4], weep: [2.6, 0.6], laugh: [2, 0.4],
  hug: [2.4, 0.8], kiss: [2.4, 0.8], dance: [3.6, 0.5], greet: [2, 0.7],
  arrive: [3, 0.85], depart: [3, 0.35], pass: [3.6, 0.5], die: [1.6, 0.85], ring: [2, 0.4],
  sunrise: [4, 0.55], sunset: [4, 0.55], moonrise: [4, 0.6], nightfall: [4, 0.75], daybreak: [4, 0.6], stars: [3, 0.8],
  rain: [2.5, 0.8], snow: [3, 0.8], fog: [3, 0.7], wind: [2.5, 0.8], storm: [3, 0.7], cloud: [3, 0.7], flash: [1.2, 0.2],
};
/** Thing kinds that share a figure kind's name but play at their own length. */
const THING_LEN: Record<string, [number, number]> = { open: [1.4, 0.75], close: [0.9, 0.9], light: [1.2, 0.8], fall: [0.9, 0.9] };

export interface Seg { act: Act; n: number; start: number; end: number; tell: number }
export interface Timeline { segs: Seg[]; /** When the last act ends. */ total: number; /** One play through and its hold. */ loop: number; /** The telling moment. */ still: number }

const LEAD = 0.4, OVERLAP = 0.12, HOLD = 3.5, MAX = 9;

export function timeline(acts: readonly Act[]): Timeline {
  const segs: Seg[] = [];
  let at = LEAD, prev: Seg | null = null;
  acts.forEach((a, n) => {
    const [len0, tell] = (a.by >= 5 && a.by < 9 && THING_LEN[a.kind]) || LEN[a.kind] || [1.6, 0.6];
    const len = len0 * (a.manner === 1 ? 1.6 : a.manner === 2 ? 0.55 : 1);
    const start = a.with && prev ? prev.start : prev ? Math.max(LEAD, prev.end - OVERLAP) : at;
    const sg: Seg = { act: a, n, start, end: start + len, tell: start + len * tell };
    segs.push(sg); prev = sg; at = sg.end;
  });
  let total = segs.reduce((m, s) => Math.max(m, s.end), 0);
  if (total > MAX) { const k = MAX / total; segs.forEach((s) => { s.start *= k; s.end *= k; s.tell *= k; }); total = MAX; }
  const last = segs.length ? segs.reduce((m, s) => (s.tell > m.tell ? s : m)) : null;
  return { segs, total, loop: total + HOLD, still: last ? last.tell : 0 };
}

/** How far through a segment the clock is, 0..1. */
export const prog = (s: Seg, p: number): number => clamp((p - s.start) / Math.max(0.01, s.end - s.start));

/** The play clock within one loop; at the wrap the light dips so the restart reads as a cut. */
export function looped(tl: Timeline, p: number | undefined): { p: number; dip: number } {
  if (p == null || !tl.segs.length) return { p: p == null ? tl.still : p, dip: 1 };
  const q = ((p % tl.loop) + tl.loop) % tl.loop, edge = Math.min(q, tl.loop - q);
  // The first play starts in full light; every wrap after it dips out and back.
  const wrap = edge < 0.35 && (p >= tl.loop || q > tl.loop / 2);
  return { p: q, dip: wrap ? 0.45 + 0.55 * edge / 0.35 : 1 };
}
