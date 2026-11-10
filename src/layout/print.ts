// Print / Save as PDF: a real book page. A generated @page rule sets the trim size with mirrored
// margins (the inner margin wider, for the binding) and folios in the page margin; chapters start
// on a new page; pictures print as their finished frame; the light mood of the theme is used.
import { printCss } from "./geometry";
import { state } from "../state";
import type { Settings } from "../types";
import { applyLook, setForceLight } from "../ui/look";
import { finishAll, redrawAll } from "../ui/reader";
import { layoutPaged } from "./paged";

let printing = false, before: Settings["layout"] | null = null;

function setPrintCss(): void {
  let st = document.getElementById("nyPrint") as HTMLStyleElement | null;
  if (!st) { st = document.createElement("style"); st.id = "nyPrint"; document.head.appendChild(st); }
  st.textContent = printCss(state.settings);
}

function enter(): void {
  if (printing) return;
  printing = true;
  setPrintCss();
  setForceLight(true);
  before = state.settings.layout;
  if (before === "paged") { state.settings.layout = "scroll"; applyLook(); layoutPaged(); }
  else applyLook();
  finishAll();
}
function leave(): void {
  if (!printing) return;
  printing = false;
  setForceLight(false);
  if (before === "paged") { state.settings.layout = "paged"; applyLook(); layoutPaged(); }
  else applyLook();
  redrawAll(true);
}

export function initPrint(): void {
  setPrintCss();
  window.addEventListener("beforeprint", enter);
  window.addEventListener("afterprint", leave);
}

/** Print (or Save as PDF) now. */
export function printBook(): void {
  enter();
  setTimeout(() => { window.print(); setTimeout(leave, 400); }, 60);
}
