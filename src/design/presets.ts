// Presets: one click sets a whole look (form, theme, type, light, pictures, ornament). The Studio's
// Look step opens on this gallery; everything can then be fine-tuned. Pure data.
import type { Settings } from "../types";

export interface Preset { id: string; name: string; note: string; s: Partial<Settings> }

export const PRESETS: Preset[] = [
  { id: "lamplight", name: "Lamplight", note: "Scroll by lamplight, ink drawings",
    s: { layout: "scroll", theme: "lamplight", mode: "dark", pairing: "literary", light: "lamp", flicker: true, style: "ink", para: "web", align: "ragged", opening: "drop", ornament: "asterism", reveal: "rise", numerals: "roman", frame: "inline", leading: "normal", hyphens: false, paper: "none", chapterStyle: "classic", cover: "picture" } },
  { id: "first-edition", name: "First Edition", note: "Pages, Garamond, fleurons",
    s: { layout: "paged", theme: "vellum", mode: "light", pairing: "classic", light: "off", style: "orn", para: "book", align: "justify", opening: "smallcaps", ornament: "hedera", reveal: "none", numerals: "words", frame: "plate", leading: "normal", hyphens: true, paper: "laid", chapterStyle: "ornament", cover: "type" } },
  { id: "nocturne", name: "Nocturne", note: "Moonlit, one paragraph in focus",
    s: { layout: "scroll", theme: "nocturne", mode: "dark", pairing: "literary", light: "focus", style: "glow", para: "web", align: "ragged", opening: "raised", ornament: "asterism", reveal: "fade", numerals: "roman", frame: "inline", leading: "loose", hyphens: false, paper: "none", chapterStyle: "minimal", cover: "picture" } },
  { id: "sumi", name: "Sumi", note: "Chapters, ink wash",
    s: { layout: "cards", theme: "sumi", mode: "light", pairing: "modern", light: "off", style: "wash", para: "web", align: "ragged", opening: "none", ornament: "rule", reveal: "ink", numerals: "arabic", frame: "head", leading: "loose", hyphens: false, paper: "none", chapterStyle: "minimal", cover: "minimal" } },
  { id: "zine", name: "Zine", note: "Two-ink riso prints on newsprint",
    s: { layout: "scroll", theme: "riso", mode: "light", pairing: "humanist", light: "off", style: "riso", para: "web", align: "ragged", opening: "raised", ornament: "dinkus", reveal: "rise", numerals: "arabic", frame: "inline", leading: "tight", hyphens: false, paper: "grain", chapterStyle: "numeral", cover: "picture", size: "l" } },
  { id: "typescript", name: "Typescript", note: "Courier by candlelight, ASCII art",
    s: { layout: "scroll", theme: "lamplight", mode: "dark", pairing: "typewriter", light: "candle", flicker: true, style: "ascii", para: "web", align: "ragged", opening: "none", ornament: "dinkus", reveal: "none", numerals: "arabic", frame: "inline", leading: "normal", hyphens: false, paper: "none", chapterStyle: "minimal", cover: "type" } },
  { id: "field-notes", name: "Field Notes", note: "Engravings, the light follows the hour of the story",
    s: { layout: "scroll", theme: "moss", mode: "dark", pairing: "storybook", light: "story", style: "engrave", para: "book", align: "ragged", opening: "drop", ornament: "lotus", reveal: "rise", numerals: "words", frame: "margin", leading: "normal", hyphens: true, paper: "linen", chapterStyle: "classic", cover: "picture" } },
  { id: "drift", name: "Drift", note: "Generative art grown from each passage",
    s: { layout: "scroll", theme: "nocturne", mode: "light", pairing: "screen", light: "off", style: "flow", para: "web", align: "ragged", opening: "raised", ornament: "lotus", reveal: "fade", numerals: "roman", frame: "plate", leading: "loose", hyphens: false, paper: "none", chapterStyle: "numeral", cover: "type", size: "full" } },
];

export function presetById(id: string | undefined): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
