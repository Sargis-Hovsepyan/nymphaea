// Reading a scene out of any passage, with no AI: small lexicons score where (place), when (time),
// what sky and season, which things, who and what they do, and a tracker carries the setting
// forward through a chapter, so a paragraph that says only "She walked on" still happens in the
// city at night that the chapter set up. Words match exactly or as plurals, never by stem: a
// stemmer would read "pinned" as "pine" and "evening" as "even". A word after "no", "not" or
// "without" does not count ("there was no moon" is not a moonlit scene). Recurring names become a
// cast, so the same person keeps the same silhouette. A place word right after "in", "at", "into"
// and the like counts double, since that is where the scene is. Verbs and nouns of motion (fell,
// smoke, flew, flickered, lit, waves, a shooting star, swayed) become the picture's motion, so the
// drawing acts out what the sentence does. Deterministic and pure.
import { isBreak } from "../inline";
import type { Block } from "../types";
import { hash, moodOf } from "../stage/mood";
import { stem } from "../stage/stem";
import { locate, type Hit } from "../stage/locate";
import { readActs, type RawAct, type Ref, type Word } from "./clauses";
import { ALL, OFF_AHEAD, OFF_BEHIND, PAIR, SKY, THING0, TO_FIG0, TO_NONE, TO_THING0, UP, DOWN, fitActs, type Act, type FigKind } from "./acts";
import { FX, MAX_PROPS, PLACES, POSES, PROPS, SEASONS, SKIES, TIMES, isIndoor, type Place, type Pose, type Fx, type Prop, type Season, type Shot, type Sky, type Spec, type Time } from "./spec";

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
  village: "village villages town towns cottage cottages hamlet marketplace",
  garden: "garden gardens hedge hedges fountain lawn greenhouse vine vines orchard",
  road: "road roads highway path paths journey drive drove driving travel travelled traveled miles horizon track motorway",
  field: "campfire bonfire field fields meadow meadows grass wheat farm farms pasture hay barn harvest prairie plain plains crop crops",
  hill: "hill hills hillside hilltop slope slopes moor moors heath downs",
  forest: "forest forests woodland wood woods tree trees pine pines oak oaks branch branches moss undergrowth clearing grove trail fern ferns thicket",
  mountain: "mountain mountains peak peaks summit cliff cliffs ridge valley crag glacier pass",
  river: "river rivers stream streams creek brook bank banks canal ferry current",
  lake: "lake lakes pond ponds loch reeds",
  sea: "sea seas ocean oceans wave waves tide tides sail sails sailor deck gull gulls bay surf",
  shore: "shore shores beach beaches sand coast coastline dune dunes shingle",
  harbour: "harbour harbor harbours harbors port quay dock docks pier wharf",
  desert: "desert deserts sands camel camels oasis dust dusty arid caravan",
  graveyard: "graveyard graveyards cemetery cemeteries grave graves tomb tombs tombstone headstone churchyard funeral burial",
  inner: "",
};
const TIME_LEX: Record<Time, string> = {
  dawn: "dawn dawned sunrise daybreak morning mornings breakfast cockcrow",
  day: "noon afternoon afternoons daylight sunlight sunlit sunny midday sun lunch",
  dusk: "dusk sunset sundown nightfall evening evenings twilight gloaming supper",
  night: "night nights tonight midnight dark darkness moon moonlight moonlit stars star starlight starry nocturnal bedtime",
};
const SKY_LEX: Record<Exclude<Sky, "clear">, string> = {
  cloud: "cloud clouds cloudy overcast grey gray",
  rain: "rain raining rained rains rainy rainstorm drizzle drizzled showers downpour wet umbrella puddle puddles soaked drenched",
  snow: "snow snowing snowed snowy snowfall snowflake snowflakes blizzard sleet flurries snowdrift",
  fog: "fog foggy mist misty haze hazy murk",
  storm: "storm storms stormy thunder thunderstorm lightning tempest gale hurricane squall",
  wind: "wind windy windswept breeze gust gusts blew blowing howled howling",
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
  flower: "flower flowers roses lily lilies bloom blossom petal petals tulip",
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
const ONE = "i me my he him his she her man woman girl boy father mother child stranger friend son daughter husband wife king queen";
const TWO = "we us our both two together couple pair each";
const MANY = "they them crowd people everyone family children friends soldiers villagers guests strangers";
const POSE_LEX: Record<Exclude<Pose, "stand">, string> = {
  walk: "walk walked walking leaving arrived went stepped stepping crossed wandered wandering followed strode marched climbed climbing strolled strolling trudged trudging paced pacing headed",
  run: "ran run running fled fleeing hurried hurrying raced racing rushed rushing sprinted chased chasing dashed bolted",
  sit: "sat sit sitting seated knelt kneel kneeling crouched crouching perched slumped",
  lie: "lay lying slept sleep sleeping asleep sprawled collapsed",
  reach: "read reading held hold holding reached reaching handed grabbed offered carried carrying clutched clutching gripped lifted pointed waved",
  look: "looked looking gazed gazing stared staring watched watching glanced peered peering",
  pair: "embraced embrace embracing hugged hug hugging kissed kiss kissing danced dance dancing",
};
/** Motion the scene can act out. "fall" and "rise" name the direction, "sway" wind in things. */
const FX_LEX: Record<Fx, string> = {
  fall: "fell fall falling fallen tumbled tumbling dropped shed shedding petals confetti ash ashes scattered scattering",
  rise: "smoke smoking smoky steam steaming steamed incense rising billowed curled curling vapour vapor",
  fly: "flew fly flying flight flock flocks soared soaring swooped swooping wings fluttered fluttering flapped flapping",
  flicker: "flicker flickered flickering spark sparks sparked flame flames guttered guttering shimmered shimmering crackled crackling",
  glow: "glow glowed glowing lit lights lantern lanterns neon twinkled twinkling gleamed gleaming fireflies firefly shone shining illuminated",
  swell: "waves crashed crashing surf breakers swell swelled churned churning foam spray",
  star: "meteor meteors comet comets",
  sway: "swayed swaying sway rustled rustling rustle billowing streaming whipped tossing",
};
/** Words that put the next noun phrase in a place. */
const PREP = new Set("in at into inside within through across along on onto by beside near toward towards under over above below beneath behind outside".split(" "));
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
const F_LEX = toLex(FX_LEX);
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
  /** Motion the scene can act out. */
  fx: Partial<Record<Fx, number>>;
  /** Where each thing is first named (word index): the first-named thing is usually the subject. */
  first: Partial<Record<Prop, number>>;
  /** What happens, clause by clause, and the people it names (compose/clauses.ts). */
  acts: RawAct[];
  refs: Ref[];
}

/** Two-word names that mean something neither word does alone; both words are used up. */
type Tag = ["place", Place] | ["time", Time] | ["prop", Prop] | ["none", ""];
const PHRASES: Record<string, Tag[]> = {
  "living room": [["place", "room"]], "sitting room": [["place", "room"]], "drawing room": [["place", "room"]], "dining room": [["place", "room"]],
  "street lamp": [["prop", "lamp"]], "street light": [["prop", "lamp"]], "street lights": [["prop", "lamp"]], "street lamps": [["prop", "lamp"]],
  "fire escape": [["place", "city"]], "bus stop": [["place", "city"]], "fire alarm": [["none", ""]], "fire engine": [["place", "city"]],
  "railway station": [["place", "station"]], "train station": [["place", "station"]], "bus station": [["place", "station"]],
  "sea shore": [["place", "shore"]], "full moon": [["time", "night"]], "half moon": [["time", "night"]], "night sky": [["time", "night"]],
  "morning light": [["time", "dawn"]], "evening light": [["time", "dusk"]],
  "front door": [["prop", "door"]], "back door": [["prop", "door"]], "coffee cup": [["prop", "cup"]], "tea cup": [["prop", "cup"]],
  "kitchen table": [["place", "kitchen"], ["prop", "table"]], "fire place": [["prop", "fire"]], "rose garden": [["place", "garden"], ["prop", "flower"]],
  "book shop": [["place", "city"], ["prop", "book"]], "town square": [["place", "village"]], "village square": [["place", "village"]], "market square": [["place", "village"]], "city square": [["place", "city"]], "post office": [["place", "city"]], "light house": [["prop", "tower"]],
  "dog tired": [["none", ""]], "house arrest": [["none", ""]], "star sign": [["none", ""]],
};
/** Words that name a thing only as nouns: after a subject or a modal they are verbs ("she fired him"). */
const AMBIG = new Set("fire fires light watch train trains bank field spring fall star park ship book table chair house dog glass letter iron match bat".split(" "));
const SUBJ = new Set("i he she we they you it who to will would could can should must did didn't won't wouldn't couldn't".split(" "));
/** A weather word undone a few words later: "the rain stopped", "the fog lifted". */
const UNDO = new Set("stopped ceased cleared lifted eased passed died faded".split(" "));
/** Words that open a clause about somewhere else: a memory, a wish, a dream, a future. */
const UNREAL = new Set("remembered remember remembering recalled dreamed dreamt dreaming imagined imagining wished wishing hoped someday tomorrow".split(" "));
/** "Two friends", "both sisters": a pair, not a crowd. */
const COUNT2 = new Set(["two", "both", "couple", "pair"]);
const RESUME = new Set("then but now suddenly yet until when".split(" "));

interface Tok extends Word {}
/**
 * The words of a passage with how much each one counts for the setting and the things in it: in
 * full where the passage is, 0.2 inside a simile or a memory or a wish ("like a storm", "she
 * remembered the sea"), 0.5 inside dialogue. A sentence end ends a simile or a memory; "then",
 * "but" and the like bring the passage back to the present.
 */
function scoped(text: string): Tok[] {
  const out: Tok[] = [];
  let talk = false, unreal = false, simile = false, prev = "", prev2 = "", br = "";
  const re = /[“”"]|[.!?;:]|,|[\p{L}\p{N}’']+/giu;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const t = m[0];
    if (t === "“") { talk = true; br = br || ","; continue; }
    if (t === "”" || (t === '"' && talk)) { talk = false; unreal = false; simile = false; br = br || ","; continue; }
    if (t === '"') { talk = true; br = br || ","; continue; }
    if (/^[.!?;:]$/.test(t)) { unreal = false; simile = false; prev = ""; br = t; continue; }
    if (t === ",") { simile = false; prev = ","; br = br || ","; continue; }
    const w = t.toLowerCase();
    if (RESUME.has(w)) unreal = false;
    // A simile is the phrase after "like"; a preposition starts the sentence's own words again.
    if (PREP.has(w) || SUBJ.has(w) || ["as", "and", "while", "when", "so"].includes(w)) simile = false;
    if (UNREAL.has(w)) unreal = true;
    // "like a storm", "burned like fire", "as if": but "I like the sea" is not a simile.
    if ((prev === "like" && !SUBJ.has(prev2)) || (prev === "as" && /^(if|though)$/.test(w))) simile = true;
    out.push({ w, raw: t, br, weight: simile || unreal ? 0.2 : talk ? 0.5 : 1 });
    br = "";
    prev2 = prev; prev = w;
  }
  return out;
}

/** One word that named something: its kind, the key it named, the word as written and how much it counts. */
type Kind = "place" | "time" | "sky" | "season" | "props" | "pose" | "motion" | "people";
interface Named1 { kind: Kind; key: string; raw: string; w: number; wi: number; before: string }

/**
 * The one walk over a passage's words that both the reading (evidence) and the Studio's readout
 * (namedWords) fold, so the two can never drift apart. It applies every word rule in one place:
 * negation, a place right after a preposition counting double, two-word names, verbs that look
 * like things, "two friends" being a pair, "a shooting star", and weather that stops (a negative
 * hit undoes it). People and poses count even after "no"; nothing else does.
 */
function walk(text: string, visit: (h: Named1) => void): Tok[] {
  let neg = 0, prep = 0, prev = "", skip = 0;
  let lastSky: { key: string; w: number; wi: number } | null = null;
  const toks = scoped(text);
  toks.forEach((tk, wi) => {
    const raw = tk.w, s = raw.replace(/[’']s$/, "").replace(/[’']/g, "");
    const before = prev; prev = s;
    if (skip) { skip--; return; }
    if (NEG.has(s)) { neg = 3; return; }
    const off = neg > 0;
    if (neg > 0) neg--;
    const at = prep > 0;
    if (prep > 0) prep--;
    if (PREP.has(s)) { prep = 3; return; }
    const w = tk.weight, put = (kind: Kind, key: string, v = w, word = raw) => visit({ kind, key, raw: word, w: v, wi, before });
    if (ONE_L.has(s)) put("people", "one", 1);
    if (TWO_L.has(s)) put("people", "two", 1);
    if (MANY_L.has(s) && !COUNT2.has(before)) put("people", "many", 1);
    if (CHILD_L.has(s)) put("people", "child", 1);
    if (ELDER_L.has(s)) put("people", "elder", 1);
    (Object.keys(PO_LEX) as Exclude<Pose, "stand">[]).forEach((k) => { if (hit(PO_LEX[k], s)) put("pose", k); });
    if (off) return;
    // "The rain stopped": the weather named a few words back is over.
    if (UNDO.has(s) && lastSky && wi - lastSky.wi <= 3) { put("sky", lastSky.key, -lastSky.w); lastSky = null; }
    // "The star fell": the falling belongs to the star, not to leaves or ash.
    const skyFall = ["star", "stars", "comet", "meteor"].includes(before) && hit(F_LEX.fall, s);
    FX.forEach((k) => { if (hit(F_LEX[k], s) && !(skyFall && k === "fall")) put("motion", k); });
    if ((s === "star" || s === "stars") && (before === "shooting" || before === "falling")) put("motion", "star", 2 * w);
    // Two-word names first.
    const next = toks[wi + 1] ? toks[wi + 1].w : "";
    const ph = PHRASES[s + " " + next.replace(/[’']/g, "")];
    if (ph) {
      ph.forEach(([kind, key]) => { if (kind !== "none") put(kind === "prop" ? "props" : kind, key, kind === "place" && at ? 2 * w : w, raw + " " + next); });
      skip = 1;
      return;
    }
    // A verb, not a thing: "she fired", "to park", "would watch".
    if (AMBIG.has(s) && SUBJ.has(before)) return;
    PLACES.forEach((p) => { if (hit(P_LEX[p], s)) put("place", p, (at ? 2 : 1) * w); });
    TIMES.forEach((t) => { if (hit(T_LEX[t], s)) put("time", t); });
    (Object.keys(S_LEX) as Exclude<Sky, "clear">[]).forEach((k) => { if (hit(S_LEX[k], s)) { put("sky", k); lastSky = { key: k, w, wi }; } });
    (Object.keys(SE_LEX) as Exclude<Season, "none">[]).forEach((k) => { if (hit(SE_LEX[k], s)) put("season", k); });
    PROPS.forEach((p) => { if (hit(R_LEX[p], s)) put("props", p); });
  });
  return toks;
}

/** What the clause reader needs from the lexicons: which thing a noun names, and whether a word is a name. */
const LEXICON = {
  propOf: (w: string, next = ""): Prop | null => {
    // Two-word names decide: "fire escape" names no fire, "street lamp" names a lamp.
    const ph = PHRASES[w + " " + next];
    if (ph) { const t = ph.find(([k]) => k === "prop"); return t ? t[1] as Prop : null; }
    return PROPS.find((p) => hit(R_LEX[p], w)) || null;
  },
  isName: (raw: string): boolean => /^[A-Z][a-z]{2,}$/.test(raw) && !NOT_NAMES.has(raw) && !COMMON.has(raw.toLowerCase()),
};
/** Lower-case words that are never names, even at the start of a sentence. */
const COMMON = new Set<string>([
  ...[P_LEX, T_LEX, S_LEX, R_LEX, SE_LEX, PO_LEX, F_LEX].flatMap((L) => Object.values(L).flatMap((x) => Array.from(x as Set<string>))),
  ...ONE_L, ...TWO_L, ...MANY_L, ...PREP, ...NEG, ..."sun rain snow fog mist wind storm cloud clouds lightning thunder day dawn dusk night darkness suddenly slowly later soon inside outside there here everything nothing someone something somewhere everyone nobody".split(" "),
]);

export function evidence(text: string): Evidence {
  const e: Evidence = { place: {}, time: {}, sky: {}, season: {}, props: {}, pose: {}, one: 0, two: 0, many: 0, child: 0, elder: 0, speech: 0, walk: 0, fx: {}, first: {}, acts: [], refs: [] };
  const add = (m: Partial<Record<string, number>>, k: string, v: number) => { m[k] = Math.max(0, (m[k] || 0) + v); };
  const toks = walk(text, (h) => {
    switch (h.kind) {
      case "people": e[h.key as "one" | "two" | "many" | "child" | "elder"]++; break;
      case "pose": add(e.pose, h.key, h.w); if (h.key === "walk" || h.key === "run") e.walk++; break;
      case "motion": add(e.fx, h.key, h.w); break;
      case "props": add(e.props, h.key, h.w); if (e.first[h.key as Prop] == null) e.first[h.key as Prop] = h.wi; break;
      default: add(e[h.kind], h.key, h.w);
    }
  });
  e.speech = (text.match(/[“"][^”"]{2,}[”"]/g) || []).length;
  // "He looked at me": the narrator and someone else are two people.
  const ws = new Set(toks.map((t) => t.w));
  if (["i", "me", "my"].some((w) => ws.has(w)) && ["he", "him", "she", "her"].some((w) => ws.has(w))) e.two++;
  const r = readActs(toks, LEXICON);
  e.acts = r.acts; e.refs = r.refs;
  return e;
}

/** The words in a passage that named its scene, by kind, as written (for the Studio's "why this picture"). */
export interface Named { place: string[]; time: string[]; sky: string[]; season: string[]; props: string[]; pose: string[]; people: string[]; motion: string[]; act: string[] }
export function namedWords(text: string): Named {
  const out: Named = { place: [], time: [], sky: [], season: [], props: [], pose: [], people: [], motion: [], act: [] };
  const toks = walk(text, (h) => {
    if (h.w <= 0) return;
    if (h.kind === "people" && (h.key === "child" || h.key === "elder")) return;
    // Words in a simile or a memory hardly count, so they are not shown as what the picture is of.
    if (h.w < 0.5 && h.kind !== "pose" && h.kind !== "motion" && h.kind !== "people") return;
    if (!out[h.kind].includes(h.raw)) out[h.kind].push(h.raw);
  });
  readActs(toks, LEXICON).acts.forEach((a) => { const w = a.words.join(" "); if (!out.act.includes(w)) out.act.push(w); });
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
  // How many different places and skies are named, not how often: "on the kitchen table" names one room.
  const named = (m: Partial<Record<string, number>>) => Object.values(m).filter((v) => (v || 0) >= 0.5).length;
  const where = named(e.place) + named(e.sky);
  const small = props.some((p) => ["cup", "book", "candle", "letter", "glass", "clock", "flower", "umbrella", "suitcase", "mirror"].includes(p));
  if (small && where <= 1 && who <= 1) return "close";
  if (who > 0 && (e.speech > 0 || (e.one + e.two + e.many) >= 3) && where <= 2) return "mid";
  // People doing something named (sitting, holding, kissing) are seen nearer, unless the place is the subject.
  const act = Object.entries(e.pose).some(([k, v]) => k !== "walk" && k !== "run" && (v || 0) >= 0.5);
  if (who > 0 && act && where <= 1) return "mid";
  return "wide";
}

/**
 * The motion a passage names, strongest first, at most three, kept only where the scene can show it:
 * no shooting star by day or indoors, no breaking waves without water. "Lit" next to a fire or a candle
 * is a flicker more than a glow.
 */
export function fxFor(e: Evidence, place: Place, time: Time, sky: Sky): Fx[] {
  const m: Partial<Record<Fx, number>> = { ...e.fx };
  if ((m.glow || 0) && ((e.props.fire || 0) + (e.props.candle || 0)) > 0) m.flicker = (m.flicker || 0) + 1;
  const ok = (k: Fx): boolean => {
    if (k === "star") return time === "night" && !isIndoor(place);
    if (k === "swell") return ["sea", "shore", "harbour", "lake", "river"].includes(place);
    if (k === "sway") return !isIndoor(place) && sky !== "storm";
    if (k === "fly") return !isIndoor(place) || (e.props.bird || 0) > 0;
    return place !== "inner" || k === "fall" || k === "rise";
  };
  return (Object.keys(m) as Fx[]).filter((k) => (m[k] || 0) > 0 && ok(k))
    .sort((a, b) => (m[b] || 0) - (m[a] || 0) || FX.indexOf(a) - FX.indexOf(b)).slice(0, 3);
}

/** Acts that move a figure from where it stands, and acts that are done in place with the hands or the face. */
const TRAVEL = new Set<string>(["go", "run", "enter", "leave", "cross"]);
const GESTURE = new Set<string>(["handle", "open", "close", "light", "snuff", "knock", "take", "give", "put", "drop", "throw", "raise", "wave", "point", "drink", "read", "work", "speak", "nod", "shake", "weep", "laugh", "bow", "hug", "kiss", "greet"]);

/**
 * The read acts bound to this picture: people to figure numbers (in order of first mention), things to
 * their place in the props, directions to targets. Returns the acts and how many figures they need.
 */
export function bindActs(raw: RawAct[], props: Prop[], who: number): { acts: Act[]; who: number; order: number[] } {
  const order: number[] = [];
  const fig = (ref: number) => { let i = order.indexOf(ref); if (i < 0) { order.push(ref); i = order.length - 1; } return i; };
  // People first, in the order the acts name them.
  raw.forEach((a) => {
    if (a.subj.t === "fig") fig(a.subj.ref);
    if (a.subj.t === "all" && a.fam === "pair") a.subj.refs.slice(0, 2).forEach(fig);
    if (a.obj && a.obj.t === "fig") fig(a.obj.ref);
  });
  const need = Math.min(3, Math.max(who, order.length, raw.some((a) => a.fam === "pair") ? 2 : 0));
  const acts: Act[] = [];
  raw.forEach((a) => {
    let by: number;
    if (a.subj.t === "sky") by = SKY;
    else if (a.subj.t === "thing") { const j = props.indexOf(a.subj.prop); if (j < 0) return; by = THING0 + j; }
    else if (a.fam === "pair") by = PAIR;
    else if (a.subj.t === "all") by = need > 1 ? ALL : 0;
    else { by = fig(a.subj.ref); if (by > 2) return; }
    let kind = a.kind as Act["kind"], to = TO_NONE, away = a.dir === "away";
    if (a.obj?.t === "fig") { const j = fig(a.obj.ref); to = j <= 2 ? TO_FIG0 + j : TO_NONE; }
    else if (a.obj?.t === "thing") { const j = props.indexOf(a.obj.prop); to = j < 0 ? TO_NONE : TO_THING0 + j; }
    else if (a.obj?.t === "up") to = UP;
    else if (a.obj?.t === "down") to = DOWN;
    if (a.dir === "ahead") to = to === TO_NONE ? OFF_AHEAD : to;
    if (a.dir === "behind") to = to === TO_NONE ? OFF_BEHIND : to;
    if (a.fam === "fig") {
      const door = props.findIndex((p) => p === "door" || p === "gate");
      // "Stepped into the rain", "went out": out of the picture, through the door when there is one.
      if ((kind === "go" || kind === "run") && (a.dir === "into" || a.dir === "ahead") && to === TO_NONE || (kind === "go" && a.dir === "ahead")) { kind = "leave"; to = OFF_AHEAD; }
      if (kind === "leave" && (to === TO_NONE || to === OFF_AHEAD) && door >= 0) to = TO_THING0 + door;
      if ((kind === "go" || kind === "run") && a.dir === "across" && to === TO_NONE) kind = "cross";
      if (kind === "enter" && door >= 0 && to === TO_NONE) to = TO_THING0 + door;
    }
    acts.push({ by, kind, to, manner: a.manner, with: a.with, away });
  });
  return { acts: fitActs({ who: need, props }, acts), who: need, order };
}

/** The spec for a passage, given what the chapter has set up so far (ctx already includes it). */
export function specFrom(text: string, ctx: Context, e: Evidence = evidence(text), held: Held = {}, cast: Cast = new Map(), extra: { names?: string[]; mood?: string; shot?: Evidence } = {}): Spec {
  const mood = moodOf(extra.mood ?? text);
  // A place the passage names itself wins over one carried from before ("above the harbour" two
  // paragraphs back does not move "the kitchen was warm" outside).
  let place = (argmax(e.place, 0.9) as Place | null) || (argmax(ctx.place, 0.4) as Place | null) || held.place || null;
  // No word for the place: outdoor things put it outside; nothing at all gives an honest abstract motif.
  if (!place) {
    const has = (p: Prop) => (e.props[p] || 0) > 0;
    place = has("boat") || has("ship") ? "sea" : has("bridge") ? "river" : has("car") ? "road" : has("train") ? "station"
      : has("tree") || has("horse") || has("bird") || has("flower") ? "field" : has("bed") ? "bedroom"
      : has("table") || has("cup") || has("chair") || has("window") || has("door") || has("candle") || has("lamp") || has("book") ? "room" : "inner";
  }
  let time = (argmax(e.time, 0.9) as Time | null) || (argmax(ctx.time, 0.4) as Time | null) || held.time || null;
  // No word for the hour: let the mood light it (dark passages fall at night, bright ones by day).
  if (!time) time = mood.v < -0.25 ? "night" : mood.v > 0.25 ? "day" : isIndoor(place) ? "night" : "dusk";
  const sky = (argmax(ctx.sky, 0.6) as Sky | null) || "clear";
  const season = (argmax(ctx.season, 0.4) as Season | null) || held.season || "none";
  const props = (Object.keys(e.props) as Prop[]).filter((p) => (e.props[p] || 0) >= 0.5).sort((a, b) => (e.props[b] || 0) - (e.props[a] || 0) || (e.first[a] ?? 999) - (e.first[b] ?? 999) || PROPS.indexOf(a) - PROPS.indexOf(b)).slice(0, MAX_PROPS);
  // The cast: named people first, in order of appearance; others by the passage.
  const names = (extra.names ?? Array.from(text.matchAll(/\b([A-Z][a-z]{2,})\b/g)).map((m) => m[1])).filter((w, i, all) => cast.has(w) && all.indexOf(w) === i);
  let who = 0;
  if (e.many >= 2 || (e.many && e.many >= e.one)) who = 3;
  else if (e.two) who = 2;
  else if (e.one || e.many) who = 1;
  // A named person is a person, even when no pronoun says so.
  if (names.length > who) who = Math.min(3, names.length);
  // A thing that acts, or is acted on, is in the picture even when it is named only in passing.
  e.acts.forEach((a) => [a.subj, a.obj].forEach((x) => { if (x && x.t === "thing" && !props.includes(x.prop) && props.length < MAX_PROPS) props.push(x.prop); }));
  // What happens: people named by the acts are figures, even when named only once.
  const bound = e.acts.length ? bindActs(e.acts, props, who) : null;
  if (bound && bound.acts.length) who = Math.max(who, bound.who);
  // The pose: the strongest verb; a pair needs two people.
  let pose: Pose = "stand";
  if (who) {
    const p = argmax(e.pose) as Pose | null;
    pose = p && (p !== "pair" || who >= 2) ? p : "stand";
  }
  const h = hash(text);
  const stature: 0 | 1 | 2 = e.child > 0 ? 1 : e.elder > 0 ? 2 : 0;
  // Builds follow the figures the acts number (a named person keeps their silhouette), else the names in order.
  const nameAt = (i: number): string | undefined => {
    if (bound && bound.acts.length && bound.order.length) { const r = e.refs[bound.order[i]]; return r ? r.name ?? (bound.order.length === 1 && i === 0 ? names[0] : undefined) : names[i]; }
    return names[i];
  };
  const builds = Array.from({ length: who }, (_, i) => { const n = nameAt(i); return n ? cast.get(n) ?? hash(n) % 36 : buildFor((h >>> (i * 5)) % 997, i === 0 ? stature : 0); });
  const sd = held.chapter != null ? hash(held.chapter + "|" + place) % 46656 : h % 46656;
  const acts = bound ? bound.acts : [];
  // A verb that is acted out is not also loose motion: "night fell" and "she fell" drop no leaves, "the bird flew off" is that bird.
  const fxE = { ...e, fx: { ...e.fx } };
  e.acts.forEach((a) => { a.words.forEach((w) => FX.forEach((k) => { if (hit(F_LEX[k], w.toLowerCase()) && fxE.fx[k]) fxE.fx[k] = Math.max(0, fxE.fx[k]! - 1); })); });
  const fx = fxFor(fxE, place, time, sky);
  // The sky's acts set the hour they happen at: a sunrise is at dawn, night falls at dusk.
  const skyAct = acts.find((a) => a.by === SKY);
  if (skyAct && !(argmax(e.time, 0.9) && ["rain", "snow", "fog", "wind", "storm", "cloud", "flash"].includes(skyAct.kind))) {
    const at: Partial<Record<string, Time>> = { sunrise: "dawn", daybreak: "dawn", sunset: "dusk", nightfall: "dusk", moonrise: "night", stars: "night" };
    if (at[skyAct.kind]) time = at[skyAct.kind]!;
  }
  let shot: Shot = place === "inner" && !acts.length ? "wide" : shotFor(extra.shot ?? e, who, props);
  const figActs = acts.filter((a) => a.by <= PAIR);
  // A person acting is never a still life; going somewhere needs room, a gesture is seen nearer.
  if (figActs.some((a) => TRAVEL.has(a.kind))) shot = "wide";
  else if (figActs.length && shot === "close") shot = "mid";
  else if (figActs.length && figActs.every((a) => GESTURE.has(a.kind)) && who <= 2 && shot === "wide") shot = "mid";
  return {
    place, time, sky, season, props, who, pose, cast: builds, shot,
    v: mood.v, a: mood.a, seed: sd, moment: h % 1296, ...(fx.length ? { fx } : {}), ...(acts.length ? { acts } : {}),
  };
}

/** One passage on its own (no chapter context). */
export function readSpec(text: string): Spec {
  const e = evidence(text);
  return specFrom(text, advance(emptyContext(), e), e);
}

/** The reading state just before a block: the chapter's carried context and what it has settled on. */
export interface Before { ctx: Context; held: Held }

interface Tracked { keys: string[]; before: Before[]; specs: (Spec | null)[]; cast: Cast }
const CTX_CACHE = new WeakMap<Block[], Tracked>();
/** What the reading of a block depends on; compared one by one, so an unchanged book costs a pass of string equality. */
const keysOf = (blocks: Block[]) => blocks.map((b) => b.type + (b.level || 0) + "|" + b.text);
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * A spec for every block of a book, reading in order: the setting carries forward and fades,
 * a new chapter mostly resets it, and a scene break lets it go faster. Headings get null.
 * The layout seed comes from the chapter and the place, so a place keeps its look in a chapter.
 * Also gives the state before each block (so a quote inside it can be read with its chapter) and
 * the book's cast. Cached per block list until its words change.
 */
export function track(blocks: Block[]): Tracked {
  const keys = keysOf(blocks), hit = CTX_CACHE.get(blocks);
  if (hit && same(hit.keys, keys)) return hit;
  let ctx = emptyContext(), held: Held = { chapter: "0" }, chapter = 0;
  const cast = castOf(blocks), before: Before[] = [];
  const specs = blocks.map((b) => {
    before.push({ ctx, held });
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
  const out = { keys, before, specs, cast };
  CTX_CACHE.set(blocks, out);
  return out;
}

export function trackSpecs(blocks: Block[]): (Spec | null)[] {
  return track(blocks).specs;
}

/** Where a value in a quoted picture came from: the chosen words, the rest of the paragraph, or the chapter. */
export type Source = "words" | "paragraph" | "chapter";
export interface QuoteReading {
  spec: Spec;
  from: Partial<Record<"place" | "time" | "sky" | "season" | "props" | "people" | "pose" | "motion" | "act", Source>>;
  /** The words of the quote and of the paragraph that named each kind. */
  named: { words: Named; paragraph: Named };
}

function scaled(e: Evidence, w: number): Evidence {
  const m = <K extends string>(x: Partial<Record<K, number>>) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, (v as number) * w])) as Partial<Record<K, number>>;
  return { ...e, place: m(e.place), time: m(e.time), sky: m(e.sky), season: m(e.season) };
}
const any = (m: Partial<Record<string, number>>) => Object.values(m).some((v) => (v || 0) > 0);
const people = (e: Evidence) => e.one + e.two + e.many;

const NAME = /\b([A-Z][a-z]{2,})\b/g;
const namesIn = (t: string, cast: Cast) => Array.from(t.matchAll(NAME)).map((m) => m[1]).filter((w) => cast.has(w));

/**
 * The picture for some chosen words (`h`, found in the book by locate), read in layers. The setting
 * (place, hour, sky, season) folds the chapter, then the rest of the paragraph, then the words at the
 * highest weight: the words decide, the paragraph fills what they leave open, the chapter carries the
 * rest. What is in the picture (things, people, what they do, what moves) comes from the words when
 * they name any of it, else from the paragraph. A pronoun takes the last name before it, so "she sat
 * down" draws the person named two lines up. The framing follows the words alone.
 */
export function readQuote(blocks: Block[], h: Hit): QuoteReading {
  const { before, cast } = track(blocks);
  const b0 = before[h.startBlock] || { ctx: emptyContext(), held: {} };
  const lead = blocks[h.startBlock].text.slice(0, h.startOff), tail = blocks[h.endBlock].text.slice(h.endOff);
  const quote = h.exact, rest = lead + " " + tail;
  const eW = evidence(quote), eP = evidence(rest);
  const ctx = advance(advance(b0.ctx, eP), scaled(eW, 2.5), 1);
  // One layering rule: a kind comes from the words when they name any of it, else from the paragraph.
  const own = <K extends "place" | "time" | "props" | "fx">(k: K) => any(eW[k]);
  const hasWho = people(eW) > 0;
  const W = <K extends "place" | "time" | "props" | "fx">(k: K): Evidence[K] => (own(k) ? eW : eP)[k];
  const P = hasWho ? eW : eP;
  const e: Evidence = {
    ...eW,
    // What happens comes from the words when they say anything happens, else from the paragraph.
    acts: eW.acts.length ? eW.acts : eP.acts, refs: eW.acts.length ? eW.refs : eP.refs,
    place: W("place"), time: W("time"), props: W("props"), fx: W("fx"), first: (own("props") ? eW : eP).first,
    pose: hasWho || any(eW.pose) ? eW.pose : eP.pose,
    one: P.one, two: P.two, many: P.many, child: P.child, elder: P.elder,
  };
  // The cast: names in the words, else the last named person before them.
  let names = namesIn(quote, cast);
  if (!names.length && people(e) > 0) {
    let last = namesIn(lead, cast).pop();
    for (let j = h.startBlock - 1; !last && j >= Math.max(0, h.startBlock - 4) && blocks[j].type !== "h"; j--) last = namesIn(blocks[j].text, cast).pop();
    if (last) names = [last];
  }
  const spec = specFrom(quote, ctx, e, b0.held, cast, { names, mood: quote + " " + rest, shot: { ...e, place: eW.place, sky: eW.sky } });
  const src = (k: "place" | "time" | "sky" | "season", v: string): Source =>
    (eW[k] as Record<string, number>)[v] ? "words" : (eP[k] as Record<string, number>)[v] ? "paragraph" : "chapter";
  const by = (words: boolean): Source => (words ? "words" : "paragraph");
  const from: QuoteReading["from"] = {};
  if (spec.place !== "inner") from.place = src("place", spec.place);
  from.time = src("time", spec.time);
  if (spec.sky !== "clear") from.sky = src("sky", spec.sky);
  if (spec.season !== "none") from.season = src("season", spec.season);
  if (spec.props.length) from.props = by(own("props"));
  if (spec.who) from.people = by(hasWho);
  if (spec.who && spec.pose !== "stand") from.pose = by(hasWho || any(eW.pose));
  if (spec.fx && spec.fx.length) from.motion = by(own("fx"));
  if (spec.acts && spec.acts.length) from.act = by(eW.acts.length > 0);
  return { spec, from, named: { words: namedWords(quote), paragraph: namedWords(rest) } };
}

/**
 * Read some words of the book (a selection, a found passage, a picture's quote) ending at or
 * before paragraph `after`. Null when the words are not in the few paragraphs before it.
 */
export function readQuoteAt(blocks: Block[], after: number, quote: string): QuoteReading | null {
  const [h] = locate(blocks, quote, { from: Math.max(0, after - QUOTE_WINDOW), to: after, fuzzy: false, limit: 1 });
  return h ? readQuote(blocks, h) : null;
}

/** Words that start at `startBlock` can be drawn by a picture after paragraph `after`. */
export const inReach = (startBlock: number, endBlock: number, after: number): boolean => after >= endBlock && after - startBlock <= QUOTE_WINDOW;

/** How many paragraphs back from its picture a quote may start (the same window as captions). */
export const QUOTE_WINDOW = 6;

export { POSES, SEASONS, SKIES };
