// Compare: the book as it looks now beside a second look (an edition or a theme), both live. The second
// look can be taken with one click, and taken back with Undo.
import { KEYS } from "../brand";
import { PRESETS, presetById } from "../design/presets";
import { THEMES, THEME_LIST } from "../design/themes";
import { state } from "../state";
import { store } from "../store";
import type { Settings } from "../types";
import { syncControls } from "../ui/controls";
import { setOpt } from "./design";
import { createPreview, type Preview } from "./preview";
import { readingBlock } from "./bookNav";
import { $, book, hasText, hooks, sess, usedImages } from "./session";
import { toast } from "./ui";
import { registerView } from "./views";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e;
};

let built = false, pa: Preview | null = null, pb: Preview | null = null;
/** "e:<edition id>" or "t:<theme>" */
let alt = "";
let sel: HTMLSelectElement, useBtn: HTMLButtonElement, nameA: HTMLElement, empty: HTMLElement, cols: HTMLElement;

/** The settings for a choice, laid over the current ones. */
export function altSettings(choice: string, base: Settings): Settings {
  if (choice.startsWith("e:")) { const p = presetById(choice.slice(2)); return p ? { ...base, ...p.s, preset: p.id } : { ...base }; }
  if (choice.startsWith("t:")) return { ...base, theme: choice.slice(2) as Settings["theme"], preset: "custom" };
  return { ...base };
}

function currentName(): string {
  const p = presetById(state.settings.preset);
  return p ? p.name : THEMES[state.settings.theme].name + ", your changes";
}
function altName(): string {
  if (alt.startsWith("e:")) return presetById(alt.slice(2))?.name || "";
  return THEMES[alt.slice(2) as keyof typeof THEMES]?.name + " theme";
}

function defaultAlt(): string {
  const cur = state.settings.preset;
  const p = PRESETS.find((x) => x.id !== cur && x.s.theme !== state.settings.theme) || PRESETS.find((x) => x.id !== cur) || PRESETS[0];
  return "e:" + p.id;
}

function build(): void {
  built = true;
  const root = $("viewCompare");
  root.textContent = ""; root.classList.add("cp");
  empty = el("div", "vw-empty");
  empty.append(el("h3", "", "Compare two looks"), el("p", "", "Add a story first. Then pick a second edition or theme and read the same pages in both, side by side, before you change anything."));
  root.appendChild(empty);
  cols = el("div", "cp-cols");
  const mk = (side: "a" | "b") => {
    const col = el("section", "cp-col"); col.dataset.side = side;
    const hd = el("header", "cp-head");
    const f = document.createElement("iframe"); f.className = "cp-frame"; f.title = side === "a" ? "The book with the current look" : "The book with the second look";
    col.append(hd, f);
    return { col, hd, f };
  };
  const A = mk("a"), Bc = mk("b");
  nameA = el("b", "", ""); A.hd.append(el("span", "cp-tag", "Now"), nameA);
  sel = document.createElement("select"); sel.className = "mk-input cp-sel"; sel.setAttribute("aria-label", "Second look");
  const g1 = document.createElement("optgroup"); g1.label = "Editions";
  PRESETS.forEach((p) => { const o = document.createElement("option"); o.value = "e:" + p.id; o.textContent = p.name; g1.appendChild(o); });
  const g2 = document.createElement("optgroup"); g2.label = "Themes";
  THEME_LIST.forEach((t) => { const o = document.createElement("option"); o.value = "t:" + t; o.textContent = THEMES[t].name; g2.appendChild(o); });
  sel.append(g1, g2);
  alt = defaultAlt(); sel.value = alt;
  useBtn = el("button", "btn primary cp-use", "Use this look"); useBtn.type = "button";
  Bc.hd.append(el("span", "cp-tag alt", "Instead"), sel, useBtn);
  cols.append(A.col, Bc.col);
  root.appendChild(cols);
  sel.addEventListener("change", () => { alt = sel.value; draw(); });
  useBtn.addEventListener("click", useAlt);
  // The previews load their pages now, once, the first time Compare is shown.
  pa = createPreview(A.f, sess.pristine, state.settings);
  pb = createPreview(Bc.f, sess.pristine, altSettings(alt, state.settings));
}

function draw(): void {
  if (!built) return;
  const ok = hasText();
  empty.hidden = ok; cols.hidden = !ok;
  if (!ok) return;
  nameA.textContent = currentName();
  const S = altSettings(alt, state.settings), B = book(), imgs = usedImages();
  const same = JSON.stringify({ ...S, preset: 0 }) === JSON.stringify({ ...state.settings, preset: 0 });
  useBtn.disabled = same;
  useBtn.title = same ? "This is the look you already have" : "Use " + altName() + " for the book";
  pa!.images(imgs); pa!.render(B, state.settings);
  pb!.images(imgs); pb!.render(B, S);
  // Both panes open on the passage the Book view was showing, so the two looks show the same words.
  const at = readingBlock();
  if (at >= 0) setTimeout(() => { pa!.send({ type: "scroll", block: at }); pb!.send({ type: "scroll", block: at }); }, 450);
}

function useAlt(): void {
  const prev: Settings = JSON.parse(JSON.stringify(state.settings)), name = altName();
  if (alt.startsWith("e:")) {
    const b = document.querySelector<HTMLElement>('#mkPresets button[data-preset="' + alt.slice(2) + '"]');
    if (b) b.click();
    else { const p = presetById(alt.slice(2)); if (p) { state.settings = { ...state.settings, ...p.s, preset: p.id }; store(KEYS.settings, state.settings); syncControls(sess.mk, state.settings); hooks.refresh(); } }
  } else setOpt("theme", alt.slice(2) as Settings["theme"]);
  toast("The book now uses " + name + ".", false, {
    label: "Undo",
    run: () => { state.settings = prev; store(KEYS.settings, prev); syncControls(sess.mk, prev); hooks.refresh(); toast("Back to the look you had."); },
  });
}

export function initCompare(): void {
  registerView("compare", () => { if (!built) build(); draw(); });
}
