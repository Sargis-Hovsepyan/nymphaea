// Saving and loading the working book. The draft is written to localStorage on every change (so a
// closed tab loses nothing) and, a moment later, to the bookshelf in IndexedDB. If neither keeps it,
// the author is told, not left to find out.
import { DRAFT_KEY, KEYS } from "../brand";
import { getImages } from "../ai/store";
import { blocksToText, parseDraft } from "../parse";
import { guardScenes } from "../stage/guard";
import { state } from "../state";
import { load, tryStore } from "../store";
import type { Book } from "../types";
import { clearUndo } from "./undo";
import { asDraft, draftOf, hasWords, newBookId, shelve, type Draft } from "./shelfData";
import { putBook } from "./shelfStore";
import { book, hooks, setMd, setMetaFields, sess, withMeta } from "./session";
import { saveFailed, saveState, toast } from "./ui";

let shelfTimer = 0, lsOk = true, failedAt = 0, softWarned = false, onShelved: () => void = () => {};
/** Be told after each write to the shelf (the bookshelf list and the painting cleanup listen). */
export function watchShelf(fn: () => void): void { onShelved = fn; }

export function currentDraft(): Draft { return draftOf(book(), sess.md, sess.userTitle, sess.meta, sess.id); }

function fail(): void {
  saveFailed();
  if (Date.now() - failedAt < 30_000) return;
  failedAt = Date.now();
  toast("Couldn’t save in this browser. Storage may be full or blocked. Export the book to keep a copy.", true);
}

/** Write the draft to the shelf now. True when it reached the disk. */
export async function flushDraft(): Promise<boolean> {
  clearTimeout(shelfTimer);
  const d = currentDraft();
  if (!hasWords(d)) return true;
  const ok = await putBook(shelve(d, sess.id));
  if (!ok && !lsOk) fail();
  else if (!ok && !softWarned) { softWarned = true; toast("The bookshelf can’t be kept in this browser (a private window, perhaps). This book is still saved here.", true); }
  else if (ok && lsOk) saveState(false);
  onShelved();
  return ok;
}

/** Save the working draft. Called after every change. */
export function saveDraft(): void {
  saveState(false);
  const d = currentDraft();
  lsOk = tryStore(DRAFT_KEY, d);
  if (!hasWords(d)) return;
  if (!lsOk) saveFailed();
  clearTimeout(shelfTimer);
  shelfTimer = window.setTimeout(() => { flushDraft(); }, 700);
}

/** Make a draft the book being edited. */
export function applyDraft(d: Draft): void {
  clearUndo();
  sess.id = d.id || newBookId();
  sess.md = d.md; sess.userTitle = d.title || "";
  sess.meta = { subtitle: d.subtitle || "", author: d.author || "", dedication: d.dedication || "" };
  const parsed = parseDraft(sess.md, sess.userTitle);
  state.book = withMeta({ title: parsed.title, blocks: parsed.blocks, scenes: guardScenes(parsed.blocks, d.scenes || []).scenes, beats: d.beats, cover: d.cover, source: d.source || "auto" });
  setMd(sess.md); setMetaFields();
  const ids = book().scenes.map((s) => s.img).filter((x): x is string => !!x);
  if (ids.length) getImages(ids).then((m) => { sess.images = { ...sess.images, ...m }; hooks.refresh(); });
}

/** A blank book. The old one stays on the shelf (callers flush it first). */
export function blankBook(): void {
  const empty: Book = { title: "", blocks: [], scenes: [], source: "auto" };
  clearUndo();
  sess.id = newBookId(); sess.md = ""; sess.userTitle = ""; sess.meta = { subtitle: "", author: "", dedication: "" };
  state.book = empty;
  setMd(""); setMetaFields();
}

/** The draft the last session left (or the book from the oldest Studio), if any. */
export function savedDraft(): Draft | null {
  const d = asDraft(load<unknown>(DRAFT_KEY));
  if (d) return d;
  const legacy = load<Book>(KEYS.book);
  if (legacy && Array.isArray(legacy.blocks) && legacy.blocks.length) {
    const md = blocksToText(legacy.blocks);
    return { md, title: legacy.title || "", scenes: legacy.scenes || [], beats: legacy.beats, cover: legacy.cover, source: legacy.source || "auto" };
  }
  return null;
}
