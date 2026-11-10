// The mood of a passage: a small valence (dark ↔ bright) and arousal (still ↔ stirring) lexicon,
// matched by stem. It tints the generative art (warm accent vs cool second ink) and its energy. Pure.
import { stem, tokens } from "./stem";

const BRIGHT = "love laugh smile warm light bright hope joy happy glad gentle soft kind sun morning bloom spring gold sweet calm peace safe home friend dance sing";
const DARK = "dark cold fear afraid alone lost cry tears grief dead death die night shadow pain hurt broken empty grey silent sorry wrong fail fell rain storm";
const STIR = "run ran rush shout scream fight strike crash storm fire fast sudden burst race chase attack slam break broke heart pound loud wild";
const STILL = "quiet still slow calm silent soft wait waited sleep rest gentle hush breath breathe sit sat stay lull";

const lex = (s: string) => new Set(s.split(" ").map(stem));
const B = lex(BRIGHT), D = lex(DARK), U = lex(STIR), Q = lex(STILL);

export interface Mood { /** −1 dark … 1 bright */ v: number; /** 0 still … 1 stirring */ a: number }

export function moodOf(text: string): Mood {
  let b = 0, d = 0, u = 0, q = 0;
  tokens(text).forEach((w) => { const s = stem(w); if (B.has(s)) b++; if (D.has(s)) d++; if (U.has(s)) u++; if (Q.has(s)) q++; });
  const v = b + d ? (b - d) / (b + d) : 0;
  const a = u + q ? 0.5 + 0.5 * (u - q) / (u + q) : 0.5;
  return { v, a };
}

/** A stable 32-bit hash of a string (FNV-1a), to seed generative art from the text itself. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
