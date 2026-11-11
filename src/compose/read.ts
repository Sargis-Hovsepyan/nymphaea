// Reading a scene out of any passage, with no AI: small lexicons score where (place), when (time),
// what sky and season, which things, who and what they do, and a tracker carries the setting
// forward through a chapter, so a paragraph that says only "She walked on" still happens in the
// city at night that the chapter set up. Words match exactly or as plurals, never by stem: a
// stemmer would read "pinned" as "pine" and "evening" as "even". A word after "no", "not" or
// "without" does not count ("there was no moon" is not a moonlit scene). Recurring names become a
// cast, so the same person keeps the same silhouette. Deterministic and pure.
import { isBreak } from "../inline";
import type { Block } from "../types";
import { hash, moodOf } from "../stage/mood";
import { stem, tokens } from "../stage/stem";
import { MAX_PROPS, PLACES, POSES, PROPS, SEASONS, SKIES, TIMES, isIndoor, type Place, type Pose, type Prop, type Season, type Shot, type Sky, type Spec, type Time } from "./spec";

const PLACE_LEX: Record<Place, string> = {
  room: "room rooms wall walls ceiling floor sofa couch apartment flat inside indoors curtain curtains attic cellar parlour parlor lounge",
  kitchen: "kitchen kitchens stove oven sink cupboard pantry kettle",
  bedroom: "bedroom bedrooms bed beds pillow pillows sheets blanket blankets mattress",
  study: "study library desk office bookshelf bookshelves bookcase",
  hall: "hall hallway corridor stairs staircase landing upstairs downstairs foyer entrance banister",
  cafe: "cafe café cafes bar bars restaurant restaurants diner pub tavern inn waiter waitress counter",
  church: "church churches chapel cathedral altar pew pews nave priest choir",
  city: "city cities street streets avenue building buildings traffic taxi taxis subway metro downtown skyline neon sidewalk pavement alley alleys block blocks crosswalk tram bus",
  station: "station stations platform platforms railway train trains tracks carriage carriages ticket",
  village: "village villages town towns cottage cottages hamlet marketplace square",
  garden: "garden gardens hedge hedges fountain lawn greenhouse vine vines orchard",
  road: "road roads highway path paths journey drive drove driving travel travelled traveled miles horizon track motorway",
  field: "field fields meadow meadows grass wheat farm farms pasture hay barn harvest prairie plain plains crop crops",
  hill: "hill hills hillside hilltop slope slopes moor moors heath downs",
  forest: "forest forests woodland wood woods tree trees pine pines oak oaks branch branches moss undergrowth clearing grove trail fern ferns thicket",
  mountain: "mountain mountains peak peaks summit cliff cliffs ridge valley crag glacier pass",
  river: "river rivers stream streams creek brook bank banks canal ferry current",
  lake: "lake lakes pond ponds loch reeds",
  sea: "sea seas ocean oceans wave waves tide tides ship ships sail sails sailor deck gull gulls bay surf",
  shore: "shore shores beach beaches sand coast coastline dune dunes shingle",
  harbour: "harbour harbor harbours harbors port quay dock docks pier wharf",
  desert: "desert deserts sands camel camels oasis dust dusty arid caravan",
  graveyard: "graveyard graveyards cemetery cemeteries grave graves tomb tombs tombstone headstone churchyard funeral burial",
  inner: "",
};
const TIME_LEX: Record<Time, string> = {
  dawn: "dawn sunrise daybreak morning mornings",
  day: "noon afternoon daylight sunlight sunny midday sun",
  dusk: "dusk sunset evening evenings twilight gloaming",
  night: "night nights tonight midnight dark darkness moon moonlight stars star starlight nocturnal",
};
const SKY_LEX: Record<Exclude<Sky, "clear">, string> = {
  cloud: "cloud clouds cloudy overcast grey gray",
  rain: "rain raining rained rains drizzle downpour wet umbrella puddle puddles soaked",
  snow: "snow snowing snowed snowflake snowflakes blizzard sleet",
  fog: "fog foggy mist misty haze hazy",
  storm: "storm storms thunder lightning tempest gale",
  wind: "wind windy breeze gust gusts blew blowing",
};
const SEASON_LEX: Record<Exclude<Season, "none">, string> = {
  spring: "spring blossom blossoms april bud buds",
  summer: "summer july august heatwave",
  autumn: "autumn october november harvest",
  winter: "winter december january february frost frozen ice icy snow",
};
const PROP_LEX: Record<Prop, string> = {
  tree: "tree trees oak pine willow birch",
  house: "house houses home cottage roof porch",
  lamp: "lamp lamps lantern lamppost streetlight bulb",
  boat: "boat boats sail canoe rowboat yacht ferry",
  bird: "bird birds wing wings feather crow crows gull gulls sparrow owl swallow flock",
  car: "car cars taxi truck engine headlights drove driving",
  tower: "tower towers lighthouse steeple spire belfry castle",
  fire: "fire fires campfire bonfire blaze embers hearth fireplace",
  table: "table tables",
  cup: "cup cups coffee tea mug kettle teapot",
  book: "book books page pages notebook diary novel",
  candle: "candle candles candlelight wick",
  door: "door doors doorway threshold",
  flower: "flower flowers rose roses lily lilies bloom blossom petal petals tulip",
  bench: "bench benches",
  dog: "dog dogs puppy hound",
  cat: "cat cats kitten",
  horse: "horse horses pony mare stallion rode riding saddle",
  bridge: "bridge bridges",
  window: "window windows pane sill",
  bed: "bed beds pillow mattress",
  chair: "chair chairs armchair stool",
  shelf: "shelf shelves bookshelf bookcase",
  clock: "clock clocks ticking",
  mirror: "mirror mirrors reflection",
  stairs: "stairs staircase banister",
  piano: "piano pianos",
  letter: "letter letters envelope envelopes",
  glass: "wineglass glasses wine whisky whiskey",
  umbrella: "umbrella umbrellas",
  suitcase: "suitcase suitcases luggage bag bags trunk",
  bicycle: "bicycle bicycles bike bikes",
  train: "train trains locomotive carriage",
  ship: "ship ships steamer liner",
  fence: "fence fences railing railings",
  gate: "gate gates",
  well: "wells",
  grave: "grave graves tombstone headstone",
  rock: "rock rocks stone stones boulder boulders",
  tent: "tent tents camp",
};
const ONE = "i me my he him his she her man woman girl boy father mother child old stranger friend son daughter husband wife king queen";
const TWO = "we us our both two together couple pair each";
const MANY = "they them crowd people everyone family children friends soldiers villagers guests strangers";
const POSE_LEX: Record<Exclude<Pose, "stand">, string> = {
  walk: "walk walked walking leave leaving arrived went stepped crossed wandered followed strode marched climbed",
  run: "ran run running fled hurried raced rushed sprinted chased",
  sit: "sat sit sitting seated",
  lie: "lay lying slept sleeping asleep",
  reach: "held hold holding reached reaching handed grabbed offered",
  look: "looked gazed stared watched glanced",
  pair: "embraced embrace hugged hug kissed kiss danced dance",
};
const CHILD = "child children boy girl kid kids baby son daughter little";
const ELDER = "old elderly grandmother grandfather grandma grandpa granny aged";
const NEG = new Set(["no", "not", "without", "never", "nor", "none"]);

const lex = (s: string) => new Set(s.split(" ").filter(Boolean));
/** A token is in a lexicon as written, or as the plural of a word in it. */
function hit(L: Set<string> | undefined, w: string): boolean {
  if (!L || !L.size) return false;
  return L.has(w) || (w.length > 3 && w.endsWith("es") && L.has(w.slice(0, -2))) || (w.length > 2 && w.endsWith("s") && L.has(w.slice(0, -1)));
}
const toLex = <K extends string>(m: Record<K, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, lex(v as string)])) as Record<K, Set<string>>;
const P_LEX = toLex(PLACE_LEX), T_LEX = toLex(TIME_LEX), S_LEX = toLex(SKY_LEX), R_LEX = toLex(PROP_LEX), SE_LEX = toLex(SEASON_LEX), PO_LEX = toLex(POSE_LEX);
const ONE_L = lex(ONE), TWO_L = lex(TWO), MANY_L = lex(MANY), CHILD_L = lex(CHILD), ELDER_L = lex(ELDER);

/** Stems that name a spec's place, sky and things (to pick a caption that names them). */
export function specStems(s: Spec): Set<string> {
  const out = new Set<string>();
  const add = (L: Set<string> | undefined) => L && L.forEach((x) => out.add(stem(x)));
  add(P_LEX[s.place]); add(T_LEX[s.time]);
  if (s.sky !== "clear") add(S_LEX[s.sky]);
  s.props.forEach((p) => add(R_LEX[p]));
  return out;
}

/** Raw evidence in one passage: a score per place, time, sky, season, prop and pose, plus people. */
export interface Evidence {
  place: Partial<Record<Place, number>>;
  time: Partial<Record<Time, number>>;
  sky: Partial<Record<Sky, number>>;
  season: Partial<Record<Season, number>>;
  props: Partial<Record<Prop, number>>;
  pose: Partial<Record<Pose, number>>;
  one: number; two: number; many: number; child: number; elder: number;
  /** Spoken lines in the passage. */
  speech: number;
  /** Kept for older callers: any motion word. */
  walk: number;
}

export function evidence(text: string): Evidence {
  const e: Evidence = { place: {}, time: {}, sky: {}, season: {}, props: {}, pose: {}, one: 0, two: 0, many: 0, child: 0, elder: 0, speech: 0, walk: 0 };
  const add = <K extends string>(m: Partial<Record<K, number>>, k: K, v = 1) => { m[k] = (m[k] || 0) + v; };
  let neg = 0;
  tokens(text).forEach((raw) => {
    const s = raw.replace(/[’']s$/, "").replace(/[’']/g, "");
    if (NEG.has(s)) { neg = 3; return; }
    const off = neg > 0;
    if (neg > 0) neg--;
    if (ONE_L.has(s)) e.one++;
    if (TWO_L.has(s)) e.two++;
    if (MANY_L.has(s)) e.many++;
    if (CHILD_L.has(s)) e.child++;
    if (ELDER_L.has(s)) e.elder++;
    (Object.keys(PO_LEX) as Exclude<Pose, "stand">[]).forEach((k) => { if (PO_LEX[k].has(s)) { add(e.pose, k); if (k === "walk" || k === "run") e.walk++; } });
    if (off) return;
    PLACES.forEach((p) => { if (hit(P_LEX[p], s)) add(e.place, p); });
    TIMES.forEach((t) => { if (hit(T_LEX[t], s)) add(e.time, t); });
    (Object.keys(S_LEX) as Exclude<Sky, "clear">[]).forEach((k) => { if (hit(S_LEX[k], s)) add(e.sky, k); });
    (Object.keys(SE_LEX) as Exclude<Season, "none">[]).forEach((k) => { if (hit(SE_LEX[k], s)) add(e.season, k); });
    PROPS.forEach((p) => { if (hit(R_LEX[p], s)) add(e.props, p); });
  });
  e.speech = (text.match(/[“"][^”"]{2,}[”"]/g) || []).length;
  return e;
}

/** The words in a passage that named its scene, by kind, as written (for the Studio's "why this picture"). */
export interface Named { place: string[]; time: string[]; sky: string[]; season: string[]; props: string[]; pose: string[]; people: string[] }
export function namedWords(text: string): Named {
  const out: Named = { place: [], time: [], sky: [], season: [], props: [], pose: [], people: [] };
  const put = (k: keyof Named, w: string) => { if (!out[k].includes(w)) out[k].push(w); };
  let neg = 0;
  tokens(text).forEach((raw) => {
    const s = raw.replace(/[’']s$/, "").replace(/[’']/g, "");
    if (NEG.has(s)) { neg = 3; return; }
    const off = neg > 0;
    if (neg > 0) neg--;
    if (ONE_L.has(s) || TWO_L.has(s) || MANY_L.has(s) || CHILD_L.has(s) || ELDER_L.has(s)) put("people", raw);
    (Object.keys(PO_LEX) as Exclude<Pose, "stand">[]).forEach((k) => { if (PO_LEX[k].has(s)) put("pose", raw); });
    if (off) return;
    if (PLACES.some((p) => hit(P_LEX[p], s))) put("place", raw);
    if (TIMES.some((t) => hit(T_LEX[t], s))) put("time", raw);
    if ((Object.keys(S_LEX) as Exclude<Sky, "clear">[]).some((k) => hit(S_LEX[k], s))) put("sky", raw);
    if ((Object.keys(SE_LEX) as Exclude<Season, "none">[]).some((k) => hit(SE_LEX[k], s))) put("season", raw);
    if (PROPS.some((p) => hit(R_LEX[p], s))) put("props", raw);
  });
  return out;
}

/** How much the passage says about its own scene: 0 nothing, higher is more concrete. */
export function concreteness(e: Evidence): number {
  const sum = (m: Partial<Record<string, number>>) => Object.values(m).reduce((a: number, b) => a + (b || 0), 0);
  return sum(e.place) * 1.4 + sum(e.time) + sum(e.sky) + sum(e.props) * 0.8;
}

function argmax<K extends string>(m: Partial<Record<K, number>>, min = 0): K | null {
  let best: K | null = null, bv = min;
  (Object.keys(m) as K[]).forEach((k) => { const v = m[k] || 0; if (v > bv) { bv = v; best = k; } });
  return best;
}

/** Carried context: decayed scores from earlier paragraphs of the same chapter. */
export interface Context { place: Partial<Record<Place, number>>; time: Partial<Record<Time, number>>; sky: Partial<Record<Sky, number>>; season: Partial<Record<Season, number>> }
export const emptyContext = (): Context => ({ place: {}, time: {}, sky: {}, season: {} });

function fold<K extends string>(into: Partial<Record<K, number>>, add: Partial<Record<K, number>>, decay: number): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  (Object.keys(into) as K[]).forEach((k) => { const v = (into[k] || 0) * decay; if (v > 0.05) out[k] = v; });
  (Object.keys(add) as K[]).forEach((k) => { out[k] = (out[k] || 0) + (add[k] || 0); });
  return out;
}

/** Advance the context by one passage (its own evidence counts in full, the past fades). */
export function advance(ctx: Context, e: Evidence, decay = 0.72): Context {
  return { place: fold(ctx.place, e.place, decay), time: fold(ctx.time, e.time, decay), sky: fold(ctx.sky, e.sky, decay), season: fold(ctx.season, e.season, Math.max(decay, 0.92)) };
}

/** What the scene settled on so far in this chapter: it holds until the text moves it. */
export interface Held { place?: Place; time?: Time; season?: Season; chapter?: string }

/** A cast: recurring names, each mapped to a build (stature by the words around it, the rest by the name). */
export type Cast = Map<string, number>;

const NOT_NAMES = new Set(("The A An And But Or If Then So Of To In On At By For With From As Is Was Were It Its This That These Those There Here Not No "
  + "He She They We You I My His Her Their Our Your Me Him Them Us What When Where Why How Who Which After Before While Once Just Still Even "
  + "Yes Oh Mr Mrs Ms Dr Sir Lady Lord God Chapter Part One Two Three Monday Tuesday Wednesday Thursday Friday Saturday Sunday "
  + "January February March April May June July August September October November December Christmas English French").split(" "));

/** Names that appear at least twice, not at the start of a sentence. */
export function castOf(blocks: Block[]): Cast {
  const count = new Map<string, number>();
  blocks.forEach((b) => {
    if (b.type === "h") return;
    const t = b.text.replace(/[*_`]/g, "");
    for (const m of t.matchAll(/(^|[^.!?“"]\s)([A-Z][a-z]{2,})\b/g)) { const w = m[2]; if (!NOT_NAMES.has(w)) count.set(w, (count.get(w) || 0) + 1); }
  });
  const cast: Cast = new Map();
  count.forEach((n, w) => { if (n >= 2) cast.set(w, hash(w) % 36); });
  return cast;
}

function buildFor(seed: number, stature: 0 | 1 | 2): number {
  return stature * 12 + (seed % 12);
}

/** The shot a passage asks for: where and weather mean wide, people and speech mean nearer, a thing alone means close. */
export function shotFor(e: Evidence, who: number, props: Prop[]): Shot {
  const sum = (m: Partial<Record<string, number>>) => Object.values(m).reduce((a: number, b) => a + (b || 0), 0);
  const where = sum(e.place) + sum(e.sky);
  const small = props.some((p) => ["cup", "book", "candle", "letter", "glass", "clock", "flower", "umbrella", "suitcase", "mirror"].includes(p));
  if (small && where <= 1 && who <= 1) return "close";
  if (who > 0 && (e.speech > 0 || (e.one + e.two + e.many) >= 3) && where <= 2) return "mid";
  return "wide";
}

/** The spec for a passage, given what the chapter has set up so far (ctx already includes it). */
export function specFrom(text: string, ctx: Context, e: Evidence = evidence(text), held: Held = {}, cast: Cast = new Map()): Spec {
  const mood = moodOf(text);
  let place = (argmax(ctx.place, 0.4) as Place | null) || held.place || null;
  // No word for the place: outdoor things put it outside; nothing at all gives an honest abstract motif.
  if (!place) {
    const has = (p: Prop) => (e.props[p] || 0) > 0;
    place = has("boat") || has("ship") ? "sea" : has("bridge") ? "river" : has("car") ? "road" : has("train") ? "station"
      : has("tree") || has("horse") || has("bird") || has("flower") ? "field" : has("bed") ? "bedroom"
      : has("table") || has("cup") || has("chair") || has("window") || has("door") || has("candle") || has("lamp") || has("book") ? "room" : "inner";
  }
  let time = (argmax(ctx.time, 0.4) as Time | null) || held.time || null;
  // No word for the hour: let the mood light it (dark passages fall at night, bright ones by day).
  if (!time) time = mood.v < -0.25 ? "night" : mood.v > 0.25 ? "day" : isIndoor(place) ? "night" : "dusk";
  const sky = (argmax(ctx.sky, 0.6) as Sky | null) || "clear";
  const season = (argmax(ctx.season, 0.4) as Season | null) || held.season || "none";
  const props = (Object.keys(e.props) as Prop[]).sort((a, b) => (e.props[b] || 0) - (e.props[a] || 0) || PROPS.indexOf(a) - PROPS.indexOf(b)).slice(0, MAX_PROPS);
  let who = 0;
  if (e.many >= 2 || (e.many && e.many >= e.one)) who = 3;
  else if (e.two) who = 2;
  else if (e.one || e.many) who = 1;
  // The pose: the strongest verb; a pair needs two people.
  let pose: Pose = "stand";
  if (who) {
    const p = argmax(e.pose) as Pose | null;
    pose = p && (p !== "pair" || who >= 2) ? p : "stand";
  }
  // The cast: named people first, in order of appearance; others by the passage.
  const names = Array.from(text.matchAll(/\b([A-Z][a-z]{2,})\b/g)).map((m) => m[1]).filter((w, i, all) => cast.has(w) && all.indexOf(w) === i);
  const h = hash(text);
  const stature: 0 | 1 | 2 = e.child > 0 ? 1 : e.elder > 0 ? 2 : 0;
  const builds = Array.from({ length: who }, (_, i) => names[i] ? cast.get(names[i])! : buildFor((h >>> (i * 5)) % 997, i === 0 ? stature : 0));
  const sd = held.chapter != null ? hash(held.chapter + "|" + place) % 46656 : h % 46656;
  return {
    place, time, sky, season, props, who, pose, cast: builds, shot: place === "inner" ? "wide" : shotFor(e, who, props),
    v: mood.v, a: mood.a, seed: sd, moment: h % 1296,
  };
}

/** One passage on its own (no chapter context). */
export function readSpec(text: string): Spec {
  const e = evidence(text);
  return specFrom(text, advance(emptyContext(), e), e);
}

/**
 * A spec for every block of a book, reading in order: the setting carries forward and fades,
 * a new chapter mostly resets it, and a scene break lets it go faster. Headings get null.
 * The layout seed comes from the chapter and the place, so a place keeps its look in a chapter.
 */
export function trackSpecs(blocks: Block[]): (Spec | null)[] {
  let ctx = emptyContext(), held: Held = { chapter: "0" }, chapter = 0;
  const cast = castOf(blocks);
  return blocks.map((b) => {
    if (b.type === "h") {
      const top = (b.level || 1) === 1;
      ctx = advance(ctx, evidence(b.text), top ? 0.15 : 0.5);
      if (top) { chapter++; held = { chapter: String(chapter) }; }
      return null;
    }
    if (b.type === "p" && isBreak(b.text)) { ctx = advance(ctx, evidence(""), 0.35); held = { place: held.place, season: held.season, chapter: held.chapter }; return null; }
    const e = evidence(b.text);
    ctx = advance(ctx, e);
    const s = specFrom(b.text, ctx, e, held, cast);
    held = { place: s.place === "inner" ? held.place : s.place, time: s.time, season: s.season, chapter: held.chapter };
    return s;
  });
}

export { POSES, SEASONS, SKIES };
