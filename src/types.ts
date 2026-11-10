import type { Mode, Theme } from "./design/themes";
import type { Measure, Numerals, Pairing } from "./design/type";

/** p: paragraph · h: heading · quote: "> …" (an epigraph when it follows a heading) · verse: lines kept. */
export type BlockType = "p" | "h" | "quote" | "verse";

export interface Block {
  type: BlockType;
  /** Exactly as written. Verse keeps its line breaks as "\n". */
  text: string;
  /** Headings: 1 "#" chapter, 2 "##" section, 3 "###" minor. */
  level?: 1 | 2 | 3;
}

export interface SceneRef {
  /** 0-based index of the block the picture follows. */
  after: number;
  scene: string;
  /** A few words quoted exactly from the text near `after`. Never invented. */
  caption: string;
}

export type BookSource = "hand" | "auto" | "claude";

export interface Book {
  title: string;
  blocks: Block[];
  scenes: SceneRef[];
  beats?: number[];
  cover?: string;
  source: BookSource;
  /** Front matter, all typed by the author. */
  subtitle?: string;
  author?: string;
  dedication?: string;
}

/** Vector: ink · cut · glow · wash. Canvas: dither · halftone · ascii · glass · engrave · stipple · riso · flow.
 *  orn: typographic ornaments only. none: no pictures. */
export type Style = "ink" | "cut" | "glow" | "wash" | "dither" | "halftone" | "ascii" | "glass" | "engrave" | "stipple" | "riso" | "flow" | "orn" | "none";
export type Size = "s" | "m" | "l";
export type Density = "few" | "some" | "many";
export type Layout = "scroll" | "cards" | "paged";
export type Light = "off" | "lamp" | "candle" | "focus" | "dawn";
export type Reveal = "none" | "rise" | "fade" | "ink";
export type Para = "book" | "web";
export type Align = "ragged" | "justify";
export type Opening = "drop" | "raised" | "smallcaps" | "none";
export type Ornament = "asterism" | "dinkus" | "lotus" | "hedera" | "rule";
export type Trim = "a5" | "6x9" | "a4" | "letter";

export interface Settings {
  /** Pictures. */
  style: Style;
  size: Size;
  density: Density;
  motion: boolean;
  /** Colour. */
  theme: Theme;
  mode: Mode;
  /** Light. */
  light: Light;
  follow: boolean;
  flicker: boolean;
  /** Type. */
  pairing: Pairing;
  fontSize: number;
  measure: Measure;
  para: Para;
  align: Align;
  opening: Opening;
  numerals: Numerals;
  ornament: Ornament;
  /** Form. */
  layout: Layout;
  trim: Trim;
  reveal: Reveal;
  beats: boolean;
  /** Exported books show a small Reading drawer. */
  readerControls: boolean;
  /** The preset the look started from (for the Studio's gallery). */
  preset?: string;
  /** Settings schema revision; bumped when the shape or a default changes for everyone. */
  rev?: number;
}
