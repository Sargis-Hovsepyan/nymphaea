// The scene library and the keyword map used for automatic staging. Keywords are matched by stem
// (stage/stem.ts), so "walked" finds "walk"; with a document model they are weighted by TF-IDF.
import { isComposed } from "../compose/spec";
import { idf, isStop, stem, type DocModel } from "./stem";

export const SCENE_LIST = [
  "lamp", "pawn", "knight", "queen", "king", "door", "rain", "sea", "moon", "city", "forest", "candle", "road", "lotus",
  "window", "stairs", "letter", "train", "bird", "mountain", "house", "bridge", "field", "cup", "clock", "book",
] as const;
export type SceneId = (typeof SCENE_LIST)[number];

export const SCENE_DESC: Record<string, string> = {
  lamp: "a hanging lamp over a table",
  pawn: "a chess pawn stepping forward",
  knight: "a chess knight falling over",
  queen: "a chess queen striking with beams of light",
  king: "a chess king stepping back",
  door: "a figure walking into a lit doorway",
  rain: "rain on a window at night",
  sea: "waves under the moon",
  moon: "a moon rising over hills",
  city: "a city skyline with lit windows",
  forest: "tall trees in fog",
  candle: "a candle flame",
  road: "a road running to the horizon",
  lotus: "a water lily opening on dark water",
  window: "a window with a curtain stirring",
  stairs: "a figure climbing a staircase",
  letter: "a letter rising from its envelope",
  train: "a train crossing the night",
  bird: "a bird flying across the sky",
  mountain: "the sun rising behind mountains",
  house: "a house whose windows light up",
  bridge: "a bridge over still water",
  field: "grass moving in a field",
  cup: "a cup of something hot, steaming",
  clock: "a clock, its hands turning",
  book: "an open book, pages turning",
};

export const WORDS: Record<string, string> = {
  lamp: "lamp lamps light lights glow bulb shadow shadows table",
  pawn: "pawn pawns chess board e4 move moves opening",
  knight: "knight knights captured capture trapped",
  queen: "queen queens check attack strike",
  king: "king kings resign resigned surrender checkmate mate",
  door: "door doors doorway leave left walked exit threshold goodbye",
  rain: "rain raining storm wet umbrella grey thunder drizzle",
  sea: "sea ocean wave waves shore boat beach tide water",
  moon: "moon night stars star sky midnight",
  city: "city street streets building buildings architect architects blueprint blueprints tower town",
  forest: "tree trees forest woods leaves branch branches garden",
  candle: "candle candles fire flame flames burn burning fireplace",
  road: "road roads path journey walk walking alone travel car highway",
  lotus: "lotus lily lilies pond bloom blossom blossoms petal petals",
  window: "window windows curtain curtains glass pane sill",
  stairs: "stairs staircase stair steps climb climbed upstairs downstairs ladder landing",
  letter: "letter letters envelope wrote write writing note notes mail postcard",
  train: "train trains station platform rail railway carriage tracks",
  bird: "bird birds wing wings feather feathers flew fly flying sparrow crow gull",
  mountain: "mountain mountains hill hills peak summit cliff valley sunrise dawn",
  house: "house home houses roof kitchen hallway porch",
  bridge: "bridge bridges river crossing canal bank",
  field: "field fields grass meadow wheat harvest farm",
  cup: "cup cups coffee tea mug kettle cafe breakfast",
  clock: "clock clocks hour hours minute minutes waited waiting late time",
  book: "book books page pages read reading library story",
};

/** stem → scene */
export const KW: Record<string, string> = {};
Object.keys(WORDS).forEach((s) => WORDS[s].split(" ").forEach((w) => { const k = stem(w); if (!KW[k]) KW[k] = s; }));

export function isLibraryScene(s: unknown): s is SceneId {
  return typeof s === "string" && (SCENE_LIST as readonly string[]).includes(s);
}

/** A library scene id, or a well-formed composed scene ("gen:…"). */
export function isScene(s: unknown): s is string {
  return isLibraryScene(s) || isComposed(s);
}

export function words(t: string): string[] {
  return t.toLowerCase().match(/[a-z0-9’']+/g) || [];
}

/** Keyword score per scene. With a document model each hit is weighted by the stem's IDF. */
export function scoreOf(t: string, model: DocModel | null = null): Record<string, number> {
  const sc: Record<string, number> = {};
  words(t).forEach((w) => {
    if (isStop(w)) return;
    const k = stem(w), s = KW[k];
    if (s) sc[s] = (sc[s] || 0) + (model ? idf(model, k) : 1);
  });
  return sc;
}

export function bestScene(sc: Record<string, number>, avoid?: string | null): string | null {
  let best: string | null = null, bv = 0;
  Object.keys(sc).forEach((s) => {
    const v = sc[s] - (s === avoid ? 0.6 : 0);
    if (v > bv) { bv = v; best = s; }
  });
  return best;
}
