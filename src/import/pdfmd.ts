// PDF text → Markdown, as pure functions (pdf.js is only used to read the raw text items; see pdf.ts).
//
// What it does, and reports, so the author can check every step:
//  - joins text items into lines (adding a space where pdf.js split a word gap)
//  - takes out page numbers and running headers/footers (text repeated at the top or bottom of pages)
//  - finds paragraphs from line gaps, first-line indents and short last lines
//  - finds chapter headings from font size (they become "# Heading")
//  - joins a paragraph that runs across a page break, and mends words hyphenated at a line end
//  - keeps italics and bold (from the font names) as *…* and **…**: markers, not words
//  - rejoins a drop cap to its word ("T" + "he lamp" → "The lamp"), reads two-column pages left
//    column first, spells out ligature characters and notes footnotes (left in place)
// It never rewrites a word: every character in the output came from the PDF, in order.

export interface PdfItem { str: string; x: number; y: number; w: number; h: number; it?: boolean; b?: boolean }
export interface PdfLine { s: string; x: number; y: number; h: number; /** right edge */ r?: number }
export interface PdfReport {
  pages: number;
  paragraphs: number;
  headings: number;
  pageNumbers: number;
  runningHeads: number;
  joinedAcrossPages: number;
  /** Words split by a hyphen at a line end and put back together. */
  mended: number;
  /** Page breaks that may or may not split a paragraph: the first words after each. */
  unsure: string[];
  /** Runs of italic or bold type kept as Markdown. */
  styled?: number;
  /** Drop caps rejoined to their word. */
  dropCaps?: number;
  /** Ligature characters spelled out. */
  ligatures?: number;
  /** Pages read as two columns. */
  twoColumn?: number;
  /** Lines of small type at the foot of a page (footnotes), left in place. */
  footnotes?: number;
}

/** Text items of one page (in content order) → lines. y grows upwards, as in PDF space. */
export function itemsToLines(items: PdfItem[]): PdfLine[] {
  type L = PdfLine & { st: string };
  const lines: L[] = [];
  let cur: L | null = null, endX = 0;
  const mark = (it: PdfItem) => (it.b ? "**" : "") + (it.it ? "*" : "");
  /** Close the open style before any trailing space. */
  const close = (l: L) => {
    if (!l.st) return;
    const m = (l.s.match(/\s*$/) || [""])[0];
    l.s = l.s.slice(0, l.s.length - m.length) + l.st.split("").reverse().join("") + m;
    l.st = "";
  };
  items.forEach((it) => {
    if (!it.str) return;
    const h = it.h || 10;
    const sameLine = !!cur && Math.abs(cur.y - it.y) <= Math.max(2, h * 0.3);
    // A wide gap on one baseline is a column gutter: start a separate line.
    const gutter = sameLine && it.x - endX > h * 2.5;
    if (!cur || !sameLine || gutter) {
      if (cur) close(cur);
      cur = { s: "", x: it.x, y: it.y, h, st: "" }; lines.push(cur);
    } else {
      const gap = it.x - endX;
      if (gap > h * 0.12 && !/\s$/.test(cur.s) && !/^\s/.test(it.str)) cur.s += " ";
      cur.h = Math.max(cur.h, h);
    }
    const st = it.str.trim() ? mark(it) : cur.st;
    if (st !== cur.st) {
      close(cur);
      const lead = (it.str.match(/^\s*/) || [""])[0];
      cur.s += lead + st + it.str.slice(lead.length);
      cur.st = st;
    } else cur.s += it.str;
    endX = it.x + (it.w || 0);
    cur.r = Math.max(cur.r || 0, endX);
  });
  if (cur) close(cur);
  return lines.map(({ st: _st, ...l }) => ({ ...l, s: l.s.replace(/\s+/g, " ").trim() })).filter((l) => l.s.replace(/\*/g, ""));
}

const LIG_FROM = 0xfb00;
const LIG_TO = ["ff", "fi", "fl", "ffi", "ffl", "st", "st"];
const LIG_RE = new RegExp("[" + String.fromCharCode(0xfb00) + "-" + String.fromCharCode(0xfb06) + "]", "g");
/** Ligature characters (as some PDFs store "fi") spelled out as their letters. */
function spellLigatures(s: string): [string, number] {
  let n = 0;
  const out = s.replace(LIG_RE, (c) => { n++; return LIG_TO[c.charCodeAt(0) - LIG_FROM] || c; });
  return [out, n];
}

/** A page set in two columns: read the left column top to bottom, then the right. */
function columnOrder(ls: PdfLine[]): PdfLine[] | null {
  const withR = ls.filter((l) => l.r != null);
  if (withR.length < 8) return null;
  const minX = Math.min(...withR.map((l) => l.x)), maxR = Math.max(...withR.map((l) => l.r!));
  const mid = (minX + maxR) / 2;
  const left = withR.filter((l) => l.r! < mid + 4), right = withR.filter((l) => l.x > mid - 4);
  if (left.length < withR.length * 0.3 || right.length < withR.length * 0.3 || left.length + right.length < withR.length * 0.85) return null;
  const col = (l: PdfLine) => (l.x > mid - 4 ? 1 : 0);
  return ls.slice().sort((a, b) => col(a) - col(b) || b.y - a.y);
}

const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

const PAGE_NUM = /^(?:page\s+)?[-–—(\[]?\s*(?:\d{1,4}|[ivxlcdm]{2,7})\s*[-–—)\]]?$/i;
const BREAK = /^(?:[*#~•·◆◇⁂§]\s*){1,9}$|^(?:[-_]\s*){3,}$/;
const END = /[.!?…:;"'”’»)\]—–]$/;
/** A running head, compared without its digits (page numbers often sit inside it). */
const headKey = (s: string): string => s.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

interface Para { text: string; heading: boolean; h: number; startIndented: boolean; lastLen: number }

/** Lines of every page → Markdown, plus a report of everything that was taken out or joined. */
export function pagesToMarkdown(pages: PdfLine[][]): { markdown: string; report: PdfReport } {
  const report: PdfReport = { pages: pages.length, paragraphs: 0, headings: 0, pageNumbers: 0, runningHeads: 0, joinedAcrossPages: 0, mended: 0, unsure: [], styled: 0, dropCaps: 0, ligatures: 0, twoColumn: 0, footnotes: 0 };
  // 0. Ligature characters spelled out; two-column pages put in reading order.
  pages = pages.map((ls) => {
    const fixed = ls.map((l) => { const [t, n] = spellLigatures(l.s); report.ligatures! += n; return n ? { ...l, s: t } : l; });
    const cols = columnOrder(fixed);
    if (cols) { report.twoColumn!++; return cols; }
    return fixed;
  });

  // 1. Page numbers: a lone number (or roman numeral) among the first or last two lines of a page.
  const P = pages.map((ls) => ls.filter((l, i) => {
    const edge = i < 2 || i >= ls.length - 2;
    if (edge && ls.length > 1 && PAGE_NUM.test(l.s)) { report.pageNumbers++; return false; }
    return true;
  }));

  // 2. Running heads: the same first/last line on at least 3 pages and 40% of them. They are set at
  //    body size or smaller, so a large title that happens to match one (page 1) is kept.
  if (P.length >= 3) {
    const small = median(P.flat().map((l) => l.h)) * 1.1;
    const edgeOf = (ls: PdfLine[]) => [ls[0], ls.length > 1 ? ls[ls.length - 1] : undefined].filter((l): l is PdfLine => !!l && l.h <= small);
    const seen: Record<string, number> = {};
    P.forEach((ls) => {
      new Set(edgeOf(ls).map((l) => headKey(l.s))).forEach((k) => { seen[k] = (seen[k] || 0) + 1; });
    });
    const heads = new Set(Object.keys(seen).filter((k) => k.length <= 90 && seen[k] >= 3 && seen[k] >= P.length * 0.4));
    if (heads.size) P.forEach((ls, pi) => {
      P[pi] = ls.filter((l, i) => {
        const edge = i === 0 || i === ls.length - 1;
        if (edge && l.h <= small && heads.has(headKey(l.s))) { report.runningHeads++; return false; }
        return true;
      });
    });
  }

  // 3. Body measurements across the whole document.
  const all = P.flat();
  const bodyH = median(all.map((l) => l.h)) || 10;
  const bodyLen = median(all.filter((l) => l.h <= bodyH * 1.1).map((l) => l.s.length)) || 60;
  const lens = all.filter((l) => l.h <= bodyH * 1.1).map((l) => l.s.length).sort((a, b) => a - b);
  /** A full-width line: the 90th-percentile length (justified text fills the measure). */
  const fullLen = lens[Math.floor(lens.length * 0.9)] || 70;
  const text = all.map((l) => l.s).join(" ");
  // House style for dashes: if the document spaces its dashes (" — "), a line ending in one does too.
  const spaced = (text.match(/\s[—–]\s/g) || []).length > (text.match(/\S[—–]\S/g) || []).length;
  const join = (a: string, b: string) => joinLine(a, b, spaced);

  // Each page's left margin. A page of nothing but one-line paragraphs would read its indent as
  // the margin, so every page also looks at the margin of all pages of its parity (book margins
  // mirror left and right) and takes the smaller one when the two are an indent apart.
  const own = P.map((ls) => {
    const xs = ls.filter((l) => l.h <= bodyH * 1.1 && l.s.length >= bodyLen * 0.5).map((l) => l.x);
    return xs.length ? Math.min(...xs) : null;
  });
  const parityLeft = [0, 1].map((par) => {
    const xs = own.filter((v, i): v is number => v != null && i % 2 === par).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length * 0.1)] : null;
  });
  const lefts = P.map((ls, pi) => {
    const mine = own[pi], par = parityLeft[pi % 2] ?? parityLeft[1 - (pi % 2)];
    if (mine == null) return par ?? (ls.length ? Math.min(...ls.map((l) => l.x)) : 0);
    return par != null && par < mine && mine - par <= bodyH * 4 ? par : mine;
  });
  // Whether the document marks paragraphs with a first-line indent.
  let indentedLines = 0;
  P.forEach((ls, pi) => ls.forEach((l) => { if (l.h <= bodyH * 1.1 && l.x > lefts[pi] + bodyH * 0.8 && l.s.length >= bodyLen * 0.5) indentedLines++; }));
  const indentStyle = indentedLines >= 3 && indentedLines >= all.length * 0.04;

  // The normal line-to-line step, for the whole document. The lower quartile, because in a story
  // with many one-line paragraphs most gaps can be paragraph gaps.
  const gaps: number[] = [];
  P.forEach((ls) => {
    for (let i = 1; i < ls.length; i++) {
      if (ls[i - 1].h <= bodyH * 1.1 && ls[i].h <= bodyH * 1.1) gaps.push(Math.abs(ls[i - 1].y - ls[i].y));
    }
  });
  const sortedGaps = gaps.sort((a, b) => a - b);
  const gap = sortedGaps[Math.floor(sortedGaps.length / 4)] || bodyH * 1.2;

  // Drop caps: one or two large letters alone, then the body line they belong to. The letter goes
  // back onto its word ("T" + "he" → "The", but "A" + "lamp" → "A lamp"); the lines that wrap
  // around the cap are not first-line indents.
  const vocabAll: Record<string, number> = {};
  (text.toLowerCase().match(/[\p{L}\p{N}’']+/gu) || []).forEach((w) => { vocabAll[w] = (vocabAll[w] || 0) + 1; });
  const beside = new Set<PdfLine>();
  P.forEach((ls) => {
    for (let i = 0; i < ls.length - 1; i++) {
      const c = ls[i], nx = ls[i + 1];
      if (!/^[\p{Lu}\p{N}"“‘']{1,2}$/u.test(c.s) || c.h < bodyH * 1.8 || nx.h > bodyH * 1.1) continue;
      const word = (nx.s.match(/^[\p{L}’']+/u) || [""])[0], lone = /^(A|I|O)$/.test(c.s);
      const glue = /^\p{Ll}/u.test(nx.s) && !(lone && vocabAll[word.toLowerCase()] && !vocabAll[(c.s + word).toLowerCase()]);
      ls.forEach((l, j) => { if (j > i + 1 && l.y >= c.y - bodyH * 0.6 && l.x > c.x + bodyH * 0.5) beside.add(l); });
      nx.s = c.s + (glue ? "" : " ") + nx.s;
      nx.x = Math.min(nx.x, c.x);
      ls.splice(i, 1);
      report.dropCaps!++;
    }
  });
  // Footnotes: lines of small type at the foot of a page. Noted, and left exactly where they are.
  P.forEach((ls) => { for (let i = ls.length - 1; i >= 3 && ls[i].h < bodyH * 0.85; i--) report.footnotes!++; });

  const paras: Para[] = [];
  P.forEach((ls, pi) => {
    if (!ls.length) return;
    const left = lefts[pi];
    const pagePs: Para[] = [];
    let para: Para | null = null;

    ls.forEach((l, i) => {
      const isHead = l.h >= bodyH * 1.25 && l.s.length <= 90;
      const prev = ls[i - 1];
      const indented = l.x > left + bodyH * 0.8 && !beside.has(l);
      let fresh = !para;
      if (para && prev) {
        const vgap = Math.abs(prev.y - l.y);
        if (vgap > gap * 1.45 && !(para.heading && isHead)) fresh = true;      // a blank line
        else if (isHead !== para.heading) fresh = true;                         // into or out of a heading
        else if (para.heading && Math.abs(l.h - para.h) > 1) fresh = true;      // a different heading size
        else if (!para.heading && indented) fresh = true;                       // a first-line indent
        else if (!para.heading && prev.s.length < bodyLen * 0.6 && END.test(prev.s)) fresh = true; // a short last line
        if (BREAK.test(l.s) || BREAK.test(prev.s)) fresh = true;
      }
      if (fresh) {
        para = { text: l.s, heading: isHead, h: l.h, startIndented: indented, lastLen: l.s.length };
        pagePs.push(para);
      } else if (para) {
        para.text = join(para.text, l.s);
        para.lastLen = l.s.length;
      }
    });

    // A paragraph that ran across the page break. The next page must start with an un-indented
    // body line; in an indented book that alone says "same paragraph". In a book that spaces its
    // paragraphs instead, a page that ends on a full stop gives no sign either way: it continues
    // only if the next line starts in lower case, and the break is reported for the author to check.
    const carry = paras[paras.length - 1], first = pagePs[0];
    if (carry && first && !first.heading && !carry.heading && !first.startIndented && !BREAK.test(first.text) && !BREAK.test(carry.text)) {
      const sentenceEnd = END.test(carry.text), lower = /^\p{Ll}/u.test(first.text);
      if (indentStyle || !sentenceEnd || lower) {
        carry.text = join(carry.text, first.text);
        pagePs.shift();
        report.joinedAcrossPages++;
      } else if (carry.lastLen >= fullLen * 0.8) {
        report.unsure.push(first.text.split(" ").slice(0, 6).join(" "));
      }
    }
    paras.push(...pagePs);
  });

  // Words hyphenated at a line end: put back together if the document spells them whole elsewhere,
  // keep the hyphen if it spells them with one, or if both halves are words the document uses on
  // their own (almost- + lesson); otherwise join (remem- + ber, the usual typesetting case).
  const vocab: Record<string, number> = {};
  (text.toLowerCase().match(/[\p{L}\p{N}’'-]+/gu) || []).forEach((w) => { vocab[w] = (vocab[w] || 0) + 1; });
  const mend = new RegExp("([\\p{L}\\p{N}’'-]*)" + SHY + "([\\p{L}\\p{N}’'-]*)", "gu");
  paras.forEach((p) => {
    p.text = p.text.replace(mend, (_m, a: string, b: string) => {
      const whole = (a + b).toLowerCase(), hyph = (a + "-" + b).toLowerCase();
      const compound = !vocab[whole] && (vocab[hyph] || (vocab[a.toLowerCase()] && (vocab[b.toLowerCase()] || 0) >= 2));
      if (compound) return a + "-" + b;
      report.mended++;
      return a + b;
    });
  });

  const out: string[] = [];
  paras.forEach((p) => {
    // A style run that crossed a line end: "*word* *next*" → "*word next*".
    p.text = p.text.replace(/(\S)\*\* \*\*(?=\S)/g, "$1 ").replace(/([^\s*])\* \*(?=[^\s*])/g, "$1 ");
    report.styled! += (p.text.match(/(?<![*\p{L}\p{N}])\*(?=[^\s*])/gu) || []).length;
    if (p.heading && !BREAK.test(p.text)) { out.push("# " + p.text.replace(/\*+/g, "").trim()); report.headings++; }
    else { out.push(p.text); report.paragraphs++; }
  });
  return { markdown: out.join("\n\n"), report };
}

/** Marks a line-end hyphen until the whole document has been read (then pagesToMarkdown decides). */
const SHY = String.fromCharCode(0xad);

/** Join two lines of one paragraph. "remem-" + "ber" is marked for mending; a dash at the line end
 *  keeps the document's own spacing. */
export function joinLine(a: string, b: string, spacedDash = false): string {
  if (/\p{Ll}-$/u.test(a) && /^\p{Ll}/u.test(b)) return a.slice(0, -1) + SHY + b;
  if (/[—–]$/.test(a)) return spacedDash ? a + " " + b : a + b;
  return a + " " + b;
}

const n = (k: number, one: string, many = one + "s"): string => k + " " + (k === 1 ? one : many);

/** A one-line summary of the report, for the Studio. */
export function describeReport(name: string, r: PdfReport): string {
  const bits = [n(r.pages, "page"), n(r.paragraphs, "paragraph")];
  if (r.headings) bits.push(n(r.headings, "heading"));
  const out: string[] = [];
  if (r.pageNumbers) out.push(n(r.pageNumbers, "page number"));
  if (r.runningHeads) out.push(n(r.runningHeads, "running header"));
  let s = name + ": " + bits.join(", ") + ".";
  if (out.length) s += " Took out " + out.join(" and ") + ".";
  if (r.mended) s += " Mended " + n(r.mended, "word") + " hyphenated at a line end.";
  if (r.unsure.length) s += " Check " + (r.unsure.length === 1 ? "one page break" : r.unsure.length + " page breaks") + " that may split a paragraph: before “" + r.unsure.slice(0, 3).join("…”, “") + "…”" + (r.unsure.length > 3 ? " and others" : "") + ".";
  if (r.joinedAcrossPages) s += " Joined " + n(r.joinedAcrossPages, "paragraph") + " split by a page break.";
  if (r.styled) s += " Kept " + n(r.styled, "run") + " of italic or bold type.";
  if (r.dropCaps) s += " Put " + n(r.dropCaps, "drop cap") + " back on " + (r.dropCaps === 1 ? "its word" : "their words") + ".";
  if (r.twoColumn) s += " Read " + n(r.twoColumn, "page") + " as two columns.";
  if (r.ligatures) s += " Spelled out " + n(r.ligatures, "ligature character") + ".";
  if (r.footnotes) s += " " + n(r.footnotes, "line") + " of small type at page feet (footnotes?) left in place.";
  return s;
}
