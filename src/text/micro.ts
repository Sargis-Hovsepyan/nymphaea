// Display-only micro-typography. Nothing here changes a character: it only wraps runs of the
// author's text in spans, so copying the page gives back exactly what was written.
//   · Acronyms (NASA, BBC, TV) are set in small caps, so they don't shout from the line.
//   · The last two words of a paragraph are kept together, so no paragraph ends on a lonely word.
// Used by inline.ts (appendInline) when rendering the book.

export interface Run { t: string; sc?: boolean }

const CAPS = /\b[A-Z][A-Z0-9]{1,5}\b/g;

/** Split text into runs, marking acronyms for small caps. Skipped in shouting (mostly capital) text. */
export function capsRuns(text: string, shouting: boolean): Run[] {
  if (shouting) return [{ t: text }];
  const out: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(CAPS)) {
    const i = m.index ?? 0;
    if (!/[A-Z]{2}/.test(m[0])) continue;
    if (i > last) out.push({ t: text.slice(last, i) });
    out.push({ t: m[0], sc: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out.length ? out : [{ t: text }];
}

/** Mostly capitals: a heading in caps or a shout. Small caps would weaken it. */
export function isShouting(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4) return false;
  return letters.replace(/[^A-Z]/g, "").length / letters.length > 0.5;
}

/** Where the unbreakable tail (the last two words) of a paragraph starts in its last run, or -1. */
export function tailStart(text: string, totalWords: number): number {
  if (totalWords < 6) return -1;
  const end = text.replace(/\s+$/, ""), sp = end.lastIndexOf(" ");
  if (sp <= 0) return -1;
  if (end.length - sp - 1 > 9) return -1;
  return end.lastIndexOf(" ", sp - 1) + 1;
}
