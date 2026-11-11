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
  setTimeout(() => t.remove(), action ? 8000 : warn ? 6500 : 3600);
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

/** Show a pane (phones show one at a time, mid widths one side next to the book) and a tab. */
export function setPane(pane: Pane, tab?: Tab): void {
  const w = $("mkWork");
  w.dataset.pane = pane;
  if (tab) {
    if (w.dataset.tab !== tab) { const sc = $("mkScroll"); if (sc) sc.scrollTop = 0; }
    w.dataset.tab = tab;
    $("tabText").hidden = tab !== "text";
    $("tabPictures").hidden = tab !== "pictures";
    document.querySelectorAll<HTMLElement>("#mkTabs [role=tab]").forEach((b) => { const on = b.dataset.tab === tab; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  }
  const t = w.dataset.tab as Tab;
  document.querySelectorAll<HTMLElement>(".wk-nav button").forEach((b) => {
    const on = b.dataset.pane === pane && (pane !== "manuscript" || b.dataset.tab === t);
    b.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll<HTMLElement>("#mkSideSw button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.side === (pane === "design" ? "design" : "manuscript"))));
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
