import type { Block } from "./types";

const NBSP = new RegExp(String.fromCharCode(160), "g");

/**
 * Plain text / Markdown → blocks. Blank lines split blocks; the words are never touched.
 *   # / ## / ###      heading (chapter / section / minor); a short "Chapter …" line is a chapter
 *   > …               a quote (an epigraph when it follows a heading); a "— Name" line keeps its own line
 *   line\             a hard break: the paragraph is verse and keeps its lines
 * Whitespace inside a paragraph is normalised. If the first short line has no closing punctuation
 * it becomes the title.
 */
export function parseText(raw: string, title?: string): { title: string; blocks: Block[] } {
  raw = String(raw || "").replace(/\r\n?/g, "\n").replace(NBSP, " ").trim();
  let parts = raw.split(/\n\s*\n/);
  if (parts.length < 3 && raw.split("\n").length > 4) parts = raw.split("\n");
  const blocks: Block[] = [];
  parts.forEach((p) => {
    const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    if (lines.every((l) => l.startsWith(">"))) {
      const t = joinLines(lines.map((l) => l.replace(/^>\s?/, "").trim()), true);
      if (t) blocks.push({ type: "quote", text: t });
      return;
    }
    if (lines.length > 1 && lines.slice(0, -1).some((l) => /\\$/.test(l))) {
      blocks.push({ type: "verse", text: joinLines(lines, false) });
      return;
    }
    const t = lines.join(" ").replace(/\s{2,}/g, " ").trim();
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) { blocks.push({ type: "h", text: h[2], level: h[1].length as 1 | 2 | 3 }); return; }
    if (t.length < 70 && /^(chapter|part|episode|book)\b/i.test(t) && !/[.,;]$/.test(t)) { blocks.push({ type: "h", text: t, level: 1 }); return; }
    blocks.push({ type: "p", text: t });
  });
  if (!title && blocks.length > 1) {
    const f = blocks[0];
    if ((f.type === "p" || f.type === "h") && f.text.length <= 80 && !/[.!?,;:…"”]$/.test(f.text)) { title = f.text; blocks.shift(); }
  }
  return { title: title || "Untitled", blocks };
}

/** Lines → text. A line ending in "\" breaks; inside a quote an attribution ("— Name") breaks too. */
function joinLines(lines: string[], quote: boolean): string {
  let out = "";
  lines.forEach((l, i) => {
    const s = l.replace(/\s*\\$/, "").replace(/\s{2,}/g, " ");
    if (i) out += (quote && /^[—―]/.test(s)) || /\\$/.test(lines[i - 1]) ? "\n" : " ";
    out += s;
  });
  return out.trim();
}

export function blocksToText(b: Block[]): string {
  return b.map((x) => {
    if (x.type === "h") return "#".repeat(x.level || 1) + " " + x.text;
    if (x.type === "quote") return quoteMd(x.text);
    if (x.type === "verse") return x.text.split("\n").join("\\\n");
    return x.text;
  }).join("\n\n");
}

function quoteMd(text: string): string {
  // A line break inside a quote is either an attribution (kept by itself) or a hard break.
  return text.split("\n").map((l, i, a) => "> " + l + (i < a.length - 1 && !/^[—―]/.test(a[i + 1]) ? "\\" : "")).join("\n");
}

/** Markdown + the title field → title and blocks. A typed title wins; an opening "# Title" that
 *  repeats it is the title itself, not a chapter. */
export function parseDraft(text: string, title: string): { title: string; blocks: Block[] } {
  if (!title) return parseText(text);
  const r = parseText(text, title);
  if (r.blocks[0] && r.blocks[0].type === "h" && r.blocks[0].text === title) r.blocks.shift();
  return r;
}

/** Blocks a picture can follow and a caption can quote: everything but headings. */
export function isProse(b: Block | undefined): boolean {
  return !!b && b.type !== "h";
}

/** One space for every run of whitespace (verse line breaks included), for quoting. */
export function flat(t: string): string {
  return t.replace(/\s+/g, " ");
}
