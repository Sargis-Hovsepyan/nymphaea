// The Studio: a file (or several) in → Markdown to check → staged pictures → a look → a book out
// (HTML, EPUB, print), with the real book running live beside it. The author's words only ever
// change when the author types them (or accepts a typography fix); everything the engine adds goes
// through the Guard. This file wires the parts together; each part lives in its own module:
//   session (shared state) · draft + shelf (saving, books) · undo · importer · textPane · pictures
//   paint + staging (AI) · design · exportSheet · pick (clicks in the preview) · shortcuts · uiState
import { PAIRINGS } from "../design/type";
import type { Pristine } from "../export";
import { canExport } from "../export";
import { state } from "../state";
import { words } from "../stage/keywords";
import { bindControls, syncControls } from "../ui/controls";
import { initAiPanel } from "./ai";
import { syncAi } from "./aiState";
import { applyDraft, blankBook, saveDraft, savedDraft } from "./draft";
import { LIGHT_NOTE, buildStyles, buildThemes, firstLine, markPresets, resetLook, setOpt, specimens } from "./design";
import { mountEditor } from "./editor";
import { initImporter } from "./importer";
import { checkPick, initPick, onPick, onSelect, onView } from "./pick";
import { deselect, initScenes, renderScenes } from "./pictures";
import { createPreview } from "./preview";
import { rebuildText } from "./rebuild";
import { initExport, renderSummary } from "./exportSheet";
import { $, book, hasText, hooks, narrow, plural, sess, usedImages } from "./session";
import { initShelf, newBook, showLanding, showWork } from "./shelf";
import { initShortcuts } from "./shortcuts";
import { initStudioMode } from "./studio";
import { onPaste, renderOutline, renderTypo } from "./textPane";
import { undo } from "./undo";
import { initNav, onWhere, renderNav } from "./bookNav";
import { initLarge } from "./large";
import { initExtras, refreshExtras } from "./extras";
import { initViews, refreshView } from "./views";
import { initUiState } from "./uiState";
import { currentSide, onSideChange, savedSide, saveState, setSide, toast, type Side } from "./ui";

let specKey = "";

/** After any change: save, and bring every view up to date. */
function refresh(): void {
  saveDraft();
  const B = book(), S = state.settings, ok = hasText();
  const ps = B.blocks.filter((b) => b.type !== "h").length, hs = B.blocks.filter((b) => b.type === "h").length;
  const w = B.blocks.reduce((a, b) => a + words(b.text).length, 0);

  $<HTMLInputElement>("mkTitle").placeholder = ok ? B.title : "Untitled book";
  $("mkMdStats").textContent = ok
    ? plural(ps, "paragraph") + (hs ? " · " + plural(hs, "heading") : "") + " · " + plural(w, "word") + " · about " + Math.max(1, Math.round(w / 230)) + " min to read. Every word goes into the book as written."
    : "Nothing here yet.";

  renderOutline();
  renderTypo();
  renderScenes();
  renderSummary(ps, w);
  $("mkEmpty").hidden = ok;
  $("mkFrame").style.visibility = ok ? "visible" : "hidden";
  const can = ok && canExport(sess.pristine);
  ["mkDownload", "mkOpenTab", "mkEpub", "mkPrint"].forEach((id) => { $<HTMLButtonElement>(id).disabled = !can; });
  ["mkExportBtn", "mkMdDl", "mkAuto", "mkAsk"].forEach((id) => { $<HTMLButtonElement>(id).disabled = !ok; });
  $<HTMLButtonElement>("mkClear").disabled = !B.scenes.length;
  $("mkBack").hidden = !ok;
  $("mkLightNote").textContent = LIGHT_NOTE[S.light];
  const sk = B.title + "|" + firstLine();
  if (sk !== specKey) { specKey = sk; specimens(); }
  markPresets();
  syncAi();
  checkPick();
  document.documentElement.style.setProperty("--book-face", PAIRINGS[S.pairing]?.body || "Georgia,serif");
  renderNav();
  refreshView();
  refreshExtras();
  if (ok) { sess.preview.images(usedImages()); sess.preview.render(B, S); }
}

/** The Studio's own type: Schibsted Grotesk for the whole interface. Never shipped in a book. */
function studioFonts(): void {
  if (document.getElementById("mkFontsCss")) return;
  const l = document.createElement("link");
  l.id = "mkFontsCss"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..800&display=swap";
  document.head.appendChild(l);
}

function setZoom(z: number): void {
  const st = $("mkStage");
  st.style.setProperty("--zoom", String(z / 100));
  st.classList.toggle("zoomed", z < 100);
  $("mkZoomOut").textContent = z + "%";
}

export function initMaker(p: Pristine): void {
  sess.pristine = p;
  sess.mk = $("maker");
  hooks.refresh = refresh; hooks.renderScenes = renderScenes;
  initStudioMode(() => { if (sess.ready) renderScenes(); });
  studioFonts();
  sess.preview = createPreview($<HTMLIFrameElement>("mkFrame"), p, state.settings, onPick, onView, onWhere, onSelect);
  sess.editor = mountEditor($<HTMLTextAreaElement>("mkMd"), $("mkHi"), $("mkScroll"));

  // Restore the last draft (or the last book from the old Studio), else start empty.
  const draft = savedDraft();
  if (draft) applyDraft(draft); else blankBook();
  $("mkWork").hidden = false;

  // Beside the book: the text or the look, one at a time (a full screen each on phones).
  const toggle = (s: Side) => setSide(currentSide() === s ? "none" : s);
  $("mkTextBtn").addEventListener("click", () => { toggle("text"); if (currentSide() === "text") $("mkMd").focus({ preventScroll: true }); });
  $("mkLookBtn").addEventListener("click", () => toggle("look"));
  document.querySelector(".wk-nav")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-side]"); if (b) setSide(b.dataset.side as Side);
  });
  $("mkWork").addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("[data-close-side]")) setSide("none"); });
  // At mid widths the side and the open picture take turns beside the book.
  const mid = () => matchMedia("(max-width:1199px)").matches;
  onSideChange(() => deselect());
  hooks.openPanel = () => { if (mid() && !narrow() && currentSide() !== "none") setSide("none"); };
  setSide(narrow() ? "none" : savedSide());
  $("mkHome").addEventListener("click", showLanding);
  // Shortcuts say Ctrl where there is no ⌘ key.
  if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
    document.querySelectorAll<HTMLElement>("#maker kbd").forEach((k) => { k.textContent = (k.textContent || "").replace("⌘", "Ctrl "); });
    document.querySelectorAll<HTMLElement>("#maker [title*='⌘']").forEach((el) => { el.title = el.title.replace("⌘", "Ctrl+"); });
  }
  $("mkUndoBtn").addEventListener("click", undo);
  $<HTMLInputElement>("mkZoom").addEventListener("input", (e) => setZoom(+(e.target as HTMLInputElement).value));
  $("mkNew").addEventListener("click", async () => { await newBook(); showLanding(); });
  $("mkBack").addEventListener("click", () => showWork());

  initImporter();

  // Text
  let tmr = 0;
  const edited = () => { saveState(true); clearTimeout(tmr); tmr = window.setTimeout(() => rebuildText(false), 350); };
  $("mkMd").addEventListener("input", (e) => { sess.md = (e.target as HTMLTextAreaElement).value; sess.editor.paint(); edited(); });
  $("mkMd").addEventListener("paste", (e) => onPaste(e as ClipboardEvent));
  $("mkTitle").addEventListener("input", (e) => { sess.userTitle = (e.target as HTMLInputElement).value.trim(); edited(); });
  ([["mkSubtitle", "subtitle"], ["mkAuthor", "author"], ["mkDedication", "dedication"]] as const).forEach(([id, k]) =>
    $(id).addEventListener("input", (e) => { sess.meta[k] = (e.target as HTMLInputElement).value.trim(); edited(); }));

  // Pictures, design, AI
  initScenes();
  initPick();
  initAiPanel(() => { refresh(); });
  $("mkUndoMenu").addEventListener("click", undo);
  buildThemes();
  buildStyles();
  bindControls(sess.mk, setOpt);
  syncControls(sess.mk, state.settings);
  $("mkResetLook").addEventListener("click", () => { resetLook(); toast("Back to the default look."); });
  $("mkTop").addEventListener("click", () => sess.preview.send({ type: "top" }));
  initUiState();
  initViews();
  initNav();
  initLarge();
  initExtras();
  initExport();
  initShortcuts();

  // claude.ai extras
  if (window.claude && window.claude.use) {
    $("mkOpenTab").hidden = true; // artifact pages can't open blob tabs
    window.claude.use("sample").then((s) => { if (s) { sess.sample = s; syncAi(); } }).catch(() => {});
    window.claude.use("downloads").then((d) => { if (d) sess.downloads = d; }).catch(() => {});
  }

  sess.ready = true;
  refresh();
  initShelf();
  if (hasText()) showWork(); else showLanding();
}
