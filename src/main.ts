import "./styles.css";
import "./maker/maker.css";
import "./maker/shell.css";
import { KEYS, readerKey } from "./brand";
import type { Pristine } from "./export";
import { initPaged, layoutPaged } from "./layout/paged";
import { initPrint } from "./layout/print";
import { initMaker } from "./maker";
import { migrate, studioLook, withDefaults } from "./settings";
import { isImageData } from "./ai/store";
import { guardScenes } from "./stage/guard";
import { onMotionChange, state } from "./state";
import { load, migrateLegacy, store } from "./store";
import type { Settings } from "./types";
import { initLight, lightStep, setStorySource } from "./ui/light";
import { applyLook } from "./ui/look";
import { initPreviewChild } from "./ui/previewChild";
import { initReader, onRendered, readingSpec, motionChanged, redrawAll, renderBook, startLoop, wake } from "./ui/reader";
import { initReaderPanel, panelOpen } from "./ui/readerPanel";

// One engine, three ways to open:
//   maker   — the Studio (this app): a file in, a book out
//   book    — an exported book (window.__BOOK): opens as itself
//   preview — the Studio's live preview iframe (window.__PREVIEW): renders what the Studio sends
const shellEl = document.getElementById("shell")!;
const makerEl = document.getElementById("maker");

// Capture the untouched book shell, CSS and engine first: an exported book is exactly these.
const pristine: Pristine = {
  shell: shellEl.outerHTML,
  css: Array.from(document.querySelectorAll("style")).map((s) => s.textContent || "").join("\n"),
  engine: document.querySelector('script[type="module"]:not([src])')?.textContent || "",
  engineSrc: document.querySelector('script[type="module"][src*="main"]')?.getAttribute("src") || undefined,
};

/** What a reader may change in an exported book (the Reading drawer). */
const READER_KEYS: (keyof Settings)[] = ["theme", "mode", "pairing", "fontSize", "measure", "light", "follow", "flicker", "motion", "reveal", "layout", "pictures"];
function readerOnly(s: Partial<Settings> | null): Partial<Settings> {
  const o: Partial<Settings> = {};
  if (s) READER_KEYS.forEach((k) => { if (k in s) (o as Record<string, unknown>)[k] = s[k]; });
  return o;
}

function bootBook(preview: boolean): void {
  makerEl?.remove();
  const author: Settings = withDefaults(window.__SETTINGS || {});
  const book = window.__BOOK;
  if (!preview && book && Array.isArray(book.blocks)) {
    book.scenes = guardScenes(book.blocks, Array.isArray(book.scenes) ? book.scenes : []).scenes;
    // Only real raster pictures, and only those the scenes use.
    const imgs = book.images && typeof book.images === "object" ? book.images : {};
    state.images = {};
    book.scenes.forEach((s) => { if (s.img && isImageData(imgs[s.img])) state.images[s.img] = imgs[s.img]; });
    delete book.images;
    state.book = book;
  }
  const key = readerKey(state.book.title);
  state.settings = { ...author, ...(!preview && author.readerControls ? readerOnly(migrate(load(key))) : {}) };
  initReader({ preview, posKey: key + ":pos" });
  initLight(panelOpen, wake);
  setStorySource(readingSpec);
  initPaged();
  initPrint();
  onRendered(layoutPaged);
  initReaderPanel({ author, persist: (s) => { if (!preview) store(key, s ? readerOnly(s) : null); }, relayout: layoutPaged });
  applyLook();
  // "Auto" follows the device: repaint when it switches between light and dark.
  matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (state.settings.mode === "auto") { applyLook(); redrawAll(true); } });
  // The system's reduced motion setting can change while the book is open.
  onMotionChange(() => { applyLook(); motionChanged(); });
  if (preview) initPreviewChild(layoutPaged); else renderBook();
  startLoop(lightStep);
}

function bootMaker(): void {
  shellEl.remove();
  if (!makerEl) return;
  makerEl.hidden = false;
  document.body.classList.add("mk-on");
  migrateLegacy();
  state.settings = studioLook(load(KEYS.settings));
  initMaker(pristine);
}

if (window.__PREVIEW) bootBook(true);
else if (window.__BOOK) bootBook(false);
else bootMaker();
