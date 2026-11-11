// Verbs, and the act each one plays. A verb is matched by its lemma (walked, walking, walks all
// give walk; ran gives run), which is used only here, on the one word in a clause that can be its
// verb: the nouns and places keep their exact-word lexicons in compose/read.ts. One verb can mean
// different acts for different subjects ("the candle went out", "she went out"), so each family
// has its own table. Pure.
import type { FigKind, PairKind, SkyKind, ThingKind } from "./acts";

/** Irregular past forms and participles, to their lemma. */
const IRREG: Record<string, string> = {
  ran: "run", went: "go", gone: "go", came: "come", sat: "sit", stood: "stand", rose: "rise", risen: "rise", lay: "lie", lain: "lie",
  knelt: "kneel", fell: "fall", fallen: "fall", took: "take", taken: "take", gave: "give", given: "give", put: "put", threw: "throw",
  thrown: "throw", drank: "drink", drunk: "drink", ate: "eat", eaten: "eat", read: "read", wrote: "write", written: "write", spoke: "speak",
  spoken: "speak", said: "say", told: "tell", wept: "weep", saw: "see", seen: "see", caught: "catch", held: "hold", led: "lead",
  left: "leave", fled: "flee", flew: "fly", flown: "fly", drove: "drive", driven: "drive", rode: "ride", ridden: "ride", swam: "swim",
  shook: "shake", shaken: "shake", struck: "strike", rang: "ring", rung: "ring", lit: "light", lighted: "light", blew: "blow", blown: "blow",
  broke: "break", broken: "break", began: "begin", begun: "begin", got: "get", gotten: "get", bent: "bend", leapt: "leap", leaped: "leap",
  sprang: "spring", sprung: "spring", stole: "steal", crept: "creep", swept: "sweep", slept: "sleep", felt: "feel", brought: "bring",
  bought: "buy", found: "find", sank: "sink", sunk: "sink", slid: "slide", hung: "hang", swung: "swing", flung: "fling", dug: "dig",
  bore: "bear", tore: "tear", wore: "wear", woke: "wake", awoke: "wake", strode: "stride", hid: "hide", shot: "shoot", sped: "speed",
  dealt: "deal", meant: "mean", met: "meet", sent: "send", spent: "spend", lent: "lend", built: "build", burnt: "burn", dreamt: "dream",
  heard: "hear", kept: "keep", knew: "know", made: "make", paid: "pay", sold: "sell", sought: "seek", taught: "teach", thought: "think",
  understood: "understand", withdrew: "withdraw", forgot: "forget", grew: "grow", drew: "draw", drawn: "draw", let: "let", set: "set",
  shut: "shut", cut: "cut", hit: "hit", quit: "quit", spread: "spread", burst: "burst", cast: "cast", shone: "shine", stuck: "stick",
  clung: "cling", wound: "wind", fought: "fight", climbed: "climb", poured: "pour", danced: "dance", waved: "wave", bowed: "bow",
};

/** Lemmas a suffix rule would get wrong, or forms that are not verbs here. */
const NOT_VERB = new Set(["is", "was", "were", "has", "had", "this", "his", "hers", "its", "us", "yes", "bus", "gas", "less", "glass", "grass", "dress", "kiss", "news", "always", "perhaps", "nothing", "something", "evening", "morning", "ceiling", "building", "being", "thing", "king", "ring", "spring", "string", "wing", "darling", "during", "bed", "red", "shed", "need"]);

/**
 * The lemma of a word that may be a verb: irregulars from the table, then walks/walked/walking,
 * stopped/stopping, carried/carries, danced/dancing. A guess for any regular verb, checked against
 * the tables below, so a wrong guess simply finds nothing.
 */
export function lemma(w: string): string[] {
  const out = [w];
  if (IRREG[w]) out.unshift(IRREG[w]);
  if (NOT_VERB.has(w) || w.length < 4) return out;
  const add = (x: string) => { if (x.length >= 2 && !out.includes(x)) out.push(x); };
  if (w.endsWith("ies")) add(w.slice(0, -3) + "y");
  if (w.endsWith("ied")) add(w.slice(0, -3) + "y");
  if (w.endsWith("es")) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  else if (w.endsWith("s") && !w.endsWith("ss")) add(w.slice(0, -1));
  for (const suf of ["ed", "ing"]) {
    if (!w.endsWith(suf)) continue;
    const b = w.slice(0, -suf.length);
    add(b); add(b + "e");
    if (b.length > 2 && b[b.length - 1] === b[b.length - 2]) add(b.slice(0, -1));
  }
  return out;
}

/** A table written as "kind: verb verb verb; kind: ...". */
function parse<K extends string>(src: string): Map<string, K> {
  const m = new Map<string, K>();
  src.split(";").forEach((part) => {
    const [k, list] = part.split(":");
    if (!list) return;
    list.trim().split(/\s+/).forEach((v) => { if (!m.has(v)) m.set(v, k.trim() as K); });
  });
  return m;
}

/** A person's verbs, by the act they play. Two-word verbs come first in the reading (see PHRASAL). */
export const FIG_VERBS = parse<FigKind>(`
  go: walk stroll wander amble stride march trudge pace stalk saunter tramp hike limp stagger shuffle tiptoe trek roam follow approach advance proceed head return go come move step travel continue drift plod creep sneak edge;
  run: run race rush hurry dash sprint bolt flee chase gallop scurry scramble charge tear dart hasten scamper jog;
  enter: enter;
  leave: leave depart exit;
  cross: cross;
  turn: turn spin whirl pivot swivel;
  sit: sit perch settle slump;
  rise: rise stand straighten;
  lie: lie recline sprawl stretch;
  kneel: kneel crouch squat stoop;
  fall: fall collapse stumble trip tumble slip faint;
  jump: jump leap hop vault bound skip spring;
  bow: bow curtsy curtsey;
  handle: touch push pull press tug stroke pat rub brush pour stir shove wipe tap grip clutch;
  open: open unlock unfold unlatch unbolt;
  close: close shut slam lock latch fasten;
  light: light kindle ignite strike;
  snuff: snuff extinguish douse quench;
  knock: knock rap bang hammer pound;
  take: take grab seize snatch pick gather collect fetch catch accept receive;
  give: give hand offer pass deliver present return;
  put: put place set lay;
  drop: drop;
  throw: throw toss hurl fling cast;
  raise: raise lift hoist;
  wave: wave beckon signal;
  point: point gesture indicate;
  look: look gaze stare watch glance peer peek glare observe study regard squint;
  drink: drink sip gulp swallow eat taste bite chew sup;
  read: read browse;
  work: write sew knit paint draw dig row paddle play sweep scrub cook chop hammer type scribble sketch plant pull;
  speak: speak say talk shout call whisper murmur reply answer ask tell sing yell scream sigh mutter announce explain argue plead pray;
  nod: nod agree;
  shake: shake;
  weep: weep sob cry mourn grieve;
  laugh: laugh giggle chuckle grin smile beam;
`);

/** Two figures together, when the subject is two people or "they". */
export const PAIR_VERBS = parse<PairKind>(`
  hug: hug embrace hold cling cuddle;
  kiss: kiss;
  dance: dance waltz twirl;
  greet: greet meet shake;
`);

/** A thing's own verbs. */
export const THING_VERBS = parse<ThingKind>(`
  open: open swing creak yawn;
  close: close shut slam bang;
  arrive: arrive come pull draw roll approach appear land settle alight return dock;
  depart: leave depart go pull set sail drive fly vanish disappear recede escape;
  pass: pass cross rumble roar rattle speed race glide sweep drift float;
  light: catch flare blaze kindle burn glow brighten;
  die: die fade dim;
  fall: fall drop slip tumble topple crash shatter smash spill;
  ring: ring chime strike toll peal sound;
`);

/** The sky's verbs, keyed by what the subject names (sun, rain…). A missing entry means the noun alone says it. */
export const SKY_VERBS: Record<string, Record<string, SkyKind | `${SkyKind}!`>> = {
  sun: { rise: "sunrise", come: "cloud!", break: "cloud!", climb: "sunrise", appear: "sunrise", set: "sunset", sink: "sunset", go: "sunset", dip: "sunset", slip: "sunset", fade: "sunset" },
  moon: { rise: "moonrise", come: "moonrise", appear: "moonrise", climb: "moonrise", emerge: "moonrise" },
  night: { fall: "nightfall", come: "nightfall", descend: "nightfall", close: "nightfall", settle: "nightfall", deepen: "nightfall" },
  dark: { fall: "nightfall", come: "nightfall", descend: "nightfall", settle: "nightfall", gather: "nightfall" },
  darkness: { fall: "nightfall", come: "nightfall", descend: "nightfall", settle: "nightfall", gather: "nightfall" },
  dusk: { fall: "nightfall", come: "nightfall", gather: "nightfall", settle: "nightfall" },
  dawn: { break: "daybreak", come: "daybreak", rise: "daybreak", arrive: "daybreak", creep: "daybreak" },
  day: { break: "daybreak", dawn: "daybreak" },
  morning: { come: "daybreak", break: "daybreak", arrive: "daybreak" },
  star: { come: "stars", appear: "stars", emerge: "stars", prick: "stars", shine: "stars" },
  rain: { begin: "rain", start: "rain", fall: "rain", come: "rain", pour: "rain", pound: "rain", lash: "rain", drum: "rain", beat: "rain", stop: "rain!", cease: "rain!", ease: "rain!", let: "rain!", die: "rain!", end: "rain!" },
  snow: { begin: "snow", start: "snow", fall: "snow", come: "snow", drift: "snow", stop: "snow!", cease: "snow!", end: "snow!" },
  fog: { roll: "fog", come: "fog", creep: "fog", settle: "fog", descend: "fog", gather: "fog", thicken: "fog", lift: "fog!", clear: "fog!", thin: "fog!", burn: "fog!", melt: "fog!" },
  mist: { roll: "fog", come: "fog", creep: "fog", rise: "fog", settle: "fog", gather: "fog", lift: "fog!", clear: "fog!", thin: "fog!" },
  wind: { rise: "wind", pick: "wind", blow: "wind", howl: "wind", gust: "wind", come: "wind", stir: "wind", whip: "wind", die: "wind!", drop: "wind!", fall: "wind!", ease: "wind!", stop: "wind!", calm: "wind!" },
  breeze: { rise: "wind", pick: "wind", blow: "wind", stir: "wind", come: "wind", die: "wind!", drop: "wind!" },
  storm: { break: "storm", come: "storm", rage: "storm", gather: "storm", hit: "storm", roll: "storm", pass: "storm!", end: "storm!", blow: "storm!", die: "storm!" },
  cloud: { gather: "cloud", roll: "cloud", come: "cloud", cover: "cloud", mass: "cloud", build: "cloud", part: "cloud!", clear: "cloud!", break: "cloud!", lift: "cloud!", drift: "cloud!" },
  lightning: { flash: "flash", strike: "flash", split: "flash", crack: "flash", fork: "flash", light: "flash" },
  thunder: { roll: "flash", crack: "flash", boom: "flash", rumble: "flash", crash: "flash", clap: "flash" },
};

/** "It began to rain", "it snowed", "it was raining": the weather with no noun subject. */
export const IT_WEATHER: Record<string, SkyKind> = { rain: "rain", snow: "snow", pour: "rain", drizzle: "rain", thunder: "flash", storm: "storm" };

/**
 * Two-word verbs, read before the verb alone. Each maps to an act per family; the particle can be
 * a word or two after the verb ("she put the cup down" is read as put down only next to the verb).
 */
export const PHRASAL: Record<string, { fig?: FigKind; thing?: ThingKind; to?: "up" | "down" | "ahead" | "behind"; away?: boolean }> = {
  "sit down": { fig: "sit" }, "sit up": { fig: "rise" }, "stand up": { fig: "rise" }, "get up": { fig: "rise" }, "rise up": { fig: "rise" },
  "lie down": { fig: "lie" }, "lay down": { fig: "lie" }, "get down": { fig: "kneel" }, "bend down": { fig: "kneel" }, "kneel down": { fig: "kneel" },
  "fall down": { fig: "fall" }, "fall over": { fig: "fall" }, "go out": { fig: "leave", thing: "die" }, "go in": { fig: "enter" },
  "go inside": { fig: "enter" }, "go outside": { fig: "leave" }, "come in": { fig: "enter", thing: "arrive" }, "come inside": { fig: "enter" },
  "come out": { fig: "enter", thing: "arrive" }, "come back": { fig: "enter", thing: "arrive" }, "walk in": { fig: "enter" }, "walk out": { fig: "leave" },
  "walk away": { fig: "go", away: true }, "run away": { fig: "run", away: true }, "run off": { fig: "run", to: "ahead" }, "run out": { fig: "leave" },
  "go away": { fig: "go", away: true }, "turn away": { fig: "turn", away: true }, "turn around": { fig: "turn" }, "turn round": { fig: "turn" },
  "turn back": { fig: "turn" }, "set off": { fig: "go", thing: "depart", to: "ahead" }, "set out": { fig: "go", thing: "depart", to: "ahead" },
  "move away": { fig: "go", thing: "depart", away: true }, "move off": { fig: "go", thing: "depart" },
  "pull in": { thing: "arrive" }, "pull into": { thing: "arrive" }, "pull up": { thing: "arrive" }, "draw in": { thing: "arrive" }, "draw up": { thing: "arrive" },
  "pull out": { thing: "depart" }, "pull away": { thing: "depart" }, "drive off": { fig: "leave", thing: "depart" }, "drive away": { fig: "leave", thing: "depart" },
  "fly off": { thing: "depart" }, "fly away": { thing: "depart" }, "fly up": { thing: "depart" }, "take off": { thing: "depart" }, "take flight": { thing: "depart" },
  "go by": { thing: "pass" }, "go past": { thing: "pass" }, "rush past": { thing: "pass" }, "roll by": { thing: "pass" }, "rush by": { thing: "pass" },
  "blow out": { fig: "snuff", thing: "die" }, "put out": { fig: "snuff", thing: "die" }, "go dark": { thing: "die" }, "die out": { thing: "die" },
  "die down": { thing: "die" }, "burn out": { thing: "die" }, "flicker out": { thing: "die" }, "sputter out": { thing: "die" }, "gutter out": { thing: "die" },
  "come on": { thing: "light" }, "flare up": { thing: "light" }, "blaze up": { thing: "light" }, "catch fire": { thing: "light" }, "burst open": { thing: "open" },
  "swing open": { thing: "open" }, "fly open": { thing: "open" }, "creak open": { thing: "open" }, "swing shut": { thing: "close" }, "slam shut": { thing: "close" },
  "bang shut": { thing: "close" }, "click shut": { thing: "close" }, "pick up": { fig: "take" }, "put down": { fig: "put" }, "set down": { fig: "put" },
  "hand over": { fig: "give" }, "hold up": { fig: "raise" }, "hold out": { fig: "give" }, "reach out": { fig: "handle" },
  "reach for": { fig: "take" }, "look up": { fig: "look", to: "up" }, "look down": { fig: "look", to: "down" }, "look out": { fig: "look" },
  "look back": { fig: "turn" }, "look round": { fig: "look" }, "look around": { fig: "look" }, "climb up": { fig: "go", to: "up" },
  "climb down": { fig: "go", to: "down" }, "burst into": { fig: "weep" }, "break down": { fig: "weep" }, "shake hands": { fig: "speak" },
  "wave goodbye": { fig: "wave" },
};
export const PARTICLES = new Set(["down", "up", "out", "in", "into", "inside", "outside", "off", "away", "around", "round", "back", "over", "by", "past", "on", "open", "shut", "fire", "flight", "dark", "for", "hands", "goodbye"]);

/** Idioms that look like acts but are not ("fell in love", "gave up"): the verb and the next word. */
export const IDIOM = new Set([
  "fall love", "fall asleep", "fall silent", "fall ill", "fall apart", "give up", "give way", "give in", "take place", "take care", "take part",
  "take time", "run out", "run into", "go on", "go wrong", "come true", "come across", "make sure", "turn out", "turn into", "look like",
  "look forward", "break heart", "hold breath", "hold back", "take breath", "take deep", "drop out", "light up", "set eyes", "pass away",
  "lose heart", "shake off", "point out", "stand still", "come clean", "read mind", "read between", "keep up", "open up", "close down",
]);

/** Adverbs of manner. */
export const SLOW = new Set(["slowly", "gently", "softly", "quietly", "carefully", "lazily", "wearily", "calmly", "gradually", "leisurely", "silently", "tenderly", "cautiously", "steadily", "unhurriedly"]);
export const SUDDEN = new Set(["suddenly", "quickly", "abruptly", "hurriedly", "swiftly", "sharply", "violently", "fast", "rapidly", "instantly", "hastily", "briskly", "fiercely", "urgently"]);
