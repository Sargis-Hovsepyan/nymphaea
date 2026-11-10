// A light English stemmer and document statistics for staging. "walked", "walking" and "walks"
// all meet at "walk"; TF-IDF makes a word that is on every page count for less than a rare one.
// Pure. Used by stage/keywords.ts (scene scores), stage/segment.ts and stage/place.ts.

export function stem(raw: string): string {
  let w = raw.toLowerCase().replace(/[’']s$/, "").replace(/[’']/g, "");
  if (w.length <= 3) return w;
  if (/ies$/.test(w) && w.length > 4) w = w.slice(0, -3) + "y";
  else if (/sses$/.test(w)) w = w.slice(0, -2);
  else if (/ing$/.test(w) && w.length > 5) w = w.slice(0, -3);
  else if (/ed$/.test(w) && w.length > 4) w = w.slice(0, -2);
  else if (/[^su]s$/.test(w)) w = w.slice(0, -1);
  if (/([bdfgmnprt])\1$/.test(w)) w = w.slice(0, -1);
  if (/e$/.test(w) && w.length > 3) w = w.slice(0, -1);
  return w;
}

export function tokens(t: string): string[] {
  return t.toLowerCase().match(/[a-z0-9’']+/g) || [];
}

const STOP = new Set(("a an the and or but if then so of to in on at by for with from as is was were be been being am are it its it's "
  + "i me my mine we us our you your he him his she her they them their this that these those there here not no nor "
  + "do does did done have has had having can could would should will shall may might must just only also very "
  + "what which who whom whose when where why how all any each every some such than too more most much many own "
  + "out up down off over under again once about into through after before above below between both few same "
  + "other s t don didn wasn isn ll ve re d m said say says like one two back").split(" "));

export function isStop(w: string): boolean { return STOP.has(w); }

/** Content stems of a text (stop words out). */
export function contentStems(t: string): string[] {
  return tokens(t).filter((w) => !STOP.has(w)).map(stem).filter((w) => w.length > 2);
}

export interface DocModel {
  /** Number of paragraphs. */ n: number;
  /** Paragraphs each stem appears in. */ df: Map<string, number>;
}

export function docModel(texts: string[]): DocModel {
  const df = new Map<string, number>();
  texts.forEach((t) => new Set(contentStems(t)).forEach((s) => df.set(s, (df.get(s) || 0) + 1)));
  return { n: texts.length, df };
}

/** Inverse document frequency: rare words weigh more. 1 for an unknown model. */
export function idf(m: DocModel | null, s: string): number {
  if (!m || !m.n) return 1;
  return Math.log(1 + m.n / (m.df.get(s) || 1));
}
