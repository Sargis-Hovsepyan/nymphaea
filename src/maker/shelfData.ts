// What a shelved book is, and how the old single draft becomes one. Pure data, no storage here.
import { words } from "../stage/keywords";
import { parseDraft } from "../parse";
import type { Book, BookSource, SceneRef } from "../types";

/** The Studio's working copy of one book: the Markdown, the title page and the staging plan. */
export interface Draft {
  id?: string;
  md: string; title: string; subtitle?: string; author?: string; dedication?: string;
  scenes: SceneRef[]; beats?: number[]; cover?: string; source: BookSource;
}

/** A book on the shelf: the draft plus what the shelf shows without opening it. */
export interface Shelved {
  id: string;
  updated: number;
  title: string;
  words: number;
  /** The first picture, for the thumbnail: its scene id and, if painted, its image id. */
  pic?: { scene: string; img?: string };
  draft: Draft;
}

export const newBookId = (): string => "b" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

export const hasWords = (d: Pick<Draft, "md">): boolean => !!d.md && d.md.trim().length > 0;

/** An untrusted object (storage can hold anything) as a Draft, or null. */
export function asDraft(v: unknown): Draft | null {
  const d = v as Partial<Draft> | null;
  if (!d || typeof d !== "object" || typeof d.md !== "string" || !d.md.trim()) return null;
  const str = (x: unknown) => (typeof x === "string" ? x : undefined);
  return {
    id: str(d.id), md: d.md, title: str(d.title) || "",
    subtitle: str(d.subtitle), author: str(d.author), dedication: str(d.dedication),
    scenes: Array.isArray(d.scenes) ? d.scenes : [], beats: Array.isArray(d.beats) ? d.beats : undefined,
    cover: str(d.cover), source: d.source === "hand" || d.source === "claude" ? d.source : "auto",
  };
}

/** The shelf's record for a draft. */
export function shelve(d: Draft, id: string, now = Date.now()): Shelved {
  const parsed = parseDraft(d.md, d.title);
  const wordCount = parsed.blocks.reduce((a, b) => a + (b.type === "h" ? 0 : words(b.text).length), 0);
  const first = [...(d.scenes || [])].sort((a, b) => a.after - b.after)[0];
  return { id, updated: now, title: d.title || parsed.title || "Untitled book", words: wordCount, pic: first ? { scene: first.scene, img: first.img } : undefined, draft: { ...d, id } };
}

/**
 * First run with a shelf: the one draft the old Studio kept becomes a book on the shelf. Returns
 * null if there is no usable draft, or its book is already on the shelf (`shelfIds`).
 */
export function migrateDraft(old: unknown, shelfIds: string[], now = Date.now()): Shelved | null {
  const d = asDraft(old);
  if (!d || (d.id && shelfIds.includes(d.id))) return null;
  return shelve(d, d.id || newBookId(), now);
}

/** Newest first. */
export const byRecent = (a: Shelved, b: Shelved): number => b.updated - a.updated;

/** The Draft for a Book (the other direction of withMeta). */
export function draftOf(B: Book, md: string, title: string, meta: { subtitle: string; author: string; dedication: string }, id?: string): Draft {
  return { id, md, title, ...meta, scenes: B.scenes, beats: B.beats, cover: B.cover, source: B.source };
}
