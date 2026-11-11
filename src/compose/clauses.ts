// Reading who does what to what, clause by clause, with no parser: a clause is cut at a sentence
// end, a semicolon, "and", "then", "as", "while" and the like; its verb is the first word whose
// lemma is in the verb tables (compose/verbs.ts) with a subject just before it (a name, a pronoun,
// a person, a thing, the sun or the rain) and nothing between them but small words. The object is
// the first person or thing after the verb, the direction the preposition before it.
//
// Clauses that do not happen in the scene are skipped: negated ("did not open"), wished or modal
// ("would open", "wanted to"), conditional ("if"), inside dialogue, a simile or a memory (the token
// weights from compose/read.ts), and idioms ("fell in love"). State verbs stay poses: "she sat on the
// bench" is how she is, "she sat down" is something she does. Pure; the lexicons are passed in.
import type { Prop } from "./spec";
import type { FigKind, PairKind, SkyKind, ThingKind } from "./acts";
import { FIG_VERBS, IDIOM, IT_WEATHER, PAIR_VERBS, PARTICLES, PHRASAL, SKY_VERBS, SLOW, SUDDEN, THING_VERBS, lemma } from "./verbs";

/** A word of the passage: lower case, as written, how much it counts (1 here and now), the punctuation before it. */
export interface Word { w: string; raw: string; weight: number; br: string }

export interface Ref { name?: string; g: "m" | "f" | "?" | "i" }
export type Subj = { t: "fig"; ref: number } | { t: "all"; refs: number[] } | { t: "thing"; prop: Prop } | { t: "sky" };
export type Obj = { t: "fig"; ref: number } | { t: "thing"; prop: Prop } | { t: "up" } | { t: "down" };
export interface RawAct {
  subj: Subj;
  fam: "fig" | "pair" | "thing" | "sky";
  kind: FigKind | PairKind | ThingKind | SkyKind;
  obj?: Obj;
  /** toward the object, away from it, or out of the frame. */
  dir?: "to" | "away" | "ahead" | "behind" | "into" | "across";
  manner: 0 | 1 | 2;
  with: boolean;
  /** The words that named the act, as written (the verb and its particle). */
  words: string[];
}
export interface Lexicon { propOf(w: string, next?: string): Prop | null; isName(raw: string): boolean }

const DET = new Set("the a an this that these those his her their my our your its one two three some every each another no".split(" "));
const POSS = new Set("his her their my our your its".split(" "));
const AUX = new Set("had was were is are has have been be did does do just then still also again finally soon now already almost at last once quietly".split(" "));
const MODAL = new Set("would could should might may must will shall can wanted tried needed hoped meant decided planned wished refused longed gonna wanna".split(" "));
const NEG = new Set(["not", "never", "no", "nor", "nobody", "nothing", "neither"]);
const START = new Set(["began", "started", "begin", "start", "begins", "starts", "beginning", "starting", "continued", "went", "kept"]);
const SPLIT = new Set(["and", "but", "then", "as", "while", "when", "before", "after", "until", "so", "yet", "once", "whereupon"]);
const TOGETHER = new Set(["as", "while", "when"]);
const PRON: Record<string, Ref["g"] | "group" | "it"> = { i: "i", he: "m", she: "f", we: "group", they: "group", you: "?", it: "it" };
const OBJ_PRON: Record<string, Ref["g"] | "group"> = { me: "i", him: "m", her: "f", us: "group", them: "group", you: "?" };
const SELF = new Set(["myself", "himself", "herself", "themselves", "ourselves", "yourself", "itself"]);
const PERSON = new Set(("man woman girl boy child stranger friend mother father son daughter husband wife king queen lady gentleman lad lass baby "
  + "doctor sailor priest soldier farmer fisherman driver nurse teacher waiter waitress guard officer captain servant maid widow nun monk "
  + "traveller traveler visitor guest neighbour neighbor sister brother aunt uncle grandmother grandfather grandma grandpa granny old figure "
  + "poet painter musician fiddler shepherd hunter rider dancer singer stranger beggar thief detective inspector constable clerk boatman ferryman").split(" "));
const FEMALE = new Set("woman girl mother daughter wife queen lady lass maid widow nun sister aunt grandmother grandma granny waitress".split(" "));
const MALE = new Set("man boy father son husband king gentleman lad monk brother uncle grandfather grandpa waiter".split(" "));
const GROUP = new Set("people crowd children friends soldiers villagers guests strangers men women girls boys family couple lovers pair sailors travellers travelers dancers everyone everybody both".split(" "));
const SKY_NOUN: Record<string, string> = {
  sun: "sun", sunlight: "sun", moon: "moon", night: "night", dark: "dark", darkness: "darkness", dusk: "dusk", twilight: "dusk", dawn: "dawn",
  day: "day", daylight: "day", morning: "morning", star: "star", stars: "star", rain: "rain", downpour: "rain", drizzle: "rain", snow: "snow",
  snowflakes: "snow", fog: "fog", mist: "mist", wind: "wind", winds: "wind", gale: "wind", breeze: "breeze", storm: "storm", tempest: "storm",
  cloud: "cloud", clouds: "cloud", lightning: "lightning", thunder: "thunder", sky: "cloud",
};
/** Nouns that name a drawn thing only here, in a subject or an object. */
const EXTRA_PROP: Record<string, Prop> = { lights: "lamp", light: "lamp", flame: "candle", flames: "fire", bell: "tower", bells: "tower", bus: "car", taxi: "car", cab: "car", carriage: "train", cart: "car", wagon: "car", envelope: "letter", note: "letter", mug: "cup", bottle: "glass", tea: "cup", coffee: "cup", wine: "glass", plane: "bird" };
const PREP_DIR: Record<string, RawAct["dir"]> = {
  to: "to", toward: "to", towards: "to", at: "to", into: "into", onto: "to", for: "to", through: "into", inside: "into",
  from: "away", away: "away", out: "ahead", outside: "ahead", off: "ahead", across: "across", over: "across", past: "across", along: "across", back: "behind",
};
/** Sit, lie and stand are states; only with their particle ("sat down", "stood up") are they acts. */
const STATE = new Set(["sit", "lie", "stand", "settle", "perch", "slump", "recline", "sprawl", "stretch"]);

/** Verbs that act only with their particle ("got up", "blew out"). */
const PHRASAL_HEADS = new Set(Object.keys(PHRASAL).map((k) => k.split(" ")[0]));
/** Small words that end a noun phrase rather than start one. */
const FUNC = new Set("on in at by with and as then under near beside again goodbye gently softly once twice hard back too there here".split(" "));
const isAdverb = (w: string) => w.endsWith("ly") && w.length > 4 && w !== "only" && w !== "early";
const between = (w: string) => AUX.has(w) || isAdverb(w) || SLOW.has(w) || SUDDEN.has(w);

interface Clause { words: Word[]; with: boolean; sentence: number }

/** Cut the passage into clauses. "Mara and Tom walked" stays one clause: "and" between two people joins them. */
function clauses(words: Word[], lex: Lexicon): Clause[] {
  const out: Clause[] = [];
  let cur: Word[] = [], withNext = false, sentence = 0, curWith = false;
  const person = (x: Word | undefined) => !!x && (lex.isName(x.raw) || PRON[x.w] != null || PERSON.has(x.w));
  const flush = () => { if (cur.length) out.push({ words: cur, with: curWith, sentence }); cur = []; };
  words.forEach((x, i) => {
    if (/[.!?;:]/.test(x.br)) { flush(); sentence++; curWith = false; withNext = false; }
    else if (x.br === "," && cur.length && !SPLIT.has(x.w)) { flush(); curWith = withNext; withNext = false; }
    if (SPLIT.has(x.w) && !(x.w === "and" && person(words[i - 1]) && person(words[i + 1]))) {
      flush(); curWith = TOGETHER.has(x.w); withNext = false; return;
    }
    cur.push(x);
  });
  flush();
  return out;
}

/**
 * The acts in a passage, in order, and the people they name (in order of first mention: the first
 * is figure 0). `words` come from compose/read.ts with their weights and punctuation.
 */
export function readActs(words: Word[], lex: Lexicon): { acts: RawAct[]; refs: Ref[] } {
  const refs: Ref[] = [], acts: RawAct[] = [];
  let lastSubj: Subj | null = null, lastThing: Prop | null = null, lastSentence = -1;
  /** The thing a noun names; a two-word name ("fire escape") can block it. */
  const propOf = (w: string, next = ""): Prop | null => lex.propOf(w, next) || (lex.propOf(w) ? null : EXTRA_PROP[w] || null);
  const refByName = (name: string) => { let i = refs.findIndex((r) => r.name === name); if (i < 0) { refs.push({ name, g: "?" }); i = refs.length - 1; } return i; };
  const fits = (r: Ref, g: Ref["g"]) => r.g === g || (r.g === "?" && g !== "i") || g === "?";
  /** A pronoun: the subject of the clause before when it fits, else the latest person who fits, else someone new. */
  const refByPron = (g: Ref["g"], not = -1): number => {
    if (g === "i") { let i = refs.findIndex((r) => r.g === "i"); if (i < 0) { refs.push({ g: "i" }); i = refs.length - 1; } return i; }
    if (lastSubj && lastSubj.t === "fig" && lastSubj.ref !== not && fits(refs[lastSubj.ref], g)) { const r = refs[lastSubj.ref]; if (r.g === "?") r.g = g; return lastSubj.ref; }
    for (let i = refs.length - 1; i >= 0; i--) if (i !== not && fits(refs[i], g)) { if (refs[i].g === "?") refs[i].g = g; return i; }
    refs.push({ g }); return refs.length - 1;
  };
  /** "They", "we", "the children": everyone in the picture, without naming anyone new. */
  const group = (): number[] => refs.map((_, i) => i);

  for (const cl of clauses(words, lex)) {
    const W = cl.words;
    if (cl.sentence !== lastSentence) { lastSentence = cl.sentence; }
    if (W[0] && (W[0].w === "if" || W[0].w === "unless")) continue;
    // Find the verb: the first word that is a verb with a subject before it (or none, so the clause before lends one).
    let subj: Subj | null = null, vi = -1, neg = false, modal = false, it = false;
    for (let j = 0; j < W.length && vi < 0; j++) {
      const x = W[j];
      if (j > 0 && (DET.has(W[j - 1].w) || W[j - 1].w === "of")) continue;
      if (!verbish(x.w)) continue;
      // Walk back over small words to the subject.
      let k = j - 1, n = false, m = false;
      while (k >= 0 && (between(W[k].w) || NEG.has(W[k].w) || /n[’']t$/.test(W[k].w) || MODAL.has(W[k].w) || START.has(W[k].w) || W[k].w === "to" || W[k].w === "going")) {
        if (NEG.has(W[k].w) || /n[’']t$/.test(W[k].w)) n = true;
        if (MODAL.has(W[k].w) || W[k].w === "going") m = true;
        k--;
      }
      const s = k >= 0 ? subjectAt(W, k) : null;
      if (s) { subj = s.subj; it = s.it; vi = j; neg = n; modal = m; break; }
      if (k < 0 && lastSubj && !PRON[x.w]) { subj = lastSubj; vi = j; neg = n; modal = m; break; }
    }
    if (vi < 0 || !subj) continue;
    const v = W[vi];
    if (neg || modal || v.weight < 1) { lastSubj = subj; continue; }
    const lems = lemma(v.w);
    // The next content word, for idioms and phrasal verbs.
    const next = W.slice(vi + 1).find((x) => !DET.has(x.w) && x.w !== "in" && x.w !== "a");
    if (lems.some((l) => next && IDIOM.has(l + " " + next.w))) { lastSubj = subj; continue; }
    const p1 = W[vi + 1], p2 = W[vi + 2];
    const phr = (fam: "fig" | "thing") => {
      for (const l of lems) for (const pp of [p1, p2]) {
        if (!pp || !PARTICLES.has(pp.w)) continue;
        const e = PHRASAL[l + " " + pp.w];
        if (e && e[fam]) return { e, kind: e[fam]!, part: pp };
      }
      return null;
    };
    const manner: 0 | 1 | 2 = W.some((x) => SUDDEN.has(x.w)) || /^slam/.test(v.w) ? 2 : W.some((x) => SLOW.has(x.w)) ? 1 : 0;
    let act: RawAct | null = null;
    const base = { manner, with: cl.with && acts.length > 0, words: [v.raw] };

    if (subj.t === "sky" || it) {
      const noun = subj.t === "sky" ? skyNounAt(W, vi) : "";
      if (it) {
        // "It began to rain", "it snowed".
        const after = W[vi + 1] && W[vi + 1].w === "to" ? W[vi + 2] : null;
        const wl = [...lems, ...(after ? lemma(after.w) : [])].find((l) => IT_WEATHER[l]);
        if (wl) act = { subj: { t: "sky" }, fam: "sky", kind: IT_WEATHER[wl], ...base };
        else if (lastThing) subj = { t: "thing", prop: lastThing };
      } else {
        const tab = SKY_VERBS[noun] || {};
        const hitL = lems.find((l) => tab[l]);
        if (hitL) {
          const k = tab[hitL];
          act = { subj, fam: "sky", kind: k.replace("!", "") as SkyKind, ...base };
          if (k.endsWith("!")) act.dir = "away";
        }
      }
    }
    if (!act && subj.t === "thing") {
      const ph = phr("thing");
      let kind: ThingKind | undefined = ph ? ph.kind as ThingKind : undefined;
      if (!kind) { const l = lems.find((x) => THING_VERBS.has(x)); kind = l ? THING_VERBS.get(l) : undefined; }
      // "The light", "the candle" was lit: the passive of a figure's verb.
      if (!kind && lems.includes("light")) kind = "light";
      if (kind) {
        const dirW = W.slice(vi + 1).find((x) => PREP_DIR[x.w]);
        if (kind === "depart" && dirW && (dirW.w === "over" || dirW.w === "across" || dirW.w === "past")) kind = "pass";
        act = { subj, fam: "thing", kind, ...base, words: ph ? [v.raw, ph.part.raw] : [v.raw] };
        if (ph?.e.away) act.dir = "away";
      }
      lastThing = subj.prop;
    }
    if (!act && (subj.t === "fig" || subj.t === "all")) {
      const ph = phr("fig");
      const objAt = ph ? W.indexOf(ph.part) + 1 : vi + 1;
      const o = objectOf(W, objAt, subj, lems.some((l) => ["give", "hand", "offer", "pass"].includes(l)));
      const isPair = !ph && (subj.t === "all" || (o.obj && o.obj.t === "fig")) && lems.some((l) => PAIR_VERBS.has(l));
      if (isPair) {
        const l = lems.find((x) => PAIR_VERBS.has(x))!;
        act = { subj, fam: "pair", kind: PAIR_VERBS.get(l)!, ...base };
        if (subj.t === "fig" && o.obj && o.obj.t === "fig") act.subj = { t: "all", refs: [subj.ref, o.obj.ref] };
      } else {
        let kind: FigKind | undefined = ph ? ph.kind as FigKind : undefined;
        if (!kind) {
          const l = lems.find((x) => FIG_VERBS.has(x));
          // A state ("she sat on the bench") is a pose, not an act.
          if (l && !STATE.has(l)) kind = FIG_VERBS.get(l);
        }
        if (kind) {
          act = { subj, fam: "fig", kind, ...base, words: ph ? [v.raw, ph.part.raw] : [v.raw] };
          if (o.obj) act.obj = o.obj;
          if (o.dir) act.dir = o.dir;
          if (ph?.e.to === "up") act.obj = act.obj || { t: "up" };
          if (ph?.e.to === "down") act.obj = act.obj || { t: "down" };
          if (ph?.e.to === "ahead") act.dir = "ahead";
          if (ph?.e.away) act.dir = "away";
          if (o.obj && o.obj.t === "thing") lastThing = o.obj.prop;
        }
      }
    }
    if (act) acts.push(act);
    if (subj.t !== "sky") lastSubj = subj;
  }
  return { acts, refs };

  function verbish(w: string): boolean {
    if (DET.has(w) || PRON[w] != null || NEG.has(w)) return false;
    return lemma(w).some((l) => FIG_VERBS.has(l) || THING_VERBS.has(l) || PHRASAL_HEADS.has(l) || PAIR_VERBS.has(l) || IT_WEATHER[l] != null || Object.values(SKY_VERBS).some((t) => t[l]));
  }

  /** The subject ending at W[k]: a pronoun, a name, or a noun phrase naming a person, a group, a thing or the sky. */
  function subjectAt(W: Word[], k: number): { subj: Subj; it: boolean } | null {
    const x = W[k];
    const pr = PRON[x.w];
    if (pr === "it") return lastThing ? { subj: { t: "thing", prop: lastThing }, it: true } : { subj: { t: "sky" }, it: true };
    if (pr === "group") return { subj: { t: "all", refs: group() }, it: false };
    if (pr) return { subj: { t: "fig", ref: refByPron(pr) }, it: false };
    if (lex.isName(x.raw)) {
      // "Mara and Tom": both are people, acting together.
      if (k >= 2 && W[k - 1].w === "and" && lex.isName(W[k - 2].raw)) return { subj: { t: "all", refs: [refByName(W[k - 2].raw), refByName(x.raw)] }, it: false };
      return { subj: { t: "fig", ref: refByName(x.raw) }, it: false };
    }
    // A noun phrase: up to two words before the noun, the first a determiner or nothing.
    if (SKY_NOUN[x.w]) return { subj: { t: "sky" }, it: false };
    if (GROUP.has(x.w)) return { subj: { t: "all", refs: group() }, it: false };
    if (PERSON.has(x.w)) {
      const g: Ref["g"] = FEMALE.has(x.w) ? "f" : MALE.has(x.w) ? "m" : "?";
      // "The old man", "a woman": a new person unless one like them was just named.
      return { subj: { t: "fig", ref: refByPron(g) }, it: false };
    }
    const p = propOf(x.w, W[k + 1] ? W[k + 1].w : "");
    if (p && (k === 0 || DET.has(W[k - 1].w) || (k >= 2 && DET.has(W[k - 2].w)) || x.w.endsWith("s"))) return { subj: { t: "thing", prop: p }, it: false };
    return null;
  }

  function skyNounAt(W: Word[], vi: number): string {
    for (let k = vi - 1; k >= 0; k--) if (SKY_NOUN[W[k].w]) return SKY_NOUN[W[k].w];
    return "";
  }

  /** The first person or thing after the verb, and the direction of the preposition before it. */
  function objectOf(W: Word[], from: number, subj: Subj, ditransitive: boolean): { obj?: Obj; dir?: RawAct["dir"] } {
    let dir: RawAct["dir"] | undefined, thing: Obj | undefined;
    const me = subj.t === "fig" ? subj.ref : -1;
    // "Handed the letter to Tom": for giving, the person it goes to is the target, not the thing.
    const found = (o: Obj, d: RawAct["dir"]) => (ditransitive && o.t === "thing" ? ((thing = thing || o), null) : { obj: o, dir: d });
    for (let j = from; j < Math.min(W.length, from + 7); j++) {
      const x = W[j], nx = W[j + 1];
      if (PREP_DIR[x.w]) { if (!(x.w === "out" && nx && nx.w === "of")) dir = dir === "away" ? dir : PREP_DIR[x.w]; if (x.w === "out" && nx && nx.w === "of") dir = "away"; continue; }
      if (SELF.has(x.w)) continue;
      if (x.w === "it" && lastThing) { const r = found({ t: "thing", prop: lastThing }, dir); if (r) return r; continue; }
      // "Her letter" is hers; "kissed her on the bridge" is her.
      if (x.w === "her" && nx && !nx.br && !ditransitive && !PREP_DIR[nx.w] && !FUNC.has(nx.w)) continue;
      const op = OBJ_PRON[x.w];
      if (op && op !== "group") { const r = refByPron(op, me); if (r !== me) return { obj: { t: "fig", ref: r }, dir }; continue; }
      if (thing && x.w !== "to") { if (!lex.isName(x.raw) && !PERSON.has(x.w)) continue; }
      // A name after "to" or "into" is often a place ("walked to London"): a person only if already met, or given to.
      if (lex.isName(x.raw) && (refs.some((r) => r.name === x.raw) || !dir || (ditransitive && dir === "to"))) return { obj: { t: "fig", ref: refByName(x.raw) }, dir };
      if (PERSON.has(x.w) && j > from) return { obj: { t: "fig", ref: refByPron(FEMALE.has(x.w) ? "f" : MALE.has(x.w) ? "m" : "?", me) }, dir };
      const p = propOf(x.w, nx ? nx.w : "");
      if (p) { const r = found({ t: "thing", prop: p }, dir); if (r) return r; continue; }
      if (SKY_NOUN[x.w] && (x.w === "sky" || x.w.startsWith("star") || x.w === "moon" || x.w === "sun" || x.w === "clouds")) return { obj: { t: "up" }, dir };
    }
    return thing ? { obj: thing, dir } : { dir };
  }
}
