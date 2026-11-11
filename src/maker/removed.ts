// Pictures taken away from a card stay visible, struck through, at the end of the picture list with a
// Restore button. They go when the text changes or after five more picture edits. Restoring goes
// through commitScenes, so the Guard checks the caption again.
import type { SceneRef } from "../types";
import { $, book, commitScenes, pkey } from "./session";
import { thumb } from "./studio";
import { checkpoint, UNDO } from "./undo";
import { toast } from "./ui";

interface Gone { ref: SceneRef; age: number }
const MAX_AGE = 5;
let gone: Gone[] = [];
let blocksRef: unknown = null, blocksLen = -1, sig = "", own = false;

const sigOf = (): string => book().scenes.map((s) => s.after + s.scene + s.caption + (s.img || "")).join("|");

/** Call just before a picture is taken out of the plan. */
export function noteRemoved(ref: SceneRef): void {
  gone.forEach((g) => g.age++);
  gone.push({ ref: JSON.parse(JSON.stringify(ref)), age: 0 });
  own = true;
}

/** Called after every Studio refresh: age the list, and clear it if the text changed. */
export function trackRemoved(): boolean {
  const B = book(), before = gone.length;
  if (blocksRef !== B.blocks || blocksLen !== B.blocks.length) {
    if (blocksRef !== null) gone = [];
    blocksRef = B.blocks; blocksLen = B.blocks.length;
  }
  const s = sigOf();
  if (s !== sig) { if (own) own = false; else gone.forEach((g) => g.age++); sig = s; }
  gone = gone.filter((g) => g.age < MAX_AGE);
  return gone.length !== before;
}

/** Draw the struck-through pictures at the end of the list. */
export function renderRemoved(list: HTMLElement): void {
  const here = new Set(book().scenes.map(pkey));
  const items = gone.filter((g) => !here.has(pkey(g.ref)) && book().blocks[g.ref.after]);
  if (!items.length) return;
  const h = document.createElement("li"); h.className = "rm-h"; h.textContent = "Removed";
  list.appendChild(h);
  items.forEach((g) => {
    const li = document.createElement("li"); li.className = "rm"; li.dataset.rm = pkey(g.ref);
    const th = document.createElement("span"); th.className = "rm-th"; th.innerHTML = thumb(g.ref.scene);
    const t = document.createElement("span"); t.className = "rm-t";
    const c = document.createElement("s"); c.textContent = g.ref.caption || "No caption";
    const m = document.createElement("span"); m.className = "rm-m"; m.textContent = "Removed picture";
    t.append(c, m);
    const b = document.createElement("button"); b.type = "button"; b.className = "btn quiet rm-b"; b.dataset.restore = pkey(g.ref); b.textContent = "Restore";
    b.setAttribute("aria-label", "Restore the picture “" + (g.ref.caption || "no caption") + "”");
    li.append(th, t, b); list.appendChild(li);
  });
}

export function initRemoved(): void {
  $("mkScenes").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-restore]");
    if (!b) return;
    const g = gone.find((x) => pkey(x.ref) === b.dataset.restore);
    if (!g) return;
    gone = gone.filter((x) => x !== g);
    own = true;
    checkpoint();
    commitScenes([...book().scenes, g.ref]);
    toast("Picture restored.", false, UNDO);
  });
}
