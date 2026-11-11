// Where the reader is, and what that is worth: time left from words and a measured pace, the saved
// position, the caption's words inside the paragraph they were quoted from, and the room light a
// passage asks for. All pure, so the reader's DOM code stays thin and the rules can be tested.
import { plain } from "../inline";
import { CAPTION_WINDOW } from "../stage/guard";
import type { Spec } from "../compose/spec";
import type { Block, SceneRef } from "../types";

// ---- pace and time left ----------------------------------------------------------------------

export const PACE = { def: 230, min: 120, max: 450 };
/** The default pace counts as this many minutes of reading, so a few samples cannot swing it. */
const PRIOR_MIN = 1.5;

export const clampPace = (p: number): number => Math.max(PACE.min, Math.min(PACE.max, p));

export const wordCount = (text: string): number => plain(text).split(/\s+/).filter(Boolean).length;

/** Words read and active milliseconds so far. */
export interface PaceStat { w: number; ms: number }

/**
 * Add one stretch of reading: `dw` words passed in `dt` ms. Idle gaps (over 30 s), moving back and
 * jumps (faster than 900 words a minute, a drag on the scrollbar or a chapter key) are not reading.
 */
export function paceAdd(p: PaceStat, dw: number, dt: number): PaceStat {
  if (!(dt > 0) || dt > 30000 || !(dw > 0)) return p;
  if ((dw / dt) * 60000 > 900) return p;
  return { w: p.w + dw, ms: p.ms + dt };
}

export function paceOf(p: PaceStat, def = PACE.def): number {
  return clampPace((def * PRIOR_MIN + p.w) / (PRIOR_MIN + p.ms / 60000));
}

export function minutesLeft(words: number, wpm: number): number {
  return words <= 0 ? 0 : Math.round(words / clampPace(wpm));
}

/** "Chapter 3 · about 6 min left in chapter", or "about 6 min left" when the book has no chapters. */
export function leftLabel(words: number, wpm: number, chapter?: number | null): string {
  const m = minutesLeft(words, wpm), ch = chapter ? "Chapter " + chapter + " · " : "";
  if (words <= 0) return chapter ? ch + "end of chapter" : "The end";
  const t = m < 1 ? "under a minute left" : "about " + m + " min left";
  return ch + t + (chapter ? " in chapter" : "");
}

// ---- the saved position ----------------------------------------------------------------------

export interface Pos { b: number; o: number; w?: number; ms?: number }

/** Block, fraction of the way down it, and the pace stats, as one short string. */
export function encodePos(p: Pos): string {
  return [Math.max(0, Math.round(p.b)), Math.max(0, Math.min(1, p.o)).toFixed(3), Math.round(p.w || 0), Math.round(p.ms || 0)].join(":");
}

export function decodePos(raw: unknown): Pos | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{1,6}):(\d(?:\.\d+)?):(\d{1,9}):(\d{1,10})$/.exec(raw);
  if (!m) return null;
  const o = +m[2];
  if (o > 1) return null;
  return { b: +m[1], o, w: +m[3], ms: +m[4] };
}

/** Past the opening: more than a couple of paragraphs in. A reader still at the top has nothing to resume. */
export function pastOpening(blocks: Block[], b: number): boolean {
  const first = blocks.findIndex((x) => x.type === "p");
  return b < blocks.length && b > (first < 0 ? 0 : first) + 2;
}

/** The last picture passed before block `b`. */
export function lastFigureBefore(scenes: SceneRef[], b: number): SceneRef | undefined {
  let best: SceneRef | undefined;
  scenes.forEach((s) => { if (s.after < b && (!best || s.after >= best.after)) best = s; });
  return best;
}

// ---- the caption's words in the text ----------------------------------------------------------

const WORDCH = /[\p{L}\p{N}]/u;

/**
 * Where `caption` sits inside `text`: the same exact, whole-word match the Guard demands, with any
 * run of whitespace counting as one space. Offsets are into `text`. Null if it is not there.
 */
export function quoteRange(text: string, caption: string): [number, number] | null {
  const q = caption.trim().replace(/…$/, "").trim().replace(/\s+/g, " ");
  if (!q) return null;
  let flat = "";
  const at: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const sp = /\s/.test(text[i]);
    if (sp && flat.endsWith(" ")) continue;
    flat += sp ? " " : text[i]; at.push(i);
  }
  for (let i = flat.indexOf(q); i >= 0; i = flat.indexOf(q, i + 1)) {
    const before = i > 0 ? flat[i - 1] : "", after = flat[i + q.length] || "";
    const okS = !WORDCH.test(q[0]) || !before || !WORDCH.test(before);
    const okE = !WORDCH.test(q[q.length - 1]) || !after || !WORDCH.test(after);
    if (okS && okE) return [at[i], at[i + q.length - 1] + 1];
  }
  return null;
}

/** The block a caption quotes: the anchor paragraph, or one of the few before it. -1 if none. */
export function cueBlock(blocks: Block[], after: number, caption: string): number {
  const cap = plain(caption);
  for (let j = after; j >= Math.max(0, after - CAPTION_WINDOW); j--) {
    const b = blocks[j];
    if (b && b.type !== "h" && quoteRange(plain(b.text), cap)) return j;
  }
  return -1;
}

/** Can the page mark words without touching them? (CSS Custom Highlight API.) */
export function cueSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof (globalThis as { Highlight?: unknown }).Highlight === "function";
}

// ---- story light ------------------------------------------------------------------------------

export type RGB = [number, number, number];
/** The room's darkness (0 clear, 1 black), and how far it is tinted toward `rgb`. */
export interface Story { dark: number; tm: number; rgb: RGB }

const HOUR: Record<Spec["time"], Story> = {
  dawn: { dark: 0.58, tm: 0.1, rgb: [236, 166, 150] },
  day: { dark: 0.62, tm: 0, rgb: [255, 255, 255] },
  dusk: { dark: 0.8, tm: 0.15, rgb: [201, 128, 58] },
  night: { dark: 0.93, tm: 0.3, rgb: [28, 44, 92] },
};
export const STORY_NEUTRAL: Story = { dark: 0.82, tm: 0, rgb: [255, 255, 255] };
const GREY: RGB = [122, 128, 136];
const GREYING: Partial<Record<Spec["sky"], number>> = { cloud: 0.15, snow: 0.25, rain: 0.4, fog: 0.5, storm: 0.55 };

/** Night dims and cools, dawn lifts, dusk warms, day is light; fog, rain and storm grey it a little. */
export function storyTarget(s: Pick<Spec, "time" | "sky"> | null): Story {
  if (!s) return STORY_NEUTRAL;
  const h = HOUR[s.time] || STORY_NEUTRAL, g = GREYING[s.sky] || 0;
  const rgb = h.rgb.map((c, k) => Math.round(c + (GREY[k] - c) * g)) as RGB;
  return { dark: Math.min(0.96, h.dark + g * 0.05), tm: Math.min(0.5, h.tm + g * 0.14), rgb };
}
