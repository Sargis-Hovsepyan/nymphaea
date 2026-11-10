// HTML → Markdown, with a small tokenizer (no DOM, so it runs in tests too). Used for rich-text
// paste (Word, Google Docs, web pages) and for the chapters inside an EPUB. It keeps what a story
// uses: paragraphs, headings, *italic*, **bold**, quotes, line breaks (verse) and scene breaks.
// It never changes a word: only tags become Markdown; the text between them is kept as it is
// (whitespace collapsed, entities decoded).

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", shy: "", thinsp: " ", ensp: " ", emsp: " ",
  eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß", copy: "©", middot: "·",
};
export function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n ? String.fromCodePoint(n) : m; }
    const v = NAMED[e.toLowerCase()]; return v == null ? m : v;
  });
}

/** A <br> until whitespace is settled; then it becomes a Markdown hard break ("\" at the line end). */
const BR = String.fromCharCode(1);

const BLOCK = /^(p|div|h[1-6]|li|blockquote|section|article|tr|dd|dt|figcaption|pre|title|header|footer|body)$/;

/** A paragraph being built: text with Markdown markers placed so they hug words, never spaces. */
class Run {
  s = "";
  private open: string[] = [];
  private justOpened = "";
  text(t: string): void {
    if (this.justOpened && /^\s/.test(t)) {
      // "<i> word" → " *word": the space goes before the marker.
      this.s = this.s.slice(0, -this.justOpened.length) + t.match(/^\s+/)![0] + this.justOpened;
      t = t.trimStart();
    }
    if (t) this.justOpened = "";
    this.s += t;
  }
  on(mark: string): void { this.open.push(mark); this.s += mark; this.justOpened = mark; }
  off(mark: string): void {
    const i = this.open.lastIndexOf(mark);
    if (i < 0) return;
    this.open.splice(i, 1);
    if (this.s.endsWith(mark) && this.justOpened === mark) { this.s = this.s.slice(0, -mark.length); this.justOpened = ""; return; }
    const tail = (this.s.match(/\s*$/) || [""])[0];
    this.s = this.s.slice(0, this.s.length - tail.length) + mark + tail;
    this.justOpened = "";
  }
  /** Close anything still open (a paragraph ended inside <i>). */
  end(): string { [...this.open].reverse().forEach((m) => this.off(m)); return this.s; }
}

export function htmlToMarkdown(html: string): string {
  const src = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(head|script|style|noscript|svg|nav)\b[\s\S]*?<\/\1\s*>/gi, "");
  const out: string[] = [];
  let run = new Run(), kind: "p" | "h" = "p", level = 0, quote = 0, em = 0, strong = 0;
  const spans: { em: boolean; strong: boolean }[] = [];
  const flush = () => {
    const t = run.end().replace(/[ \t\r\n]+/g, " ").split(BR).map((s) => s.trim()).filter((s, i, a) => s || (i > 0 && i < a.length - 1)).join("\\\n").trim();
    const reopen = { em, strong };
    run = new Run(); if (reopen.strong) run.on("**"); if (reopen.em) run.on("*");
    if (!t.replace(/[*\\\s]/g, "")) { kind = "p"; level = 0; return; }
    if (kind === "h") out.push("#".repeat(Math.max(1, level)) + " " + t.replace(/\\\n/g, " ").replace(/\*+/g, "").trim());
    else if (quote) out.push(t.split("\\\n").map((l, i, a) => "> " + l + (i < a.length - 1 ? "\\" : "")).join("\n"));
    else out.push(t);
    kind = "p"; level = 0;
  };
  const setEm = (d: number) => { const was = em > 0; em = Math.max(0, em + d); if (!was && em > 0) run.on("*"); if (was && em === 0) run.off("*"); };
  const setStrong = (d: number) => { const was = strong > 0; strong = Math.max(0, strong + d); if (!was && strong > 0) run.on("**"); if (was && strong === 0) run.off("**"); };
  for (const m of src.matchAll(/<\/?([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g)) {
    if (m[3] != null) { run.text(decode(m[3])); continue; }
    const close = m[0][1] === "/", tag = m[1].toLowerCase().replace(/^\w+:/, ""), attrs = m[2] || "";
    if (tag === "br") { run.text(BR); continue; }
    if (tag === "hr") { flush(); out.push("* * *"); continue; }
    if (tag === "em" || tag === "i" || tag === "cite") { setEm(close ? -1 : 1); continue; }
    if (tag === "strong" || tag === "b") { setStrong(close ? -1 : 1); continue; }
    if (tag === "span" || tag === "font") {
      // Google Docs and Word mark italics and bold with inline styles.
      if (close) { const s = spans.pop(); if (s && s.strong) setStrong(-1); if (s && s.em) setEm(-1); }
      else {
        const st = ((attrs.match(/style\s*=\s*"([^"]*)"/i) || attrs.match(/style\s*=\s*'([^']*)'/i) || [])[1] || "").toLowerCase();
        const isEm = /font-style\s*:\s*italic/.test(st), isStrong = /font-weight\s*:\s*(bold|[6-9]00)/.test(st);
        if (isStrong) setStrong(1);
        if (isEm) setEm(1);
        spans.push({ em: isEm, strong: isStrong });
      }
      continue;
    }
    if (tag === "blockquote") { flush(); quote = Math.max(0, quote + (close ? -1 : 1)); continue; }
    if (/^h[1-6]$/.test(tag)) { flush(); if (!close) { kind = "h"; level = Math.min(3, +tag[1]); } continue; }
    if (BLOCK.test(tag)) { flush(); continue; }
  }
  em = 0; strong = 0;
  flush();
  return out.join("\n\n");
}

/** Pasted HTML worth converting: it carries formatting a story uses. */
export function richEnough(html: string): boolean {
  return /<(em|i|strong|b|h[1-6]|blockquote)\b|font-style\s*:\s*italic|font-weight\s*:\s*(bold|[6-9]00)/i.test(html);
}
