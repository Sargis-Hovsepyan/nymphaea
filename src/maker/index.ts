// The Studio: a file (or several) in → Markdown to check → staged pictures → a look → a book out
// (HTML, EPUB, print), with the real book running live beside it. The author's words only ever
// change when the author types them (or accepts a typography fix); everything the engine adds goes
// through the Guard.
import { DRAFT_KEY, KEYS, exportFileName, slug } from "../brand";
import { PRESETS, presetById } from "../design/presets";
import { STUDIO, studioVars } from "../design/studio";
import { THEMES, THEME_LIST, isDark, palette, type Mode } from "../design/themes";
import { PAIRINGS, PAIRING_LIST } from "../design/type";
import { buildEpub } from "../epub/book";
import { buildBookHtml, canExport, type Pristine } from "../export";
import { ACCEPT, importFiles } from "../import/files";
import { htmlToMarkdown, richEnough } from "../import/html";
import { isBreak, plain } from "../inline";
import { blocksToText, parseDraft } from "../parse";
import { SEED_SCENES } from "../sample";
import { SEED_TEXT, SEED_TITLE } from "../seed";
import { DEFAULTS, NUM } from "../settings";
import { autoStage, captionFor } from "../stage/auto";
import { buildStagingPrompt, readStagingReply } from "../stage/claude";
import { captionIsQuoted, guardScenes } from "../stage/guard";
import { SCENE_DESC, SCENE_LIST, words } from "../stage/keywords";
import { remapBeats, remapScenes } from "../stage/remap";
import { state } from "../state";
import { load, store } from "../store";
import { applyFix, findIssues, type Kind } from "../text/check";
import type { Book, SceneRef, Settings, Style } from "../types";
import { bindControls, syncControls } from "../ui/controls";
import { sceneThumb } from "../vscenes/model";
import { mountEditor, type Editor } from "./editor";
import { mountLanding } from "./landing";
import { createPreview, type Preview } from "./preview";
import { closeExport, openExport, saveState, setPane, toast, type Pane, type Tab } from "./ui";

interface Draft { md: string; title: string; subtitle?: string; author?: string; dedication?: string; scenes: SceneRef[]; beats?: number[]; cover?: string; source: Book["source"] }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const STYLE_NAME: Record<Style, string> = {
  ink: "Ink", cut: "Cut paper", glow: "Glow", wash: "Ink wash", dither: "Dithered", halftone: "Halftone", ascii: "ASCII", glass: "Glass",
  engrave: "Engraving", stipple: "Stipple", riso: "Riso", flow: "Generative", orn: "Ornaments", none: "No pictures",
};
const STYLE_NOTE: Record<Style, string> = {
  ink: "lines that draw themselves", cut: "flat paper layers", glow: "silhouettes in lamplight", wash: "bleeding watercolour",
  dither: "1-bit pixels", halftone: "newsprint dots", ascii: "characters", glass: "frosted glass",
  engrave: "cross-hatched etching", stipple: "pen dots", riso: "two inks, off register", flow: "grown from the words",
  orn: "fleurons and rules", none: "the text alone",
};
const STYLE_ORDER: Style[] = ["ink", "cut", "glow", "wash", "engrave", "stipple", "riso", "flow", "halftone", "dither", "ascii", "glass", "orn", "none"];
const LIGHT_NOTE: Record<Settings["light"], string> = {
  off: "Even light across the page.",
  lamp: "A pool of lamplight follows the line being read; the rest of the page sits in shadow.",
  candle: "A smaller, warmer pool that gutters like a flame.",
  focus: "The paragraph being read stays bright; the others fall back, for close reading.",
  dawn: "Each chapter opens in the dark and the page brightens as the reader goes on.",
};
const LAYOUT_NAME: Record<Settings["layout"], string> = { scroll: "Scroll", cards: "Chapter cards", paged: "Paged spreads" };
const plural = (n: number, one: string, many = one + "s") => n.toLocaleString() + " " + (n === 1 ? one : many);
const STUDIO_MODE = "nymphaea-studio-mode";

let md = "", userTitle = "", meta = { subtitle: "", author: "", dedication: "" };
let preview: Preview;
let pristine: Pristine;
let sample: any = null, downloads: any = null, ctl: AbortController | null = null;
let mk: HTMLElement;
let editor: Editor;
let specKey = "";

/* ---------------- the Studio's own light and dark ---------------- */
function studioMode(): Mode { const m = load<Mode>(STUDIO_MODE); return m === "light" || m === "dark" ? m : "auto"; }
const MODE_ICON: Record<Mode, string> = {
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z"/></svg>',
};
let studioReady = false;
function applyStudio(): void {
  const m = studioMode(), dark = isDark(m), vars = studioVars(dark), root = document.documentElement;
  Object.keys(vars).forEach((k) => root.style.setProperty(k, vars[k]));
  root.setAttribute("data-mode", dark ? "dark" : "light");
  root.style.colorScheme = dark ? "dark" : "light";
  document.querySelectorAll<HTMLElement>(".mk-mode").forEach((b) => {
    b.setAttribute("aria-label", "Studio colours: " + m); b.title = "Studio colours: " + m + " (click to change)";
    b.dataset.mode = m; b.innerHTML = MODE_ICON[m];
  });
  thumbs.clear();
  if (studioReady) renderScenes();
}

/* ---------------- text → book ---------------- */
function book(): Book { return state.book; }
function hasText(): boolean { return book().blocks.some((b) => b.type !== "h"); }

function withMeta(b: Book): Book {
  b.subtitle = meta.subtitle || undefined; b.author = meta.author || undefined; b.dedication = meta.dedication || undefined;
  return b;
}

/** Re-read the Markdown. Pictures follow their paragraphs; an automatic plan is simply redone. */
function rebuild(restage: boolean, opts: { samePositions?: (caption: string) => string } = {}): void {
  const old = book(), parsed = parseDraft(md, userTitle);
  const next: Book = withMeta({ title: parsed.title, blocks: parsed.blocks, scenes: [], source: restage ? "auto" : old.source, cover: old.cover });
  let lost = 0;
  if (next.source === "auto") next.scenes = autoStage(next.blocks, state.settings.density);
  else if (opts.samePositions && old.blocks.length === next.blocks.length) {
    // A typography fix changes characters in place, not the order: pictures keep their places.
    next.scenes = guardScenes(next.blocks, old.scenes.map((s) => ({ ...s, caption: opts.samePositions!(s.caption) }))).scenes;
    next.beats = old.beats;
  } else {
    const r = remapScenes(old.blocks, next.blocks, old.scenes);
    next.scenes = r.scenes; lost = r.lost;
    next.beats = remapBeats(old.blocks, next.blocks, old.beats);
  }
  state.book = next;
  refresh();
  if (lost) sceneNote(plural(lost, "picture") + " came out because " + (lost === 1 ? "its paragraph" : "their paragraphs") + " changed.", true);
}

function saveDraft(): void {
  const B = book();
  saveState(false);
  store(DRAFT_KEY, { md, title: userTitle, ...meta, scenes: B.scenes, beats: B.beats, cover: B.cover, source: B.source } satisfies Draft);
}

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
  const can = ok && canExport(pristine);
  ["mkDownload", "mkOpenTab", "mkEpub", "mkPrint"].forEach((id) => { $<HTMLButtonElement>(id).disabled = !can; });
  ["mkExportBtn", "mkMdDl", "mkMdDl2", "mkAuto", "mkAsk", "mkAddBtn"].forEach((id) => { $<HTMLButtonElement>(id).disabled = !ok; });
  $<HTMLButtonElement>("mkClear").disabled = !B.scenes.length;
  $("mkBack").hidden = !ok;
  $("mkLightNote").textContent = LIGHT_NOTE[S.light];
  const sk = B.title + "|" + firstLine();
  if (sk !== specKey) { specKey = sk; specimens(); }
  markPresets();
  if (ok) preview.render(B, S);
}

/* ---------------- landing, workspace, panes ---------------- */
const narrow = () => matchMedia("(max-width:759px)").matches;
function landingOpen(): boolean { return !$("mkLanding").hidden; }

function showLanding(): void {
  $("mkLanding").hidden = false;
  ($("mkWork") as HTMLElement & { inert: boolean }).inert = true;
  $("mkBack").hidden = !hasText();
  mountLanding(pristine);
  $("mkLanding").scrollTop = 0;
}
function showWork(pane: Pane = "manuscript", tab?: Tab): void {
  $("mkLanding").hidden = true;
  ($("mkWork") as HTMLElement & { inert: boolean }).inert = false;
  setPane(pane, tab);
}

/* ---------------- source ---------------- */
function report(lines: string[], opts: { warn?: boolean; busy?: string; dismiss?: boolean } = {}): void {
  const r = landingOpen() ? $("mkLdReport") : $("mkReport");
  r.hidden = false; r.className = "mk-report" + (opts.warn ? " warn" : ""); r.textContent = "";
  if (opts.busy) {
    const p = document.createElement("div"); const dot = document.createElement("span"); dot.className = "mk-busy";
    p.append(dot, opts.busy); r.appendChild(p); return;
  }
  const [head, ...rest] = lines;
  const h = document.createElement("div"); h.textContent = head; r.appendChild(h);
  if (rest.length) { const ul = document.createElement("ul"); rest.forEach((l) => { const li = document.createElement("li"); li.textContent = l; ul.appendChild(li); }); r.appendChild(ul); }
  if (opts.dismiss) {
    const row = document.createElement("div"); row.className = "row";
    const a = document.createElement("button"); a.type = "button"; a.className = "btn"; a.textContent = "Dismiss"; a.onclick = () => { r.hidden = true; };
    row.appendChild(a); r.appendChild(row);
  }
}

function setMetaFields(): void {
  $<HTMLInputElement>("mkTitle").value = userTitle;
  $<HTMLInputElement>("mkSubtitle").value = meta.subtitle;
  $<HTMLInputElement>("mkAuthor").value = meta.author;
  $<HTMLInputElement>("mkDedication").value = meta.dedication;
}

function loadText(text: string, title: string, author = ""): void {
  md = text; userTitle = title; meta = { subtitle: "", author, dedication: "" };
  setMd(md);
  setMetaFields();
  state.book = { title: "", blocks: [], scenes: [], source: "auto" };
  rebuild(true);
  preview.send({ type: "top" });
}

/** Put the Markdown into the editor (and its colour mirror). */
function setMd(text: string): void {
  $<HTMLTextAreaElement>("mkMd").value = text;
  editor.paint();
}

async function doImport(files: FileList | File[]): Promise<void> {
  if (!files.length) return;
  report([], { busy: "Reading " + (files.length === 1 ? files[0].name : files.length + " files") + "…" });
  try {
    const r = await importFiles(files, (s) => report([], { busy: s }));
    if (!r.markdown.trim()) {
      report(["No text found in that file.", "If it’s a scanned PDF, it holds pictures of pages rather than text. Copy the text from it and use Paste text instead."], { warn: true });
      return;
    }
    loadText(r.markdown, r.title, r.author || "");
    const B = book();
    $("mkLdReport").hidden = true;
    showWork("manuscript", "text");
    report(["Made “" + B.title + "”: " + plural(B.blocks.filter((b) => b.type !== "h").length, "paragraph") + " and " + plural(B.scenes.length, "picture") + ".", ...r.notes], { dismiss: true });
  } catch (e: any) {
    report([e && e.message === "none" ? "Those files aren’t a format Nymphaea reads (PDF, Word, EPUB, HTML, Markdown or text)." : "Couldn’t read that file.", "You can copy its text and use Paste text instead."], { warn: true });
  }
}

function loadSample(): void {
  loadText("# " + SEED_TITLE + "\n\n" + SEED_TEXT.join("\n\n"), "");
  const B = book();
  B.scenes = guardScenes(B.blocks, SEED_SCENES).scenes; B.source = "hand";
  refresh();
  $("mkLdReport").hidden = true; $("mkReport").hidden = true;
  showWork("manuscript", "text");
  toast("Loaded the sample episode with its hand-placed pictures.");
}

/* ---------------- text: outline, typography, rich paste ---------------- */
function renderOutline(): void {
  const box = $("mkOutline"), B = book();
  box.textContent = "";
  const marks: { i: number; kind: string; label: string }[] = [];
  B.blocks.forEach((b, i) => {
    if (b.type === "h") marks.push({ i, kind: (b.level || 1) === 1 ? "ch" : "sec", label: plain(b.text) });
    else if (b.type === "quote") marks.push({ i, kind: "q", label: plain(b.text.split("\n")[0]) });
    else if (b.type === "verse") marks.push({ i, kind: "v", label: plain(b.text.split("\n")[0]) });
    else if (isBreak(b.text)) marks.push({ i, kind: "brk", label: "⁂" });
  });
  box.hidden = !marks.length;
  if (!marks.length) return;
  const h = document.createElement("h3"); h.textContent = "Outline"; box.appendChild(h);
  const ul = document.createElement("ol");
  marks.slice(0, 200).forEach((m) => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.className = "o-" + m.kind;
    b.textContent = m.label.length > 40 ? m.label.slice(0, 40) + "…" : m.label;
    b.title = m.kind === "brk" ? "Scene break" : m.label;
    b.addEventListener("click", () => { jumpEditor(B.blocks[m.i].text); preview.send({ type: "scroll", block: m.i }); });
    li.appendChild(b); ul.appendChild(li);
  });
  box.appendChild(ul);
}

/** Put the editor's caret at a block's text and scroll it into view. */
function jumpEditor(text: string): void {
  const ta = $<HTMLTextAreaElement>("mkMd"), needle = text.split("\n")[0].slice(0, 40);
  const at = ta.value.indexOf(needle);
  if (at < 0) return;
  if (narrow()) setPane("manuscript", "text"); else setPane($("mkWork").dataset.pane === "design" ? "manuscript" : ($("mkWork").dataset.pane as Pane), "text");
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(at, at + needle.length);
  editor.reveal(at);
}

/** A paragraph was clicked in the book: jump the editor to it, and aim "Add a picture" at it. */
function onPick(i: number): void {
  const b = book().blocks[i];
  if (!b) return;
  if (b.type !== "h") $<HTMLInputElement>("mkAddAt").value = String(pNumber(i));
  if ($("mkWork").dataset.tab === "pictures" && !narrow()) { toast(b.type === "h" ? "That’s a heading. Pick a paragraph to add a picture." : "Paragraph " + pNumber(i) + " is selected. Choose a scene and press Add."); return; }
  jumpEditor(b.text);
}

function renderTypo(): void {
  const box = $("mkTypo") as HTMLDetailsElement, issues = hasText() ? findIssues(md) : [], wasOpen = box.open;
  box.hidden = !issues.length;
  box.textContent = "";
  if (!issues.length) return;
  box.open = wasOpen;
  const n = issues.reduce((a, it) => a + it.count, 0);
  const sum = document.createElement("summary"); sum.textContent = plural(n, "typography suggestion"); box.appendChild(sum);
  const p = document.createElement("p"); p.className = "note"; p.textContent = "Typewriter habits a typesetter would set differently. Nothing changes unless you choose to fix it.";
  box.appendChild(p);
  issues.forEach((it) => {
    const row = document.createElement("div"); row.className = "mk-fix";
    const t = document.createElement("div");
    const b = document.createElement("b"); b.textContent = it.label + ", " + it.count;
    const d = document.createElement("span"); d.className = "diff";
    const del = document.createElement("del"); del.textContent = it.before;
    const ins = document.createElement("ins"); ins.textContent = it.after;
    d.append(del, ins); t.append(b, d);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn"; btn.textContent = "Fix";
    btn.addEventListener("click", () => fixTypo(it.kind));
    row.append(t, btn); box.appendChild(row);
  });
}

function fixTypo(kind: Kind): void {
  md = applyFix(md, kind);
  setMd(md);
  rebuild(false, { samePositions: (c) => applyFix(c, kind) });
  toast("Typography fixed. It’s now your own edit.");
}

function onPaste(e: ClipboardEvent): void {
  const html = e.clipboardData && e.clipboardData.getData("text/html");
  if (!html || !richEnough(html)) return;
  const conv = htmlToMarkdown(html);
  if (!conv.trim()) return;
  e.preventDefault();
  const ta = e.target as HTMLTextAreaElement, a = ta.selectionStart, b = ta.selectionEnd;
  ta.setRangeText(conv, a, b, "end");
  md = ta.value;
  editor.paint();
  rebuild(false);
  toast("Pasted with its italics, headings and quotes kept as Markdown.");
}

/* ---------------- pictures ---------------- */
function sceneNote(t: string, warn = false): void { const n = $("mkSceneNote"); n.textContent = t; n.className = "note" + (warn ? " warn" : ""); }

function pNumber(after: number): number {
  let n = 0; book().blocks.forEach((b, i) => { if (i <= after && b.type !== "h") n++; }); return n;
}
function blockOfP(n: number): number {
  let c = 0; const bl = book().blocks;
  for (let i = 0; i < bl.length; i++) if (bl[i].type !== "h" && ++c === n) return i;
  return -1;
}

function sceneOptions(sel: HTMLSelectElement, value: string): void {
  sel.textContent = "";
  SCENE_LIST.forEach((s) => { const o = document.createElement("option"); o.value = s; o.textContent = s[0].toUpperCase() + s.slice(1); o.title = SCENE_DESC[s]; o.selected = s === value; sel.appendChild(o); });
}

const thumbs = new Map<string, string>();
function thumb(name: string): string {
  let t = thumbs.get(name);
  if (!t) {
    const p = isDark(studioMode()) ? STUDIO.dark : STUDIO.light;
    t = sceneThumb(name, { bg: p.desk, ink: p.ink, accent: p.accent, light: p.hi, mid: p.rule, dark: p.panel });
    thumbs.set(name, t);
  }
  return t;
}

function renderScenes(): void {
  const B = book(), list = $("mkScenes");
  list.textContent = "";
  const by = ({ hand: "placed by hand", auto: "placed automatically at the scene changes in your text", claude: "staged by Claude" } as Record<string, string>)[B.source] || "";
  if (!hasText()) { sceneNote("Add some text first."); return; }
  if (!$("mkSceneNote").classList.contains("warn")) sceneNote(B.scenes.length ? plural(B.scenes.length, "picture") + ", " + by + "." : "No pictures yet.");
  if (!B.scenes.length) { const li = document.createElement("li"); li.className = "empty"; li.textContent = "Place them automatically, or add one after any paragraph."; list.appendChild(li); }
  B.scenes.forEach((s, k) => {
    const li = document.createElement("li"); li.dataset.k = String(k);
    const th = document.createElement("span"); th.className = "th"; th.innerHTML = thumb(s.scene);
    const n = document.createElement("i"); n.textContent = NUM[k] || String(k + 1); th.appendChild(n);
    const sel = document.createElement("select"); sel.className = "mk-input"; sel.setAttribute("aria-label", "Scene for picture " + (k + 1)); sceneOptions(sel, s.scene);
    const acts = document.createElement("span"); acts.className = "acts";
    const go = document.createElement("button"); go.type = "button"; go.className = "btn quiet go"; go.textContent = "¶ " + pNumber(s.after); go.title = "Show it in the book";
    const x = document.createElement("button"); x.type = "button"; x.className = "btn quiet x"; x.textContent = "×"; x.setAttribute("aria-label", "Remove picture " + (k + 1));
    acts.append(go, x);
    const cap = document.createElement("input"); cap.className = "mk-input cap"; cap.value = s.caption; cap.setAttribute("aria-label", "Caption for picture " + (k + 1)); cap.placeholder = "Caption: words quoted from the text";
    li.append(th, sel, acts, cap); list.appendChild(li);
  });
  $<HTMLInputElement>("mkAddAt").max = String(B.blocks.filter((b) => b.type !== "h").length);
}

function commitScenes(scenes: SceneRef[], note?: string): void {
  const B = book();
  B.scenes = guardScenes(B.blocks, scenes).scenes; B.source = "hand";
  if (note) sceneNote(note); else $("mkSceneNote").classList.remove("warn");
  refresh();
}

function initScenes(): void {
  const list = $("mkScenes");
  list.addEventListener("change", (e) => {
    const t = e.target as HTMLElement, li = t.closest("li"), B = book();
    if (!li || li.dataset.k == null) return;
    const k = +li.dataset.k, s = B.scenes[k];
    if (t.tagName === "SELECT") { s.scene = (t as HTMLSelectElement).value; commitScenes(B.scenes); }
    else if (t.classList.contains("cap")) {
      const v = (t as HTMLInputElement).value.trim();
      if (captionIsQuoted(v, B.blocks, s.after)) { s.caption = v; commitScenes(B.scenes); }
      else {
        t.classList.add("bad");
        sceneNote("A caption has to be words quoted exactly from the text just before its picture. “" + v.slice(0, 40) + "” isn’t, so the caption stays as it was.", true);
        (t as HTMLInputElement).value = s.caption;
        setTimeout(() => t.classList.remove("bad"), 2400);
      }
    }
  });
  list.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"), li = b && b.closest("li");
    if (!b || !li || li.dataset.k == null) return;
    const k = +li.dataset.k, B = book();
    if (b.classList.contains("x")) { B.scenes.splice(k, 1); commitScenes(B.scenes); }
    if (b.classList.contains("go")) { preview.send({ type: "scroll", block: B.scenes[k].after, picture: true }); if (narrow()) setPane("book"); }
  });

  sceneOptions($<HTMLSelectElement>("mkAddScene"), "lamp");
  $("mkAddBtn").addEventListener("click", () => {
    const n = +$<HTMLInputElement>("mkAddAt").value, i = blockOfP(n), B = book();
    if (i < 0) { sceneNote("There’s no paragraph " + (n || "") + ". Pick a number from 1 to " + B.blocks.filter((b) => b.type !== "h").length + ".", true); return; }
    const scene = $<HTMLSelectElement>("mkAddScene").value;
    commitScenes([...B.scenes, { after: i, scene, caption: captionFor(B.blocks[i].text, scene) }], "Added a picture after paragraph " + n + ".");
    toast("Added a picture after paragraph " + n + ".");
    preview.send({ type: "scroll", block: i, picture: true });
  });
  $("mkAuto").addEventListener("click", () => {
    const B = book(); B.scenes = autoStage(B.blocks, state.settings.density); B.source = "auto"; delete B.beats;
    $("mkSceneNote").classList.remove("warn"); refresh();
  });
  $("mkClear").addEventListener("click", () => { commitScenes([], "Removed every picture. The text reads on its own."); toast("Removed every picture."); });
  $("mkAsk").addEventListener("click", stageWithClaude);
  $("mkStop").addEventListener("click", () => ctl && ctl.abort());
}

async function stageWithClaude(): Promise<void> {
  if (!sample) return;
  const B = book(), { prompt, cut } = buildStagingPrompt(B, state.settings.density);
  ctl = new AbortController();
  $<HTMLButtonElement>("mkAsk").disabled = true; $("mkStop").hidden = false;
  sceneNote("Claude is reading your text… this can take a minute.");
  try {
    const r = readStagingReply(B, await sample.json(prompt, { signal: ctl.signal }));
    if (!r.scenes.length) { sceneNote("Claude’s answer had no usable scenes. Try again, or place them automatically.", true); return; }
    B.scenes = r.scenes; B.source = "claude"; B.beats = r.beats;
    if (r.cover) B.cover = r.cover;
    const fixed = r.recaptioned ? " " + plural(r.recaptioned, "caption") + (r.recaptioned === 1 ? " wasn’t" : " weren’t") + " an exact quote, so the words were taken from the paragraph instead." : "";
    sceneNote("Staged " + plural(r.scenes.length, "scene") + (cut ? " (Claude read the first part of a very long text)" : "") + "." + fixed);
    refresh();
  } catch (e: any) {
    const c = e && e.code;
    if (c === "cancelled" || (e && e.name === "AbortError")) sceneNote("Stopped.");
    else if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(c)) { $("mkAsk").hidden = true; sceneNote("Claude isn’t available here. Automatic placement still works."); }
    else if (c === "rate_limited") sceneNote("Too many requests right now. Try again in a little while.", true);
    else if (c === "prompt_too_large") sceneNote("This text is too long for one pass. Try a single chapter.", true);
    else sceneNote("That didn’t work. Try again, or place the pictures automatically.", true);
  } finally {
    $<HTMLButtonElement>("mkAsk").disabled = !hasText(); $("mkStop").hidden = true;
  }
}

/* ---------------- look: presets, themes, type, styles ---------------- */
function setOpt<K extends keyof Settings>(k: K, v: Settings[K]): void {
  const S = state.settings;
  S[k] = v;
  const p = presetById(S.preset);
  if (p && k in p.s && p.s[k] !== v) S.preset = "custom";
  store(KEYS.settings, S);
  syncControls(mk, S);
  if (k === "density") {
    const B = book();
    if (B.source === "auto") B.scenes = autoStage(B.blocks, S.density);
    else sceneNote("Press Place automatically to use the new amount. Your own placement is kept until then.");
  }
  refresh();
}

function applyPreset(id: string): void {
  const p = presetById(id);
  if (!p) return;
  state.settings = { ...state.settings, ...p.s, preset: id };
  store(KEYS.settings, state.settings);
  syncControls(mk, state.settings);
  refresh();
}

function markPresets(): void {
  $("mkPresets").querySelectorAll<HTMLElement>("button[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === state.settings.preset)));
}

function firstLine(): string {
  const p = book().blocks.find((b) => b.type === "p" && !isBreak(b.text));
  const t = p ? plain(p.text) : "The lamp above the table buzzed quietly, like it was thinking.";
  return t.length > 96 ? t.slice(0, t.lastIndexOf(" ", 96)) + "…" : t;
}

/** Specimen fonts: every pairing, subset to just the letters the cards show (a few KB). */
let specimenText = "";
function specimens(): void {
  const title = book().title || "Your Book", line = firstLine();
  const txt = "Aa" + title + line + PRESETS.map((p) => p.name).join("") + PAIRING_LIST.map((p) => PAIRINGS[p].name).join("");
  const chars = Array.from(new Set(txt.split(""))).join("");
  if (chars !== specimenText) {
    specimenText = chars;
    let link = document.getElementById("mkSpecimens") as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.rel = "stylesheet"; link.id = "mkSpecimens"; document.head.appendChild(link); }
    const fam = Array.from(new Set(PAIRING_LIST.flatMap((p) => PAIRINGS[p].families.map((f) => f.split(":")[0]))));
    link.href = "https://fonts.googleapis.com/css2?" + fam.map((f) => "family=" + f).join("&") + "&text=" + encodeURIComponent(chars) + "&display=swap";
  }
  buildPresets(title, line);
  buildTypes(line);
}

function buildPresets(title: string, line: string): void {
  const box = $("mkPresets");
  box.textContent = "";
  PRESETS.forEach((p) => {
    const s = { ...DEFAULTS, ...p.s }, pal = palette(s.theme, s.mode !== "light"), P = PAIRINGS[s.pairing];
    const b = document.createElement("button"); b.type = "button"; b.dataset.preset = p.id; b.setAttribute("role", "listitem");
    b.style.cssText = "--pv-bg:" + pal.desk + ";--pv-ink:" + pal.ink + ";--pv-mut:" + pal.muted + ";--pv-acc:" + pal.accent + ";--pv-rule:" + pal.rule + ";--pv-body:" + P.body + ";--pv-disp:" + P.display;
    const card = document.createElement("span"); card.className = "pv pv-" + s.layout + (s.light !== "off" ? " pv-lit" : "");
    const h = document.createElement("span"); h.className = "pv-t"; h.textContent = title;
    const r = document.createElement("span"); r.className = "pv-r";
    const tx = document.createElement("span"); tx.className = "pv-x"; tx.textContent = line;
    card.append(h, r, tx);
    const name = document.createElement("b"); name.textContent = p.name;
    const note = document.createElement("span"); note.className = "pv-n"; note.textContent = p.note;
    b.append(card, name, note);
    b.addEventListener("click", () => applyPreset(p.id));
    box.appendChild(b);
  });
  markPresets();
}

function buildThemes(): void {
  const box = $("mkThemes");
  box.textContent = "";
  THEME_LIST.forEach((t) => {
    const T = THEMES[t], b = document.createElement("button"); b.type = "button"; b.setAttribute("data-v", t);
    const sw = document.createElement("span"); sw.className = "th-sw";
    [T.dark, T.light].forEach((pal) => { const half = document.createElement("i"); half.style.cssText = "--a:" + pal.desk + ";--b:" + pal.accent + ";--c:" + pal.ink; sw.appendChild(half); });
    const n = document.createElement("b"); n.textContent = T.name;
    const note = document.createElement("span"); note.textContent = T.note;
    b.append(sw, n, note); box.appendChild(b);
  });
}

function buildTypes(line: string): void {
  const box = $("mkType");
  if (box.childElementCount && box.dataset.line === line) return;
  box.dataset.line = line;
  box.textContent = "";
  PAIRING_LIST.forEach((p) => {
    const P = PAIRINGS[p], b = document.createElement("button"); b.type = "button"; b.setAttribute("data-v", p);
    const aa = document.createElement("span"); aa.className = "ty-aa"; aa.style.fontFamily = P.display; aa.textContent = "Aa";
    const n = document.createElement("b"); n.textContent = P.name;
    const note = document.createElement("span"); note.className = "ty-n"; note.textContent = P.note;
    const smp = document.createElement("span"); smp.className = "ty-s"; smp.style.fontFamily = P.body; smp.textContent = line;
    b.append(aa, n, note, smp); box.appendChild(b);
  });
  syncControls(mk, state.settings);
}

function buildStyles(): void {
  const box = $("mkStyles");
  box.textContent = "";
  STYLE_ORDER.forEach((s) => {
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("data-v", s); b.className = "st-" + s;
    const i = document.createElement("i"); i.setAttribute("aria-hidden", "true");
    const n = document.createElement("b"); n.textContent = STYLE_NAME[s];
    const note = document.createElement("span"); note.textContent = STYLE_NOTE[s];
    b.append(i, n, note); box.appendChild(b);
  });
}

/* ---------------- export ---------------- */
function renderSummary(ps: number, w: number): void {
  const B = book(), S = state.settings, dl = $("mkSum");
  dl.textContent = "";
  const P = PAIRINGS[S.pairing];
  const rows: [string, string][] = hasText() ? [
    ["Title", B.title + (B.author ? " · " + B.author : "")],
    ["File", exportFileName(B.title)],
    ["Text", plural(ps, "paragraph") + ", " + plural(w, "word")],
    ["Form", LAYOUT_NAME[S.layout] + (S.para === "book" ? ", indented" : "") + (S.align === "justify" ? ", justified" : "")],
    ["Colour", THEMES[S.theme].name + ", " + (S.mode === "auto" ? "light or dark with the reader’s device" : S.mode)],
    ["Type", P.name + " (" + P.note + "), " + S.fontSize + "px, " + ({ narrow: 55, normal: 66, wide: 75 } as Record<string, number>)[S.measure] + " characters a line"],
    ["Light", S.light === "off" ? "Even" : S.light[0].toUpperCase() + S.light.slice(1) + (S.flicker && S.light !== "focus" ? ", flickering" : "")],
    ["Pictures", S.style === "none" ? "None" : plural(B.scenes.length, "picture") + ", " + STYLE_NAME[S.style] + (S.motion ? ", animated" : ", still")],
    ["Readers", S.readerControls ? "Can adjust the page, light and type" : "See your look only"],
  ] : [["Book", "Nothing to export yet. Add some text first."]];
  rows.forEach(([k, v]) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); });
  if (!canExport(pristine)) $("mkDlNote").textContent = "Downloads work in the built app: run npm run build, then open index.html.";
}

async function save(name: string, data: string | Uint8Array, type: string, note: HTMLElement): Promise<void> {
  if (downloads) {
    try {
      await downloads.save({ filename: name, data: typeof data === "string" ? data : new Blob([data as BlobPart], { type }) });
      note.textContent = "Saved " + name + "."; toast("Saved " + name + "."); return;
    } catch (e: any) {
      if (e && e.code === "declined") { note.textContent = "Download cancelled."; return; }
      if (typeof data === "string") { note.textContent = "Couldn’t save the file here."; return; }
    }
  }
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  note.textContent = "Saved " + name + "."; toast("Saved " + name + ".");
}

function bookHtml(): string { return buildBookHtml(pristine, book(), state.settings); }

function downloadBook(): void {
  if (!hasText() || !canExport(pristine)) return;
  save(exportFileName(book().title), bookHtml(), "text/html", $("mkDlNote"));
}
async function downloadEpub(): Promise<void> {
  if (!hasText()) return;
  const note = $("mkDlNote");
  note.textContent = "Making the EPUB…";
  const pics = state.settings.style === "none" || state.settings.style === "orn" ? [] : await preview.snapshots();
  const data = buildEpub(book(), state.settings, pics);
  save(exportFileName(book().title).replace(/\.html$/, ".epub"), data, "application/epub+zip", note);
}
function downloadMd(note: HTMLElement): void {
  if (!hasText()) return;
  const t = userTitle && !/^#\s/.test(md.trim()) ? "# " + userTitle + "\n\n" + md.trim() + "\n" : md.trim() + "\n";
  save(slug(book().title) + ".md", t, "text/markdown", note);
}

/* ---------------- boot ---------------- */
export function initMaker(p: Pristine): void {
  pristine = p;
  mk = $("maker");
  applyStudio();
  matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (studioMode() === "auto") applyStudio(); });
  document.querySelectorAll(".mk-mode").forEach((b) => b.addEventListener("click", () => {
    const order: Mode[] = ["auto", "light", "dark"], next = order[(order.indexOf(studioMode()) + 1) % 3];
    store(STUDIO_MODE, next); applyStudio();
  }));
  preview = createPreview($<HTMLIFrameElement>("mkFrame"), p, state.settings, onPick);
  editor = mountEditor($<HTMLTextAreaElement>("mkMd"), $("mkHi"), $("mkScroll"));

  // Restore the last draft (or the last book from the old Studio), else start empty.
  const draft = load<Draft>(DRAFT_KEY);
  const legacy = !draft ? load<Book>(KEYS.book) : null;
  if (draft && draft.md && draft.md.trim()) {
    md = draft.md; userTitle = draft.title || "";
    meta = { subtitle: draft.subtitle || "", author: draft.author || "", dedication: draft.dedication || "" };
    const parsed = parseDraft(md, userTitle);
    state.book = withMeta({ title: parsed.title, blocks: parsed.blocks, scenes: guardScenes(parsed.blocks, draft.scenes || []).scenes, beats: draft.beats, cover: draft.cover, source: draft.source || "auto" });
  } else if (legacy && Array.isArray(legacy.blocks) && legacy.blocks.length) {
    md = blocksToText(legacy.blocks); userTitle = legacy.title || "";
    const parsed = parseDraft(md, userTitle);
    state.book = { title: parsed.title, blocks: parsed.blocks, scenes: guardScenes(parsed.blocks, legacy.scenes || []).scenes, beats: legacy.beats, cover: legacy.cover, source: legacy.source || "auto" };
  } else {
    state.book = { title: "", blocks: [], scenes: [], source: "auto" };
  }
  setMd(md);
  setMetaFields();
  $("mkWork").hidden = false;

  // Panes and tabs
  $("mkTabs").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (b) setPane("manuscript", b.dataset.tab as Tab);
  });
  document.querySelector(".wk-nav")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (b) setPane(b.dataset.pane as Pane, b.dataset.tab as Tab | undefined);
  });
  $("mkSideSw").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (b) setPane(b.dataset.side as Pane);
  });
  setPane("manuscript", "text");
  $("mkHome").addEventListener("click", showLanding);
  $("mkNew").addEventListener("click", () => { $("mkMenu").removeAttribute("open"); showLanding(); });
  $("mkBack").addEventListener("click", () => showWork());
  document.addEventListener("click", (e) => {
    const m = $("mkMenu");
    if (m.hasAttribute("open") && !m.contains(e.target as Node)) m.removeAttribute("open");
  });
  $("mkMenu").addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("button")) $("mkMenu").removeAttribute("open"); });

  // Source: the landing page
  const fileIn = $<HTMLInputElement>("mkFiles");
  fileIn.accept = ACCEPT;
  fileIn.addEventListener("change", () => { if (fileIn.files) doImport(Array.from(fileIn.files)); fileIn.value = ""; });
  $("mkPaste").addEventListener("click", () => { showWork("manuscript", "text"); $("mkMd").focus(); });
  $("mkSample").addEventListener("click", loadSample);
  let depth = 0;
  const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
  window.addEventListener("dragenter", (e) => { if (hasFiles(e)) { depth++; mk.classList.add("dragging"); } });
  window.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; mk.classList.remove("dragging"); } });
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; mk.classList.remove("dragging");
    doImport(Array.from(e.dataTransfer!.files));
  });

  // Text
  let tmr = 0;
  const edited = () => { saveState(true); clearTimeout(tmr); tmr = window.setTimeout(() => rebuild(false), 350); };
  $("mkMd").addEventListener("input", (e) => { md = (e.target as HTMLTextAreaElement).value; editor.paint(); edited(); });
  $("mkMd").addEventListener("paste", (e) => onPaste(e as ClipboardEvent));
  $("mkTitle").addEventListener("input", (e) => { userTitle = (e.target as HTMLInputElement).value.trim(); edited(); });
  ([["mkSubtitle", "subtitle"], ["mkAuthor", "author"], ["mkDedication", "dedication"]] as const).forEach(([id, k]) =>
    $(id).addEventListener("input", (e) => { meta[k] = (e.target as HTMLInputElement).value.trim(); edited(); }));
  $("mkMdDl").addEventListener("click", () => downloadMd($("mkMdStats")));
  $("mkMdDl2").addEventListener("click", () => downloadMd($("mkDlNote")));

  // Pictures, design
  initScenes();
  buildThemes();
  buildStyles();
  bindControls(mk, setOpt);
  syncControls(mk, state.settings);
  $("mkResetLook").addEventListener("click", () => {
    state.settings = { ...DEFAULTS, density: state.settings.density };
    store(KEYS.settings, state.settings); syncControls(mk, state.settings); refresh();
    toast("Back to the default look.");
  });

  // Preview
  $("mkDevice").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (!b) return;
    const d = b.getAttribute("data-d");
    $("mkStage").classList.toggle("phone", d === "phone");
    $("mkStage").classList.toggle("tablet", d === "tablet");
    $("mkDevice").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  });
  $("mkTop").addEventListener("click", () => preview.send({ type: "top" }));

  // Export
  const sheet = $<HTMLDialogElement>("mkExport");
  $("mkExportBtn").addEventListener("click", () => { $("mkDlNote").textContent = ""; refresh(); openExport(); });
  $("mkExClose").addEventListener("click", closeExport);
  sheet.addEventListener("click", (e) => {
    const r = sheet.getBoundingClientRect(), x = e.clientX, y = e.clientY;
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) closeExport();
  });
  $("mkDownload").addEventListener("click", downloadBook);
  $("mkEpub").addEventListener("click", downloadEpub);
  $("mkPrint").addEventListener("click", () => { closeExport(); preview.send({ type: "print" }); });
  $("mkOpenTab").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([bookHtml()], { type: "text/html" }));
    if (!window.open(url, "_blank")) toast("The browser blocked the new tab. Use Export instead.", true);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "s") { e.preventDefault(); downloadBook(); }
    else if (k === "e" && !landingOpen() && hasText()) { e.preventDefault(); refresh(); openExport(); }
  });

  // claude.ai extras
  if (window.claude && window.claude.use) {
    $("mkOpenTab").hidden = true; // artifact pages can't open blob tabs
    window.claude.use("sample").then((s) => { if (s) { sample = s; $("mkAsk").hidden = false; } }).catch(() => {});
    window.claude.use("downloads").then((d) => { if (d) downloads = d; }).catch(() => {});
  }

  studioReady = true;
  refresh();
  if (hasText()) showWork(); else showLanding();
}
