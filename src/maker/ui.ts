// Small Studio furniture: toasts for outcomes ("Saved x.html"), the save-state light in the top bar,
// and which pane or tab is showing. Display only: none of this touches the author's text.
const $ = (id: string) => document.getElementById(id) as HTMLElement;

export interface ToastAction { label: string; run: () => void }

/**
 * A short message under the top bar. Warnings stay a little longer, and a message with an action
 * (Undo) stays long enough to use it.
 */
export function toast(text: string, warn = false, action?: ToastAction): void {
  const box = $("mkToasts");
  if (!box) return;
  const t = document.createElement("div");
  t.className = "toast" + (warn ? " warn" : "");
  const msg = document.createElement("span"); msg.textContent = text; t.appendChild(msg);
  if (action) {
    const b = document.createElement("button"); b.type = "button"; b.className = "toast-act"; b.textContent = action.label;
    b.addEventListener("click", () => { t.remove(); action.run(); });
    t.appendChild(b);
  }
  box.appendChild(t);
  while (box.childElementCount > 3) box.firstElementChild!.remove();
  // A toast with an action waits while the pointer or the keyboard is on it.
  let left = action ? 8000 : warn ? 6500 : 3600, since = Date.now(), timer = window.setTimeout(() => t.remove(), left);
  const hold = () => { clearTimeout(timer); left -= Date.now() - since; };
  const go = () => { since = Date.now(); timer = window.setTimeout(() => t.remove(), Math.max(1500, left)); };
  if (action) { t.addEventListener("pointerenter", hold); t.addEventListener("pointerleave", go); t.addEventListener("focusin", hold); t.addEventListener("focusout", go); }
}

let savedTimer = 0, liveTimer = 0, wasTyping = false;
/** Screen readers hear the save state only when typing stops ("Saved") or when saving fails. */
function announce(text: string): void { const l = $("mkSaveLive"); if (l) l.textContent = text; }
/** "Saving…" while the author is typing, "Saved" once the draft is written. */
export function saveState(saving: boolean): void {
  const s = $("mkSave");
  if (!s) return;
  clearTimeout(savedTimer);
  if (saving) { wasTyping = true; clearTimeout(liveTimer); s.dataset.state = "saving"; s.textContent = "Saving…"; return; }
  savedTimer = window.setTimeout(() => {
    s.dataset.state = "saved"; s.textContent = "Saved";
    if (wasTyping) { wasTyping = false; clearTimeout(liveTimer); liveTimer = window.setTimeout(() => announce("Saved"), 1200); }
  }, 250);
}
/** The browser would not keep the draft. A toast says what to do; this keeps the bar honest. */
export function saveFailed(): void {
  const s = $("mkSave");
  if (!s) return;
  clearTimeout(savedTimer); clearTimeout(liveTimer); wasTyping = false;
  s.dataset.state = "failed"; s.textContent = "Not saved";
  announce("Not saved");
}

export type Pane = "manuscript" | "book" | "design";
export type Tab = "text" | "pictures";
/** What opens beside the book: nothing, the text, or the look. */
export type Side = "none" | "text" | "look";

const SIDE_KEY = "nymphaea-studio-side";
const midWidth = () => matchMedia("(max-width:1199px)").matches;
const phone = () => matchMedia("(max-width:759px)").matches;
let onSide: (s: Side) => void = () => {};
/** Told when the side changes (index.ts closes the picture at mid widths, where they take turns). */
export function onSideChange(fn: (s: Side) => void): void { onSide = fn; }

export const currentSide = (): Side => ($("mkWork").dataset.side as Side) || "none";

/** Open the text or the look beside the book (one at a time), or close both. On phones each is a full screen. */
export function setSide(s: Side): void {
  const w = $("mkWork");
  if (w.dataset.side === s) return;
  w.dataset.side = s;
  $("mkTextBtn").setAttribute("aria-pressed", String(s === "text"));
  $("mkLookBtn").setAttribute("aria-pressed", String(s === "look"));
  document.querySelectorAll<HTMLElement>(".wk-nav button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.side === s)));
  try { localStorage.setItem(SIDE_KEY, s); } catch { /* the Studio works without it */ }
  if (s !== "none" && midWidth() && !phone()) onSide(s);
}
/** The side the author left open, for wide screens (phones always open on the book). */
export function savedSide(): Side {
  let v: string | null = null;
  try { v = localStorage.getItem(SIDE_KEY); } catch { /* none */ }
  return v === "text" || v === "look" ? v : "none";
}

/** The older pane-and-tab vocabulary, kept for the many callers: the pictures are always on the strip now. */
export function setPane(pane: Pane, tab?: Tab): void {
  if (pane === "design") setSide("look");
  else if (pane === "manuscript" && tab === "text") setSide("text");
  else if (phone()) setSide("none");
}


/** Close a modal sheet on a backdrop click: the click lands on the dialog itself, outside its box.
 *  (Keyboard "clicks" on buttons inside target the button, so they never close it.) */
export function closeOnBackdrop(d: HTMLDialogElement, close: () => void = () => d.close()): void {
  d.addEventListener("click", (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
  });
}

/** The export sheet. */
export function openExport(): void { const d = $("mkExport") as HTMLDialogElement; if (!d.open) d.showModal(); }
export function closeExport(): void { const d = $("mkExport") as HTMLDialogElement; if (d.open) d.close(); }
