// The typography check (the Studio's Text step). It finds typewriter habits — straight quotes, two
// hyphens for a dash, three dots for an ellipsis, double spaces, ligature characters — and offers
// the typeset form. Nothing is applied unless the author accepts it: then it is the author's own
// edit, made in their Markdown. Pure.

export type Kind = "quotes" | "dashes" | "ellipses" | "spaces" | "ligatures";

export interface Issue { kind: Kind; label: string; count: number; before: string; after: string }

const LIG = new RegExp("[" + String.fromCharCode(0xfb00) + "-" + String.fromCharCode(0xfb06) + "]", "g");
const LIG_TO = ["ff", "fi", "fl", "ffi", "ffl", "st", "st"];

/** Curly quotes by context: an opening quote follows a start, space, dash or bracket. */
function curl(s: string): string {
  return s
    .replace(/(^|[\s(\[{—–-])"/gm, "$1“").replace(/"/g, "”")
    .replace(/(\p{L})'(\p{L})/gu, "$1’$2")
    .replace(/(^|[\s(\[{—–-])'/gm, "$1‘").replace(/'/g, "’");
}

const FIX: Record<Kind, (s: string) => string> = {
  quotes: curl,
  dashes: (s) => s.replace(/(\S) ?--- ?(\S)/g, "$1—$2").replace(/ -- /g, " — ").replace(/(\S)--(\S)/g, "$1—$2"),
  ellipses: (s) => s.replace(/\.\.\.(?!\.)/g, "…"),
  spaces: (s) => s.replace(/(\S)  +(?=\S)/g, "$1 "),
  ligatures: (s) => s.replace(LIG, (c) => LIG_TO[c.charCodeAt(0) - 0xfb00] || c),
};
const FIND: Record<Kind, RegExp> = {
  quotes: /["']/g, dashes: /---?/g, ellipses: /\.\.\.(?!\.)/g, spaces: /\S {2,}(?=\S)/g, ligatures: LIG,
};
const LABEL: Record<Kind, string> = {
  quotes: "Straight quotes → curly quotes", dashes: "Two hyphens → an em dash", ellipses: "Three dots → an ellipsis",
  spaces: "Double spaces → one space", ligatures: "Ligature characters → plain letters",
};

/** Markdown structure that must not be touched: the "> " of a quote line, a "* * *" break. */
function prose(md: string, fn: (s: string) => string): string {
  return md.split("\n").map((line) => {
    if (/^(?:[*#~•·◆◇⁂§-]\s*){3,}$/.test(line.trim())) return line;
    const m = line.match(/^(\s*(?:>\s?|#{1,3}\s+)?)([\s\S]*)$/)!;
    return m[1] + fn(m[2]);
  }).join("\n");
}

export function findIssues(md: string): Issue[] {
  const out: Issue[] = [];
  (Object.keys(FIX) as Kind[]).forEach((k) => {
    const count = (md.match(FIND[k]) || []).length;
    if (!count) return;
    const fixed = prose(md, FIX[k]);
    if (fixed === md) return;
    // First changed line, as a before/after sample.
    const a = md.split("\n"), b = fixed.split("\n"), i = a.findIndex((l, j) => l !== b[j]);
    const at = Math.max(0, firstDiff(a[i], b[i]) - 24);
    out.push({ kind: k, label: LABEL[k], count, before: clip(a[i].slice(at)), after: clip(b[i].slice(at)) });
  });
  return out;
}

export function applyFix(md: string, kind: Kind): string {
  return prose(md, FIX[kind]);
}

function firstDiff(a: string, b: string): number { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; }
function clip(s: string): string { return s.length > 60 ? s.slice(0, 60) + "…" : s; }
