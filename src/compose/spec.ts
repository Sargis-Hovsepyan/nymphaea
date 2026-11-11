// A composed scene, described as data: where it happens, when, under what sky and season, which
// things are in it, who is there and what they are doing, how near the camera stands, and the
// passage's mood. A spec is read from the text (compose/read.ts), laid out (compose/layout.ts),
// drawn as a vector scene (compose/draw.ts) and turned into an image prompt (ai/prompt.ts).
//
// It travels inside a SceneRef as a compact id, so a composed picture is stored, guarded, exported
// and rendered exactly like a library scene. Pure.
//
//   gen:<place>.<time>.<sky>.<props>.<who><pose>.<cast>.<shot><season>.<mood>.<seed>.<moment>[.<motion>]
//   e.g. gen:city.night.rain.lamp+car.1w.k.fx.13.k3f.a0
//   The motion part (a bit mask in base 36, see FX) is written only when the text named a motion,
//   so every id made before it existed is still the same id. A twelfth part holds what happens, in
//   order (compose/acts.ts, four characters per act); when it is there the motion part is always
//   written, "0" for none, so the parts never read ambiguously.
//
import { describeActs, decodeActs, encodeActs, fitActs, remapActs, type Act } from "./acts";

// The older seven part form (gen:<place>.<time>.<sky>.<props>.<who>[w].<mood>.<seed>) still decodes.

export const PLACES = [
  "room", "kitchen", "bedroom", "study", "hall", "cafe", "church",
  "city", "station", "village", "garden", "road", "field", "hill", "forest", "mountain",
  "river", "lake", "sea", "shore", "harbour", "desert", "graveyard",
  "inner",
] as const;
export const TIMES = ["dawn", "day", "dusk", "night"] as const;
export const SKIES = ["clear", "cloud", "rain", "snow", "fog", "storm", "wind"] as const;
export const SEASONS = ["none", "spring", "summer", "autumn", "winter"] as const;
export const SHOTS = ["wide", "mid", "close"] as const;
export const POSES = ["stand", "walk", "run", "sit", "lie", "reach", "look", "pair"] as const;
export const PROPS = [
  "tree", "house", "lamp", "boat", "bird", "car", "tower", "fire", "table", "cup", "book", "candle",
  "door", "flower", "bench", "dog", "cat", "horse", "bridge", "window",
  "bed", "chair", "shelf", "clock", "mirror", "stairs", "piano", "letter", "glass", "umbrella",
  "suitcase", "bicycle", "train", "ship", "fence", "gate", "well", "grave", "rock", "tent", "cigarette",
] as const;

/** Motion the passage names, acted out on top of the scene: things falling, smoke rising, birds
 *  taking off, light flickering, lights coming on, waves breaking, a shooting star, wind in things. */
export const FX = ["fall", "rise", "fly", "flicker", "glow", "swell", "star", "sway"] as const;
export type Fx = (typeof FX)[number];

export type Place = (typeof PLACES)[number];
export type Time = (typeof TIMES)[number];
export type Sky = (typeof SKIES)[number];
export type Season = (typeof SEASONS)[number];
export type Shot = (typeof SHOTS)[number];
export type Pose = (typeof POSES)[number];
export type Prop = (typeof PROPS)[number];

export interface Spec {
  place: Place;
  time: Time;
  sky: Sky;
  season: Season;
  /** At most four, in order of how strongly the text names them. The first is the focus of a close shot. */
  props: Prop[];
  /** Figures: 0 none, 1 one, 2 two, 3 a few. */
  who: number;
  /** What the figures are doing. */
  pose: Pose;
  /** One build per figure (0–35: stature, garment, head), so a named person keeps their silhouette. */
  cast: number[];
  /** How near the camera stands. */
  shot: Shot;
  /** Mood: valence −1 dark … 1 bright, arousal 0 still … 1 stirring. */
  v: number;
  a: number;
  /** The layout of the place (0–46655): the same place in the same chapter keeps it. "Vary" changes it. */
  seed: number;
  /** The moment inside that place (0–1295): clouds, figures, small things. "Shuffle" changes it. */
  moment: number;
  /** What moves, read from the verbs and nouns of the passage. Optional: older specs have none. */
  fx?: Fx[];
  /** What happens, in order: read from the sentence, played by the picture. Optional: older specs have none. */
  acts?: Act[];
}

export const MAX_PROPS = 4;
export const GEN = "gen:";

export const INDOORS: readonly Place[] = ["room", "kitchen", "bedroom", "study", "hall", "cafe", "church"];
export const WATERS: readonly Place[] = ["sea", "shore", "harbour", "lake", "river"];
export const isIndoor = (p: Place): boolean => INDOORS.includes(p);
export const isWater = (p: Place): boolean => WATERS.includes(p);

/** Small things that need a surface to sit on (a table, a bench, a ledge). */
export const SMALL: readonly Prop[] = ["cup", "book", "candle", "letter", "glass", "cigarette"];
/** Things that only belong outside. */
export const OUTDOOR_ONLY: readonly Prop[] = ["tree", "house", "boat", "car", "tower", "horse", "bridge", "train", "ship", "fence", "gate", "well", "grave", "rock", "tent", "bicycle", "bird"];
/** Things that float. */
export const ON_WATER: readonly Prop[] = ["boat", "ship"];

const POSE_CH: Record<Pose, string> = { stand: "", walk: "w", run: "r", sit: "i", lie: "l", reach: "h", look: "u", pair: "p" };
const CH_POSE: Record<string, Pose> = Object.fromEntries(Object.entries(POSE_CH).map(([k, v]) => [v, k as Pose]));
const SHOT_CH: Record<Shot, string> = { wide: "f", mid: "m", close: "c" };
const CH_SHOT: Record<string, Shot> = { f: "wide", m: "mid", c: "close" };
const SEASON_CH: Record<Season, string> = { none: "x", spring: "p", summer: "s", autumn: "a", winter: "w" };
const CH_SEASON: Record<string, Season> = Object.fromEntries(Object.entries(SEASON_CH).map(([k, v]) => [v, k as Season]));

const q = (v: number, lo: number, hi: number, steps: number) => Math.round(((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (steps - 1));
const dq = (i: number, lo: number, hi: number, steps: number) => lo + (hi - lo) * i / (steps - 1);
const clampWho = (n: number) => Math.max(0, Math.min(3, n | 0));

export function encode(s: Spec): string {
  const props = s.props.slice(0, MAX_PROPS).join("+") || "-";
  const who = clampWho(s.who);
  const mood = String(q(s.v, -1, 1, 5)) + String(q(s.a, 0, 1, 3));
  const acts = fitActs({ who, props: s.props.slice(0, MAX_PROPS) }, s.acts);
  const cast = who ? Array.from({ length: who }, (_, i) => (((s.cast[i] ?? 0) % 36) + 36) % 36).map((b) => b.toString(36)).join("") : "-";
  return GEN + [
    s.place, s.time, s.sky, props, String(who) + (who ? POSE_CH[s.pose] || "" : ""), cast,
    SHOT_CH[s.shot] + SEASON_CH[s.season], mood,
    (Math.abs(s.seed | 0) % 46656).toString(36), (Math.abs(s.moment | 0) % 1296).toString(36),
    ...(fxMask(s.fx) || acts.length ? [fxMask(s.fx).toString(36)] : []),
    ...(acts.length ? [encodeActs(acts)] : []),
  ].join(".");
}

/** The motion list as a bit mask (0 when there is none). */
export function fxMask(fx: readonly Fx[] | undefined): number {
  return (fx || []).reduce((m, x) => { const i = FX.indexOf(x); return i < 0 ? m : m | (1 << i); }, 0);
}
const fxOf = (m: number): Fx[] => FX.filter((_, i) => m & (1 << i));

const isOf = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v);

/** A spec from its id, or null if the id is not a well-formed composed scene. */
export function decode(id: unknown): Spec | null {
  if (typeof id !== "string" || !id.startsWith(GEN) || id.length > 140) return null;
  const p = id.slice(GEN.length).split(".");
  if (p.length !== 7 && (p.length < 10 || p.length > 12)) return null;
  let fx: Fx[] | undefined, acts: Act[] | null = null;
  if (p.length === 12) { acts = decodeActs(p[11]); if (!acts) return null; p.length = 11; }
  if (p.length === 11) {
    const m = /^[0-9a-z]{1,2}$/.test(p[10]) ? parseInt(p[10], 36) : NaN;
    // With acts the mask may be 0 (no motion); without them a 0 would be a second spelling of no part at all.
    if (!(m >= (acts ? 0 : 1) && m < 1 << FX.length)) return null;
    if (m) fx = fxOf(m);
    p.length = 10;
  }
  const old = p.length === 7;
  const [place, time, sky, props, who] = p;
  const castS = old ? "-" : p[5], frame = old ? "fx" : p[6], mood = old ? p[5] : p[7], seed = old ? p[6] : p[8], moment = old ? p[6] : p[9];
  if (!isOf(PLACES, place) || !isOf(TIMES, time) || !isOf(SKIES, sky)) return null;
  const pr = props === "-" ? [] : props.split("+");
  if (pr.length > MAX_PROPS || !pr.every((x) => isOf(PROPS, x))) return null;
  const wm = /^([0-3])([wrilhup]?)$/.exec(who), mm = /^([0-4])([0-2])$/.exec(mood), fm = /^([fmc])([xpsaw])$/.exec(frame);
  if (!wm || !mm || !fm || !/^[0-9a-z]{1,3}$/.test(seed) || !/^[0-9a-z]{1,3}$/.test(moment)) return null;
  if (old && wm[2] && wm[2] !== "w") return null;
  const n = +wm[1];
  if (!/^(-|[0-9a-z]{1,3})$/.test(castS) || (castS !== "-" && castS.length !== n) || (castS === "-" && n > 0 && !old)) return null;
  const cast = castS === "-" ? Array.from({ length: n }, (_, i) => (parseInt(seed, 36) + i * 7) % 36) : castS.split("").map((c) => parseInt(c, 36));
  const propList = Array.from(new Set(pr)) as Prop[];
  const fitted = acts ? fitActs({ who: n, props: propList }, acts) : [];
  return {
    place, time, sky, season: CH_SEASON[fm[2]], props: propList,
    who: n, pose: n ? CH_POSE[wm[2]] || "stand" : "stand", cast, shot: CH_SHOT[fm[1]],
    v: dq(+mm[1], -1, 1, 5), a: dq(+mm[2], 0, 1, 3), seed: parseInt(seed, 36), moment: parseInt(moment, 36) % 1296,
    ...(fx ? { fx } : {}), ...(fitted.length ? { acts: fitted } : {}),
  };
}

export const isComposed = (id: unknown): boolean => decode(id) !== null;

/** Round-trip an id so equal specs always have equal ids. */
export function normalize(id: string): string | null { const s = decode(id); return s ? encode(s) : null; }

/** A plain spec with sensible defaults (the Studio's starting point). */
export function blank(seed = 0, over: Partial<Spec> = {}): Spec {
  return { place: "room", time: "night", sky: "clear", season: "none", props: [], who: 1, pose: "stand", cast: [seed % 36], shot: "wide", v: 0, a: 0.5, seed: seed % 46656, moment: seed % 1296, ...over };
}

/** Change how many figures there are, keeping the cast and pose consistent. */
export function withWho(s: Spec, who: number): Spec {
  const n = clampWho(who);
  const cast = Array.from({ length: n }, (_, i) => s.cast[i] ?? (s.seed + i * 7) % 36);
  const acts = fitActs({ who: n, props: s.props }, s.acts);
  return { ...s, who: n, cast, pose: n ? (s.pose === "pair" && n < 2 ? "stand" : s.pose) : "stand", ...(s.acts ? { acts } : {}) };
}

/** Change the things in a picture: acts on a thing follow it to its new place, or go with it. */
export function withProps(s: Spec, props: Prop[]): Spec {
  const next = Array.from(new Set(props)).slice(0, MAX_PROPS);
  return { ...s, props: next, ...(s.acts ? { acts: fitActs({ who: s.who, props: next }, remapActs(s.acts, s.props, next)) } : {}) };
}

/** A spec from loose data (an AI reply, a form): unknown values fall back, never throw. */
export function fromLoose(o: unknown, seed = 0): Spec | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>, str = (v: unknown) => (typeof v === "string" ? v.toLowerCase().trim() : "");
  const place = str(r.place), time = str(r.time), sky = str(r.sky ?? r.weather), season = str(r.season), shot = str(r.shot), pose = str(r.pose);
  if (!isOf(PLACES, place)) return null;
  const props = (Array.isArray(r.props) ? r.props : []).map(str).filter((x): x is Prop => isOf(PROPS, x));
  const who = clampWho(Math.round(Number(r.figures ?? r.who) || 0));
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const sd = Math.abs(num(r.seed, seed) | 0);
  const ps: Pose = isOf(POSES, pose) ? pose : r.walk === true ? "walk" : "stand";
  const fx = Array.from(new Set((Array.isArray(r.motion ?? r.fx) ? (r.motion ?? r.fx) as unknown[] : []).map(str).filter((x): x is Fx => isOf(FX, x))));
  const propList = Array.from(new Set(props)).slice(0, MAX_PROPS);
  const acts = looseActs(r.acts, propList);
  return withWho({
    place, time: isOf(TIMES, time) ? time : "day", sky: isOf(SKIES, sky) ? sky : "clear", season: isOf(SEASONS, season) ? season : "none",
    props: Array.from(new Set(props)).slice(0, MAX_PROPS), who, pose: ps, cast: [], shot: isOf(SHOTS, shot) ? shot : "wide",
    v: Math.max(-1, Math.min(1, num(r.v, 0))), a: Math.max(0, Math.min(1, num(r.a, 0.5))), seed: sd % 46656, moment: sd % 1296,
    ...(fx.length ? { fx } : {}), ...(acts.length ? { acts } : {}),
  }, Math.max(who, ...acts.filter((a) => a.by <= 2).map((a) => a.by + 1), acts.some((a) => a.by === 4) ? 2 : 0));
}

/** Acts from loose data: {who, do, to, how, with, away}. Unknown words drop the act, never throw. */
function looseActs(v: unknown, props: Prop[]): Act[] {
  if (!Array.isArray(v)) return [];
  const out: Act[] = [];
  for (const x of v.slice(0, 6)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>, s = (k: string) => (typeof o[k] === "string" ? (o[k] as string).toLowerCase().trim() : typeof o[k] === "number" ? String(o[k]) : "");
    const w = s("who"), d = s("do"), t = s("to");
    const by = /^[0-2]$/.test(w) ? +w : w === "all" ? 3 : w === "pair" ? 4 : w === "sky" ? 9 : props.indexOf(w as Prop) >= 0 ? 5 + props.indexOf(w as Prop) : -1;
    if (by < 0 || !d) continue;
    const to = /^[0-2]$/.test(t) ? 1 + +t : props.indexOf(t as Prop) >= 0 ? 4 + props.indexOf(t as Prop) : t === "up" ? 10 : t === "down" ? 11 : t === "off" ? 8 : 0;
    out.push({ by, kind: d as Act["kind"], to, manner: s("how") === "slow" ? 1 : s("how") === "sudden" ? 2 : 0, with: o.with === true, away: o.away === true });
  }
  return out;
}

const PLACE_WORDS: Record<Place, string> = {
  room: "a room", kitchen: "a kitchen", bedroom: "a bedroom", study: "a study lined with books", hall: "a hall with a staircase",
  cafe: "a café", church: "a church", city: "a city street", station: "a railway station", village: "a village",
  garden: "a garden", road: "a long road", field: "an open field", hill: "rolling hills", forest: "a forest",
  mountain: "the mountains", river: "a river", lake: "a lake", sea: "the sea", shore: "a beach", harbour: "a harbour",
  desert: "the desert", graveyard: "a graveyard", inner: "a quiet abstract space",
};
const TIME_WORDS: Record<Time, string> = { dawn: "at dawn", day: "by day", dusk: "at dusk", night: "at night" };
const SKY_WORDS: Record<Sky, string> = { clear: "", cloud: "under cloud", rain: "in the rain", snow: "in falling snow", fog: "in fog", storm: "in a storm", wind: "in the wind" };
const SEASON_WORDS: Record<Season, string> = { none: "", spring: "in spring", summer: "in summer", autumn: "in autumn", winter: "in winter" };
const SHOT_WORDS: Record<Shot, string> = { wide: "", mid: "a nearer view of ", close: "a close view of " };
const POSE_WORDS: Record<Pose, string> = { stand: "", walk: "walking", run: "running", sit: "sitting", lie: "lying down", reach: "reaching out", look: "looking up", pair: "close together" };
const PROP_WORDS: Record<Prop, string> = {
  tree: "a tree", house: "a house", lamp: "a lamp", boat: "a boat", bird: "birds", car: "a car", tower: "a tower", fire: "a fire",
  table: "a table", cup: "a cup", book: "a book", candle: "a candle", door: "a door", flower: "flowers", bench: "a bench",
  dog: "a dog", cat: "a cat", horse: "a horse", bridge: "a bridge", window: "a window",
  bed: "a bed", chair: "a chair", shelf: "shelves", clock: "a clock", mirror: "a mirror", stairs: "stairs", piano: "a piano",
  letter: "a letter", glass: "a glass", umbrella: "an umbrella", suitcase: "a suitcase", bicycle: "a bicycle", train: "a train",
  ship: "a ship", fence: "a fence", gate: "a gate", well: "a well", grave: "a grave", rock: "rocks", tent: "a tent", cigarette: "a cigarette",
};
const FX_WORDS: Record<Fx, string> = {
  fall: "things falling", rise: "smoke rising", fly: "birds taking flight", flicker: "flickering light", glow: "lights glowing",
  swell: "waves breaking", star: "a shooting star", sway: "everything moving in the wind",
};
const WHO_WORDS = ["", "a figure", "two figures", "a few figures"];

export function list(xs: string[]): string {
  const w = xs.filter(Boolean);
  return w.length <= 1 ? w.join("") : w.slice(0, -1).join(", ") + " and " + w[w.length - 1];
}

/** A plain description, used as the picture's accessible label and in the Studio. */
export function describe(s: Spec): string {
  if (s.place === "inner" && s.acts && s.acts.length) return "a bare stage" + (s.who ? ", with " + WHO_WORDS[s.who] : "") + (s.props.length ? (s.who ? " and " : ", with ") + list(s.props.map((p) => PROP_WORDS[p])) : "") + "; " + describeActs(s);
  if (s.place === "inner") return "a quiet pattern of lines, " + (s.v > 0.25 ? "rising" : s.v < -0.25 ? (s.a > 0.5 ? "pressed into layers" : "settling") : s.a < 0.45 ? "spreading in rings" : "drifting");
  const who = s.who ? WHO_WORDS[s.who] + (POSE_WORDS[s.pose] ? " " + POSE_WORDS[s.pose] : "") : "";
  const things = list([...s.props.map((p) => PROP_WORDS[p]), who]);
  const lead = s.shot === "close" && s.props.length ? SHOT_WORDS.close + PROP_WORDS[s.props[0]] + " in " : SHOT_WORDS[s.shot];
  const rest = s.shot === "close" && s.props.length ? list([...s.props.slice(1).map((p) => PROP_WORDS[p]), who]) : things;
  const motion = (s.fx || []).map((x) => x === "fall" ? (s.season === "autumn" ? "leaves falling" : s.season === "spring" ? "petals falling" : FX_WORDS.fall) : FX_WORDS[x]);
  const acts = s.acts && s.acts.length ? "; " + describeActs(s) : "";
  return lead + [PLACE_WORDS[s.place], TIME_WORDS[s.time], SKY_WORDS[s.sky], SEASON_WORDS[s.season]].filter(Boolean).join(" ") + (rest ? ", with " + rest : "") + (motion.length ? "; " + list(motion) : "") + acts;
}

export const LABEL = { fx: FX_WORDS, place: PLACE_WORDS, time: TIME_WORDS, sky: SKY_WORDS, prop: PROP_WORDS, season: SEASON_WORDS, pose: POSE_WORDS, shot: SHOT_WORDS };
