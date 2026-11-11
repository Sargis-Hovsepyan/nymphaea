// The two rules the screen and the EPUB must agree on: which paragraphs stand alone as beats, and
// which chapter headings already carry their own number. One copy, used by ui/reader.ts and
// epub/book.ts. Pure.
import { plain } from "../inline";
import { autoBeats } from "../stage/beats";
import type { Block } from "../types";

const WORDS = /^(chapter|part|book|episode|act|prologue|epilogue|interlude|afterword|foreword|preface|\d+\b)/i;
// A Roman numeral counts only when it is one ("IV. The Sea", "XII"), never the first letters of a word ("Mild", "Dim").
const ROMAN = /^(?=[IVXLCDM])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})(?:[.:)]|\s*$)/;
/** Headings that already carry their own number ("Chapter One", "3", "IV. The Sea") get none. */
export const NUMBERED = { test: (t: string): boolean => WORDS.test(t) || ROMAN.test(t) };

export const hasOwnNumber = (heading: string): boolean => NUMBERED.test(heading);

/**
 * The paragraphs set as beats. Explicit beats (from Claude) are taken as given, and then only short
 * lines qualify; without them the automatic rule decides.
 */
export function beatIndexes(blocks: Block[], explicit?: number[]): Set<number> {
  if (!explicit || !explicit.length) return autoBeats(blocks);
  const out = new Set<number>(), want = new Set(explicit);
  blocks.forEach((b, i) => {
    if (b.type !== "p") return;
    const len = plain(b.text).length;
    if (want.has(i) ? len <= 90 : len <= 18) out.add(i);
  });
  return out;
}

/**
 * The scene for the cover. An author's choice stands. Otherwise the most common scene, but when the
 * book has two or more pictures it must not repeat the first one: the next most common takes over.
 */
export function coverScene(scenes: { after: number; scene: string }[], base: string, explicit?: string): string {
  if (explicit) return explicit;
  if (scenes.length < 2) return base;
  const ordered = scenes.slice().sort((a, b) => a.after - b.after), first = ordered[0].scene;
  if (base !== first) return base;
  const cnt = new Map<string, number>();
  ordered.forEach((s) => { if (s.scene !== first) cnt.set(s.scene, (cnt.get(s.scene) || 0) + 1); });
  let best = base, n = 0;
  cnt.forEach((c, id) => { if (c > n) { n = c; best = id; } });
  return best;
}

/** Does any picture already show this scene? (The end mark is a lotus only when none does.) */
export const showsScene = (scenes: { scene: string }[], id: string): boolean => scenes.some((s) => s.scene === id);
