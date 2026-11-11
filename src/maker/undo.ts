// Undo. A step that can be undone. Picture steps never touch the words: undoing one puts the earlier
// pictures back onto the text as it is now. Text steps (a typography fix, a new file) restore the
// text only if nothing was typed since, so an undo can never erase the author's newer words.
import { guardScenes } from "../stage/guard";
import { state } from "../state";
import { parseDraft } from "../parse";
import type { BookSource, SceneRef } from "../types";
import { restorePictures } from "./restore";
import { book, clearWarn, hooks, setMd, setMetaFields, sess, withMeta, type Meta } from "./session";
import { toast } from "./ui";

interface Snap { text: boolean; md: string; mdAfter?: string; title: string; meta: Meta; scenes: SceneRef[]; beats?: number[]; source: BookSource; cover?: string }
const undoStack: Snap[] = [];

/** An older toast's Undo would now undo a different step: retire those. */
function retireUndoToasts(): void { document.querySelectorAll("#mkToasts .toast").forEach((t) => { if (t.querySelector(".toast-act")) t.remove(); }); }

/** Remember the book as it is now, so the next change can be undone. */
export function checkpoint(text = false): Snap {
  const B = book();
  retireUndoToasts();
  const snap: Snap = JSON.parse(JSON.stringify({ text, md: sess.md, title: sess.userTitle, meta: sess.meta, scenes: B.scenes, beats: B.beats, source: B.source, cover: B.cover }));
  undoStack.push(snap);
  if (undoStack.length > 50) undoStack.shift();
  return snap;
}

export function clearUndo(): void { undoStack.length = 0; retireUndoToasts(); }

/** Every picture list the undo stack could bring back (so their paintings are kept). */
export function undoScenes(): SceneRef[][] { return undoStack.map((s) => s.scenes); }

export function undo(): void {
  retireUndoToasts();
  const s = undoStack.pop();
  if (!s) { toast("Nothing to undo."); return; }
  if (s.text) {
    if (s.mdAfter !== undefined && sess.md !== s.mdAfter) {
      toast("The text has been edited since, so that step can’t be undone here without losing your newer words. Use undo inside the editor instead.", true);
      return;
    }
    sess.md = s.md; sess.userTitle = s.title; sess.meta = { ...s.meta };
    setMd(sess.md); setMetaFields();
    const parsed = parseDraft(sess.md, sess.userTitle);
    state.book = withMeta({ title: parsed.title, blocks: parsed.blocks, scenes: guardScenes(parsed.blocks, s.scenes).scenes, beats: s.beats, cover: s.cover, source: s.source });
  } else {
    const cur = book(), r = restorePictures(cur.blocks, sess.md, sess.userTitle, s);
    cur.scenes = r.scenes; cur.beats = r.beats; cur.source = s.source; cur.cover = s.cover;
  }
  clearWarn();
  hooks.refresh();
  toast("Undone.");
}
export const UNDO = { label: "Undo", run: () => undo() };
