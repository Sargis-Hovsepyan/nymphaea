// A book's Reading drawer: the reader's own page, light and type, the contents, and print. It
// changes how the book looks for this reader only (saved per book); the words are untouched.
import { THEMES, THEME_LIST } from "../design/themes";
import { PAIRINGS, PAIRING_LIST } from "../design/type";
import { printBook } from "../layout/print";
import { STRUCTURAL } from "../settings";
import { state } from "../state";
import type { Settings } from "../types";
import { bindControls, syncControls } from "./controls";
import { finePointer } from "./light";
import { applyLook } from "./look";
import { chapters, onRendered, redrawAll, renderBook, resetWidths, scrollToBlock } from "./reader";

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export function panelOpen(): boolean {
  const p = document.getElementById("studio");
  return !!p && !p.hidden;
}

/** Theme swatches and the typeface list, filled from the design data. */
function fillPickers(): void {
  const sw = document.getElementById("rdThemes");
  if (sw && !sw.childElementCount) THEME_LIST.forEach((t) => {
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("data-v", t);
    b.textContent = THEMES[t].name;
    b.style.setProperty("--sw-bg", THEMES[t].dark.desk); b.style.setProperty("--sw-acc", THEMES[t].dark.accent);
    sw.appendChild(b);
  });
  const sel = document.getElementById("rdPairing") as HTMLSelectElement | null;
  if (sel && !sel.options.length) PAIRING_LIST.forEach((p) => { const o = document.createElement("option"); o.value = p; o.textContent = PAIRINGS[p].name + " · " + PAIRINGS[p].note; sel.appendChild(o); });
}

function fillToc(): void {
  const sec = document.getElementById("tocSec"), ol = document.getElementById("toc");
  if (!sec || !ol) return;
  const chs = chapters();
  sec.hidden = chs.length < 2;
  ol.textContent = "";
  chs.forEach((c) => {
    const li = document.createElement("li"), b = document.createElement("button"); b.type = "button";
    const n = document.createElement("span"); n.textContent = c.num;
    b.append(n, document.createTextNode(c.title));
    b.addEventListener("click", () => scrollToBlock(c.i));
    li.appendChild(b); ol.appendChild(li);
  });
}

export function initReaderPanel(opts: { author: Settings; persist: (s: Settings | null) => void; relayout: () => void }): void {
  fillPickers();
  const panel = $("studio"), btn = $("openStudio");
  const sync = () => {
    btn.hidden = !state.settings.readerControls;
    syncControls(panel, state.settings, { finePointer });
  };
  const scrim = $("rdScrim");
  const set = (open: boolean) => {
    panel.hidden = !open; scrim.hidden = !open; document.body.classList.toggle("st-open", open); btn.setAttribute("aria-expanded", String(open));
    if (open) $("closeStudio").focus({ preventScroll: true });
  };
  scrim.addEventListener("click", () => { set(false); btn.focus(); });
  // On a phone the drawer is a bottom sheet: drag its header down to put it away.
  let y0 = -1;
  const head = panel.querySelector("header") as HTMLElement;
  head.addEventListener("pointerdown", (e) => { y0 = e.clientY; });
  head.addEventListener("pointerup", (e) => { if (y0 >= 0 && e.clientY - y0 > 60) set(false); y0 = -1; });
  bindControls(panel, (k, v) => {
    const S = state.settings, old = S[k];
    S[k] = v; applyLook(); sync(); opts.persist(S);
    if (k === "theme" || k === "mode") redrawAll(true);
    if (STRUCTURAL[k] && old !== v) renderBook();
    else if (k === "pairing" || k === "fontSize" || k === "measure") { resetWidths(); opts.relayout(); }
  });
  btn.addEventListener("click", () => set(!panelOpen()));
  $("closeStudio").addEventListener("click", () => { set(false); btn.focus(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panelOpen()) set(false); });
  $("resetLook").addEventListener("click", () => {
    state.settings = { ...opts.author, readerControls: true };
    opts.persist(null); applyLook(); sync(); renderBook();
  });
  $("printBook").addEventListener("click", () => { set(false); printBook(); });
  onRendered(fillToc);
  sync();
}

/** Re-sync the drawer after the settings were replaced from outside (the Studio preview). */
export function syncReaderPanel(): void {
  const panel = document.getElementById("studio"), btn = document.getElementById("openStudio");
  if (!panel || !btn) return;
  btn.hidden = !state.settings.readerControls;
  if (btn.hidden && panelOpen()) { panel.hidden = true; const sc = document.getElementById("rdScrim"); if (sc) sc.hidden = true; document.body.classList.remove("st-open"); }
  syncControls(panel, state.settings, { finePointer });
}
