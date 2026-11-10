// Small Studio furniture: toasts for outcomes ("Saved x.html"), the save-state light in the top bar,
// and which pane or tab is showing. Display only: none of this touches the author's text.
const $ = (id: string) => document.getElementById(id) as HTMLElement;

/** A short message at the bottom of the screen. Warnings stay a little longer. */
export function toast(text: string, warn = false): void {
  const box = $("mkToasts");
  if (!box) return;
  const t = document.createElement("div");
  t.className = "toast" + (warn ? " warn" : "");
  t.textContent = text;
  box.appendChild(t);
  while (box.childElementCount > 3) box.firstElementChild!.remove();
  setTimeout(() => t.remove(), warn ? 6500 : 3600);
}

let savedTimer = 0;
/** "Saving…" while the author is typing, "Saved" once the draft is written. */
export function saveState(saving: boolean): void {
  const s = $("mkSave");
  if (!s) return;
  clearTimeout(savedTimer);
  if (saving) { s.dataset.state = "saving"; s.textContent = "Saving…"; return; }
  savedTimer = window.setTimeout(() => { s.dataset.state = "saved"; s.textContent = "Saved"; }, 250);
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
    document.querySelectorAll<HTMLElement>("#mkTabs button").forEach((b) => { const on = b.dataset.tab === tab; b.setAttribute("aria-selected", String(on)); b.setAttribute("aria-pressed", String(on)); });
  }
  const t = w.dataset.tab as Tab;
  document.querySelectorAll<HTMLElement>(".wk-nav button").forEach((b) => {
    const on = b.dataset.pane === pane && (pane !== "manuscript" || b.dataset.tab === t);
    b.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll<HTMLElement>("#mkSideSw button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.side === (pane === "design" ? "design" : "manuscript"))));
}

/** The export sheet. */
export function openExport(): void { const d = $("mkExport") as HTMLDialogElement; if (!d.open) d.showModal(); }
export function closeExport(): void { const d = $("mkExport") as HTMLDialogElement; if (d.open) d.close(); }
