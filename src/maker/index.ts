// The Studio: a file (or several) in → Markdown to check → staged pictures → a look → a book out
// (HTML, EPUB, print), with the real book running live beside it. The author's words only ever
// change when the author types them (or accepts a typography fix); everything the engine adds goes
// through the Guard. This file wires the parts together; each part lives in its own module:
//   session (shared state) · draft + shelf (saving, books) · undo · importer · textPane · pictures
//   paint + staging (AI) · design · exportSheet · pick (clicks in the preview) · shortcuts · uiState
import { THEMES } from "../design/themes";
import { PAIRINGS } from "../design/type";
import type { Pristine } from "../export";
import { canExport } from "../export";
import { state } from "../state";
import { words } from "../stage/keywords";
import { bindControls, syncControls } from "../ui/controls";
import { initAiPanel } from "./ai";
import { syncAi } from "./aiState";
import { applyDraft, blankBook, saveDraft, savedDraft } from "./draft";
import { LAYOUT_NAME, LIGHT_NOTE, STYLE_NAME, buildStyles, buildThemes, firstLine, markPresets, resetLook, setOpt, specimens } from "./design";
import { mountEditor } from "./editor";
import { initImporter } from "./importer";
import { checkPick, initPick, onPick, onView } from "./pick";
import { initScenes, renderScenes } from "./pictures";
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
import { initExtras, refreshExtras } from "./extras";
import { initViews, refreshView } from "./views";
import { load, store } from "../store";
import { initUiState, rememberTab, savedTab } from "./uiState";
import { saveState, setPane, toast, watchPane, type Pane, type Tab } from "./ui";

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
  $("mkPnote").textContent = ok ? LAYOUT_NAME[S.layout] + ", " + THEMES[S.theme].name + " " + (S.mode === "auto" ? "auto" : S.mode) + ", " + STYLE_NAME[S.style] + ", " + plural(B.scenes.length, "picture") : "Preview";
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

/** The Studio's own type: Archivo for the interface, Geist Mono for counts. Never shipped in a book. */
function studioFonts(): void {
  if (document.getElementById("mkFontsCss")) return;
  const l = document.createElement("link");
  l.id = "mkFontsCss"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&family=Geist+Mono:wght@400;500&display=swap";
  document.head.appendChild(l);
}

const PANEL_KEY = "nymphaea-studio-panel";
function setPanel(open: boolean): void {
  $("mkWork").dataset.left = open ? "open" : "closed";
  $("mkRailHide").setAttribute("aria-pressed", String(!open));
  $("mkRailHide").title = open ? "Hide the panel" : "Show the panel";
  store(PANEL_KEY, open ? "open" : "closed");
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
  sess.preview = createPreview($<HTMLIFrameElement>("mkFrame"), p, state.settings, onPick, onView, onWhere);
  sess.editor = mountEditor($<HTMLTextAreaElement>("mkMd"), $("mkHi"), $("mkScroll"));

  // Restore the last draft (or the last book from the old Studio), else start empty.
  const draft = savedDraft();
  if (draft) applyDraft(draft); else blankBook();
  $("mkWork").hidden = false;

  // Panes and tabs
  watchPane((_pane: Pane, tab: Tab) => rememberTab(tab));
  document.querySelector(".wk-nav")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (b) setPane(b.dataset.pane as Pane, b.dataset.tab as Tab | undefined);
  });
  $("mkSideSw").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (b) setPane(b.dataset.side as Pane);
  });
  // The Markdown stays closed until the author asks for it: the Studio opens on the Book panel.
  setPane("manuscript", "pictures");
  $("mkHome").addEventListener("click", showLanding);
  // The rail: Book and Text are tabs of the left panel; a second click on the open one hides it.
  $("mkTabs").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-tab]"); if (!b) return;
    const w = $("mkWork"), same = w.dataset.tab === b.dataset.tab && w.dataset.left !== "closed";
    if (same && !narrow()) { setPanel(false); return; }
    setPanel(true); setPane("manuscript", b.dataset.tab as Tab);
  });
  $("mkOpenText").addEventListener("click", () => { setPanel(true); setPane("manuscript", "text"); $("mkMd").focus({ preventScroll: true }); });
  $("mkRailAi").addEventListener("click", () => $("mkAiOpen").click());
  $("mkRailHide").addEventListener("click", () => setPanel($("mkWork").dataset.left === "closed"));
  setPanel(load<string>(PANEL_KEY) !== "closed");
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
