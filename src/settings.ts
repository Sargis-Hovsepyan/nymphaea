import { THEME_LIST } from "./design/themes";
import { PAIRING_LIST } from "./design/type";
import type { Density, Settings, Size } from "./types";

/** Rev 3: themes × light/dark, type pairings, layouts and light modes replace room/lamp/font/dropcap. */
export const SETTINGS_REV = 3;

export const DEFAULTS: Settings = {
  style: "ink",
  size: "m",
  density: "some",
  motion: true,
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
  layout: "scroll",
  trim: "a5",
  reveal: "rise",
  beats: true,
  readerControls: true,
  preset: "lamplight",
  rev: SETTINGS_REV,
};

/** Words per picture. */
export const DENS: Record<Density, number> = { few: 900, some: 450, many: 240 };

export const FIGW: Record<Size, string> = { s: "210px", m: "290px", l: "420px" };

export const NUM = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

/** Settings whose change needs the book DOM rebuilt. */
export const STRUCTURAL: Partial<Record<keyof Settings, true>> = { style: true, density: true, beats: true, motion: true, layout: true, numerals: true };

const ENUMS: Partial<Record<keyof Settings, readonly string[]>> = {
  style: ["ink", "cut", "glow", "wash", "dither", "halftone", "ascii", "glass", "engrave", "stipple", "riso", "flow", "orn", "none"],
  size: ["s", "m", "l"], density: ["few", "some", "many"], theme: THEME_LIST, mode: ["auto", "light", "dark"],
  light: ["off", "lamp", "candle", "focus", "dawn"], pairing: PAIRING_LIST, measure: ["narrow", "normal", "wide"],
  para: ["book", "web"], align: ["ragged", "justify"], opening: ["drop", "raised", "smallcaps", "none"],
  numerals: ["roman", "words", "arabic", "none"], ornament: ["asterism", "dinkus", "lotus", "hedera", "rule"],
  layout: ["scroll", "cards", "paged"], trim: ["a5", "6x9", "a4", "letter"], reveal: ["none", "rise", "fade", "ink"],
};
const BOOLS: (keyof Settings)[] = ["motion", "follow", "flicker", "beats", "readerControls"];

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
  if (typeof o.reveal === "boolean") out.reveal = o.reveal ? "rise" : "none";
  if (typeof o.font === "string" && !("pairing" in o)) out.pairing = o.font === "sans" ? "modern" : o.font === "mono" ? "typewriter" : "literary";
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
