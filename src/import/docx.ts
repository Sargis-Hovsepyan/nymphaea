// Word (.docx) → Markdown. A .docx is a ZIP; word/document.xml holds the paragraphs. A small
// tokenizer (no DOM, so it runs in tests) reads paragraph styles (Title, Heading 1–3, Quote),
// runs in italic or bold, line breaks and tabs. Footnote references are counted, not moved.
import { decode } from "./html";
import { text, unzip } from "../zip";

export interface DocxResult { markdown: string; title: string; notes: string[] }

/** styleId → style name, from word/styles.xml (localised Word files use ids like "berschrift1"). */
export function styleNames(stylesXml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    const name = (m[2].match(/<w:name\s+w:val="([^"]+)"/) || [])[1];
    if (name) out[m[1]] = name.toLowerCase();
  }
  return out;
}

const on = (rpr: string, tag: string) => {
  const m = rpr.match(new RegExp("<w:" + tag + "(?:\\s+w:val=\"([^\"]*)\")?\\s*/>"));
  return !!m && !/^(0|false|off|none)$/i.test(m[1] || "");
};

export function docxToMarkdown(docXml: string, styles: Record<string, string> = {}): DocxResult {
  const body = (docXml.match(/<w:body>([\s\S]*)<\/w:body>/) || [, docXml])[1] as string;
  const out: string[] = [], notes: string[] = [];
  let title = "", footnotes = 0, styled = 0;
  for (const pm of body.matchAll(/<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    const p = pm[1] || "";
    const sid = (p.match(/<w:pStyle\s+w:val="([^"]+)"/) || [])[1] || "";
    const sname = (styles[sid] || sid).toLowerCase();
    const outline = (p.match(/<w:outlineLvl\s+w:val="(\d)"/) || [])[1];
    let s = "", open = "";
    const setStyle = (want: string) => {
      if (want === open) return;
      if (open) { const tail = (s.match(/\s*$/) || [""])[0]; s = s.slice(0, s.length - tail.length) + open.split("").reverse().join("") + tail; }
      open = want;
      if (want) { styled++; s += want; }
    };
    for (const rm of p.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>|<w:hyperlink\b[^>]*>|<\/w:hyperlink>/g)) {
      const r = rm[1];
      if (r == null) continue;
      const rpr = (r.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [, ""])[1] as string;
      if (/<w:footnoteReference|<w:endnoteReference/.test(r)) { footnotes++; continue; }
      const want = (on(rpr, "b") ? "**" : "") + (on(rpr, "i") ? "*" : "");
      for (const tm of r.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t\s*\/>|<w:(tab|br|cr)\b([^>]*)\/>|<w:noBreakHyphen\s*\/>|<w:softHyphen\s*\/>/g)) {
        if (tm[1] != null) {
          const t = decode(tm[1]);
          if (!t) continue;
          if (t.trim()) setStyle(want);
          s += t;
        } else if (tm[2] === "tab") s += " ";
        else if (tm[2] === "br" || tm[2] === "cr") { if (!/w:type="(page|column)"/.test(tm[3] || "")) { setStyle(""); s += "\\\n"; } }
        else if (/noBreakHyphen/.test(tm[0])) s += "-";
      }
    }
    setStyle("");
    const t = s.replace(/[ \t]+/g, " ").replace(/ ?\\\n ?/g, "\\\n").replace(/^(\\\n)+|(\\\n)+$/g, "").trim();
    if (!t.replace(/[*\\\s]/g, "")) continue;
    const heading = sname === "title" ? 0 : /^heading\s?(\d)$/.test(sname) ? +sname.replace(/\D/g, "") : outline != null ? +outline + 1 : -1;
    const plainT = t.replace(/\\\n/g, " ").replace(/\*+/g, "").trim();
    if (heading === 0) { if (!title) title = plainT; else out.push("# " + plainT); }
    else if (heading > 0) out.push("#".repeat(Math.min(3, heading)) + " " + plainT);
    else if (/quote/.test(sname)) out.push(t.split("\\\n").map((l, i, a) => "> " + l + (i < a.length - 1 ? "\\" : "")).join("\n"));
    else if (t.includes("\\\n")) out.push(t.split("\\\n").join("\\\n"));
    else out.push(t);
  }
  if (styled) notes.push("kept " + styled + " run" + (styled === 1 ? "" : "s") + " of italic or bold");
  if (footnotes) notes.push(footnotes + " footnote mark" + (footnotes === 1 ? "" : "s") + " left out of the text (the notes themselves aren't imported)");
  return { markdown: out.join("\n\n"), title, notes };
}

export async function readDocx(buf: ArrayBuffer): Promise<DocxResult> {
  const z = await unzip(buf);
  const doc = text(z.get("word/document.xml"));
  if (!doc) throw new Error("docx");
  return docxToMarkdown(doc, styleNames(text(z.get("word/styles.xml"))));
}
