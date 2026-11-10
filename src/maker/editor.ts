// The Markdown editor: a plain textarea laid over a mirror that colours the syntax. The mirror is
// display-only: its text content is always exactly the author's characters (tested), it never
// feeds back into the Markdown. The textarea grows with its text, so the pane scrolls as one page
// and the mirror can never drift out of line with it.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Inline emphasis marks, wrapped (never removed): **strong** and *em*. */
const INLINE = /(\*\*[^*\n]+\*\*)|(\*[^*\s][^*\n]*\*)/g;

function line(raw: string): string {
  let h = esc(raw).replace(INLINE, (m, strong) => '<span class="' + (strong ? "sx" : "ex") + '">' + m + "</span>");
  if (/\\$/.test(raw)) h = h.replace(/\\$/, '<span class="vb">\\</span>');
  if (/^\s*(\*\s*){3,}$/.test(raw) || /^\s*(-\s*){3,}$/.test(raw)) return '<span class="bk">' + h + "</span>";
  if (/^#{1,3}\s/.test(raw)) return '<span class="hd">' + h + "</span>";
  if (/^>/.test(raw)) return '<span class="qt">' + h + "</span>";
  return h;
}

/** The Markdown as HTML for the mirror. Stripping the tags and unescaping gives back the input. */
export function highlight(md: string): string {
  return md.split("\n").map(line).join("\n");
}

/** Above this size the mirror is left plain: colour isn't worth a slow keystroke. */
const MAX_COLOUR = 300_000;

/** Where character `offset` of the text sits on screen (a rect), by walking the mirror's text. */
export function rectAt(pre: HTMLElement, offset: number): DOMRect | null {
  const w = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
  let n = w.nextNode() as Text | null, left = offset;
  while (n) {
    if (left <= n.data.length) {
      const r = document.createRange();
      r.setStart(n, left); r.setEnd(n, Math.min(n.data.length, left + 1));
      const b = r.getBoundingClientRect();
      return b.height || b.width ? b : (n.parentElement ? n.parentElement.getBoundingClientRect() : null);
    }
    left -= n.data.length;
    n = w.nextNode() as Text | null;
  }
  return null;
}

export interface Editor { paint(): void; reveal(offset: number): void }

export function mountEditor(ta: HTMLTextAreaElement, pre: HTMLElement, scroller: HTMLElement): Editor {
  const size = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
  const paint = () => {
    if (ta.value.length > MAX_COLOUR) pre.textContent = ta.value + "\n"; else pre.innerHTML = highlight(ta.value) + "\n";
    size();
  };
  // The mono face arrives after the first paint; its metrics differ from the fallback's.
  if (document.fonts) { document.fonts.ready.then(size); document.fonts.addEventListener("loadingdone", size); }
  if ("ResizeObserver" in window) {
    let w = 0;
    new ResizeObserver((es) => { const nw = Math.round(es[0].contentRect.width); if (nw !== w) { w = nw; size(); } }).observe(ta);
  }
  return {
    paint,
    /** Scroll the pane so the text at `offset` sits about a third of the way down. */
    reveal(offset) {
      const r = rectAt(pre, offset), s = scroller.getBoundingClientRect();
      if (r) scroller.scrollTop += r.top - s.top - s.height / 3;
    },
  };
}
