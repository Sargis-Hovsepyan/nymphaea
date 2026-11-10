// Inline Markdown, read at render time only. A block's text is stored exactly as written; the
// reader shows *word* as italic and **word** as bold, and a line of only "* * *" as a scene break.
import { capsRuns, isShouting, tailStart } from "./text/micro";

export interface Span { t: string; em?: boolean; strong?: boolean }

const TOKEN = /\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*|__(?=\S)([\s\S]+?)(?<=\S)__|\*(?=[^\s*])([\s\S]+?)(?<=[^\s*])\*|(?<![\p{L}\p{N}])_(?=\S)([\s\S]+?)(?<=\S)_(?![\p{L}\p{N}])/gu;

export function spans(text: string, inherit: Omit<Span, "t"> = {}): Span[] {
  const out: Span[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: text.slice(last, i), ...inherit });
    if (m[1] != null || m[2] != null) out.push(...spans(m[1] ?? m[2], { ...inherit, strong: true }));
    else out.push(...spans(m[3] ?? m[4], { ...inherit, em: true }));
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), ...inherit });
  return out;
}

/** The text a reader sees, without the * and _ markers. */
export function plain(text: string): string {
  return spans(text).map((s) => s.t).join("");
}

/** A scene break: a line of only *, #, ~ or ornaments ("* * *", "***", "⁂"), or of 3+ dashes/underscores. */
export function isBreak(text: string): boolean {
  const t = text.trim();
  return /^(?:[*#~•·◆◇⁂§]\s*){1,9}$/.test(t) || /^(?:[-_]\s*){3,}$/.test(t);
}

/**
 * Append the spans of `text` to an element as text nodes, <em> and <strong>. With `micro`,
 * acronyms get small caps and the last two words are kept on one line (display only).
 */
export function appendInline(el: HTMLElement, text: string, opts: { micro?: boolean } = {}): void {
  const sp = spans(text);
  const shout = isShouting(plain(text)), words = plain(text).split(/\s+/).filter(Boolean).length;
  sp.forEach((s, k) => {
    let host: HTMLElement = el;
    if (s.em) { const e = document.createElement("em"); host.appendChild(e); host = e; }
    if (s.strong) { const b = document.createElement("strong"); host.appendChild(b); host = b; }
    if (!opts.micro) { host.appendChild(document.createTextNode(s.t)); return; }
    let t = s.t, tail = "";
    if (k === sp.length - 1) { const at = tailStart(t, words); if (at >= 0) { tail = t.slice(at); t = t.slice(0, at); } }
    const put = (into: HTMLElement, str: string) => capsRuns(str, shout).forEach((r) => {
      if (r.sc) { const c = document.createElement("span"); c.className = "sc"; c.textContent = r.t; into.appendChild(c); }
      else into.appendChild(document.createTextNode(r.t));
    });
    put(host, t);
    if (tail) { const nw = document.createElement("span"); nw.className = "nw"; put(nw, tail); host.appendChild(nw); }
  });
}
