// The Design pane: editions, themes, type pairings and picture styles, and the specimens that show them.
import { KEYS } from "../brand";
import { PRESETS, presetById } from "../design/presets";
import { THEMES, THEME_LIST, palette } from "../design/themes";
import { PAIRINGS, PAIRING_LIST } from "../design/type";
import { isBreak, plain } from "../inline";
import { DEFAULTS } from "../settings";
import { autoStage } from "../stage/auto";
import { state } from "../state";
import { load, store } from "../store";
import type { Settings, Style } from "../types";
import { syncControls } from "../ui/controls";
import { $, book, hooks, sceneNote, sess } from "./session";
import { clearThumbs } from "./studio";

export const STYLE_NAME: Record<Style, string> = {
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
export const LIGHT_NOTE: Record<Settings["light"], string> = {
  off: "Even light across the page.",
  lamp: "A pool of lamplight follows the line being read; the rest of the page sits in shadow.",
  candle: "A smaller, warmer pool that gutters like a flame.",
  focus: "The paragraph being read stays bright; the others fall back, for close reading.",
  story: "The room’s light follows the hour and weather of the passage being read.",
};
/** One set of names for the three layouts, here and in the preview dock and the reader. */
export const LAYOUT_NAME: Record<Settings["layout"], string> = { scroll: "Scroll", cards: "Chapters", paged: "Pages" };

export function setOpt<K extends keyof Settings>(k: K, v: Settings[K]): void {
  const S = state.settings;
  S[k] = v;
  const p = presetById(S.preset);
  if (p && k in p.s && p.s[k] !== v) { store(BASE_KEY, p.id); S.preset = "custom"; }
  store(KEYS.settings, S);
  syncControls(sess.mk, S);
  if (k === "density" || k === "art") {
    const B = book();
    if (B.source === "auto") B.scenes = autoStage(B.blocks, S.density, S.art);
    else sceneNote("Press Place automatically to use the new " + (k === "art" ? "kind of picture" : "amount") + ". Your own placement is kept until then.");
  }
  if (k === "style") clearThumbs();
  hooks.refresh();
}

function applyPreset(id: string): void {
  const p = presetById(id);
  if (!p) return;
  state.settings = { ...state.settings, ...p.s, preset: id };
  store(BASE_KEY, id);
  store(KEYS.settings, state.settings);
  syncControls(sess.mk, state.settings);
  hooks.refresh();
}

export function resetLook(): void {
  state.settings = { ...DEFAULTS, density: state.settings.density, art: state.settings.art };
  store(KEYS.settings, state.settings); syncControls(sess.mk, state.settings); hooks.refresh();
}

/** The edition a customised look started from, so its card can still say so. */
const BASE_KEY = "nymphaea-studio-base";
export function markPresets(): void {
  const cur = state.settings.preset, base = cur === "custom" ? load<string>(BASE_KEY) : null;
  $("mkPresets").querySelectorAll<HTMLElement>("button[data-preset]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.preset === cur));
    b.classList.toggle("base", !!base && b.dataset.preset === base);
    if (base && b.dataset.preset === base) b.title = "Your look started from this edition and has your changes"; else b.removeAttribute("title");
  });
}

export function firstLine(): string {
  const p = book().blocks.find((b) => b.type === "p" && !isBreak(b.text));
  const t = p ? plain(p.text) : "The lamp above the table buzzed quietly, like it was thinking.";
  return t.length > 96 ? t.slice(0, t.lastIndexOf(" ", 96)) + "…" : t;
}

/** Specimen fonts: every pairing, subset to just the letters the cards show (a few KB). */
let specimenText = "";
export function specimens(): void {
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

export function buildThemes(): void {
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
  syncControls(sess.mk, state.settings);
}

export function buildStyles(): void {
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
