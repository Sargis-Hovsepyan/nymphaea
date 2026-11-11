import { THEME_LIST } from "./design/themes";
import { PAIRING_LIST } from "./design/type";
import type { Density, Leading, Settings, Size } from "./types";

/** Rev 3: themes × light/dark, type pairings, layouts and light modes replace room/lamp/font/dropcap. */
export const SETTINGS_REV = 3;

export const DEFAULTS: Settings = {
  style: "ink",
  size: "m",
  density: "some",
  frame: "inline",
  art: "mixed",
  motion: true,
  captions: "cue",
  pictures: "on",
  theme: "lamplight",
  mode: "dark",
  light: "lamp",
  follow: true,
  flicker: true,
  pairing: "literary",
  fontSize: 19,
  measure: "normal",
  para: "web",
  align: "ragged",
  opening: "drop",
  numerals: "roman",
  ornament: "asterism",
  leading: "normal",
  hyphens: false,
  paper: "none",
  chapterStyle: "classic",
  cover: "picture",
  progress: "time",
  layout: "scroll",
  trim: "a5",
  reveal: "rise",
  beats: true,
  readerControls: true,
  preset: "lamplight",
  rev: SETTINGS_REV,
};

/** Words per picture. */
export const DENS: Record<Density, number> = { few: 900, some: 450, many: 240, every: 140 };

export const FIGW: Record<Size, string> = { s: "210px", m: "290px", l: "420px", full: "100%" };

export const NUM = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

/** Settings whose change needs the book DOM rebuilt, or (leading, hyphens, size, chapterStyle) re-pages the spreads. */
export const STRUCTURAL: Partial<Record<keyof Settings, true>> = {
  style: true, density: true, beats: true, motion: true, layout: true, numerals: true,
  frame: true, cover: true, size: true, leading: true, hyphens: true, chapterStyle: true,
};

/** Line height multiplier for each Leading. */
export const LEAD: Record<Leading, number> = { tight: 0.92, normal: 1, loose: 1.12 };

const ENUMS: Partial<Record<keyof Settings, readonly string[]>> = {
  style: ["ink", "cut", "glow", "wash", "dither", "halftone", "ascii", "glass", "engrave", "stipple", "riso", "flow", "orn", "none"],
  size: ["s", "m", "l", "full"], density: ["few", "some", "many", "every"], frame: ["inline", "plate", "margin", "head"],
  leading: ["tight", "normal", "loose"], paper: ["none", "grain", "laid", "linen"], chapterStyle: ["classic", "numeral", "minimal", "ornament"],
  cover: ["picture", "type", "minimal"], progress: ["time", "bar", "none"], art: ["library", "mixed", "composed"], theme: THEME_LIST, mode: ["auto", "light", "dark"],
  light: ["off", "lamp", "candle", "focus", "story"], captions: ["cue", "caption", "both", "none"], pictures: ["on", "still", "off"], pairing: PAIRING_LIST, measure: ["narrow", "normal", "wide"],
  para: ["book", "web"], align: ["ragged", "justify"], opening: ["drop", "raised", "smallcaps", "none"],
  numerals: ["roman", "words", "arabic", "none"], ornament: ["asterism", "dinkus", "lotus", "hedera", "rule"],
  layout: ["scroll", "cards", "paged"], trim: ["a5", "6x9", "a4", "letter"], reveal: ["none", "rise", "fade", "ink"],
};
const BOOLS: (keyof Settings)[] = ["motion", "follow", "flicker", "beats", "readerControls", "hyphens"];

/**
 * Any saved settings (rev 1–2 "room/lamp/font/dropcap", rev 3, or junk) → a partial rev-3 object
 * holding only valid values. Pure; used for the Studio's saved look, a book's embedded look and a
 * reader's own look.
 */
export function migrate(raw: unknown): Partial<Settings> {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  // rev 2 → 3
  if (typeof o.room === "string" && !("theme" in o)) {
    if (o.room === "paper") { out.theme = "lamplight"; out.mode = "light"; }
    else if (o.room === "midnight") { out.theme = "nocturne"; out.mode = "dark"; }
    else { out.theme = "lamplight"; out.mode = "dark"; }
  }
  if (typeof o.lamp === "boolean" && !("light" in o)) out.light = o.lamp ? "lamp" : "off";
  if (typeof o.dropcap === "boolean" && !("opening" in o)) out.opening = o.dropcap ? "drop" : "none";
  // "Dawn" followed chapter progress; Story light follows the text's hour and weather instead.
  if (o.light === "dawn") out.light = "story";
  if (typeof o.reveal === "boolean") out.reveal = o.reveal ? "rise" : "none";
  if (typeof o.font === "string" && !("pairing" in o)) out.pairing = o.font === "sans" ? "modern" : o.font === "mono" ? "typewriter" : "literary";
  // Justified text used to hyphenate on its own; keep that for books saved before the setting existed.
  if (!("hyphens" in o) && o.align === "justify") out.hyphens = true;
  // Rev 1 (no rev, a room) saved Dithered as its default style; rev 2 moved the default to Ink.
  const v1 = typeof o.rev !== "number" && "room" in o;
  (Object.keys(DEFAULTS) as (keyof Settings)[]).forEach((k) => {
    if (k in out || !(k in o) || (v1 && k === "style")) return;
    const v = o[k], en = ENUMS[k];
    if (en) { if (typeof v === "string" && en.includes(v)) out[k] = v; }
    else if (BOOLS.includes(k)) { if (typeof v === "boolean") out[k] = v; }
    else if (k === "fontSize") { if (typeof v === "number" && v >= 14 && v <= 28) out[k] = Math.round(v); }
    else if (k === "preset") { if (typeof v === "string") out[k] = v.slice(0, 40); }
  });
  out.rev = SETTINGS_REV;
  return out as Partial<Settings>;
}

export function withDefaults(raw: unknown): Settings {
  return { ...DEFAULTS, ...migrate(raw) };
}
