// The Studio's shared working state and the few helpers every part needs. One mutable object, not
// scattered module variables, so the parts split out of the old index.ts can all see the same book.
import type { Pristine } from "../export";
import { state } from "../state";
import { guardScenes } from "../stage/guard";
import type { Book, SceneRef } from "../types";
import type { Editor } from "./editor";
import type { Preview } from "./preview";

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const plural = (n: number, one: string, many = one + "s") => n.toLocaleString() + " " + (n === 1 ? one : many);
export const narrow = () => matchMedia("(max-width:759px)").matches;

export interface Meta { subtitle: string; author: string; dedication: string }

export const sess = {
  /** The Markdown the author is editing, and the title typed in the title field. */
  md: "", userTitle: "", meta: { subtitle: "", author: "", dedication: "" } as Meta,
  /** The id of this book on the shelf. */
  id: "",
  preview: null as unknown as Preview,
  pristine: null as unknown as Pristine,
  editor: null as unknown as Editor,
  mk: null as unknown as HTMLElement,
  /** AI pictures the book's scenes use, by id (loaded from IndexedDB). */
  images: {} as Record<string, string>,
  /** claude.ai extras, when running as an artifact. */
  sample: null as any, downloads: null as any,
  ready: false,
};

/** Set by index.ts, so parts can ask for a full refresh without importing it. */
export const hooks = { refresh: () => {}, renderScenes: () => {}, armWords: (_k: number) => {}, openLarge: (_k: number) => {}, openPanel: () => {} };

/** Paintings in progress, keyed by their place in the book (not by card index, which shifts). */
export const painting = new Map<string, AbortController>();
export const pkey = (s: SceneRef): string => s.after + "|" + s.scene;

export const book = (): Book => state.book;
export const hasText = (): boolean => book().blocks.some((b) => b.type !== "h");

export function withMeta(b: Book): Book {
  const m = sess.meta;
  b.subtitle = m.subtitle || undefined; b.author = m.author || undefined; b.dedication = m.dedication || undefined;
  return b;
}

/** The AI pictures the current scenes use (the preview and the export get only these). */
export function usedImages(): Record<string, string> {
  const out: Record<string, string> = {};
  book().scenes.forEach((s) => { if (s.img && sess.images[s.img]) out[s.img] = sess.images[s.img]; });
  return out;
}

/** Put the Markdown into the editor (and its colour mirror). */
export function setMd(text: string): void {
  $<HTMLTextAreaElement>("mkMd").value = text;
  sess.editor.paint();
}

export function setMetaFields(): void {
  $<HTMLInputElement>("mkTitle").value = sess.userTitle;
  $<HTMLInputElement>("mkSubtitle").value = sess.meta.subtitle;
  $<HTMLInputElement>("mkAuthor").value = sess.meta.author;
  $<HTMLInputElement>("mkDedication").value = sess.meta.dedication;
}

/** The one-line note under the picture controls: a summary, or a warning that has no toast of its own. */
export function sceneNote(t: string, warn = false): void { const n = $("mkSceneNote"); n.textContent = t; n.className = "note" + (warn ? " warn" : ""); }
export const clearWarn = (): void => { $("mkSceneNote").classList.remove("warn"); };

/** Make `scenes` the plan (guarded, now placed by hand) and bring every view up to date. */
export function commitScenes(scenes: SceneRef[]): void {
  const B = book();
  B.scenes = guardScenes(B.blocks, scenes).scenes; B.source = "hand";
  clearWarn();
  hooks.refresh();
}

/** Long jobs the Stop button can end: AI staging and "Paint all". (Single paintings are in `painting`.) */
export const jobs = { staging: null as AbortController | null, paintAll: null as AbortController | null };
export const syncStop = (): void => { $("mkStop").hidden = !jobs.staging && !jobs.paintAll && !painting.size; };
export function stopAll(): void { jobs.staging?.abort(); jobs.paintAll?.abort(); painting.forEach((pc) => pc.abort()); }
