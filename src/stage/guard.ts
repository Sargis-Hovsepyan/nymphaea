// The Guard: every staging plan (by hand, by rules or by an AI) passes through here before it
// reaches the page. It is what makes "never invent or change the author's words" unbreakable.
import { flat, isProse } from "../parse";
import type { Block, SceneRef } from "../types";
import { captionFor } from "./auto";
import { normalize } from "../compose/spec";
import { isScene } from "./keywords";

/** How many paragraphs back from its picture a caption may quote (same window autoStage uses). */
export const CAPTION_WINDOW = 6;

function core(caption: string): string {
  return caption.trim().replace(/…$/, "").trim();
}

const WORDCH = /[\p{L}\p{N}]/u;

/** `q` occurs in `t` starting and ending on word boundaries ("x" is not a quote from "next"). */
function quotes(t: string, q: string): boolean {
  for (let i = t.indexOf(q); i >= 0; i = t.indexOf(q, i + 1)) {
    const before = i > 0 ? t[i - 1] : "", after = t[i + q.length] || "";
    const startOk = !WORDCH.test(q[0]) || !before || !WORDCH.test(before);
    const endOk = !WORDCH.test(q[q.length - 1]) || !after || !WORDCH.test(after);
    if (startOk && endOk) return true;
  }
  return false;
}

/** True if the caption is an exact quote, whole words, from the anchor paragraph or one of the few before it. */
export function captionIsQuoted(caption: string, blocks: Block[], after: number): boolean {
  const q = flat(core(caption));
  if (!q) return true;
  for (let j = after; j >= Math.max(0, after - CAPTION_WINDOW); j--) {
    if (blocks[j] && quotes(flat(blocks[j].text), q)) return true;
  }
  return false;
}

/** Image ids are short and plain, so they can never smuggle markup into a book. */
export const IMG_ID = /^[a-z0-9_-]{4,64}$/;

export interface GuardResult {
  scenes: SceneRef[];
  /** Dropped: bad index, not a paragraph, or unknown scene. */
  rejected: number;
  /** Caption was not an exact quote, so it was replaced with one taken from the paragraph. */
  recaptioned: number;
}

export function guardScenes(blocks: Block[], scenes: unknown[]): GuardResult {
  let rejected = 0, recaptioned = 0;
  const out: SceneRef[] = [];
  scenes.forEach((raw) => {
    const s = raw as Partial<SceneRef> | null;
    const after = Number(s && s.after);
    if (!s || !Number.isInteger(after) || !isProse(blocks[after]) || !isScene(s.scene)) { rejected++; return; }
    let caption = String(s.caption ?? "").slice(0, 80);
    if (!captionIsQuoted(caption, blocks, after)) { caption = captionFor(blocks[after].text, s.scene); recaptioned++; }
    const scene = s.scene.startsWith("gen:") ? normalize(s.scene)! : s.scene;
    const ref: SceneRef = { after, scene, caption };
    if (typeof s.img === "string" && IMG_ID.test(s.img)) ref.img = s.img;
    if (typeof s.prompt === "string" && s.prompt.trim()) ref.prompt = s.prompt.slice(0, 1200);
    out.push(ref);
  });
  out.sort((a, b) => a.after - b.after);
  return { scenes: out, rejected, recaptioned };
}

export function guardBeats(blocks: Block[], beats: unknown): number[] {
  return (Array.isArray(beats) ? beats : []).map(Number).filter((n) => Number.isInteger(n) && isProse(blocks[n]));
}

/** Final check before render/export: the words are exactly what was imported. */
export function sameBlocks(a: Block[], b: Block[]): boolean {
  return a.length === b.length && a.every((x, i) => x.type === b[i].type && x.text === b[i].text && (x.level || 0) === (b[i].level || 0));
}
