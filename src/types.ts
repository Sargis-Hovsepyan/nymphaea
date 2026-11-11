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
  /** An AI picture for this place (id of an image kept beside the book), drawn in the chosen style. */
  img?: string;
  /** The prompt that image was (or will be) made from. Never shown in the book. */
  prompt?: string;
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
  /** Exported books only: the AI pictures their scenes use, by id, as data URLs. */
  images?: Record<string, string>;
}

/** Vector: ink · cut · glow · wash. Canvas: dither · halftone · ascii · glass · engrave · stipple · riso · flow.
 *  orn: typographic ornaments only. none: no pictures. */
export type Style = "ink" | "cut" | "glow" | "wash" | "dither" | "halftone" | "ascii" | "glass" | "engrave" | "stipple" | "riso" | "flow" | "orn" | "none";
/** full: a plate as wide as the page allows, breaking the text measure. */
export type Size = "s" | "m" | "l" | "full";
/** every: a picture at nearly every change of scene. */
export type Density = "few" | "some" | "many" | "every";
/** inline: in the text column. plate: a framed plate with generous space. margin: beside the text on wide screens. head: a chapter's first picture sits above its title. */
export type Frame = "inline" | "plate" | "margin" | "head";
export type Leading = "tight" | "normal" | "loose";
/** Page texture, drawn faintly behind the text. */
export type Paper = "none" | "grain" | "laid" | "linen";
export type ChapterStyle = "classic" | "numeral" | "minimal" | "ornament";
/** time: time left in the bar. bar: the line only. none: neither. */
export type Progress = "time" | "bar" | "none";
export type CoverStyle = "picture" | "type" | "minimal";
/** Where automatic pictures come from: the drawn library, scenes composed from the text, or the better of the two. */
export type Art = "library" | "mixed" | "composed";
export type Layout = "scroll" | "cards" | "paged";
export type Light = "off" | "lamp" | "candle" | "focus" | "story";
/** Cue marks the caption's words in the text; caption prints them under the picture. */
export type Captions = "cue" | "caption" | "both" | "none";
/** A reader's choice: pictures animate, hold still, or are left out. */
export type Pictures = "on" | "still" | "off";
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
  frame: Frame;
  art: Art;
  motion: boolean;
  captions: Captions;
  /** Reader's own choice (the Reading drawer). */
  pictures: Pictures;
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
  leading: Leading;
  hyphens: boolean;
  paper: Paper;
  chapterStyle: ChapterStyle;
  cover: CoverStyle;
  progress: Progress;
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
