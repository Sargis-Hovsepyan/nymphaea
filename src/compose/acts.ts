// What happens in a picture, in order: who acts (a figure, the pair, a thing, the sky), what they do,
// toward what, and how. Read from the sentence by compose/clauses.ts, carried in the picture's id
// (four characters per act, see encodeActs), laid on a timeline (compose/timeline.ts) and played by
// compose/draw.ts. The vocabulary is closed: only what can be drawn well. Pure.
import type { Prop, Spec } from "./spec";

/** A figure's acts. The position in the list is the act's code in the id. */
export const FIG_KINDS = [
  "go", "run", "enter", "leave", "cross", "turn", "sit", "rise", "lie", "kneel", "fall", "jump", "bow",
  "handle", "open", "close", "light", "snuff", "knock", "take", "give", "put", "drop", "throw", "raise", "wave", "point",
  "look", "drink", "read", "work", "speak", "nod", "shake", "weep", "laugh",
] as const;
/** What two figures do together. */
export const PAIR_KINDS = ["hug", "kiss", "dance", "greet"] as const;
/** What a thing does on its own. */
export const THING_KINDS = ["open", "close", "arrive", "depart", "pass", "light", "die", "fall", "ring"] as const;
/** What the sky does. */
export const SKY_KINDS = ["sunrise", "sunset", "moonrise", "nightfall", "daybreak", "stars", "rain", "snow", "fog", "wind", "storm", "cloud", "flash"] as const;

export type FigKind = (typeof FIG_KINDS)[number];
export type PairKind = (typeof PAIR_KINDS)[number];
export type ThingKind = (typeof THING_KINDS)[number];
export type SkyKind = (typeof SKY_KINDS)[number];
export type ActKind = FigKind | PairKind | ThingKind | SkyKind;

/** Who acts: figures 0 to 2, all of them, the first two together, a thing (by its place in spec.props), the sky. */
export const ALL = 3, PAIR = 4, THING0 = 5, SKY = 9;
/** Toward what: nothing, a figure, a thing, off the frame ahead or behind, up, down, the light. */
export const TO_NONE = 0, TO_FIG0 = 1, TO_THING0 = 4, OFF_AHEAD = 8, OFF_BEHIND = 9, UP = 10, DOWN = 11, TO_LIGHT = 13;

export interface Act {
  by: number;
  kind: ActKind;
  to: number;
  /** 0 plain, 1 slowly, 2 suddenly. */
  manner: 0 | 1 | 2;
  /** Starts together with the act before it ("as", "while"). */
  with: boolean;
  /** Away from the target; for the weather, it stops. */
  away: boolean;
}

export const MAX_ACTS = 6;

export const isFig = (by: number): boolean => by >= 0 && by <= PAIR;
export const isThing = (by: number): boolean => by >= THING0 && by < SKY;
export const figOf = (to: number): number => (to >= TO_FIG0 && to < TO_THING0 ? to - TO_FIG0 : -1);
export const thingOf = (to: number): number => (to >= TO_THING0 && to < OFF_AHEAD ? to - TO_THING0 : -1);

function table(by: number): readonly string[] {
  return by === PAIR ? PAIR_KINDS : isThing(by) ? THING_KINDS : by === SKY ? SKY_KINDS : FIG_KINDS;
}

/** What each thing can do by itself. */
const CAN: Partial<Record<ThingKind, readonly Prop[]>> = {
  open: ["door", "gate", "window", "umbrella", "book", "letter", "suitcase"],
  close: ["door", "gate", "window", "umbrella", "book", "suitcase"],
  arrive: ["train", "car", "boat", "ship", "bird", "horse", "dog", "cat", "bicycle"],
  depart: ["train", "car", "boat", "ship", "bird", "horse", "dog", "cat", "bicycle"],
  pass: ["train", "car", "boat", "ship", "bird", "horse", "dog", "cat", "bicycle"],
  light: ["candle", "fire", "lamp", "cigarette"],
  die: ["candle", "fire", "lamp", "cigarette"],
  fall: ["cup", "glass", "letter", "book", "umbrella", "suitcase"],
  ring: ["clock", "tower"],
};
export const thingCan = (p: Prop, k: ThingKind): boolean => !!CAN[k]?.includes(p);
/** Things a figure's hand can act on, by act. */
const HANDS: Partial<Record<FigKind, readonly Prop[]>> = {
  open: CAN.open, close: CAN.close, light: CAN.light, snuff: CAN.die,
  take: ["cup", "glass", "letter", "book", "candle", "umbrella", "suitcase", "flower", "cigarette"],
  put: ["cup", "glass", "letter", "book", "candle", "umbrella", "suitcase", "flower", "cigarette"],
  drop: ["cup", "glass", "letter", "book", "candle", "umbrella", "suitcase", "flower", "cigarette"],
  throw: ["letter", "book", "cup", "glass", "flower", "cigarette"],
  raise: ["cup", "glass", "letter", "book", "candle", "umbrella", "lamp", "cigarette"],
  drink: ["cup", "glass"],
  read: ["letter", "book"],
};
export const handCan = (k: FigKind, p: Prop): boolean => !HANDS[k] || HANDS[k]!.includes(p);

/** Keep only acts this spec can draw: the actor exists, a thing can do it, a target is there. */
export function fitActs(s: Pick<Spec, "who" | "props">, acts: readonly Act[] | undefined): Act[] {
  const out: Act[] = [];
  for (const a of acts || []) {
    if (out.length >= MAX_ACTS) break;
    if (!table(a.by).includes(a.kind)) continue;
    if (a.by <= 2 && a.by >= s.who) continue;
    if ((a.by === ALL && s.who < 1) || (a.by === PAIR && s.who < 2)) continue;
    if (isThing(a.by)) { const p = s.props[a.by - THING0]; if (!p || !thingCan(p, a.kind as ThingKind)) continue; }
    let to = a.to;
    const fi = figOf(to), ti = thingOf(to);
    if ((fi >= 0 && (fi >= s.who || fi === a.by)) || (ti >= 0 && !s.props[ti]) || to > TO_LIGHT || to === 12) to = TO_NONE;
    if (a.by <= ALL && ti >= 0 && !handCan(a.kind as FigKind, s.props[ti])) to = TO_NONE;
    if (isThing(a.by) || a.by === SKY) to = to === OFF_AHEAD || to === OFF_BEHIND ? to : TO_NONE;
    out.push({ ...a, to });
  }
  return out;
}

/** Acts as the id part: four base-36 characters each (actor, kind, target, flags). */
export function encodeActs(acts: readonly Act[]): string {
  return acts.slice(0, MAX_ACTS).map((a) => a.by.toString(36) + table(a.by).indexOf(a.kind).toString(36) + a.to.toString(36) + (a.manner + (a.with ? 4 : 0) + (a.away ? 8 : 0)).toString(36)).join("");
}

/** Acts from the id part, or null if it is not well formed. */
export function decodeActs(s: string): Act[] | null {
  if (!/^(?:[0-9][0-9a-z][0-9a-d][0-9ab]){1,6}$/.test(s)) return null;
  const out: Act[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const by = parseInt(s[i], 36), k = parseInt(s[i + 1], 36), to = parseInt(s[i + 2], 36), fl = parseInt(s[i + 3], 36);
    const kind = table(by)[k];
    if (!kind || (fl & 3) === 3) return null;
    out.push({ by, kind: kind as ActKind, to, manner: (fl & 3) as Act["manner"], with: !!(fl & 4), away: !!(fl & 8) });
  }
  return out;
}

/** Thing slots after props change: an act on "the door" follows the door to its new place, or goes. */
export function remapActs(acts: readonly Act[] | undefined, from: readonly Prop[], to: readonly Prop[]): Act[] {
  const move = (slot: number) => { const p = from[slot]; return p ? to.indexOf(p) : -1; };
  const out: Act[] = [];
  for (const a of acts || []) {
    let by = a.by, t = a.to;
    if (isThing(by)) { const j = move(by - THING0); if (j < 0) continue; by = THING0 + j; }
    const ti = thingOf(t);
    if (ti >= 0) { const j = move(ti); t = j < 0 ? TO_NONE : TO_THING0 + j; }
    out.push({ ...a, by, to: t });
  }
  return out;
}

/* ---------------- words for acts (the Studio, screen readers, the image brief) ---------------- */

const THIRD: Record<string, string> = {
  go: "walks", run: "runs", enter: "comes in", leave: "leaves", cross: "crosses", turn: "turns", sit: "sits down", rise: "gets up",
  lie: "lies down", kneel: "kneels", fall: "falls", jump: "jumps", bow: "bows", handle: "touches", open: "opens", close: "closes",
  light: "lights", snuff: "puts out", knock: "knocks on", take: "takes", give: "gives", put: "puts down", drop: "drops", throw: "throws",
  raise: "raises", wave: "waves", point: "points at", look: "looks at", drink: "drinks", read: "reads", work: "works", speak: "speaks",
  nod: "nods", shake: "shakes their head", weep: "weeps", laugh: "laughs",
  hug: "embrace", kiss: "kiss", dance: "dance", greet: "greet each other",
};
const THING_WORDS: Record<ThingKind, [string, string]> = {
  open: ["opens", "opens"], close: ["closes", "slams"], arrive: ["arrives", "arrives"], depart: ["leaves", "leaves"], pass: ["passes", "passes"],
  light: ["catches", "flares up"], die: ["goes out", "goes out"], fall: ["falls", "falls"], ring: ["rings", "rings"],
};
const SKY_WORDS: Record<SkyKind, [string, string]> = {
  sunrise: ["the sun rises", "the sun rises"], sunset: ["the sun sets", "the sun sets"], moonrise: ["the moon rises", "the moon rises"],
  nightfall: ["night falls", "night falls"], daybreak: ["day breaks", "day breaks"], stars: ["the stars come out", "the stars come out"],
  rain: ["rain begins", "the rain stops"], snow: ["snow begins to fall", "the snow stops"], fog: ["fog rolls in", "the fog lifts"],
  wind: ["the wind rises", "the wind drops"], storm: ["a storm breaks", "the storm passes"], cloud: ["clouds gather", "the clouds part"],
  flash: ["lightning flashes", "lightning flashes"],
};
const THE: Partial<Record<Prop, string>> = { bird: "the birds", flower: "the flowers", rock: "the rocks", shelf: "the shelves", stairs: "the stairs", clock: "the clock", tower: "the bell" };
const theProp = (p: Prop | undefined) => (p ? THE[p] || "the " + p : "it");
/** "walks" to "walk", "crosses" to "cross", "goes" to "go". */
const plural = (w: string) => (w === "goes" ? "go" : /(sh|ch|ss|x)es$/.test(w) ? w.slice(0, -2) : w.endsWith("s") ? w.slice(0, -1) : w);

/** The acts in plain words: "the figure opens the door, then leaves". */
export function describeActs(s: Pick<Spec, "who" | "props" | "acts">): string {
  const acts = s.acts || [];
  const who = (i: number) => (s.who <= 1 ? "the figure" : ["the first figure", "the second figure", "the third figure"][i] || "a figure");
  const target = (a: Act): string => {
    const fi = figOf(a.to), ti = thingOf(a.to);
    if (fi >= 0) return who(fi);
    if (ti >= 0) return theProp(s.props[ti]);
    return a.to === UP ? "up" : a.to === DOWN ? "down" : "";
  };
  const one = (a: Act): string => {
    if (a.by === SKY) return SKY_WORDS[a.kind as SkyKind][a.away ? 1 : 0];
    if (isThing(a.by)) {
      const p = s.props[a.by - THING0], v = THING_WORDS[a.kind as ThingKind][a.manner === 2 ? 1 : 0];
      return theProp(p) + " " + (p === "bird" || p === "flower" ? v.replace(/^(\w+?)e?s\b/, (m) => plural(m)) : v);
    }
    const subj = a.by === PAIR ? "the two" : a.by === ALL ? (s.who > 1 ? "they all" : "the figure") : who(a.by);
    let v = THIRD[a.kind] || a.kind;
    // With a cigarette and nothing to drink from, the hand to the mouth is a draw on it.
    if (a.kind === "drink" && s.props.includes("cigarette") && !s.props.some((p) => p === "cup" || p === "glass")) v = "smokes";
    if (a.by === ALL && s.who > 1) v = v.replace(/^\w+/, plural);
    const t = target(a);
    const held = s.props.find((p) => ["letter", "cup", "glass", "book", "candle", "flower", "umbrella", "cigarette"].includes(p));
    if (a.kind === "give") return subj + " gives " + (held ? theProp(held) : "something") + (t ? " to " + t : "");
    if ((a.kind === "leave" || a.kind === "enter") && thingOf(a.to) >= 0) return subj + " " + v + " by " + t;
    const obj = t && !["sits down", "gets up", "lies down", "kneels", "falls", "jumps", "bows", "nods", "weeps", "laughs", "waves", "speaks"].includes(THIRD[a.kind] || "")
      ? (a.kind === "look" && (t === "up" || t === "down") ? "" : (a.away ? " away from " : ["go", "run"].includes(a.kind) ? " to " : " ") + t) : "";
    const look = a.kind === "look" && !obj ? (a.to === UP ? "looks up" : a.to === DOWN ? "looks down" : "looks round") : "";
    return subj + " " + (look || v + obj);
  };
  return acts.map((a, i) => (i ? (a.with ? " as " : ", then ") : "") + one(a)).join("");
}
